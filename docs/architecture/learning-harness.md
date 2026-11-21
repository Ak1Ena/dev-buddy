# Learning Harness: design (adapting the Hermes harness)

Status: proposal for Aki / Nova. Author: Arjun. Date: 2026-11-22. Design only, nothing built.
Pedagogy side (thresholds, skill catalogue, challenge design): Sage, `docs/product/learning-harness-pedagogy.md` (not on disk when I wrote this; see Open questions 1).
Hermes paths are relative to `~/.hermes/hermes-agent`, commit `f6c3eb1a79`.

**Short version.** Hermes gives us three good ideas: small bounded memory, skills as procedural memory that loads only when relevant, and a restricted background "reflection" fork that can only touch memory and skills. We keep the shapes and change what they hold. Hermes memory is free text about a user. Ours is structured evidence about learning. Hermes' guards are opt-in and its skill edits go live right away. Ours are on by default, and nothing auto-generated goes live without tests and approval.

## 1. What Hermes does (evidence)

| Part | What it does | Evidence |
|---|---|---|
| Declarative memory | Two small stores: `memory` (notes) and `user` (profile). Entries are free text joined by `§`. | `tools/memory_tool_store.py:26`, `:23-24` |
| Char budget | Defaults 2200 / 1375 chars, configurable. Usage `%` is shown in the prompt block. | `tools/memory_tool.py:56`, `memory_tool_store.py:188`, `:675-681` |
| Consolidation | An add over budget is rejected and the live entries come back. The model must resend ONE atomic batch (remove/patch + add). Limit is checked on the batch result. At most 3 failed attempts per turn, then a terminal "save skipped". | `memory_tool_store.py:332-340`, `:186`; schema text `memory_tool.py:373-390` |
| What goes in memory | Only facts true for every session. Task lessons go to skills. Task progress and TODOs are explicitly excluded (use session search). | `memory_tool.py:384-390` |
| Prompt use | Memory is a frozen snapshot taken at load, not live state. Recalled context is fenced and labelled "not new user input". | `memory_tool_store.py:177-180`, `:655-658`; `agent/memory_context.py:170-183` |
| Memory write guards | Injection/exfil scan on every entry ("a poisoned entry persists across sessions"). Duplicate entries refused. | `memory_tool_store.py:29-32`, `:403-418` |
| Grounding rule | Reviewer may save only facts grounded in a user message or tool result. Never infer traits or skill level from topic or tone. Never turn a one-off request into a standing preference. | `agent/background_review.py:459-465` |
| Skills = procedural memory | A skill is a directory with `SKILL.md` (frontmatter + instructions) plus `references/ templates/ scripts/`. | `tools/skills_tool.py:1-5` |
| Loaded only when relevant | `skills_list` returns name + description only. `skill_view` loads the full body on demand. The prompt index clips descriptions to 60 chars, and `skill_manage` rejects longer ones. | `skills_tool.py:1-5`, `agent/skill_utils.py:843-846` |
| `skill_manage` | create / patch / edit / write_file / remove_file / delete. Patch (targeted find/replace) is preferred over full rewrite. Size, name and frontmatter checks. | `tools/skill_manager_tool.py:468-506`, `:523-575`, `:105-112`, `:143`, `:842-857` |
| Reflection | Counters trigger a background review: every 10 user turns (memory) and 10 tool iterations (skills). The review is a fork of the agent that replays the conversation with a review prompt. | `agent/agent_init.py:1143`, `:1219-1221`; `agent/turn_context.py:819-826`; `agent/review_signals.py:33-40`; `agent/background_review.py:1286-1348` |
| What reflection looks for | Prompt: user corrections, workflow corrections, non-trivial techniques, and a loaded skill that turned out wrong. Prefer patching a loaded skill, then an umbrella skill, then a support file, then a new class-level skill. Write rules plus one clause of why, no incident narration. | `background_review.py:477-505`, `:532-603` |
| What it must NOT save | Environment-dependent failures, negative claims about tools, transient errors, one-off tasks, and unresolved failures dressed up as "best practice". | `background_review.py:507-530` |
| Session search | SQLite FTS5 over past conversations. No LLM call. Dedup by session lineage, cron sessions demoted, per-message read cap of 2000 chars. | `tools/session_search_tool.py:1-8`, `:39`, `:47`, `:50` |
| Guard: fork scope | The reflection fork has a dispatch-side tool whitelist (memory + skills + read-only file tools). Its own nudges are zeroed so it cannot recurse. | `background_review.py:1212-1253`, `:1105` |
| Guard: read before write | The fork may not patch a skill it has not loaded in this review. Inferring from the transcript is refused. | `tools/skill_manager_guards.py:213-224` |
| Guard: no unattended deletes | In the fork, memory `patch`/`remove` is staged for approval, not applied. Skill delete is refused unless the skill is agent-created and not pinned. Locked skills refuse every write. | `memory_tool.py:179-221`; `skill_manager_guards.py:166-210`, `:226-254` |
| Guard: security scan | Agent-created skills are scanned after write. A blocked scan restores the original file. Policy for `agent-created`: dangerous = "ask". | `skill_manager_tool.py:404-430`, `tools/skills_guard.py:36-41` |
| Guard: write approval | Optional gate: writes are staged in `pending/{memory,skills}/` for human review instead of applied. | `tools/write_approval.py:1-12`, `:77`, `:204-219` |
| Guard: ledger + curator | Every skill mutation is ledgered with actor, so it can be reverted. The curator only archives, never deletes, and never ages out a young never-used skill. | `tools/skill_ledger.py:298`, `:501`; `agent/curator.py:1-8`, `:198-249` |
| Linter | Warns on marketing words, incident-log shape, oversized body, forbidden files. | `tools/skill_linter.py:26-56` |

