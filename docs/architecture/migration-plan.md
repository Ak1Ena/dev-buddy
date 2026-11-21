# Incremental migration plan

From [current-state.md](current-state.md) to [target-state.md](target-state.md) without a rewrite. Each step is small, ships alone, keeps existing flows working, and can be reverted.

| Step | Change | Keeps working | Check |
|---|---|---|---|
| 0 | Housekeeping: add `libcst` to requirements, fix `CLAUDE.md` stack (Vite, not Next.js), move loose root scripts/notes into `docs/archive/` or delete them (with Aki's ok), and delete the unused `agents/assessment_agent.py` | everything | import check, build |
| 1 | Alembic baseline from the current models + `backend/tests/` with a test DB | everything | `pytest` green, recorded |
| 2 | `ai_gateway` wraps `services/llm`; agents switch to it one by one | all AI flows | per-agent before/after run log |
| 3 | Per-user provider credentials (encrypted) + endpoints; `.env` stays the fallback | users without their own key | connection tests per provider |
| 4 | `evidence` table; write rows from existing events (assessment answers, hints, workshop) alongside the current logic | current scoring untouched | rows appear, recorded |
| 5 | Knowledge state computed read-only; compare with today's weak/strong lists | current planner | comparison report |
| 6 | Planner and mentor read knowledge state; hint level and completion move server side | the old fields stay in sync for one release | unit tests on rules + e2e video |
| 7 | New frontend screens on the picked design, route by route (provider settings first, then learning space) | old screens until each is replaced | e2e video per route |
| 8 | Mentor prompt becomes teaching skill v1; registry + gates follow (M4) | mentor behaviour unchanged | same transcripts before/after |

Rules: no step mixes schema changes with UI changes; the Socratic rule (no direct answers, hint levels 0-3) is preserved throughout; Aki's uncommitted `Learn.tsx` work is merged or parked by Aki before step 7 touches that page.
