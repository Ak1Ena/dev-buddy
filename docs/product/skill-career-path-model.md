# Skill tree, career path, learning path

Status: proposal. Author: Sage. Date: 2026-11-22. Design only, no code.
Builds on `first-domain.md` (states, evidence rules) and `learning-harness-pedagogy.md` (path-change rules). Architecture side: `docs/architecture/learning-harness.md` (Arjun). "Assumption" marks a choice with no Nexora data behind it.

**One idea:** there is one skill tree and one state per learner per concept. A career path is a *lens* on that tree (which nodes a role needs, how deep). A learning path is a *plan* over that tree toward a goal. Neither keeps its own progress.

## 1. Skill tree

Nodes are concepts (`python.loops`). Edges are prerequisites. All states are computed from evidence records by rules. Nobody types a state in, and no AI sets one.

| State | Meaning | Learner sees |
|---|---|---|
| `locked` | No evidence, and a prerequisite has no evidence or is a suspected gap | Greyed, "needs X first". Soft lock: opening it triggers a short prerequisite check (assumption). |
| `available` | No evidence, prerequisites at least assumed | Open, "not started" |
| `assumed` | Only self-report, assessment, or a recognition-only answer. Carries a direction: *known* or *gap* | Dashed outline, "you said / we guess". Never styled like verified. |
| `in progress` | Some verified evidence, rule not yet met | Part-filled, with what is still missing |
| `verified` | Apply + explain + transfer, hint ≤1 (rule in `first-domain.md`) | Solid, "shown, not just said" |
| `retained` | A fresh unhinted variant passed after a gap (3 days, assumption) | Solid with a mark |
| `needs review` | A retention probe failed or a review is due | Amber, "quick check due" |

Rules that hold:
- One answer never moves a node to `verified`. One wrong answer never moves a node down.
- Assumed and verified stay separate in storage, in counts and in colour.
- `locked` / `available` is the `unseen` state split by prerequisites. It is derived, not stored.
- Names differ slightly from Arjun's section 3 (`unknown`, `emerging`, no `retained`). Mapping: unknown = locked/available, emerging = in progress. `retained` is a flag from the delayed check, which his "different day" rule folds into `verified`. Needs one agreed enum (open question 1). **Resolved by Nova 2026-11-22:** Arjun's doc now uses the `first-domain.md` names (unseen/assumed/in_progress/verified/retained/needs_review).

## 2. Career path

A role is a named list of requirements: `(concept, required depth)`. Depth is expressed as the evidence needed, so it is checkable:

| Depth | Needs | Reads as |
|---|---|---|
| `familiar` | `assumed` (known) is enough | "has met it" (assumption: used sparingly) |
| `working` | `verified` | "can use it unaided" |
| `solid` | `retained` | "still can after time away" |

Role: `software-engineer-modern`, shown as **Software Engineer** (Aki 2026-11-22, replacing the earlier backend-only role). It is a skill tree with a small **core** that every learner on this role needs, plus **later branches** a learner may add. The shape is the proposal. Every node, link and depth below is a **placeholder for a person to curate**, and says nothing about what employers want.

**Core** (`id (prerequisites)`, depth). Only the 8 Python nodes marked **real** exist in v1; every other node is **not in Nexora yet**.

| Area | Nodes | Depth |
|---|---|---|
| Programming fundamentals (**real**) | `python.variables`; `python.types-expressions` (variables); `python.conditionals` (types-expressions); `python.loops` (variables, conditionals); `python.lists` (variables, types-expressions); `python.functions` (variables, types-expressions); `python.dictionaries` (lists) | working |
| Programming fundamentals, later | `python.errors` (functions); `python.recursion` (functions); `python.classes` (functions, dictionaries) | working |
| Debugging | `python.debugging` (loops, lists, functions) **real**; `debug.read-traces-logs` (debugging); `debug.isolate-reproduce` (debugging) | debugging: solid; others: working |
| Data structures | `ds.complexity-basics` (loops, lists); `ds.sets-hashing` (dictionaries); `ds.stacks-queues` (lists); `ds.trees-graphs` (recursion, stacks-queues) | working; trees-graphs: familiar |
| Git | `git.basic-workflow`; `git.branch-merge` (basic-workflow); `git.resolve-conflicts` (branch-merge) | working |
| Testing | `test.unit-basics` (functions); `test.edge-cases` (unit-basics); `test.reproduce-bug-first` (unit-basics, debugging) | working |
| HTTP/APIs + a little backend | `web.http-basics` (types-expressions); `web.call-api` (http-basics, dictionaries); `web.build-simple-api` (http-basics, functions, dictionaries); `backend.sql-basics` (dictionaries); `backend.auth-basics` (build-simple-api) | working; auth-basics: familiar |
| Basic system design | `sys.client-server` (http-basics); `sys.state-storage` (sql-basics); `sys.scaling-failure` (client-server, complexity-basics) | familiar |
| Working with AI coding tools | `ai.ask-with-context` (functions); `ai.review-output` (debugging, unit-basics); `ai.explain-why-wrong` (review-output); `ai.verify-with-tests` (review-output, unit-basics) | review-output: solid; others: working |

