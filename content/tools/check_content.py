#!/usr/bin/env python3
"""Check Nexora curated content: schema, cross-references, and every code sample.

Usage:
    python3 content/tools/check_content.py [content_dir]

Needs Python 3.10+ and the `jsonschema` package (pip install jsonschema).
Prints a full log (every command, the code it ran, raw stdout, verdict) and
exits 1 if anything fails. Spec: docs/product/content-format.md.

What it checks
  1. Every *.json under content/<domain>/ validates against
     content/schema/content.schema.json.
  2. Cross-references: lessons and assessment named by the domain exist,
     concept ids and misconception ids resolve, ids are unique, the
     prerequisite graph has no cycle, seed files are draft / approved_by null,
     video slots are empty (D25).
  3. Runs code with `python3 -I`:
     - lesson program: stdout must equal expected_stdout;
     - every predict point with a verify program: stdout must equal the answer;
     - predict_output items: the code's stdout must equal the expected output
       (or the correct choice, and no wrong choice may equal it);
     - write_code / fix_bug items: the reference solution passes every case;
       the buggy code, the starter code and every must_fail answer fail at
       least one case (proves the tests catch the mistake).
  4. Hint leak check: levels 1-2 never contain the expected answer; no hint
     level contains a line that only the reference solution has.
  5. Step names (shown on Next) never contain a pending predict answer.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

TIMEOUT_S = 5
PY = sys.executable or "python3"

HARNESS = r'''
import contextlib, copy, io, json, sys
src_path, cases_path, fn_name = sys.argv[1:4]
src = open(src_path, encoding="utf-8").read()
cases = json.load(open(cases_path, encoding="utf-8"))
ns = {"__name__": "solution"}
sink = io.StringIO()
try:
    with contextlib.redirect_stdout(sink):
        exec(compile(src, "solution.py", "exec"), ns)
except BaseException as e:
    print(json.dumps({"load_error": f"{type(e).__name__}: {e}"}))
    sys.exit(0)
fn = ns.get(fn_name)
if not callable(fn):
    print(json.dumps({"load_error": f"no function named {fn_name}"}))
    sys.exit(0)
out = []
for c in cases:
    args = copy.deepcopy(c["args"])
    before = copy.deepcopy(args)
    rec = {"args": c["args"], "expected": c["expected"], "ok": False}
    try:
        with contextlib.redirect_stdout(sink):
            got = fn(*args)
        try:
            json.dumps(got)
            rec["got"] = got
        except TypeError:
            rec["got"] = repr(got)
        same = got == c["expected"] and isinstance(got, bool) == isinstance(c["expected"], bool)
        if same and c.get("check_args_unchanged") and args != before:
            same = False
            rec["note"] = "argument was changed by the call"
        rec["ok"] = bool(same)
    except BaseException as e:
        rec["error"] = f"{type(e).__name__}: {e}"
    out.append(rec)
print(json.dumps({"results": out}))
'''


class Checker:
    def __init__(self, content_dir: Path):
        self.content_dir = content_dir
        self.schema_path = content_dir / "schema" / "content.schema.json"
        self.fails: list[str] = []
        self.passes = 0
        self.not_run: list[str] = []

    # ---------- logging ----------
    def log(self, line: str = "") -> None:
        print(line, flush=True)

    def ok(self, label: str) -> None:
        self.passes += 1
        self.log(f"RESULT: PASS  {label}")

    def fail(self, label: str, why: str) -> None:
        self.fails.append(f"{label}: {why}")
        self.log(f"RESULT: FAIL  {label} -- {why}")

    # ---------- running code ----------
    def run_code(self, code: str, stdin: str = "") -> dict:
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "sample.py"
            path.write_text(code, encoding="utf-8")
            cmd = [PY, "-I", "-X", "utf8", str(path)]
            shown = f"$ {Path(PY).name} -I -X utf8 sample.py" + (f"  <<< {stdin!r}" if stdin else "")
            self.log(shown)
            for ln in code.rstrip("\n").split("\n"):
                self.log(f"  | {ln}")
            try:
                r = subprocess.run(cmd, input=stdin, capture_output=True, text=True,
                                   timeout=TIMEOUT_S, cwd=d)
                res = {"stdout": r.stdout, "stderr": r.stderr, "rc": r.returncode, "timeout": False}
            except subprocess.TimeoutExpired as e:
                out = e.stdout.decode() if isinstance(e.stdout, bytes) else (e.stdout or "")
                res = {"stdout": out[:200], "stderr": "", "rc": None, "timeout": True}
        self.log(f"  stdout: {res['stdout']!r}")
        if res["timeout"]:
            self.log(f"  exit: TIMEOUT after {TIMEOUT_S}s (killed)")
        else:
            self.log(f"  exit: {res['rc']}")
            if res["stderr"].strip():
                self.log(f"  stderr (last line): {res['stderr'].strip().splitlines()[-1]}")
        return res

    def run_function_tests(self, code: str, fn: str, cases: list) -> dict:
        with tempfile.TemporaryDirectory() as d:
            src = Path(d) / "solution.py"
            src.write_text(code, encoding="utf-8")
            cases_p = Path(d) / "cases.json"
            cases_p.write_text(json.dumps(cases), encoding="utf-8")
            harness = Path(d) / "harness.py"
            harness.write_text(HARNESS, encoding="utf-8")
            cmd = [PY, "-I", "-X", "utf8", str(harness), str(src), str(cases_p), fn]
            self.log(f"$ {Path(PY).name} -I -X utf8 harness.py solution.py cases.json {fn}")
            for ln in code.rstrip("\n").split("\n"):
                self.log(f"  | {ln}")
            try:
                r = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT_S, cwd=d)
                raw = r.stdout.strip()
                self.log(f"  raw: {raw}")
                data = json.loads(raw.splitlines()[-1]) if raw else {"load_error": r.stderr.strip()[-200:]}
            except subprocess.TimeoutExpired:
                self.log(f"  raw: TIMEOUT after {TIMEOUT_S}s (killed)")
                data = {"load_error": "timeout"}
        if "load_error" in data:
            self.log(f"  could not run: {data['load_error']}")
            return {"all_pass": False, "any_fail": True}
        for rec in data["results"]:
            got = rec.get("got", rec.get("error"))
            extra = f" ({rec['note']})" if "note" in rec else ""
            self.log(f"  case {fn}(*{json.dumps(rec['args'])}) -> {json.dumps(got) if 'got' in rec else got}"
                     f" | expected {json.dumps(rec['expected'])} | {'ok' if rec['ok'] else 'WRONG'}{extra}")
        oks = [r["ok"] for r in data["results"]]
        return {"all_pass": all(oks), "any_fail": not all(oks)}

    # ---------- helpers ----------
    @staticmethod
    def norm(s: str) -> str:
        return "\n".join(line.rstrip() for line in s.replace("\r\n", "\n").split("\n")).strip("\n")

    def stdout_outcome(self, code: str, grader: dict, label: str) -> dict:
        all_pass, any_fail = True, False
        for i, case in enumerate(grader["cases"], 1):
            self.log(f"  [case {i}/{len(grader['cases'])}]")
            res = self.run_code(code, case["stdin"])
            got = self.norm(res["stdout"]) if not res["timeout"] else None
            exp = self.norm(case["expected_stdout"])
            good = (not res["timeout"]) and res["rc"] == 0 and got == exp
            self.log(f"  expected: {case['expected_stdout']!r} -> {'match' if good else 'NO MATCH'}")
            all_pass &= good
            any_fail |= not good
        return {"all_pass": all_pass, "any_fail": any_fail}

    def solution_outcome(self, code: str, item: dict, label: str) -> dict:
        g = item["grader"]
        if g["type"] == "stdout":
            return self.stdout_outcome(code, g, label)
        return self.run_function_tests(code, g["function"], g["cases"])

    @staticmethod
    def contains_answer(text: str, answer: str) -> bool:
        a = answer.strip()
        if not a:
            return False
        if re.fullmatch(r"\w+", a):
            return re.search(rf"(?<![\w.]){re.escape(a)}(?![\w])", text) is not None
        return a in text

    # ---------- item checks ----------
    def check_item(self, item: dict, where: str) -> None:
        label = f"{where} item {item['id']} ({item['type']}, {item['leg']})"
        self.log("")
        self.log(f"--- {label}")
        t, g = item["type"], item["grader"]
        if t == "predict_output":
            if g["type"] == "stdout":
                r = self.stdout_outcome(item["code"], g, label)
                self.ok(label) if r["all_pass"] else self.fail(label, "code output differs from expected")
            else:
                res = self.run_code(item["code"])
                got = self.norm(res["stdout"])
                by_key = {c["key"]: self.norm(c["text"]) for c in item["choices"]}
                right = by_key.get(g["answer"])
                wrong_hits = [k for k, v in by_key.items() if k != g["answer"] and v == got]
                self.log(f"  correct choice {g['answer']}: {right!r}; actual: {got!r}")
                if res["rc"] == 0 and right == got and not wrong_hits:
                    self.ok(label)
                else:
                    self.fail(label, f"choice/output mismatch (wrong choices equal to output: {wrong_hits})")
        elif t in ("write_code", "fix_bug"):
            self.log("  >> reference solution (must pass every case)")
            ref = self.solution_outcome(item["reference_solution"], item, label)
            if ref["all_pass"]:
                self.ok(label + " reference passes")
            else:
                self.fail(label + " reference", "reference solution fails a case")
            rejects = []
            if t == "fix_bug":
                rejects.append(("buggy code as given", item["code"]))
            if item.get("starter_code"):
                rejects.append(("starter code untouched", item["starter_code"]))
            for i, mf in enumerate(item.get("must_fail", []), 1):
                rejects.append((f"must_fail #{i}: {mf['why']}", mf["code"]))
            for name, code in rejects:
                self.log(f"  >> {name} (must fail at least one case)")
                r = self.solution_outcome(code, item, label)
                if r["any_fail"]:
                    self.ok(f"{label} rejects {name.split(':')[0]}")
                else:
                    self.fail(f"{label} rejects {name}", "tests did not catch it")
        elif t == "explain":
            n = len(g["criteria"])
            msg = f"{label}: rubric-graded by an LLM ({n} criteria), nothing to run"
            self.log(f"  not run: {msg}")
            self.not_run.append(msg)
        elif t == "multiple_choice":
            if item.get("code"):
                self.log("  (multiple_choice with code: treated as predict)")
            msg = f"{label}: recognition item, answer key {g['answer']}, nothing to run"
            self.log(f"  not run: {msg}")
            self.not_run.append(msg)
        self.check_hint_leaks(item, label)

    def check_hint_leaks(self, item: dict, label: str) -> None:
        hints = item.get("hints")
        if not hints:
            return
        low = " \n ".join(h["text"] for h in hints if h["level"] in (1, 2))
        every = " \n ".join(h["text"] for h in hints)
        problems = []
        g = item["grader"]
        if item["type"] == "predict_output" and g["type"] == "stdout":
            for c in g["cases"]:
                ans = self.norm(c["expected_stdout"])
                if self.contains_answer(low, ans):
                    problems.append(f"level 1-2 hint contains the expected output {ans!r}")
        if g["type"] == "choice":
            right = next(c["text"] for c in item["choices"] if c["key"] == g["answer"])
            if self.contains_answer(low, self.norm(right)):
                problems.append(f"level 1-2 hint contains the correct choice {right!r}")
        if item.get("reference_solution"):
            given = set()
            for src in (item.get("code", ""), item.get("starter_code", "")):
                given |= {ln.strip() for ln in src.split("\n")}
            for ln in item["reference_solution"].split("\n"):
                s = ln.strip()
                if len(s) >= 12 and s not in given and s in every:
                    problems.append(f"a hint contains the solution line {s!r}")
        if problems:
            for p in problems:
                self.fail(label + " hint leak", p)
        else:
            self.ok(label + " hints: no answer in levels 1-2, no solution line in any level")

    # ---------- lesson ----------
    def check_lesson(self, lesson: dict, rel: str, domain: dict | None) -> None:
        self.log("")
        self.log("=" * 78)
        self.log(f"LESSON {rel}  id={lesson['id']}  concept={lesson['concept_id']}  shape={lesson['shape']}")
        self.log("=" * 78)
        prog = lesson["program"]
        label = f"{rel} program"
        self.log(f"--- {label}")
        res = self.run_code(prog["code"], prog.get("stdin", ""))
        if res["rc"] == 0 and self.norm(res["stdout"]) == self.norm(prog["expected_stdout"]):
            self.log(f"  expected: {prog['expected_stdout']!r} -> match")
            self.ok(label)
        else:
            self.fail(label, f"expected {prog['expected_stdout']!r}")

        predicts = []
        for idx, step in enumerate(lesson["steps"]):
            p = step.get("predict")
            if not p:
                continue
            answer_text = p["answer"]
            if p["answer_format"] == "choice":
                answer_text = next((c["text"] for c in p["choices"] if c["key"] == p["answer"]), None)
                if answer_text is None:
                    self.fail(f"{rel} {step['id']}", f"answer key {p['answer']} not among choices")
                    continue
            predicts.append((idx, step, p, answer_text))

        for idx, step, p, answer_text in predicts:
            label = f"{rel} step {step['id']} '{step['name']}' predict {p['id']}"
            self.log("")
            self.log(f"--- {label}")
            self.log(f"  question: {p['question']}")
            self.log(f"  answer: {answer_text!r}")
            if "verify" in p:
                res = self.run_code(p["verify"]["code"])
                got = res["stdout"].strip()
                if res["rc"] == 0 and got == answer_text.strip() and \
                        self.norm(res["stdout"]) == self.norm(p["verify"]["expected_stdout"]):
                    self.ok(label + " (verify output equals the answer)")
                else:
                    self.fail(label, f"verify printed {got!r}, answer is {answer_text!r}")
            else:
                msg = f"{label}: conceptual, not run ({p['verify_note']})"
                self.log(f"  not run: {p['verify_note']}")
                self.not_run.append(msg)

        # Next-label rule: a step name never shows an answer still waiting at or after that step.
        names_ok = True
        for i, step in enumerate(lesson["steps"]):
            for idx, s2, p, ans in predicts:
                if idx >= i and len(ans.strip()) >= 1 and self.contains_answer(step["name"], ans):
                    names_ok = False
                    self.fail(f"{rel} step name '{step['name']}'", f"shows pending answer {ans!r}")
        if names_ok:
            self.ok(f"{rel} step names never show a pending predict answer")

        n_pred = len(predicts)
        n_case = sum(1 for s in lesson["steps"] if s["kind"] == "case")
        if n_pred >= 3 and n_case >= 1:
            self.ok(f"{rel} has {n_pred} predict points and {n_case} case steps (min 3 and 1)")
        else:
            self.fail(f"{rel} structure", f"{n_pred} predict points, {n_case} case steps")

        for leg in ("apply", "explain", "transfer"):
            for item in lesson["checks"][leg]:
                self.check_item(item, rel)
        self.check_item(lesson["misconception_probe"], rel)

    # ---------- main ----------
    def run(self) -> int:
        try:
            import jsonschema
            from jsonschema import Draft202012Validator
        except ImportError:
            self.log("jsonschema is not installed: pip install jsonschema")
            return 2
        from importlib.metadata import version
        self.log(f"python: {sys.version.split()[0]} ({PY})")
        self.log(f"jsonschema: {version('jsonschema')}")
        self.log(f"content dir: {self.content_dir}")

        schema = json.loads(self.schema_path.read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)
        self.log(f"schema {self.schema_path.relative_to(self.content_dir)}: valid Draft 2020-12 schema")
        validator = Draft202012Validator(schema, format_checker=Draft202012Validator.FORMAT_CHECKER)

        files = sorted(p for p in self.content_dir.rglob("*.json")
                       if "schema" not in p.relative_to(self.content_dir).parts)
        self.log("")
        self.log("#" * 78)
        self.log(f"# 1. SCHEMA VALIDATION ({len(files)} files)")
        self.log("#" * 78)
        docs = {}
        for p in files:
            rel = str(p.relative_to(self.content_dir))
            try:
                doc = json.loads(p.read_text(encoding="utf-8"))
            except json.JSONDecodeError as e:
                self.fail(rel, f"not valid JSON: {e}")
                continue
            errors = sorted(validator.iter_errors(doc), key=lambda e: list(e.path))
            if errors:
                for e in errors[:10]:
                    self.fail(rel, f"schema: {'/'.join(map(str, e.path))}: {e.message[:300]}")
            else:
                self.ok(f"{rel} valid against content.schema.json (kind={doc.get('kind')})")
            docs[rel] = doc

        self.log("")
        self.log("#" * 78)
        self.log("# 2. CROSS-REFERENCES")
        self.log("#" * 78)
        domains = {rel: d for rel, d in docs.items() if d.get("kind") == "domain"}
        for drel, dom in domains.items():
            base = Path(drel).parent
            concept_ids = {c["id"] for c in dom["concepts"]}
            misc_ids = {m["id"] for c in dom["concepts"] for m in c["misconceptions"]}
            for c in dom["concepts"]:
                for m in c["misconceptions"]:
                    if not m["id"].startswith(c["id"] + ":"):
                        self.fail(drel, f"misconception {m['id']} not prefixed by its concept {c['id']}")
                for pre in c["prerequisites"]:
                    if pre not in concept_ids:
                        self.fail(drel, f"{c['id']} needs unknown concept {pre}")
            # cycle check
            graph = {c["id"]: c["prerequisites"] for c in dom["concepts"]}
            state: dict[str, int] = {}

            def visit(n: str) -> bool:
                if state.get(n) == 1:
                    return False
                if state.get(n) == 2:
                    return True
                state[n] = 1
                good = all(visit(m) for m in graph.get(n, []))
                state[n] = 2
                return good
            if all(visit(n) for n in graph):
                self.ok(f"{drel} prerequisite graph has no cycle ({len(graph)} concepts)")
            else:
                self.fail(drel, "prerequisite graph has a cycle")

            all_ids: dict[str, str] = {}
            seen_files = set()
            for c in dom["concepts"]:
                lrel = str(base / c["lesson_file"])
                seen_files.add(lrel)
                lesson = docs.get(lrel)
                if lesson is None:
                    self.fail(drel, f"lesson file {lrel} missing")
                    continue
                if lesson.get("concept_id") != c["id"]:
                    self.fail(lrel, f"concept_id {lesson.get('concept_id')} != domain entry {c['id']}")
                    continue
                items = [i for leg in ("apply", "explain", "transfer") for i in lesson["checks"][leg]]
                items.append(lesson["misconception_probe"])
                refs = []
                for i in items:
                    if i["concept_id"] != c["id"]:
                        self.fail(lrel, f"item {i['id']} has concept {i['concept_id']}")
                    refs += i.get("misconception_ids", [])
                    refs += [ch["misconception_id"] for ch in i.get("choices", []) if "misconception_id" in ch]
                    refs += [m["misconception_id"] for m in i.get("must_fail", []) if "misconception_id" in m]
                for s in lesson["steps"]:
                    p = s.get("predict")
                    if p:
                        refs += p.get("misconception_ids", [])
                        refs += [ch["misconception_id"] for ch in p.get("choices", []) if "misconception_id" in ch]
                        items.append({"id": p["id"]})
                for r in refs:
                    if r not in misc_ids:
                        self.fail(lrel, f"unknown misconception id {r}")
                for i in items:
                    if i["id"] in all_ids:
                        self.fail(lrel, f"duplicate id {i['id']} (also in {all_ids[i['id']]})")
                    all_ids[i["id"]] = lrel
                step_ids = [s["id"] for s in lesson["steps"]]
                if len(step_ids) != len(set(step_ids)):
                    self.fail(lrel, "duplicate step ids")
                self.ok(f"{lrel} matches domain entry {c['id']}; {len(refs)} misconception refs resolve")
            arel = str(base / dom["assessment_file"])
            assess = docs.get(arel)
            if assess is None or assess.get("kind") != "assessment":
                self.fail(drel, f"assessment file {arel} missing")
            else:
                seen_files.add(arel)
                covered = {i["concept_id"] for i in assess["items"]}
                for i in assess["items"]:
                    if i["concept_id"] not in concept_ids:
                        self.fail(arel, f"item {i['id']} unknown concept {i['concept_id']}")
                    for r in i.get("misconception_ids", []) + \
                            [ch["misconception_id"] for ch in i.get("choices", []) if "misconception_id" in ch]:
                        if r not in misc_ids:
                            self.fail(arel, f"unknown misconception id {r}")
                    if i["id"] in all_ids:
                        self.fail(arel, f"duplicate id {i['id']}")
                    all_ids[i["id"]] = arel
                missing = concept_ids - covered
                if missing:
                    self.fail(arel, f"no placement item for {sorted(missing)}")
                if len(assess["items"]) < assess["policy"]["max_items"]:
                    self.fail(arel, "fewer items in the pool than max_items")
                self.ok(f"{arel}: {len(assess['items'])} items in pool, every concept covered, "
                        f"max {assess['policy']['max_items']} asked")
            for rel in docs:
                if rel.startswith(str(base) + "/") and rel not in seen_files and rel != drel:
                    self.fail(rel, "file not referenced by the domain")

        for rel, d in docs.items():
            if d.get("status") != "draft" or d.get("approved_by") is not None:
                self.fail(rel, "seed content must be status draft with approved_by null (D23)")
        self.ok(f"all {len(docs)} files are status=draft, approved_by=null (D23: a person approves before learners see it)")
        lessons = [(rel, d) for rel, d in docs.items() if d.get("kind") == "lesson"]
        if all(d["video"] is None for _, d in lessons):
            self.ok(f"all {len(lessons)} lessons have an empty video slot (D25: a person attaches videos)")
        else:
            self.fail("video", "a seed lesson has a video filled in")

        self.log("")
        self.log("#" * 78)
        self.log("# 3. RUN EVERY CODE SAMPLE, TEST CASE AND HINT CHECK")
        self.log("#" * 78)
        for rel, d in sorted(lessons):
            self.check_lesson(d, rel, None)
        for rel, d in sorted(docs.items()):
            if d.get("kind") != "assessment":
                continue
            self.log("")
            self.log("=" * 78)
            self.log(f"ASSESSMENT {rel}  id={d['id']}  items={len(d['items'])}")
            self.log("=" * 78)
            for item in d["items"]:
                self.check_item(item, rel)

        self.log("")
        self.log("#" * 78)
        self.log("# SUMMARY")
        self.log("#" * 78)
        self.log(f"passed checks: {self.passes}")
        self.log(f"failed checks: {len(self.fails)}")
        for f in self.fails:
            self.log(f"  FAIL {f}")
        self.log(f"not run (no code to run): {len(self.not_run)}")
        for n in self.not_run:
            self.log(f"  - {n}")
        self.log("OVERALL: " + ("PASS" if not self.fails else "FAIL"))
        return 0 if not self.fails else 1


def main() -> int:
    here = Path(__file__).resolve().parent.parent
    content_dir = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else here
    return Checker(content_dir).run()


if __name__ == "__main__":
    sys.exit(main())
