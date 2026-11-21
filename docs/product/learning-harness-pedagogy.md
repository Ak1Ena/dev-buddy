# Learning harness: pedagogy design

Status: proposal. Author: Sage. Date: 2026-11-22. Design only, no code.
Running example: `first-domain.md` (Python fundamentals). "Assumption" marks a choice with no Nexora data behind it.
Architecture side (modules, storage, APIs) lives in `docs/architecture/learning-harness.md` (Arjun). Terms used here: *evidence record*, *learner state*, *teaching skill*, *proposal*. Names checked against that doc by Nova (2026-11-22): knowledge states follow `first-domain.md` (unseen / assumed / in_progress / verified / retained / needs_review) in both docs.

## What we take from Hermes (read in `/home/akiena/.hermes/hermes-agent`, not run)

| Hermes mechanism (file) | Nexora use | Deliberate difference |
|---|---|---|
| After a turn, a forked agent reviews the conversation and may write memory/skills; it can't touch the main chat; dispatch-side tool whitelist (`agent/background_review.py`) | **Reflect** runs after a session as a restricted fork | Hermes prompts say "be ACTIVE, most sessions produce an update". Ours defaults to *nothing to save* unless grounded. |
| Memory = two small curated stores, frozen snapshot at session start, "save only facts grounded in a message, never infer traits from tone or topic" (`tools/memory_tool.py`, `memory_tool_store.py`) | Learner memory read as a snapshot at session start; same grounding rule | Knowledge state is **not** written by an LLM. Rules recompute it from evidence records. The LLM only adds unverified hypotheses. |
| Skills are written through one tool: create/patch/write_file, security scan, class-level names, rules not incident stories (`tools/skill_manager_tool.py`, review prompts) | Teaching skills follow the same shape and hygiene | Hermes skills improve *the agent's task*. Ours improve *the human's later independent performance*. |
| Agent-written skills are staged in `pending/` until a person approves (`tools/write_approval.py`) | Every AI-origin skill change is a `proposal`, never auto-applied | Approval is not enough for us: a trial on learner outcomes comes first. |
| Usage sidecar + lifecycle active → stale → archived, pinned/locked skills (`tools/skill_usage.py`, `agent/curator.py`) | Per-version skill telemetry, retirement, human-locked skills | Telemetry is outcome-based, not just "was it loaded". |
| Session search: full-text recall over past sessions, no LLM calls (`tools/session_search_tool.py`) | Observe can recall past episodes | Structured evidence comes first. Raw chat search is a fallback, since memory must not depend on chat history. |

## The loop, step by step

Example: Mai finished the assessment. `python.conditionals` is *assumed-known*, `python.loops` is *unseen*.

| Step | What it does for the learner | Example | Who decides |
|---|---|---|---|
| **Observe** | Collects what actually happened: runs, predictions, edits, hint requests, chat. Loads the learner snapshot (frozen at session start) and recent evidence. | Mai predicts a `for i in range(3)` loop prints 1,2,3. The real run prints 0,1,2. | Code. No LLM. |
| **Understand** | Turns signals into evidence records and misconception hypotheses. Deterministic checks first. An LLM only grades free-text explanations against a rubric. | Record: `trace_prediction`, failed, misconception `range_off_by_one`, `verified: true` (a real run produced the truth). | Rules, LLM for rubric only. |
| **Plan** | Picks the next goal and what evidence is still missing, then picks a teaching skill and format. Applies the path rules below. | One miss: stay on loops, use another trace. | Rules. An LLM may suggest, rules decide. |
| **Teach** | Mentor works through the chosen skill: Socratic question first, hints 0-3, no code answer. Interactive step-through if a diagram helps. | Mentor asks "what is `i` on the first pass?" and Mai steps through the run. | Mentor (LLM) under skill instructions. |
| **Challenge** | Gives a task that needs production or transfer, after the teaching, not instead of it. | Write `sum_to(n)` with a loop, then the same idea over a list. | Rules pick the task. Content is curated or validated. |
| **Evaluate** | Scores against the evidence rules and writes records. Chooses the next move: explain, challenge, review or assess. | Passes unhinted: one `apply` record. Not yet verified: still needs explain and transfer. | Rules. |
| **Reflect** | After the session: update learner memory, and propose teaching-strategy changes. See below. | "Predict-then-step cleared the off-by-one for this learner." | Rules, then a restricted LLM fork. |