**Later branches** (optional extras on top of the core, all **not in Nexora yet**, all `familiar` as a placeholder):

| Branch | Nodes (prerequisites) |
|---|---|
| Frontend | `fe.html-css` ; `fe.js-basics` (python.functions, html-css) ; `fe.ui-state` (js-basics, web.call-api) |
| Backend | `backend.db-design` (sql-basics) ; `backend.async-queues` (build-simple-api) ; `backend.auth-deeper` (auth-basics) |
| Data | `data.tables-cleaning` (lists, dictionaries) ; `data.sql-analysis` (sql-basics) ; `data.stats-basics` |
| ML | `ml.train-evaluate` (data.tables-cleaning, data.stats-basics) ; `ml.overfitting` (train-evaluate) ; `ml.error-analysis` (train-evaluate) |

Assumptions about the shape (confirm or change):
- Gap and progress are counted on the **core** by default. A branch counts only after the learner adds it, and is shown as its own row, so branches never dilute the core count.
- In v1 the counts bar will be mostly "not in Nexora yet" (8 of 35 core nodes are real: 7 in the first row plus `python.debugging`), and the bar must show that as it is.
- `python.recursion`, `python.errors` and `python.classes` are core fundamentals that `first-domain.md` puts out of scope. They are listed so the tree has no hidden hole, not as a change to that doc.

**Gap and progress (deterministic):**
1. Requirement is *met* when the node's state is at or above its depth. `needs review` and `assumed` do not meet `working`.
2. Gap = unmet requirements, plus the prerequisites of those nodes that are not themselves met (transitive closure over the tree). Gaps are ordered by tree depth.
3. Progress is shown as counts, not a percent: **met / total**, with **assumed (not counted)** and **not in Nexora yet** as separate segments. A single blended score would let assumed knowledge pass as verified.
4. Wording is "skills evidenced for this role", never "ready for this role". We have no evidence about hiring.
5. A node can serve several roles and keeps one state. Switching goal changes the lens, not the learner's progress.

### Evidence rule for the AI-tools area (assumption, no Nexora data yet)

Same model as everywhere: states come from evidence records, and one answer is never proof. Nexora can only see what happens inside its own tasks, so it cannot know how a learner uses AI tools elsewhere.

1. **Task shape:** the learner gets code, a diff or an explanation said to be written by an AI tool, with at least one planted flaw: a wrong result, a missed edge case, a made-up API, or a plausible-sounding but wrong reason.
2. **What counts as evidence for `ai.review-output`:**
   - *apply:* finds the flaw and fixes it, and the fix passes hidden tests (deterministic);
   - *explain:* says why the suggestion is wrong, in their own words (LLM-graded against a rubric: medium evidence, never the only record);
   - *transfer:* does the same on a different kind of flaw or a different concept.
   `ai.explain-why-wrong` and `ai.verify-with-tests` use the same shape, with the explanation or the test as the main product.
3. **The flaw must sit in a concept the learner has `verified`** (or the node is not reachable). You cannot check what you cannot trace. This is why the prerequisites are `python.debugging` and `test.unit-basics`.
4. **Not counted as evidence, either way:** accepting AI output, asking an AI for help, or how often. The brief says not to optimize AI usage, so usage is never scored. A hint-3 style answer (the AI hands over the full fix) earns no credit, the same as a level-3 hint.
5. **"Without depending on them" = `solid`:** `ai.review-output` is `solid` only when a fresh task of the same kind, with no AI help in the task, is passed after a gap (3 days, assumption).
6. **Rotating flaws:** the same planted flaw is not reused, so the answer cannot be memorised.

Open: who writes the planted-flaw items and checks them, since AI-written flaws are generated content that must be validated before it counts (brief, Content Engine).

## 3. Learning path

The planner is rules over the tree. An LLM does not choose the order.

Inputs: the goal (a role, or a set of concepts), node states, recent evidence, the time since each verification.
1. **Target set:** unmet requirements of the goal, plus their unmet prerequisites.
2. **Candidates:** target nodes whose prerequisites are at least assumed-known.
3. **Order (assumption, tune with data):** (a) reviews that are due, (b) the `in progress` node that is closest to verified, (c) a short check on an assumed prerequisite that blocks the most target nodes, (d) a new node that unlocks the most remaining targets; ties go by tree order. At most one review is mixed into each session, which spaces practice.
4. **Output:** up to 3 steps, each with a kind (`learn`, `practice`, `check`, `review`), the goal it serves and the evidence still missing.

**Stability.** The path is stored and replaced only when a state-changing event happens, under the path-change rules in the pedagogy doc. One wrong answer produces no change to the list (acceptance test: replay a session with one miss and compare the two paths). Every change is logged with its reason code and evidence ids.

**"Why this next"** is filled from planner facts, not written by an LLM. An LLM may only rephrase for tone and may not add a claim. Each text gives three things: the reason, the evidence we have or lack, and the goal it serves. Draft wording for Lumi (English; Thai is open):