**What Hermes does NOT do (honest gaps for our purpose):**
- The security scan and the write-approval gate are **off by default** (`skills.guard_agent_created` default False at `skill_manager_tool.py:44-50`; `write_approval` default false at `write_approval.py:7-9`). The scan is always on only inside the background fork (`skill_manager_tool.py:53-56`). A foreground skill write goes live immediately.
- There is **no test of whether an edited skill works better**. Checks are structural (lint, size, scan), not behavioural. I found nothing in `evals/` for skill or memory quality (listing only; I did not read every eval).
- Memory has **no evidence, no provenance, no confidence**. It is text the model decided to write.
- Success is the agent's task outcome. Nothing measures whether a human learned anything.

## 2. Mapping onto the Nexora loop

Rule of thumb: the loop itself is deterministic code. The LLM is called inside steps, behind the AI gateway, and its output is a proposal that code validates.

| Step | Hermes analogue | Copy | Change | Drop |
|---|---|---|---|---|
| **Observe** | Session DB of messages | Append-only raw log of what happened | Record structured events (answer, code run result, hints used, time, explain-back), not just chat. Raw events become `evidence` rows. | Chat-text recall as the source of truth |
| **Understand** | Memory write by the model, grounded rule | The grounding rule: only record what the learner actually did or said | Update `knowledge_state` by code from evidence (section 3). The LLM may tag a misconception or rate an explanation. Its tag is low-weight evidence, never a mastery verdict. | Model-written free-text profile |
| **Plan** | `skills_list` -> `skill_view` (progressive disclosure) | Pick a teaching skill by short descriptor, load the body only when chosen | Planner chooses the next action (explain / challenge / review / assess) with deterministic rules over knowledge state. One wrong answer never rewrites the path. Skill choice is by situation tags first, LLM second. | LLM free choice of everything |
| **Teach** | Agent turn with fenced memory block | Fenced, labelled, size-bounded context pack; frozen for the turn | Pack = learner snapshot for this concept + selected skill body + lesson content. Hard rules (never give the direct answer, hint levels 0-3 in `socratic_mentor.py`) stay in code, not in skills. | Whole-memory injection every turn |
| **Challenge** | none | n/a | New. Pick a check from the Interactive engine that proves the concept without a hint: transfer variant, explain-back, debug task. Prefer checks Nexora can run itself (execute code). | n/a |
| **Evaluate** | none (task success is judged by the user) | n/a | New. Turn the result into an `evidence` row with `verified` set by how it was checked (section 3). | n/a |
| **Reflect** | Background review fork on a counter | Fork with a tiny whitelist, no recursion, read-before-write, stage don't apply, "nothing to save" is allowed | Two reflections: (a) **per learner**, cheap and mostly deterministic: update that learner's strategy stats; (b) **system**, offline and batched: propose skill drafts from aggregated, de-identified outcomes (section 5). Trigger on session end or N evidence rows, not on iteration counts. | Auto-apply of any skill edit; curator auto-consolidation |

Also dropped: prompt-cache-driven design (we do not control provider caching under BYOAI), the 2200-char budget as such (we use a token budget per provider, see open questions), and Hermes' terminal/file tools in the fork.

## 3. Learner memory and the knowledge state

Five categories as in the brief, but **one source of truth: an append-only evidence log**. Everything about "what the learner knows" is derived from it and can be rebuilt.

| Category | What it holds | Kind |
|---|---|---|
| Profile | Goals, self-reported level, preferences, language | Declarative, small, editable by the learner. All of it counts as *assumed*. |
| Experience | Raw attempts: exercise, answer, code, run output, hints used, time | Append-only event log |
| Knowledge | `evidence` rows (interpreted events) and `knowledge_state` (derived per learner x concept) | Evidence is append-only. State is a rebuildable view. |
| Strategy | Per learner: which teaching skill versions helped or did not, in which situations | Derived, personal (see section 5) |
| Project | Projects, skills shown, challenges met, links to evidence | Declarative + links |

Evidence record (extends the brief's illustration; not a final schema; concept ids match Sage's `python.*` list in `docs/product/first-domain.md`):

```json
{"id":"ev_...","learner_id":"user_001","concept_id":"python.loops",
 "evidence_type":"problem_solving",           // recall | explain | apply | debug | transfer | self_report
 "result":"partial_success",                  // success | partial_success | fail
 "observed_misconception":"off_by_one_range",
 "source":"interactive_exercise",
 "check":"executed_tests",                    // executed_tests | rubric_llm | multiple_choice | self_report | chat_claim
 "verified":true,
 "independence":{"hint_level":1},
 "context":{"lesson_id":"...","task_variant":"v2","skill_version":"socratic@3"},
 "created_at":"2026-11-22T10:00:00Z"}
```

**`verified` rule:** true only when Nexora controlled the check (`executed_tests`, a structured exercise, or a rubric-scored explain-back). `self_report` and `chat_claim` are always false. An LLM's opinion of a chat answer is never `verified` by itself.

**Knowledge state per learner x concept** (derived by code):