## Learning detection

**Signals and what they are worth** (thresholds from `first-domain.md`, all assumptions):

| Signal | Counts as |
|---|---|
| Code passes tests, unhinted or hint ≤1 | Strong, `verified: true`, can count toward verified |
| Prediction matches the real run, committed before the reveal | Strong, `verified: true` |
| Bug fixed so a failing test now passes | Strong, `verified: true` |
| Same idea solved in a different-looking problem | Strong (transfer) |
| Explanation in own words, rubric-graded by a model | Medium: counts once, never the only record |
| Multiple choice correct, self-report, lesson finished, correct after hint 2 | Weak: **assumed** only |
| Hint level 3 (worked example), giving up, same error twice | Diagnostic: no credit, may open a misconception |
| Time on page, animation watched, "I get it" in chat, message count, AI praise | **Not evidence** |

**Assumed vs verified.** *Assumed* is a prior used to place the learner and to decide what to probe. *Verified* needs apply + explain + transfer, so a quiz or a chat can never make it. *Retained* needs a fresh unhinted variant after a gap. Every record keeps source, time, context, hint level and `verified`. The brief's example record is the model, not a final schema.

**When the path may change:**
- One wrong answer: nothing changes. At most one follow-up probe on the same concept.
- Two independent misses (different item or session) linked to the same misconception: probe the prerequisite it points to. The path changes only if that probe fails.
- Hint level 3 on a concept whose prerequisite is only *assumed*: probe the prerequisite first.
- Skip a lesson only when the concept is *verified*. Assumed-known concepts open with a quick probe instead.
- A failed retention probe puts the concept in `needs review`. It does not erase earlier evidence.
- Every path change is logged with its reason and the records behind it (auditable AI decisions).

## Teaching skill definition

A skill is one reusable teaching move, not a lesson. Shape rules borrowed from Hermes: class-level name; procedure first; each pitfall is a rule plus a one-clause *why*; no incident stories, names, dates or learner quotes; extend an existing skill instead of adding a near-duplicate.

```
id:            lowercase-hyphenated, class-level (not "fix-loops-for-mai")
version:       semver; production versions are immutable
status:        draft | proposed | trial | production | retired   (+ locked: AI may not edit)
origin:        human | ai-proposal (with proposal id)
purpose:       one sentence, what learner change it aims at
situations:    when to pick it (concept types, evidence state, learner signals)
not_when:      situations where it backfires
inputs:        what it needs (concept id, current state, misconception hypothesis, artifact)
instructions:  numbered steps for the mentor; hint-level behaviour; what to ask first
expected_outcomes:  observable evidence it should produce
limitations:   known weak spots; assumptions it rests on
evaluation:    metric, comparison, guardrails (see validation)
```

Fixed for all skills (not editable by a skill): never give the direct code answer at hint levels 0-2; never claim mastery; never change evidence rules or path rules.

**Example 1: `trace-prediction-questioning`**
- purpose: help the learner build an accurate mental model of how code runs, by predicting before seeing.
- situations: concepts with state change (variables, conditionals, loops, lists, functions); learner shows a wrong prediction or cannot say what a line does.
- not_when: learner cannot read the syntax at all (use gap recovery first); learner is frustrated after repeated misses (shorten, give a smaller step).
- inputs: concept id, a short program, the real execution trace, suspected misconception.
- instructions: (1) Ask the learner to predict the value of one variable at one line, before any stepping. (2) Reveal by stepping the real run. (3) On mismatch, ask "which line made it differ from what you expected?" and let them find it. (4) Ask for a prediction on a slightly changed program. Hint 0 is a question, 1 names the concept, 2 points to the line, 3 walks the trace (no credit).
- expected_outcomes: prediction accuracy on the changed program rises; recurrence of the named misconception drops on the next fresh variant.
- limitations: assumes a correct execution trace is available; less useful for pure-syntax confusion; research basis is tracing-before-writing (Lister 2004) and the notional machine (Sorva 2013), which are not tests of this exact move.
- evaluation: unhinted pass rate on a fresh variant ≥48h later; hint level on the next item; misconception recurrence.

