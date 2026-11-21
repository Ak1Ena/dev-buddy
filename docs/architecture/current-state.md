# Current state (M0 audit)

Audited 2026-11-22 by Nova on branch `docs/m0-audit`, which was cut from `test` at commit `5254f5d8` (2026-05-16, 76 commits).
Command output for the claims below is in [m0-evidence.txt](m0-evidence.txt). Anything marked *not checked* was not verified.

## Summary

devBuddy is a working prototype of a Socratic Python mentor. A learner pastes code, the AI extracts concepts, generates a quiz, scores it, builds a lesson path and teaches with animated lessons and a hint-levelled chat.
Its stack and skeleton fit the Nexora brief. Its learning logic does not yet: knowledge is a single score plus weak/strong topic lists, lesson completion is whatever the client reports, and almost every decision is an LLM call.

## Stack (as found, not as the docs say)

| Layer | Actual | Note |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite 6 + Tailwind 3 + Zustand + framer-motion + Monaco (`frontend/package.json`) | `CLAUDE.md` says "Next.js 14 App Router"; that is out of date |
| Backend | FastAPI 0.115, SQLAlchemy 2 async, Pydantic 2, python-jose JWT, passlib/bcrypt (`backend/requirements.txt`) | |
| DB | SQLite via aiosqlite; tables created with `Base.metadata.create_all` (`backend/app/database.py:30`) | Alembic is in requirements but there are no migrations |
| AI | Own `LLMProvider` interface with `complete` and `stream` (`backend/app/services/llm/base.py`). Factory picks one provider from `.env` (`services/llm/factory.py`): anthropic, openai, openrouter, gemini, ollama, openwebui | One global provider per server, chosen at boot (`lru_cache`) |
| Second UI | `/home/akiena/code/dev-buddy-ui`: separate React 19 + Tailwind 4 JS app ("Oracle Terminal" look, `Design.md`), ~4.5k lines, same API (`src/lib/api.js:3`) | Not git. Read only |

Size: about 14.1k lines of app code across `backend/app` and `frontend/src`. The biggest files are `routers/learning.py` (1060), `pages/Learn.tsx` (1052) and `routers/chat.py` (607).

## Backend modules

- `routers/`: auth, assessment, learning, chat, analytics, scenes. There are 28 routes under `/api/v1` (import check in the evidence log).
- `agents/`: socratic_mentor, planner, assessment_generator, code_analyzer, designer (lesson content), lesson_suggester, choreographer (scene animation). All of them call `get_llm_provider()` directly.
- `agents/assessment_agent.py` (fixed question bank) is **not imported anywhere**, so it is dead code. It also duplicates `calculate_score` from `assessment_generator.py:348`.
- `core/ast_analyzer.py` uses `libcst`, but `libcst` is **missing from requirements.txt** (it is only in the local `.venv`).

## Data model (`backend/app/models/`)

users (skill_level, assessment_score, weak_areas, strong_areas as JSON on the user row) · assessment_sessions / assessment_answers · learning_spaces · learning_paths · lessons (content JSON) · lesson_progress (status, hints_used, workshop_score) · chat_sessions / chat_messages · hint_usage_events · skill_progression (snapshots).

There is no concept graph, no per-concept knowledge state and no evidence records. Knowledge is held in `User.weak_areas` / `strong_areas` lists (`models/user.py:25-26`).

## Learning flow today

1. **Assessment**: the learner pastes code → `code_analyzer` (LLM) extracts concepts → `assessment_generator` (LLM) writes questions → answers are checked → `calculate_score` gives percent correct, a level (`>=80` intermediate, else beginner) and topic lists from 70%/50% cut-offs (`assessment_agent.py:213` and the generator copy).
2. **Path**: `PlannerAgent` (LLM) builds 3-8 lessons. A deterministic fallback exists (`planner.py:_build_fallback_path`).
3. **Lesson**: `designer` (LLM) generates lesson content JSON. The frontend plays it with animation, step and visualization components (`components/lesson/*`, `engine/*`).
4. **Mentor**: `SocraticMentorAgent` with hint levels 0-3 (`socratic_mentor.py:14`). The hint level is **sent by the client** (`Learn.tsx:388` → `routers/chat.py:227`), so the learner can jump straight to level 3.
5. **Progress**: `PATCH /lesson/{id}/progress` accepts `status: "completed"` and `workshop_score` **from the client** (`routers/learning.py:907-950`). Completion is self-reported, not evidenced.

## Frontend

Routes (`frontend/src/App.tsx:23-31`): `/`, `/login`, `/register`, `/assessment`, `/dashboard`, `/space/:spaceId`, `/learn/:lessonId`, `/learn/:lessonId/workshop`.
JWTs are kept in JS-readable cookies via `js-cookie` (`lib/api.ts:53-54`), not httpOnly. There is no provider-settings UI: provider choice is server `.env` only.

## Checks run (see evidence log)

| Check | Result |
|---|---|
| `npm ci` (frontend) | ok, 278 packages |
| `tsc --noEmit` on working tree | **fails**: 2 errors at `Learn.tsx:345,349` (Timeout type) |
| `tsc --noEmit` on clean HEAD `5254f5d8` | ok, so the errors come from Aki's uncommitted `Learn.tsx` edit |
| `vite build` | ok, but the JS bundle is 701 kB (warning > 500 kB) |
| Backend `import app.main` | ok, 28 routes |
| Automated tests | **none**. No `tests/` folder; the root has ad hoc scripts only (`test_flow.py`, `test_fix.py`, `test_discovery.py`, `test_openwebui.py`) |
| Running app end to end with a real LLM | *not checked* this round (needs a key; Lumi is screenshotting the UI) |

## Risks and tech debt

- **Security**: default `secret_key` / `jwt_secret_key` in `config.py`; tokens readable by JS; hint level and lesson completion are trusted from the client; no rate limiting on LLM endpoints; 8 `print()` debug lines in `backend/app` (provider and model only, no keys seen).
- **Learning integrity**: mastery = one quiz score; the path changes on LLM judgement; no assumed vs verified split.
- **Coupling**: every agent calls the provider directly and builds its own prompt; there is no gateway, capability info, fallback or audit log of AI decisions.
- **Ops**: no migrations, no tests, a dependency missing from requirements, stale `CLAUDE.md`, about 20 loose planning `.md` files and scripts at the repo root.
- **Two UIs** (`frontend/` and `dev-buddy-ui`) that drift apart.
