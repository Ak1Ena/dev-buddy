# Initial decisions

Each item is a **proposal** until Aki marks it decided. "Evidence" points to [current-state.md](../architecture/current-state.md) and [m0-evidence.txt](../architecture/m0-evidence.txt).

| # | Decision | Status | Why | Evidence |
|---|---|---|---|---|
| D1 | **Evolve the existing repo, don't rewrite.** Keep the backend skeleton (FastAPI, auth, models, LLM adapters, mentor). Replace the learning logic module by module. Rebuild the UI screens on the new design. | Proposed | The stack already matches the brief; backend imports and the build pass; the gaps are in logic (evidence, memory, gateway), not in the framework | 28 routes import ok; `vite build` ok; `services/llm/*` already supports 6 providers |
| D2 | Keep React + TS + Vite + Tailwind for the frontend; keep FastAPI + SQLAlchemy for the backend | Proposed | Brief proposes the same; no reason found to switch | `frontend/package.json`, `backend/requirements.txt` |
| D3 | `frontend/` is the one web app. `dev-buddy-ui` is a reference only, not merged | Proposed | Two UIs on the same API drift apart; the redesign replaces both looks | `dev-buddy-ui/src/lib/api.js:3` |
| D4 | First domain = Python fundamentals, 8 concepts (Sage) | Proposed | Matches the primary audience and the existing code; evidence can be checked by running code | `docs/product/first-domain.md` |
| D5 | Knowledge = evidence records → computed per-concept state; old `weak_areas` imported as *assumed* | Proposed | The brief requires assumed vs verified; today it's one quiz score | `models/user.py:25-26`, `assessment_agent.py:213` |
| D6 | Hint level and lesson completion are decided server side | Proposed | Today both are trusted from the client | `Learn.tsx:388`, `routers/learning.py:907` |
| D7 | Learning harness follows the Hermes-inspired design (memory, skills as procedure, reflection with gates) | Proposed | Aki asked for it; see harness docs | `docs/architecture/learning-harness.md` |
| D8 | Add Alembic migrations and a real `backend/tests/` before M2 schema changes | Proposed | `create_all` only, no tests | `database.py:30`; no tests folder |
| D9 | No feature building until Aki picks a design direction | Decided (Aki, 2026-11-22) | Aki: redesign first | Chief brief |