**Example 2: `prerequisite-gap-recovery`**
- purpose: find out whether a stuck point comes from an earlier concept and fix that, without rerouting on a hunch.
- situations: two independent misses with one misconception, or hint 3 used, where a prerequisite is only assumed.
- not_when: the miss is a typo or a careless slip (one-off).
- inputs: target concept, prerequisite list, assumed prerequisite states, error evidence.
- instructions: (1) Tell the learner what you will check and why. (2) Give one short production item on the nearest assumed prerequisite, no hints. (3) Pass: return to the target and record the prerequisite as stronger evidence. (4) Fail: teach the prerequisite with the matching skill, then return with a fresh item.
- expected_outcomes: the prerequisite state becomes evidenced; the target concept is retried in the same or next session.
- limitations: one probe can mislead; a second probe is required before a long detour. Prerequisite graph must be correct.
- evaluation: share of recoveries where the target concept passes unhinted within the next two sessions; detours that were unnecessary (probe passed).

## Reflect: session lessons → memory and strategy

Runs at session end, and when a concept first reaches verified (assumption; Hermes uses a turn counter, default every 10 turns). It is a forked run with a whitelist: read evidence and skills, add to memory notes, create proposals. It cannot edit production skills, state, thresholds or paths.

**(a) Learner memory.**
1. *Deterministic:* rules recompute concept states from evidence records. Written to Knowledge/Experience with provenance. No LLM.
2. *LLM, restricted:* may add (i) misconception hypotheses, `verified: false`; (ii) strategy notes for *this learner*, e.g. "predict-then-step worked on loops, 3 records". Each must point to evidence ids or messages. Never infer traits ("visual learner", "slow", mood) from tone or topic; learning-styles claims have weak support (Pashler 2008). Store what worked per concept type instead.
3. One fact goes to one category (Profile / Knowledge / Experience / Strategy / Project). If unsure, leave it out.

**(b) Teaching-strategy proposals.** Only when a pattern repeats beyond one session. A proposal says: situation, move, observed outcome type, and links to evidence ids kept in a restricted audit store. The skill text itself contains **no** learner id, name, goals, code, quotes or dates. A single-learner pattern stays a personal strategy note and is not generalised (the minimum number of learners is an open question).

**Validation before promotion.** Nothing from step (b) reaches production by itself.
1. *Stage:* lands as `proposed`, with a short gist and a diff against the current version (Hermes stages to `pending/`).
2. *Static checks:* schema complete; no personal data; no incident narrative; class-level name; not a duplicate (fold into an existing skill); does not break the fixed rules (no early answers, no mastery claims, no rule changes); security scan as Hermes does for agent-written skills.
3. *Offline test:* replay on anonymised recorded sessions, checking mentor output for answer leaks, hint-level fit and a question-first start. Simulated learners are weak evidence (assumption), so this step can reject but cannot approve.
4. *Controlled trial:* a share of eligible learners get the new version beside the current one. Primary measure: independent performance on a fresh variant after a gap (apply, transfer, retain). Guardrails: verified rate does not fall; hint-3 requests do not rise. Learner satisfaction and the AI's own opinion of the session are not outcomes.
5. *Promote:* a human (Aki/Nova) approves; version bumps; the previous version stays for rollback.
6. *Monitor:* per-version outcome telemetry; stale → retired as in Hermes' curator; humans can lock a skill.

## Open questions (for Nova / Aki)

1. How many learners and sessions are the minimum before a strategy may generalise? Early on there may be too few for a real trial. Is human review by Aki the only gate until then?
2. May anonymised learner evidence improve shared teaching skills? Needs a privacy and consent decision, including for BYOAI users.
3. Reflect uses the learner's own provider under BYOAI. A weak local model gives weak proposals. Do we require a minimum capability, or let Reflect use a Nexora-chosen model?
4. Can the learner see, correct and delete what Reflect wrote? The brief asks for controls but not the UX.
5. If a learner says "I already know this", we treat it as self-report (assumed). Confirm.
6. Who curates the misconception catalogue: by hand, or AI-proposed and human-approved?
7. LLM grading of explanations needs a calibration set before we trust it even as "medium" evidence.
8. Reflect timing (session end plus first-verified) and the 48h/3-day gaps are my defaults.

Sources (from memory, not re-checked): Lister et al. 2004; Sorva 2013; Pashler et al. 2008 (learning styles). Hermes details above come from reading the listed files; I did not run Hermes or its tests.
