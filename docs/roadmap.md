# Nexora roadmap

Milestones come from the brief. Dates are not set. Each milestone ships on its own branch, tests are recorded, and nothing goes to `main` without Aki's ok.

| Milestone | Goal | Status |
|---|---|---|
| M0 Repository audit | Current state, feature inventory, decisions, migration plan | **Done** (this branch, `docs/m0-audit`) |
| Redesign | Design system + mock site (incl. skill tree, career path, learning path), 2-3 directions, UX/UI reviewed, videos, Aki picks one | **In progress** (Lumi; mock site in `/home/akiena/code/nexora-mock/`) |
| M1 AI provider foundation | AI gateway, per-user BYOAI credentials, model list, connection check, provider settings screen | Planned, not started |
| M2 Learning harness | Evidence log, knowledge state, planner on evidence, server-side hints, first domain end to end | Planned, not started |
| M3 Interactive learning | Sandboxed code runner, trace/predict-output checks, the new lesson space | Later |
| M4 Teaching intelligence | Teaching skill registry, reflection drafts, validation gates | Later |
| M5 Managed AI + subscription | Quotas, routing, billing | Later |
| M6 Platform expansion | Desktop shell, more domains | Later |

## M1 plan: AI provider foundation (not started)

Owner: Rio (backend), Kit (settings UI after the design pick). Review: Vex. Tests: Juno.
1. Wrap the current `LLMProvider` into an `ai_gateway` module with `generate` (stream of events), `get_models`, `validate_connection` and a capability descriptor. All agents call the gateway, not `get_llm_provider()`.
2. Per-user provider config: provider, model, base URL, credential. Credentials are encrypted at rest with a server key, never returned to the browser, and never logged. Revoke/delete is supported. The `.env` provider stays as the dev default.
3. Endpoints: list providers, save/test/delete a credential, list models.
4. Structured output helper (JSON schema + validate + retry), replacing the `extract_json` parsing in `agents/utils.py`.
5. Usage log per call (provider, model, tokens if reported, latency, error), with no prompt bodies by default.
6. Settings screen (new design).
Done when: each supported provider passes a recorded connection test, existing flows run unchanged through the gateway, and Vex finds no secret in logs or responses.

## M2 plan: learner model + evidence (not started)

Owner: Rio, Sage (rules), Kit (screens). Review: Vex. Tests: Juno.
1. Alembic baseline + `backend/tests/` (D8).
2. Concept graph for the first domain (Sage's 8 concepts).
3. Append-only `evidence` table. Existing assessment answers, hint events and workshop results are written as evidence; old `weak_areas` are imported as `assumed`.
4. Knowledge state computed from evidence, using Sage's rules, with unit tests for every rule (one wrong answer changes nothing, hint 3 gives no credit, and so on).
5. Server-side hint level and lesson completion (D6).
6. Planner reads knowledge state + prerequisites. The LLM only words the path and never decides it alone. Every decision stores its inputs.
7. Progress/evidence screen.
8. Skill tree, career path and learning path with "why next" (Aki's additions FR-01a, FR-01b, FR-03a; model in `docs/product/skill-career-path-model.md`). For the first domain only, with one or two sample roles.
Done when: one learner can go assessment → path → lesson → mentor → evidence for the first domain, with recorded tests and video.

See [migration-plan.md](architecture/migration-plan.md) for the order of changes inside the existing code.
