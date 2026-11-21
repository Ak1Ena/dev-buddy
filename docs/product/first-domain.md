# First learning domain: Python Fundamentals (control flow and data)

Status: proposal for Aki/Nova. Author: Sage. Date: 2026-11-22.
Nothing here is built. "Assumption" marks a choice I made without evidence from Nexora's own learners.

## Domain and why

**Python fundamentals: tracing, writing and fixing small programs (variables → functions, lists, dicts).** One language, beginner level, no libraries.

Why this one:
- First in Aki's domain list, and the primary audience (beginners, self-taught) starts here. Every later domain (DSA, backend, ML) depends on it.
- The prerequisite graph is shallow and well known, so paths, gaps and misconceptions are easy to model.
- Most evidence can be checked by running code, with no LLM. That makes "verified" cheap and auditable.
- The repo already points here: Python question bank, 18-topic list, Socratic mentor, hint levels 0-3, predict-output / fill-blank / debug workshops. We reuse content and ideas, not the design.

## Concepts (8)

| id | Concept | Needs first | Misconception to probe |
|---|---|---|---|
| python.variables | Variables and assignment | none | `=` means "equals"; a variable stores a formula |
| python.types-expressions | Types, operators, expressions | variables | `"5" + "5"` is 10; int vs str confusion |
| python.conditionals | if / elif / else, boolean logic | types-expressions | every `elif` runs; `else` runs after `if` |
| python.loops | for and while, termination, accumulators | variables, conditionals | off-by-one with `range`; loop never ends |
| python.lists | Indexing, slicing, mutation, iteration | variables, types-expressions | index vs value; `b = a` copies the list |
| python.functions | Parameters, return, scope | variables, types-expressions | `print` vs `return`; params vs arguments |
| python.dictionaries | Key lookup, insert, iterate | lists | looking up by value; missing key |
| python.debugging | Read an error, locate and fix a bug | loops, lists, functions | change code at random until it passes |

Tracing (predicting program state line by line) is a skill inside every concept, not a ninth concept. Reading/tracing before writing is the order the research supports (Lister 2004).

## What the initial assessment checks

- About 10 items, ≤15 minutes (assumption). Adaptive: start at conditionals/loops, step down the graph after a miss, up after a hit, stop once a concept's state is stable.
- Mixed item types, not only multiple choice: predict output, write a tiny function (run against tests), find the bug, one short "explain in your own words".
- Two unscored profile questions: goal, and self-rated experience. They shape tone and the first lesson, never mastery.
- **Output is a set of assumed states per concept (assumed-known / assumed-gap / unknown) plus suspected misconceptions. No level label and no percent score.** Today's 10 fixed MCQs → "beginner/intermediate" is dropped.
- Everything it produces is `verified: false`. It places the learner; it proves nothing.

## Evidence of mastery per concept

States: `unseen → assumed → in progress → verified → retained`, plus `needs review`.

| State | Rule (thresholds are assumptions, tune with pilot data) |
|---|---|
| assumed | Self-report, assessment items, or any recognition-only evidence (multiple choice). Used to place the learner. Cannot satisfy a prerequisite on its own: the next concept opens with a quick probe of its prerequisites. |
| verified | All three, with no hint above level 1: **apply** (write or fix code, passes tests), **explain** (own words, rubric-graded), **transfer** (same idea in a different-looking problem). At least two of the three records come from deterministic checks. |
| retained | A fresh variant passed unhinted at least 3 days after verification (assumption; spacing helps retention, Cepeda 2006). Failing it moves the concept to `needs review`. |

Rules:
- Deterministic evidence (code vs tests, trace matches the real run) is `verified: true`. LLM-graded explanations are stored with the rubric and model, count once, and can never be the only record.
- Hint level 2 gives partial credit and does not count toward verified. **Hint level 3 (worked example) gives no credit**: the concept goes to `in progress` and a fresh variant is scheduled later. This keeps the CLAUDE.md rule (mentor never gives the answer early).
- One wrong answer changes nothing. Two failures on independent items (different surface or session) flag a misconception and trigger review, not a demotion.
- Not evidence: completion, time on page, watching an animation, "I get it" in chat, or the AI saying the learner understood. The current workshop score (100/66/33/0 by hints used) is a completion-style number and should not feed mastery.
- Record shape follows the brief's example record (concept_id, evidence_type, result, misconception, source, verified). Not a final schema.

## Interactive formats that fit

All run without an LLM per interaction.

| Format | Concepts | Notes |
|---|---|---|
| Step-through execution (variables panel + current line) | all | Built from a real run, not narrated. Replaces the LLM-written emoji "frames" in LESSON_FORMAT.md. |
| Predict, then reveal | variables, conditionals, loops, lists | Learner commits a prediction before stepping. Mismatch becomes misconception evidence. |
| Parsons (reorder lines) | conditionals, loops, functions | Auto-graded, low load for beginners (Denny 2008). |
| Tiny coding with tests | loops, lists, functions, dicts | Main "apply" evidence. Needs a code sandbox: architecture decision. |
| Bug hunt with a failing test | debugging, loops, lists | Main "transfer" evidence. |
| Explain-in-own-words | all | Needs an LLM to grade, so it is evaluation, not the interaction. Mentor follow-up stays Socratic. |

## Explicitly out of scope

JavaScript or any second language; classes/OOP, recursion, closures, comprehensions, modules, try/except; DSA and complexity; users pasting their own code as the lesson source (current code_analyzer flow); any other domain; Thai/other content languages (see questions); building the generated-content validation pipeline; teaching-skill registry beyond using Socratic questioning and step-by-step tracing.

## Alternatives rejected

- **DSA first** (arrays, loops, recursion, big-O). Rejected: it assumes the fundamentals above, so the first assessment would mostly find gaps and send learners back here anyway.
- **Python + JavaScript together** (what the current question banks do). Rejected: doubles the curated items and splits misconception data across two languages, so evidence per concept stays too thin to verify anything. Add JS later as a transfer test.

## Open questions for Nova / Aki

1. Python only, OK? (Existing code also has a JS bank.)
2. Content language: English only for v1, or Thai too?
3. Curated foundation means someone writes the item bank (about 3-4 items × 3 types × 8 concepts). Who authors it, and may AI draft it for human review?
4. Running learner code needs a sandbox (browser interpreter or server). Architecture owner to decide; the spec only needs "pass/fail against tests and a state trace".
5. Keep "paste your own code" as an entry path later, or curriculum-only for v1?
6. Are the 3-day and ≤15-minute numbers acceptable as pilot defaults?

Sources (cited from memory, not re-checked this session): Lister et al. 2004 (reading/tracing before writing); Sorva 2013 (notional machine); Qian & Lehman 2017 (novice misconceptions); Roediger & Karpicke 2006 (testing effect); Cepeda et al. 2006 (spacing); Denny et al. 2008 (Parsons problems).
