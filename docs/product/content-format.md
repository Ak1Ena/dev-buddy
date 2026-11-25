# Nexora content format v1.0

Status: draft for Nova/Aki. Author: Sage. Date: 2026-11-25.
This spec covers curated, versioned learning content: domains, lessons, checks, hints and placement assessments.
It is domain-neutral. The first seed is Python fundamentals (`content/python-fundamentals/`, D4).
"Assumption" marks a choice made without data from Nexora's own learners.

## Files

```
content/
  schema/content.schema.json        JSON Schema (Draft 2020-12) for every content file
  tools/check_content.py            checker: schema, cross-refs, runs every code sample
  <domain>/
    domain.json                     concept map: concepts, prerequisites, misconceptions, file list
    lessons/NN-<concept>.json       one lesson per concept, with its checks and hints
    assessment/placement.json       placement assessment (item pool + policy)
```

- The format is JSON, not YAML. It needs no extra parser, and both backend and frontend can read it directly.
- Every file starts with the same header: `schema_version`, `kind` (domain | lesson | assessment), `id`, `version`, `status`, `authored_by`, `approved_by`, `approved_at`, `content_language`, and optionally `notes_for_reviewer`.
- Ids look like this:
  - concepts: `python.loops`
  - misconceptions: `python.loops:range-off-by-one` (the prefix must be the concept id)
  - items: `python.loops.apply-1`
  - predict points: `python.loops.s5.p`
  - Ids are unique across a domain.
- Adding a domain means adding a folder plus a `domain.json`, with no code change. The only language-specific part is `language` (today only `python`) and how the sandbox runs it.

## Approval and versioning (D23, D25)

- `status` is one of `draft`, `in_review`, `approved` or `retired`. The schema enforces these rules:
  - `approved` requires `approved_by`.
  - `draft` and `in_review` must have `approved_by` and `approved_at` set to null.
- Every seed file is `draft`, `approved_by: null`, and `authored_by: "ai-draft: Sage ..."`. Learners only see `approved` content. The loader filters on this; it is not built yet.
- `version` goes up on any change a learner would notice. Evidence records should store `(item id, content version)`, so old evidence stays explainable after an edit. That is a suggestion for the evidence store, not yet decided.
- `video` is always null in seed content (D25: no AI-picked videos). A person fills it with `{url, attached_by, transcript, captions_url, duration_seconds, step_id?}`.

## Lesson

| Field | Meaning |
|---|---|
| `concept_id` | The one concept this lesson teaches. |
| `shape` | One of `story-trace`, `syntax-drill`, `debugging-hunt`, `design-exercise` or `video-led` (D22). The seed uses story-trace for 7 lessons and debugging-hunt for debugging. |
| `story` | `{person, place, text}`: one real-world story, 2-3 sentences, with a named person and place. It must not give away a predict answer. |
| `program` | The program the steps trace, plus its `expected_stdout` (and optional `stdin`). The checker runs it. |
| `metric_labels` | Optional counters shown beside the code (for example Checks, Matches), set per step in `metrics`. |
| `steps` | 4-10 steps. `kind` is one of `story`, `trace`, `case`, `hunt` or `recap`. `name` (40 characters max) is the Next-button label and never contains an answer still waiting. A `case` step changes one thing; it needs a `predict` and a `what_changed` line. A step can have its own `code` (for example a variant) or point at `focus_lines` of the program. |
| `predict` | `{question, answer_format: choice/short_text/number, choices?, answer, accept?, reveal, misconception_ids?}`, plus exactly one of `verify {code, expected_stdout}` (the checker runs it, and its output must equal the answer) or `verify_note` (a conceptual question, explained). |
| `recap` | Exactly 3 sentences. |
| `checks` | `apply`, `explain` and `transfer`, each with at least one item. |
| `misconception_probe` | One item with `leg: probe`, aimed at a catalogued misconception. |

The checker requires at least 3 predict points and at least 1 case step per lesson.

`verify.code` is for the checker and the replay engine only. It may use constructs the learner hasn't met (`try/except`, `break` as a stop, `global`), so it is not meant to be shown as lesson code.

## Items (checks, probes, placement)

`type`, `grader` and required fields:

| type | grader | needs |
|---|---|---|
| `predict_output` | `stdout` (typed answer) or `choice` | `code` |
| `write_code` | `stdout` (stdin cases) or `function_tests` | `reference_solution`, usually `starter_code` |
| `fix_bug` | `stdout` or `function_tests` | `code` (the buggy program), `reference_solution` |
| `explain` | `rubric` (`criteria` ≥2, `pass_rule: all`, `reference_answer`) | n/a |
| `multiple_choice` | `choice` | `choices` |

