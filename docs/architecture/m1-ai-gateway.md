# M1: AI provider foundation, working brief and API contract

Owner: Nova (plan). Backend: Rio. Settings screen: Kit. Tests: Juno. Review: Vex.
Branch `feat/m1-ai-gateway`, worktree `/home/akiena/code/dev-buddy-worktrees/m1-ai-gateway` (branched from `docs/m0-audit` f522632d).
Plan source: `docs/roadmap.md` "M1 plan" (6 steps + done-when). Decisions: D1, D2, D13, D15, D17, D21 in `docs/decisions/initial-decisions.md`.

## Aki's request (verbatim, via Chief 2026-11-25)

"ใช้กับ Nexora ให้หนักขึ้น... ให้ Nova สั่งต่อไป M1 เลย คือ build จริงทั้ง worktree ให้เสร็จเป็น web app ที่ใช้ได้" and "เอาเรื่องที่เราเรียนอยู่ใส่เข้าไปเป็นเนื้อหาแรก" -> "ok".

## What exists today (checked 2026-11-25 on f522632d)

- `backend/app/services/llm/base.py` `LLMProvider` with `complete()` and `stream()` only.
- `backend/app/services/llm/factory.py` `get_llm_provider()`: one cached global provider from `.env` (`LLM_PROVIDER`, `LLM_MODEL`), 6 providers: anthropic, openai, gemini (OpenAI-compatible endpoint), openrouter, ollama, openwebui. Line 14 prints provider+model to stdout.
- 7 agents call `get_llm_provider()` directly: choreographer, code_analyzer, socratic_mentor, planner, designer, assessment_generator, lesson_suggester. JSON parsing via `extract_json` in `agents/utils.py`.
- DB: SQLAlchemy `create_all`, no Alembic (Alembic is M2 step 1, D8). No `backend/tests/`.

## Scope choices (Nova, reversible)

1. Gateway lives in `backend/app/ai_gateway/` (a module inside the monolith). `services/llm/*` adapters move or are wrapped there; keep the code that works.
2. Slots: credentials carry `slot` = `text` | `live` (D17). M1 builds and tests the `text` slot end to end. `live` is stored and listed but its realtime test is out of M1 (no realtime code in M1).
3. Provider ids in M1: `anthropic`, `openai`, `gemini`, `openrouter`, `ollama`, `lmstudio`, `vllm`, `openai_compatible` (custom). `openwebui` stays as an `.env` dev option. LM Studio, vLLM and custom are the OpenAI-compatible adapter with a required base URL.
4. Resolution order per call: the user's saved `text` credential if present and active, else the `.env` default (dev). No silent fallback to another provider after an error: the error is returned as a typed gateway error.
5. Encryption: Fernet (`cryptography`, already pulled in by `python-jose[cryptography]`). Key from env `CREDENTIAL_ENCRYPTION_KEY`. In `APP_ENV=development` only, if unset, generate one into `backend/.credential_key` (gitignored, mode 600). In any other env, missing key = startup error.
6. No new framework (no LangChain wrappers, D14). Plain httpx/official SDKs already in requirements.

## Gateway interface (Python)

```python
class AIGateway:
    async def generate(self, req: GenerateRequest) -> AsyncIterator[AIEvent]  # events: text_delta, done(usage), error
    async def complete(self, req: GenerateRequest) -> GenerateResult            # convenience, collects generate()
    async def complete_json(self, req, schema: type[BaseModel], retries: int = 1) -> BaseModel  # step 4
    async def get_models(self) -> list[ModelInfo]
    async def validate_connection(self) -> ConnectionStatus   # never raises; failures come back as ok=False + error_code
    async def get_capabilities(self) -> Capabilities  # streaming, json_mode, tools, realtime, local
```
`get_gateway(user_id: str | None, slot="text")` builds it from the user's credential or the `.env` default (text slot only; the `live` slot has no `.env` default). Agents take `(user_id, gateway=None)` and call the gateway through `agent_llm(...)`, which keeps the old `complete/stream` call shape so prompts did not change; nobody imports `get_llm_provider` after M1.

As built (Rio, 2026-11-25): `get_capabilities()` is async because the provider is only known after resolving the user's credential. Code lives in `backend/app/ai_gateway/` (adapters/, gateway.py, credentials.py, crypto.py, errors.py, usage.py, json_output.py).

