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