| Reason code | Shown to the learner |
|---|---|
| `check_assumed_prereq` | "Quick check on Loops first. You said you know it, but we haven't seen it yet, and Lists builds on it. Counts toward Software Engineer." |
| `continue_in_progress` | "Write a loop yourself. You've predicted loop output right twice. We still need one you write, and one in a new setting, before Loops counts as verified." |
| `review_due` | "Review Conditionals. You passed it 3 days ago. One unaided problem to see if it stuck." |
| `prereq_detour` | "Before Dictionaries, a short Lists check. Two earlier misses were about indexing." |
| `unlock_most` | "Functions is next: it opens 3 more skills on your Software Engineer path." |

## 4. Data model sketch (not a schema)

```
Concept        { id, domain, prereq_ids[] }                       curated, versioned
Role           { id, version, requirements[{concept_id, depth}] } curated, versioned
Goal           { learner_id, role_id | concept_ids[] }
EvidenceRecord { learner_id, concept_id, type, result, hint_level, verified, source, ts, context }
ConceptState   = f(EvidenceRecord[])              derived, rebuildable, one per learner x concept
RoleProgress   = g(Role, ConceptState[], Concept graph)   derived
PathStep       = planner(Goal, ConceptState[], Concept graph)  derived { concept_id, kind, reason_code, serves_goal, evidence_needed[] }
```

Only Concept, Role, Goal and EvidenceRecord are stored. The rest is recomputed, so changing a rule rebuilds state and needs no migration.

## 5. Deterministic vs AI

| Deterministic (code, testable) | AI (restricted) |
|---|---|
| State from evidence; role gap and progress; planner order; path-change rules; "why next" facts and templates | Grade an explanation against a rubric (medium evidence, never the only record); tag a misconception (a hypothesis); mentor dialogue; optional tone rephrase of "why next"; draft role or concept lists, which a person must approve |

## 6. Scope

| Piece | First domain (Python fundamentals) | Later |
|---|---|---|
| Skill tree | Full: 8 nodes, all 7 states, prerequisites as in `first-domain.md` | More domains, soft prerequisites |
| Learning path | Full: goal "finish Python fundamentals", rules above, "why next" | Goals across domains |
| Career path | One role, `software-engineer-modern` (core plus later branches, section 2). Only the 8 Python nodes are real; every other node is shown as "not in Nexora yet". The first end-to-end slice stays Programming Fundamentals (Python). | Real nodes for the other core areas, then branches (frontend, backend, data, ML) as their domains exist |

## 6b. Screen decisions (from Lumi's questions, my defaults)

- **Node detail** shows `evidence_needed[]` as structured items ("1 unaided write", "1 new setting") and, for `assumed`, its source: `you said` (self-report) or `we guess` (assessment / inference).
- **Not colour alone:** every state has a shape or icon plus a text label. `retained` must look clearly different from `verified`.
- **Soft lock:** opening a locked node leads to a short prerequisite check. The learner can take it, go back to the tree, or skip it. Skipping opens the node but changes no state. The prerequisite stays assumed or gap, and the check comes back at the first sign of trouble.
- **Correcting an assumption** is allowed ("I don't actually know this" → assumed-gap; "I know this" → assumed-known, still self-report). It never produces verified evidence.
- **Why-next card:** up to 3 steps with a kind chip and the goal served; the three-part text sits behind "Why?". Needs an empty state for no goal set and one for all steps done.
- **Career path v1:** "Software Engineer" title only (core tree; branches not shown yet), counts bar, unmet list with prerequisites, path nodes highlighted in the tree, no goal switcher.

## 7. Open questions (Nova / Aki)

1. One state enum for the whole team: `unknown/assumed/in_progress/verified/retained/needs_review` stored, `locked/available` derived? Arjun's section 3 and the `verified` rule there (3 rows, 2 types, different day) differ from `first-domain.md` (apply + explain + transfer, retention separate). I suggest `first-domain.md` wins because it owns the thresholds.
2. Who defines role requirements and depth, and from what source? I will not invent them. Default: a person curates; AI only drafts for approval.
3. Soft lock (open anything, with a check) or hard lock? I chose soft.
4. **Answered by Aki 2026-11-22:** the v1 role is a modern Software Engineer (core plus later branches), not the earlier backend-only role. Still open: is "career path" a P0 item? FR-01 to FR-09 do not name it.
5. Does the learner pick a role at onboarding, or only a concept goal? Several goals at once? With one broad role, are branches picked later by the learner?
6. Counts instead of a readiness percent: confirm.
7. Role depth is state-only. Concepts with real levels (basic vs advanced dictionaries) need sub-nodes later.
8. Thai wording for "why next"; the English above is a draft.
9. Review spacing beyond one 3-day probe (affects `retained` and `review_due`).
10. Priya was not consulted. Nothing here goes beyond the brief and Aki's three words.
11. Software Engineer core: who curates the nodes, links and depths (section 2)? They are placeholders. Is the core too wide for a first release (about 35 nodes, 8 real)?
12. AI-tools rule (section 2): who writes and validates the planted-flaw items, and is the 3-day gap for `solid` acceptable?