| State | Meaning |
|---|---|
| `unseen` | No evidence |
| `assumed` | Only self-report, placement, or inference from prerequisites. Never counts as mastery. |
| `in_progress` | Some verified evidence, not enough |
| `verified` | Enough independent verified evidence (rule below) |
| `retained` | Verified, then a fresh variant passed unhinted later (Sage's spacing rule) |
| `needs_review` | Was verified, later failed a check or aged out |

State names aligned by Nova (2026-11-22) to Sage's `docs/product/first-domain.md`, which is canonical for states and thresholds. Arjun's draft used `unknown` / `emerging`.

Proposed default rule for `verified` (numbers are placeholders for Sage to set, see Open questions 2):
- at least 3 verified success rows, at least 2 different `evidence_type`, at least 2 different `task_variant`;
- at least one of them on a different day from the first (retention);
- the successes were at hint level <= 1;
- one failure does not erase `verified`: it moves to `needs_review` and schedules a check. Misconception rows stay visible until a later verified success on the same concept without that misconception.

Consequences the brief asks for: one quiz or one good chat answer cannot reach `verified`; assumed and verified are different states and the UI/planner must show them differently; the planner reads state plus confidence, never a single score.

Memory budget (Hermes lesson, kept): the Teach step gets a **bounded pack** per concept (current state, top misconceptions, last 3 evidence rows, chosen skill), not the whole memory. Size is a token budget per provider, set in the gateway.

## 4. Teaching skills: versioned procedural memory

Shape follows the brief (purpose, situations, inputs, instructions, expected outcomes, limitations, evaluation criteria, version) in the Hermes style: a short descriptor always visible to the planner, the full body loaded only when selected (`skills_tool.py:1-5`).

Lifecycle: **draft -> tested -> promoted**, plus `retired`.

```
author or reflection job -> draft v(n+1)
  G0 structure     lint: required sections, size limit, descriptor length          (Hermes: skill_manager_tool.py:143, skill_linter.py)
  G1 safety        no learner data, no answer-giving instructions, injection scan  (Hermes: skills_guard.py:36-41)
  -> tested  (G2) replay on a fixed scenario set; must not regress vs the promoted version; run on >= 2 providers incl. a small/local model   [NEW, Hermes has no equivalent]
  -> approved (G3) a human reviews the diff and the test report                   (Hermes: write_approval.py pending store, but opt-in)
  -> promoted (G4) canary to a slice of sessions, then default; rollback = move a pointer
```

Rules:
1. **Versions are immutable.** `promoted` is a pointer from skill name to a version. Production only loads promoted versions. Draft and tested versions load only in the test harness or canary. Rollback is a pointer change (Hermes ledger idea, `skill_ledger.py:501`).
2. **Nothing generated skips a gate.** `origin: generated` can never reach `promoted` without G2 and G3. Hermes' foreground write path has no such rule (see gaps above), so we invert its defaults: gates on, no flag to turn them off in production.
3. **Reflection writes drafts only.** It uses the Hermes fork pattern: tiny tool whitelist (read skills, create draft), must load the current version before proposing a patch (`skill_manager_guards.py:213-224`), may answer "no change", and never touches promoted versions or deletes anything (`background_review.py:598`).
4. **Core rules are code, not skills.** "Never give direct code answers", hint levels, safety and auth are not patchable by any skill or reflection. A skill can only choose among behaviours the code allows. This follows the brief: AI must not silently change core learning logic.
5. **Hermes' lessons for skill text carry over:** write rules plus a reason, no incident narration, no learner quotes, one rule per lesson, don't save unresolved failures as advice (`background_review.py:477-530`).
6. **Pin/lock** a version to freeze it against all automation (`skill_manager_guards.py:226-254`).
7. **Test evidence is the learner outcome, not the AI's output.** Offline G2 uses scripted learner scenarios and checks that the skill leads to the intended behaviour (no early answer, a misconception named, a check offered). Canary promotion uses outcome metrics from the brief (verified-mastery progression, retention, independent problem solving), not session length or satisfaction.

## 5. Two objectives, two data domains

Hermes improves the agent. Nexora improves the teaching system **and** the human. These need different data with a one-way flow between them.

| | Personal domain | Strategy domain |
|---|---|---|
| Holds | Profile, experience, evidence, knowledge state, per-learner strategy stats, projects | Teaching skills (versions, tests, approvals) + aggregate outcome stats per skill version and situation tag |
| Keyed by | `learner_id` | `skill_version`, `situation_tag` |
| Contains learner text or code | Yes | **Never** |
| Read by | That learner's Teach/Plan, the learner themselves | The Plan step (to pick skills), the offline skill-improvement job, maintainers |
| Delete / export | Learner can export and delete everything. Delete cascades through all personal tables. | Nothing personal to delete, by construction |

Flow: personal -> strategy only through an **aggregation step** that writes rows like `(skill_version, situation_tag, outcome_class, hint_bucket, count)`. No `learner_id`, no free text, and cells below a minimum learner count are not published. Strategy -> personal is read-only (a learner's own strategy stats may reference `skill_version` ids).

Why it matters: the system-level reflection job only ever sees the strategy domain (plus synthetic scenarios). It cannot leak a learner's code into a reusable skill, and a learner deleting their account does not need to rewrite any skill. G1 rejects drafts that contain anything resembling learner data.

Per-learner adaptation ("this learner responds to analogies") is personal data. It lives in their Strategy memory and changes only how that learner's session is planned, not the shared skills.

## 6. Where it sits (modular monolith, no new services)

All of it is modules inside the existing FastAPI app. Existing code to build on: `backend/app/services/llm/` (`LLMProvider.complete/stream` in `base.py:5-17`, `get_llm_provider()` in `factory.py:6`), `agents/socratic_mentor.py` (hint levels), and the seeds of evidence in `models/analytics.py` (`HintUsageEvent`, `SkillProgression.weak_areas`).

| Module | Owns | Notes |
|---|---|---|
| `learning/harness` | The loop, step orchestration, action policy | Deterministic. No provider imports. |
| `memory` | Evidence log, knowledge state, bounded context pack, export/delete | The only writer of personal tables |
| `teaching_skills` | Registry, versions, lint/safety/test gates, promotion pointer, aggregate outcome stats | The only writer of strategy tables |
| `ai_gateway` | Provider interface, structured output, capability flags, fallback, usage | Grows from `services/llm`. The harness calls only this. |
| `mentor`, `evaluation`, `interactive` | Existing/planned engines the harness calls | Interactive checks must work without an LLM |

Design notes:
- **Provider independence.** The harness asks the gateway for "structured JSON for this schema". If a provider lacks tool calling or JSON mode, the gateway validates and retries, and if it still fails the harness falls back to deterministic behaviour (no new evidence tag from the LLM that turn). Capabilities are exposed, not assumed.
- **Who pays for reflection.** Per-learner steps run on the learner's chosen provider (BYOAI or managed). System-level skill drafting runs on a Nexora-controlled model over aggregates only, so BYOAI users never pay for it.
- **Background work** = a small DB-backed job table and an in-process worker (FastAPI background tasks to start). No broker, no separate service.
- **Storage.** SQLite dev, PostgreSQL prod (per `CLAUDE.md`). Evidence is append-only. Knowledge state is recomputed from it, so a rule change is a rebuild, not a migration.
- **Audit.** Each Plan decision stores the inputs it used (evidence ids, skill version) so "why did it do that" is answerable.
- **Migration path.** (1) Add the evidence table and write rows from existing assessment, hint and workshop events. Treat old `weak_areas` as `assumed`, not verified. (2) Compute knowledge state, read-only, and compare with the current behaviour. (3) Let Plan use it. (4) Move the existing mentor prompt into a v1 teaching skill. (5) Add gates G0-G3, then reflection drafts. Each step ships alone and is reversible.

## 7. Risks and trade-offs

| Risk | Choice |
|---|---|
| Mastery rule too strict -> learners stuck; too loose -> false "verified" | Start strict with placeholder numbers, review against real data; the rule is code over rebuildable state, so changing it is cheap |
| Few users -> canary has no statistical power | Rely on G2 + G3 early; canary is a safety net, not proof. Do not auto-promote on small samples |
| LLM judging explanations is noisy | Judged evidence is low weight and never alone makes `verified`; prefer executable checks (first domain is Python, so most checks can run code) |
| Reflection over-fits to a few learners | Draft only, minimum counts, human approval |
| More moving parts than the current app | One module at a time, each useful without the next; no new infrastructure |

Recommended option: the design above (evidence log + derived state + gated skill registry in the monolith). Rejected: letting a Hermes-style fork write skills directly (violates the brief), and storing knowledge as free text in memory (cannot separate assumed from verified).

## 8. Open questions (not decided here)

1. **Pedagogy doc.** `docs/product/learning-harness-pedagogy.md` did not exist when I wrote this, so consistency is unchecked. I assumed Sage owns: thresholds, the skill catalogue, challenge design, review timing. Sage should confirm the state names and the rule in section 3.
2. **Mastery thresholds** (count, distinct types and variants, retention gap, hint ceiling): placeholders above. Need Sage's evidence and real data.
3. **Concept source.** Curated taxonomy only, or AI-extended? Sage's eight `python.*` ids are the only list so far.
4. **Who approves skill promotion** (G3) and how big a canary can be with so few users? Suggest Aki alone for now.
5. **Consent and minimum cell size** for contributing de-identified outcomes to the strategy domain. Opt-in or opt-out? What minimum learner count per cell?
6. **Who pays for system-level drafting** and which model. I assumed a Nexora-managed model over aggregates only.
7. **LLM-judged evidence:** which provider judges for a BYOAI user, and how much weight does it get?
8. **Context pack size:** token budget per provider and how it is decided. Hermes' fixed char caps do not fit varying model windows.
9. **Spaced review / forgetting:** is it in the first harness milestone (M2) or later? Section 3 only schedules a check after a failure.
10. **Existing data:** can old `SkillProgression` / `HintUsageEvent` rows seed evidence at all, or do we start clean?

## 9. What I did not verify

- Hermes behaviour was read from code, not run. I did not execute the review fork, the scan, or the approval gate.
- I did not read all of `evals/`; the claim "no skill-quality eval" is from a directory listing only.
- Nexora's current code was read only for the LLM provider layer and model fields, not audited (that is M0).
- Line numbers are from commit `f6c3eb1a79` and will drift.

## 10. LangGraph and the loop (D14)

Aki's idea: use LangChain / LangGraph. Short answer: maybe LangGraph for the loop only, decided by a small M2 spike. Not the LangChain model wrappers. All facts below were checked on 2026-11-22.

**Facts (sources)**

| Item | Finding |
|---|---|
| LangGraph (Python) | 1.2.24, uploaded 2026-11-20, MIT (PyPI `langgraph`). Requires `langchain-core>=1.4.7`, `langgraph-checkpoint`, `langgraph-prebuilt`, `langgraph-sdk`, `pydantic`, `xxhash` |
| LangChain core | 1.8.4, 2026-11-19, MIT. It comes with LangGraph (hard dependency), plus `langsmith`. The `langchain` package itself (1.5.2) is *not* needed |
| JS twin | `@langchain/langgraph` 1.7.5, 2026-11-17, MIT; sqlite and postgres checkpointers exist on npm. Docs show `interrupt()` and `Command({ resume })` in JS too |
| Footprint | A clean venv with only `langgraph` installed 38 packages, 89 MB. Python SQLite/Postgres checkpointers are separate packages (`langgraph-checkpoint-sqlite` pulls `aiosqlite`, `sqlite-vec`; `-postgres` pulls `psycopg`, a second driver next to our SQLAlchemy one) |
| Telemetry / LangSmith | I found no telemetry or analytics code in `langgraph` or `langchain_core` (grep: telemetry, posthog, sentry). Tracing is on only if the `TRACING_V2` / `TRACING` env var (with the LANGSMITH_/LANGCHAIN_ prefix) equals `true` (`langsmith/utils.py:139`). The `langsmith` client is still installed. Smoke test ran with sockets blocked and made no network call |
| Smoke test | `/tmp/lgtest/smoke.py`: a 2-node graph calling plain functions `gap()` and `plan()`, an `interrupt()` gate and `Command(resume=True)` with an in-memory checkpointer. It paused, resumed and finished. The plain functions were asserted without importing the graph |

**Where it sits (if adopted)**

`learning/harness` keeps the deterministic code: state from evidence, gap, planner order, hint rules. A new `learning/harness/graph.py` is the only file that imports LangGraph. Each node is a thin wrapper around one of those functions or one `ai_gateway` call. The graph never imports a provider and never touches LangChain model classes.

| Our thing | LangGraph piece | Rule |
|---|---|---|
| Evidence log, knowledge state (`memory`) | Not in the graph | Ours, append-only. Graph state holds ids and small facts, never learner free text |
| Loop step order (Observe…Reflect) | Graph nodes and edges | Nodes are wrappers; logic stays testable without the graph |
| One learner session | `thread_id` | An opaque session id, not the learner id, so deleting a learner can't be blocked by checkpoint rows |
| Wait for the learner's answer (Challenge) | `interrupt()` / resume | Optional. A normal request/response turn also works |
| Skill promotion gates G0–G4, G3 human approval | Not the graph | A DB status and approval row (days long). Keeping a run paused for days would tie a checkpoint to a business decision |
| Checkpointer | Disposable cache | Delete it at any time. The next turn rebuilds state from evidence and must give the same next step. TTL it |
| Provider calls | `ai_gateway` | Unchanged. No `langchain-*` provider packages |
| Reflection (draft skills) | Offline job, not the live graph | As in section 4 |

**Risks and exit cost**

- **Two copies of state.** The loop's real state is the evidence log, which is rebuildable. A checkpoint is a second copy and could drift. Mitigation: the rebuild test below.
- **Personal data in checkpoints.** Checkpoints serialize the whole state each step. Keep state to ids; add a check that scans checkpoint rows for learner text.
- **Churn.** Python and JS versions move weekly (1.2.24 on 2026-11-20). Pin versions; no use of experimental APIs.
- **Dependency weight.** 38 packages, 89 MB, plus a second DB driver for the Postgres checkpointer. Small, but real for a monolith.
- **Exit cost.** What we'd rewrite if we dropped it: `graph.py` (the builder and node wiring), the checkpointer setup, and any `interrupt()` calls. Nothing else, if the rule above holds (estimate: about a day, not measured). Lock-in happens only if logic leaks into nodes; the spike checks this.
- **Gain is modest.** Because state is derived from evidence, we can already resume any session. LangGraph mostly adds a structured way to write the loop, retries, streaming and a graph view. Not sure it beats a ~100-line hand-written loop; the spike answers it.

**M2 spike plan**

| | |
|---|---|
| Scope | The loop for the 8 `python.*` concepts as one graph. Nodes wrap the pure functions. Fake provider through `ai_gateway`. SQLite checkpointer. One `interrupt()` at Challenge. Also a ~100-line hand-written version of the same loop for comparison. No UI |
| Success criteria | (1) Pure-function tests pass with `langgraph` not importable. (2) Delete the checkpoint DB mid-session: next turn gives the same step as before (golden test). (3) With tracing env unset and sockets blocked, a full run makes no network call. (4) A scan of checkpoint rows finds no learner free text. (5) Added dependencies listed and pinned; the sizes noted. (6) The graph version is clearly better than the hand-written one on at least two of: lines, retry/streaming handling, readability for a new teammate |
| Timebox | 3 working days (estimate) |
| Exit criteria | Any of (1)–(4) fails, or (6) not met: skip LangGraph, keep the hand-written loop, delete `graph.py` and the dependency, record the result in D14 |
| Language | The plan is the same with LangGraph.js if D15 ever flips to TypeScript |

Not verified here: the SQLite/Postgres checkpointers were not run; JS and Python feature parity was checked only through npm and docs text (not run); I did not check Mongo/Redis checkpointers; the 89 MB and 38-package figures are for a clean Python 3.14 venv on this machine.

## 11. Focus context: an input contract for every mentor call (D16)

Aki: the AI should know what the learner is focused on when they ask. Aki also mentioned an "interactive model"; Nova clarified that this means a *live* real-time mentor (§12), so "interactive" here means the manipulable visuals only. This is the input contract. It is built by code, with no LLM. Sage owns the canonical field list in `docs/product/focus-and-interactive-models.md`; that file did not exist when I wrote this, so the fields below are the starting set and must be reconciled with hers (open question 1).

**Today:** the client sends `code_context` (editor text), `hint_level`, `current_frame`, `is_checkpoint` (`schemas/chat.py:5-12`), and the server passes the client's `hint_level` straight to the mentor (`routers/chat.py:227`). The code is injected as one free string (`socratic_mentor.py:134`). That is the thing we replace.

**Fields (`FocusContext` v1)**

| Field | Meaning | Who sets it |
|---|---|---|
| `screen`, `lesson_id`, `item_id` | Where the learner is and which exercise/step | Client sends; server checks the ids belong to this learner's path |
| `concept_id` | Node in the concept graph (`python.*`) | Server derives it from lesson/item. A client value is only a hint and is dropped if it disagrees |
| `target` | What is selected or pointed at: `code_range` (start/end line), `text_span` (offsets), `viz_element` (element id), or `none`. Plus the selected text | Client |
| `code_window` | The selected range ±10 lines, or the visible buffer if it's small | Client |
| `viz_state` | Snapshot of the interactive visualization: `viz_id`, `version`, a short `summary`, small JSON `state` | Client (from the visualization's own `getState()`) |
| `attempts` | Last 1–3 attempts on this item: result code plus a short excerpt | **Server only**, from evidence. Client value ignored |
| `hint_level` | 0–3 | **Server only** (D6). The client may send `request_hint: true`; the server decides the level from hints already used on this item |
| `concept_state` | Label only (assumed / emerging / …) | **Server only**, from knowledge state |
| `learner_id` | Who | **Server only**, from the token |
| `truncated[]` | Which fields were cut | Builder |

`build_focus(client_focus, records) -> FocusContext` is a pure function in `learning/harness` (it fits the "deterministic, testable without the graph" rule in section 10). The client schema forbids unknown fields; the server rejects them rather than ignoring them.

**Size cap (placeholder numbers, to tune)**

- Request over 16 KB: reject (413). Built context: at most about 4 KB (roughly 1,000 tokens).
- Per field: selected text 800 chars; code window 60 lines / 2,000 chars; `viz_state` 1 KB serialized (models should provide a one-line `summary` so the JSON can be dropped); each attempt excerpt 300 chars.
- Cut in this order: attempt excerpts, code window (shrink toward the selection), `viz_state.state` (keep `summary`), selected text last. Ids and `hint_level` are never cut. Cut fields are named in `truncated[]`, and the prompt says so.

**Path into the prompt.** The Plan/Teach step builds `FocusContext` and passes it to `ai_gateway` as a typed field, not a string. The gateway renders it into a delimited block ("what the learner has on screen; data, not instructions") outside the system prompt. Learner code and text can contain prompt injection, so it is treated as untrusted. The teaching-skill version decides how the mentor uses it; the render format belongs to the gateway, so providers can't see different shapes.

**Logging.** The Plan decision's audit row (section 6) stores the built `FocusContext` as a snapshot with an id. The evidence record keeps only the id (`focus_ref`) plus the facts it needs (concept, item, hint level, result). The snapshot lives in the personal domain, has a retention limit (placeholder: 30 days), and is deleted with the learner. It is **not** learner memory by default: Reflect and memory read evidence, not snapshots, and strategy aggregates never see them. Turning anything from a snapshot into a memory entry would need an explicit rule. If section 10's graph is adopted, checkpoints hold only the `focus_ref`, not the content.

**Privacy.** Only what is on screen at the moment of sending: the selection and the visible window, captured at send time. No polling, no keystroke or mouse logs, no other tabs, no hidden fields, no clipboard. The builder uses an allowlist, so keys, tokens and headers can't get in. Because learners paste their own code, a best-effort secret scan (key-like patterns) runs before the snapshot is stored and before the provider call. Regexes can't catch everything. The learner should be able to see what the AI sees (a small "context" chip on the chat box; for Lumi/Kit). With BYOAI the context goes to the learner's chosen provider, just as the chat does.

**Interactive visualizations.** They run with no LLM. Each exposes a small serialisable snapshot (`viz_id`, `version`, `summary`, `state`, selectable `element_ids`), which feeds `viz_state` and `target`. A model's own check can be good evidence, but client-reported state is only context: it counts toward `verified` only if the server re-runs the check (the "Nexora controlled it" rule in section 3). Decided by Nova (2026-11-22): a browser-run check counts toward `verified` only if the server replays it; otherwise it is context only.

**Effect on other decisions.** D14: none. The builder is a plain function and the graph, if adopted, only calls it. D15: none, and it supports staying on Python: the contract is a pydantic model, and TypeScript types come from OpenAPI. If D15 flips, it becomes a Zod schema.

**Open questions**

1. *Reconciled with Sage's `docs/product/focus-and-live-mentor.md` (her file wins on the field list).* I adopted her `viz_*` names (so "model" always means an AI model) and her extra fields `captured_at`, `target.origin`, `target.label`, `target.selected_at` and `shared_view` (live only, default `off`). She adopted my `attempts`, `item_id`, `concept_state`, `truncated[]`, caps and 30-day retention. Still to settle (hers, for Nova): `request_hint` per item vs per concept, stale-context rules.
2. *Decided (above).* Open part: which visualizations will have server-replayable checks? Replaying needs the check logic on the server, which depends on D15.
3. The exact hint-level rule from `request_hint` (per item or per concept; reset when?). Sage's pedagogy doc.
4. Snapshot retention (30 days is a guess) and whether the learner can switch focus capture off.
5. The cap numbers: tune them with real token counts per provider.

Not verified: all of the above is design only. I did not check how `Learn.tsx` could produce the selection, or what the current lesson components can export as model state. The secret-scan patterns are not chosen.

## 12. Live mentor mode (D17)

Aki means a *live model*: a real-time voice AI mentor, maybe seeing the screen (like Gemini Live or OpenAI Realtime). This is an optional mode on top of the text mentor, not a replacement. Sage writes the teaching side. All provider facts were checked on 2026-11-22 from the vendors' own docs and price pages (list below).

**Capability flag and fallback.** `ai_gateway` gets a separate `live` capability per provider and model: `{audio_in, audio_out, image_in, transcripts, tools, max_session_s, token_mode}`. The UI shows "Live" only when the learner's chosen provider and model report it, and the learner has switched live mode on. Everything else is text chat. If a live session drops or hits a cap, the lesson continues in text with the same `FocusContext`. Live is never required to finish a lesson.

| Provider | Live today? | Source (2026-11-22) |
|---|---|---|
| Google Gemini | Yes: Live API with `gemini-3.8-live`, `gemini-3.8-live-extended-thinking`, `gemini-3.1-flash-live-preview`, `gemini-2.5-flash-native-audio-preview-12-2025`. Audio, image/video and text in; audio out; barge-in, transcripts, tool calls | ai.google.dev/gemini-api/docs/live-guide, `/docs/live` |
| OpenAI | Yes: Realtime API (`gpt-realtime-2.1`, `-mini`) over WebRTC or WebSocket, plus the newer GPT-Live (`gpt-live-1`, `gpt-live-1.1`, billed per minute). `gpt-realtime-2.1` takes text, audio and image input | platform.openai.com/docs/guides/realtime, `/docs/pricing` |
| Anthropic | I found no realtime audio API in Anthropic's docs index (no entry for realtime, voice, speech or audio) | platform.claude.com/llms.txt |
| OpenRouter, Ollama, Open WebUI | Not checked. Not sure | |

So of the six providers in `services/llm/factory.py`, at most two (Gemini, OpenAI) have live today.

**Two separate provider slots.** Aki wants the settings separate, so the learner configures two independent slots:

| Slot | Fields | Connection test |
|---|---|---|
| Text mentor | provider, model, key | A tiny completion through the gateway; shows latency or the error |
| Live mentor | provider, a live-capable model, key, voice | Opens a short live session (setup, one text turn, a reply, close); records latency or the error; stores no audio |

- The slots are independent. Text can be Claude or OpenRouter while live is Gemini Live. The live slot's model list comes only from the capability table (above), so it shows realtime models only. The voice list is also per provider and model.
- **Hidden live button.** If the live slot is empty, or its model isn't in the capability table as `live`, the Live button is hidden and text chat is the fallback. My default for a failed test: the button stays visible but disabled, with "reconnect" pointing to settings (hidden would look like a bug).
- **Credentials.** Same rules as the provider-credentials step in `migration-plan.md` (step 3): keys are stored encrypted on the server, entered through a write-only field, shown only masked (last 4), and never sent to the browser, logs or error messages. If both slots use the same provider, the second slot can point at the same stored credential, so one rotation fixes both. The encryption method is not chosen here.
- **Mapping to `ai_gateway`.** Provider configs are keyed by capability: a `provider_config` row is `(owner, slot = text | live, provider, model, credential_ref, voice, options, last_test)`. The gateway resolves `for_learner(id).get(TEXT)` or `.get(LIVE)`. The harness asks for a capability, never a provider name, so the text loop is unchanged. An `owner` is a learner or the Managed AI default; resolution order is the learner's own slot, then Managed AI if the plan allows it, then none. The `live` capability table is static code (provider, model, flags) that the connection test confirms. Evidence and audit rows record the slot, provider and model, because a learner can now use two different providers.
- **Privacy follows the slots.** With two providers, the focus context and any live audio reach each respective provider. The settings screen should say, per slot, where the data goes.

**Transport (recommended: server relay).** Browser ⇄ our FastAPI WebSocket ⇄ provider. The provider key never leaves the server (per-user encrypted key, or the Managed AI key). The browser connects with a one-time ticket from an authenticated REST call (valid about 60 s, bound to the learner and one session), not a long-lived token in a URL. PCM audio goes up (16 kHz, 16-bit for Gemini, `gemini live-guide`; OpenAI's samples use 24 kHz).
Why relay and not direct: (1) the server can meter and cut a session, which caps cost; (2) hint level and focus come from the server (D6, §11), and the Socratic rules stay in our config; (3) one place to log. Cost: one extra hop, and we carry the audio (about 32 KB/s up and 48 KB/s down per session, my arithmetic, so 50 sessions is roughly 32 Mbit/s; not measured).
Both vendors recommend direct browser connections with ephemeral tokens for latency (Gemini: "avoids your backends needing to proxy the real time data"; OpenAI: `POST /v1/realtime/client_secrets`). Keep that as the fallback if relay latency is too high. If used, scope the token tightly. For Gemini that means `uses: 1`, an expiry no longer than our session cap, a 1-minute window to start, and `liveConnectConstraints` locking the model and config so the system instructions stay on the server (Gemini ephemeral-tokens doc; it's marked preview). OpenAI client secrets are created server-side with the session config; whether the browser can override that config afterwards: not sure. Set the OpenAI safety identifier header to a hashed learner id, not the id itself.

**Latency budget (targets, not measured).** Median 800 ms and p95 1.5 s from the end of the learner's speech to the first audio back. Rough split: end-of-turn detection about 300 ms, network 50 ms, relay hop at most 20 ms, provider first audio about 400 ms. Focus refreshes must not stall speech: send them as a context update that doesn't complete the turn. Gemini's doc says `turn_complete=true` "unconditionally interrupts generation", so the update must set it false. Debounce: send after the focus has been stable about 1 s, at most once per 2 s, and keep it within the §11 size cap.

**Cost and caps.** Voice costs far more than text. Prices from the pages above:

| Model | Price |
|---|---|
| Gemini 3.8 Live, paid | audio in $0.005/min, audio out $0.018/min, image/video $0.002/min. Free tier: free of charge, but the page says free-tier data is "used to improve our products" |
| OpenAI GPT-Live | $0.05/min active, $0.02/min standby |
| `gpt-realtime-2.1` | audio $32 in / $64 out per 1M tokens (text $4 / $24, image in $5); `-mini` audio $10 / $20. Per-minute equivalent: not sure |

Gemini worked example: 10 min/day with both sides speaking is at most 10 × (0.005 + 0.018) = $0.23 per learner per day, about $7 a month. That is too much to give a free-tier learner by default. Proposed placeholder caps, enforced by the relay from a per-learner usage table (`live_usage`: seconds of audio and of video per day):

| Plan | Live mode |
|---|---|
| Free | Off, or a small trial (10 min/day, 5 min per session, no screen frames) |
| Managed AI paid | 60 min/day, 15 min per session |
| BYOAI | The learner's own provider bills them. We apply only the session limit and idle cut-off |

For all plans: end the session after 60 s of silence, show remaining minutes, and fall back to text at the cap. The provider's own session limits also apply: Gemini documents 15 min for audio-only and 2 min for audio plus video without session management, so reconnect and resume logic is needed (OpenAI limit: not found, not sure).

**Privacy and opt-in.** Mic and any screen input are off until the learner turns them on, per session. A visible "LIVE" indicator with elapsed time shows whenever anything is streaming, and one tap turns it off and releases the mic. No audio or screen frames are stored by default. Saving a transcript is a separate, off-by-default choice. Sage's pedagogy doc assumes the transcript is stored "like chat"; that differs from Nova's brief (nothing stored unless the learner agrees), so open question 6. The default keeps only the evidence rows and the `focus_ref` snapshots from §11 with the same retention. Transcript text follows the evidence rules: it is used for judging, it is not memory, and strategy aggregates never see it. The user must know where the audio goes (their provider; for a free-tier Gemini key, possibly used for training). Minors, consent wording and regional rules: not checked.
**Screen frames.** Sage's `shared_view: canvas` (a frame of Nexora's own lesson pane, opt-in, off by default) is in the contract. I recommend implementing it after M1, so v1 sends none. The structured §11 focus context carries what matters at a fraction of the cost, and Gemini's 2-minute audio+video limit makes continuous video awkward. Later, as a separate opt-in: capture only our own tab, one frame per focus change, never stored. Capturing other windows or tabs is not allowed.

**Live focus context.** The same §11 `FocusContext`, rebuilt by the server on each focus change and pushed into the session as above. `hint_level`, attempts and concept state still come from the server only.

**Keeping the Socratic rule.** A speech-to-speech model decides what to say, so we can't filter its audio before it plays. Plan: put the teaching skill's rules in the session instructions; give the model one tool, `request_hint`, whose answer comes from our server at the server-decided level (D6); and run a transcript monitor on the relay that interrupts and logs any spoken code answer. OpenAI's GPT-Live splits a voice layer from a backend reasoner, which is a similar shape. Whether models follow this reliably: not verified. Test it at M1.

**Evidence.** Talk is a signal, never `verified`. A spoken explanation is judged like a typed one: low weight, and never the only record (§3). Evidence that counts comes from the attempt that follows (code run or an interactive check on the server). A live session writes `spoken` evidence rows with `verified=false`, a `focus_ref`, and no audio.

**Aki's Gemini key.** Aki's saved key is a Gemini speech key, which may or may not work with the Live API. Not tested now. At M1 the gateway tests (D13, server side only) should check: Live connect and a short audio reply; the free vs paid tier of the key; the real latency through the relay and directly; the session ceiling; and what usage numbers come back.

**Effect on D14 and D15.** Neither changes.
- D14: a live session is a long-lived streaming loop, not a graph run, so LangGraph is not in the audio path. Reflect and evidence updates after a session can still be graph nodes. Live adds one reason to keep the deterministic functions callable on their own (for `request_hint`).
- D15: it doesn't push toward TypeScript or a separate service. The relay is I/O-bound, and Gemini's Python SDK sample and OpenAI's Python WebSocket sample both exist in the docs. Keep it in the monolith. Revisit only if the M1 test shows relay-added latency above 50 ms p95 or event-loop lag at about 20 simulated sessions (placeholder). Then the first step is a separate worker process on the same codebase, not a new service.

**Open questions**
1. Relay or ephemeral tokens as the default, after the M1 latency numbers.
2. Free-tier policy: off, or a small trial? The free Gemini tier uses data for training, so Managed AI free should not use a free-tier key.
3. The exact caps (minutes, session length) and who sets them.
4. Does Sage want live mode to use the same hint ladder, or a different one for speech?
5. Minimum age and consent wording for voice; provider data terms for OpenAI (not checked).
6. Transcript storage: not stored unless the learner agrees (Nova's brief, my default) vs stored like chat (Sage's assumption).
7. **Does "separate settings" mean more than text/live slots?** My reading (Nova's): two slots, Text mentor and Live mentor. The other reading is open: a learner's own settings kept separate from Managed AI settings (who pays, caps, which provider), or one settings page per learner and another for the team or admin. If so, the `owner` field in the gateway mapping becomes a real settings surface.

Not verified: no provider was called; the slot design and connection tests were not built or tried. Prices and limits are from the pages as of 2026-11-22 and change often. The bandwidth numbers and latency targets are my estimates. OpenRouter, Ollama and Open WebUI were not checked.