Graders:
- `stdout`: each case is `{stdin, expected_stdout}`. Comparison ignores trailing spaces and blank lines at the ends. The program must exit 0.
- `function_tests`: each case is `{args, expected, check_args_unchanged?}`. The function is called with a deep copy of `args`. `True` does not count as `1`. `check_args_unchanged` fails the case if the call changed its arguments (used for aliasing bugs).
- `choice`: one answer key. A choice can carry a `misconception_id`, so a wrong pick becomes misconception evidence.
- `rubric`: graded by an LLM against all criteria. The grade is stored with the rubric and model, and it can never be the only evidence for a concept (first-domain.md).

**Server-only fields:** `reference_solution`, `must_fail`, rubric `reference_answer`, `choice.answer`, `predict.answer` and `accept`. None of these goes to the client before the learner commits an answer, and none goes into the mentor prompt. The mentor gets the item prompt, the learner's code and the hint text for the current level.

`must_fail` lists wrong answers (with `why` and an optional `misconception_id`) that the tests must reject. The checker proves this. It also proves that the buggy code and the untouched starter code fail. This is why many lessons before the functions lesson use stdin with several cases: hardcoding one printed answer does not pass.

### Hints

- Every non-placement item has exactly 3 hints, at levels 1, 2 and 3. Level 0 is the mentor's own Socratic question and is not stored.
- Level 1 is a question that points at where to look.
- Level 2 narrows it down to the exact idea or line, but still contains no answer.
- Level 3 is a guided example in a different context, which the learner maps back to their own problem. It earns no credit (first-domain.md, D24).
- The checker fails a level 1-2 hint that contains the expected output or the correct choice. It fails any hint that contains a line of the reference solution (12+ characters) not already in the given code.

### Evidence legs and points

- `leg` is one of `apply`, `explain`, `transfer`, `probe` or `placement`.
- A concept becomes `verified` after apply + explain + transfer, each at hint level 1 or below, with at least 2 of the 3 graded deterministically (first-domain.md, D10). In the seed, every lesson's apply and transfer items run code, and explain is rubric-graded.
- A `probe` or `multiple_choice` result counts only as `assumed` evidence or as a misconception flag, never as verified.
- Content files carry no points. Points are awarded once, when a concept turns verified (D20/D24), by the evidence service, not by content.

## Placement assessment

- `policy` holds `max_items`, `time_limit_minutes`, `start_concepts`, `adaptive_rule`, `stop_rule`, `mentor: off`, `evidence_verified: false`, `output_states` (assumed_known / assumed_gap / unknown) and `shows_score: false`.
- `profile_questions` are unscored (`scored: false`). They shape tone and the first lesson, never mastery.
- `items` all have `leg: placement` and no hints. The pool is bigger than `max_items`, so the adaptive rule has room to choose. Items reused from the old bank (`backend/app/agents/assessment_agent.py`) say so in `source`.
- Seed: 15 items, at most 10 asked, 15 minutes, starting at conditionals and loops (first-domain.md). The thresholds are assumptions.

## The checker

```
python3 -m venv /tmp/v && /tmp/v/bin/pip install jsonschema
/tmp/v/bin/python content/tools/check_content.py        # exit 0 = all pass
```

- Code runs with `python3 -I -X utf8` in a temp folder with a 5-second timeout. This is a check for authors, not a learner sandbox (that is an architecture decision, first-domain.md Q4).
- The log prints every command, the code it ran, the raw stdout, the exit code and the verdict. Explain items are listed as "not run", and so are the conceptual predicts.
- Evidence for the seed is in `docs/m2-evidence/seed-content-check.log`.
- The M2 loader should validate files against the same schema (`jsonschema` dependency) and refuse to serve anything that isn't `approved`.

## Open questions (for Nova / Aki)

1. **Content language.** The seed is English only (`content_language: en`). Should Thai be a separate file per language, or translated fields inside one file?
2. **Who approves (D23)?** The schema has `approved_by`, but no reviewer role or flow is defined yet.
3. **What hint level 3 is.** Content treats level 3 as a guided example in a different context. The mentor code header says "worked example", while its prompt says "similar pattern in a different context". The two need to agree.
4. **Stdin graders before functions.** Lessons 1-5 and 7 grade with stdin/stdout, because functions come later in the graph. Is that acceptable for the sandbox, or should every apply item use function tests (which would mean reordering concepts)?
5. **Added misconceptions.** I added `python.lists:index-starts-at-one` and `python.functions:local-visible-outside`, which are beyond first-domain.md. Keep them?
6. **Topic.** Python fundamentals is a default, because Aki's own current topic wasn't stated. Swapping in another domain should need only new content, with no format change.
