# Feature inventory (M0)

Mapped against the brief's requirements. Evidence: [current-state.md](../architecture/current-state.md). Status: **Have** = works in code, **Partial** = exists but doesn't meet the brief, **Missing**.
"Reuse" says what to do with the code, not with the look (the UI is being redesigned).

| FR | Requirement | Status | What exists | Reuse? |
|---|---|---|---|---|
| FR-01 | Learning profile | Partial | `users` row: skill_level, preferred_language, weak/strong areas | Keep the user/auth tables; move knowledge out of the user row |
| FR-02 | Initial assessment | Partial | Code → concepts → LLM questions → % score → level (`routers/assessment.py`, `agents/assessment_generator.py`) | Reuse question checking and the concept list; replace level/% output with per-concept assumed states (see `first-domain.md`) |
| FR-03 | Adaptive path | Partial | LLM planner with a deterministic fallback (`agents/planner.py`) | Keep the fallback idea; the planner must read the learner model and a prerequisite graph, not just weak_areas |
| FR-04 | Curated + AI-assisted lessons | Partial | All lesson content is AI-generated at request time (`agents/designer.py`, `LESSON_FORMAT.md`) | Reuse the lesson JSON format as a starting point; add a curated, validated content store |
| FR-05 | Interactive learning space | Have (partial) | Animation player, code walkthrough, step flow, concept graph, data view, scene engine (`frontend/src/components/lesson/*`, `engine/*`) | Strong reuse candidate for the logic; restyle to the new design |
| FR-06 | AI mentor | Have (partial) | Socratic mentor, hint levels 0-3, streaming chat (`agents/socratic_mentor.py`, `routers/chat.py`) | Reuse the prompt and the hint model; move the hint level to the server side |
| FR-07 | Persistent memory | Missing | Chat history and hint events only | New learner memory module |
| FR-08 | BYOAI | Partial | 6 providers behind one interface, but server-wide, from `.env` (`services/llm/factory.py`) | Grow into the AI gateway (M1): per-user credentials, validation, model list |
| FR-09 | Evidence & evaluation | Missing | Client-reported completion + workshop score (`routers/learning.py:907`) | New evidence module |
| FR-10 | Teaching skill registry | Missing | Prompts hard-coded in each agent | New (P1) |
| FR-11 | Managed AI subscription | Missing | — | Later (M5) |
| FR-12 | Desktop | Missing | — | Later (M6) |

## Additions requested by Aki (2026-11-22)

Aki (verbatim): "เราอยากให้มี skill tree, career path, learning path". These extend FR-01 (profile/goals) and FR-03 (adaptive path). Model: `docs/product/skill-career-path-model.md` (Sage).

| ID | Feature | Extends | Status | What exists |
|---|---|---|---|---|
| FR-01a | Skill tree: concepts with prerequisites; node state from evidence only (assumed vs verified) | FR-01, FR-09 | Missing | `ConceptTree.tsx` / `ConceptGraph.tsx` draw concept graphs for a lesson, but there is no learner state behind them |
| FR-01b | Career path: target roles mapped to the skills they need, with gap and progress | FR-01 | Missing | — |
| FR-03a | Learning path with a visible "why this step next" | FR-03 | Partial | LLM-built lesson list with no stored reasons (`agents/planner.py`) |

Other things in the code that the brief doesn't list: learning spaces (several per user), "instant discovery" from pasted code, AI-named spaces, lesson "surrender", hint-usage analytics. Keeping them is Aki's call; none of them block M1/M2.
