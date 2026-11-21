# Target state

Where Nexora is heading, based on the brief. This is the shape, not a spec: each module gets its own design before it's built.
The harness detail is in [learning-harness.md](learning-harness.md) (Arjun) and [learning-harness-pedagogy.md](../product/learning-harness-pedagogy.md) (Sage).

## Principles that shape the code

- **Modular monolith.** One FastAPI app, one DB, modules with clear owners. No microservices, no broker.
- **Provider independent.** Learning logic never imports a provider SDK. It talks to the AI gateway only.
- **Deterministic where possible.** Planner rules, evidence scoring and interactive checks run without an LLM. AI is used for explanations, Socratic dialogue, drafting content and grading free-text, and its output is validated.
- **Evidence first.** Knowledge state is computed from append-only evidence records with provenance. It is never stored as a single score, and assumed and verified are kept separate.
- **Same contracts for web and desktop.** The desktop shell (later) reuses the web frontend and backend API.

## Modules

| Module | Owns | Grows from |
|---|---|---|
| `identity` | Users, auth, sessions, data export/delete | `routers/auth.py`, `models/user.py`, `utils/auth.py` |
| `ai_gateway` | Provider interface (generate/stream, models, validate), per-user encrypted credentials, capabilities, structured output, fallback, usage log | `services/llm/*` |
| `learner` / `memory` | Profile, evidence log, knowledge state per concept, misconceptions, experience, strategy notes, context pack for the mentor | new; seeds in `models/analytics.py` |
| `content` | Concept graph per domain, curated lessons/exercises, AI drafts with a validation state | `LESSON_FORMAT.md`, `agents/designer.py` output format |
| `learning` (harness, planner, evaluation) | Observe → Understand → Plan → Teach → Challenge → Evaluate → Reflect; path decisions with stored reasons; evaluation rules | `agents/planner.py` (fallback path), `assessment_generator.check_answer` |
| `interactive` | Exercise runners and checks (code vs tests, trace, predict-output) that work without an LLM | `frontend/src/components/lesson/*`, `engine/*`; a sandboxed runner is new |
| `mentor` | Socratic dialogue, server-side hint policy, misconception spotting | `agents/socratic_mentor.py` |
| `teaching_skills` | Versioned strategies, draft → tested → promoted gates (P1) | prompts now inside each agent |
| `billing` | Plans, quotas, managed AI (M5) | new, later |

## Key interfaces

- AI gateway (from the brief): `generate(req) -> stream of AIEvent`, `getModels()`, `validateConnection()`, plus a capability descriptor. The current `LLMProvider.complete/stream` becomes the inner adapter.
- Evidence record: `learner_id, concept_id, evidence_type, result, misconception?, source, verified, created_at, context` (the brief's example; not a final schema).
- Knowledge state per concept: `unseen | assumed | in_progress | verified | retained | needs_review` (Sage's proposal in `first-domain.md`).

## Frontend

The stack stays React + TypeScript + Vite + Tailwind. It gets a new design system and screens after Aki picks a redesign direction (Lumi, `docs/design/`). It adds a provider settings screen where credentials go to the backend only and are never stored or logged in the browser. Auth moves to httpOnly cookies.

## Out of scope until later milestones

Managed AI and billing (M5), desktop (M6), multiple domains beyond the first one, and auto-promoted teaching skills.