## HTTP API (contract for Kit; Rio may adjust names, then update this file)

All under `/api/ai`, JWT required, user-scoped. Secrets never appear in any response.

| Method | Path | Body / result |
|---|---|---|
| GET | `/api/ai/providers` | `[{id, label, needs_key, needs_base_url, default_base_url, supports_live, local}]` |
| GET | `/api/ai/credentials` | `[{id, slot, provider, model, base_url, key_hint: "…ab12", status: "untested"/"ok"/"failed", last_checked_at, last_error}]` |
| PUT | `/api/ai/credentials/{slot}` | `{provider, model?, base_url?, api_key?}` → saved record (no key). Omitting `api_key` keeps the stored one. |
| POST | `/api/ai/credentials/{slot}/test` | → `{ok, latency_ms, model_count, error_code?, message?}`; updates status. Always HTTP 200: a failed test is `ok: false`. For the `live` slot this is a connection check only (no realtime session yet). |
| GET | `/api/ai/credentials/{slot}/models` | → `[{id, label?, context_window?}]` from the provider |
| DELETE | `/api/ai/credentials/{slot}` | revoke: row deleted, ciphertext gone; calls fall back to `.env` default. → **204** no body; 404 if nothing saved |
| POST | `/api/ai/test-draft` | `{provider, base_url?, api_key?, slot?}` test before save (nothing stored) → `{ok, latency_ms, model_count, error_code?, message?, models: [...]}`. `slot` (optional): reuse the key already saved in that slot when `api_key` is omitted, so the form can change model/URL without retyping the key. `models` fills the model picker. |

Rules as built:
- PUT without `api_key` keeps the stored key only if provider and base URL are unchanged; otherwise 400 (a saved key is never sent to a new host without being re-entered).
- `base_url` must be http(s), no spaces, no `user:pass@`, no query or fragment (422 otherwise). Any host is allowed on purpose, so local LLMs work; that also means the server will call any URL a logged-in user saves (SSRF risk to review before multi-tenant hosting).
- `openwebui` is dev `.env` only: not in `/providers`, PUT rejects it.

Error codes: `auth_failed`, `not_found`, `rate_limited`, `unreachable`, `bad_request`, `provider_error` (plus `cancelled` in the usage log when a call is dropped mid-way).
Error shape for `/models`, PUT and other non-test routes: HTTP **400** for `bad_request`, **502** for every provider-side error (not 401, because the frontend treats 401 as logout), body `{"detail": {"error_code": "...", "message": "..."}}`. Messages are fixed text per code plus the HTTP status; provider error bodies are never passed through (some echo the key).

## Usage log (step 5)

Table `ai_usage`: user_id, slot, provider, model, agent (caller name), source (user/env/draft), started_at, latency_ms, input_tokens?, output_tokens?, ok, error_code. No prompt or response bodies. No keys, headers or full URLs with query strings. Written in the background so a slow write never delays a lesson. Streamed calls on OpenAI-compatible providers log no token counts yet.

## Logging rules

Remove the `DEBUG:` prints in `config.py` and `factory.py` (or turn them into logger.debug without secrets). No key, no `Authorization` header, no request body in logs or exceptions returned to the client.

## Settings screen (step 6)

Route `/settings` in `frontend/`, built in design A. Path (D18). Reference: mock `~/code/nexora-mock/src/body.html` lines 109-116 and its CSS. Two cards: Text mentor (working) and Live mentor (stored only, "live test comes later"). Provider select → key field (password, never re-shown, shows `key_hint`) / base URL when needed → Test connection → model picker filled from the provider → Save. Delete key. Line: "Your learning record stays with Nexora if you switch provider." Mobile 390 px works. Nothing secret in localStorage or the Zustand store.

## Done when (roadmap)

Each supported provider passes a recorded connection test, existing flows run unchanged through the gateway, and Vex finds no secret in logs or responses.

Real keys available on this machine (server side only, D13): Gemini, OpenRouter, OpenWebUI (in Aki's `~/code/dev-buddy/.env`, read-only) and local Ollama (`/usr/bin/ollama`, no model pulled yet). Anthropic and OpenAI have no key: their test runs against a local stub server and is marked "stub, not live" in the log. LM Studio / vLLM / custom: tested via the OpenAI-compatible path against local Ollama's `/v1`.

Ports for this worktree: backend 8011, frontend 5183 (8000 is in use by another process; leave it alone).
