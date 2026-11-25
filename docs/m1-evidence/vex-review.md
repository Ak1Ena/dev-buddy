# M1 security review (Vex) — 4e90b9a1 (frontend /settings) + 0432c800 (backend gateway)

Reviewed 2026-11-25 on `feat/m1-ai-gateway`. Committed code only, plus deltas for e6e37671 and c213db55 (bottom).
Cited line numbers in Findings were checked against `git show 0432c800:<file>`; the c213db55 delta cites `git show c213db55:<file>`.

**Final M1 verdict (after c213db55): secrets found: none. F1-F8 all PASS. No new findings above Info.**

## Verdict (at 0432c800)

**Secrets found: none.** No provider key, Fernet key or JWT secret in any API response, log line,
exception detail, `ai_usage` row, git history or the frontend bundle.

**Security: PASS with findings.** Nothing blocks M1 "no secret in logs or responses". One Medium
(base_url SSRF, left open on purpose) and two Medium carry-overs from before M1 need a decision before
anything is deployed beyond localhost.

### Secret greps run

The scan loads key values from the worktree `.env` into shell variables and prints only names and
hit counts. Never echoed. Script: `/home/akiena/.openmausbot/workspaces/998a7ddf-939f-4a2f-bc81-db5ef8aca6b2/m1-review/vex_secret_scan.sh`.

```
$ bash vex_secret_scan.sh     # greps each .env value (len>=8) in: docs backend/{scripts,tests,app}
                              # frontend/src frontend/dist /tmp/vex-dist, `git log -p --all`, backend/devbuddy.db, *.log
keys loaded from .env (names, length>=8): OPENWEBUI_API_KEY GEMINI_API_KEY SECRET_KEY CREDENTIAL_ENCRYPTION_KEY JWT_SECRET_KEY OPENROUTER_API_KEY
OPENWEBUI_API_KEY: worktree files=0  git-history-lines=0  devbuddy.db=0  logs=0
GEMINI_API_KEY: worktree files=0  git-history-lines=0  devbuddy.db=0  logs=0
SECRET_KEY: worktree files=0  git-history-lines=2  devbuddy.db=0  logs=0
CREDENTIAL_ENCRYPTION_KEY: worktree files=0  git-history-lines=0  devbuddy.db=0  logs=0
JWT_SECRET_KEY: worktree files=0  git-history-lines=3  devbuddy.db=0  logs=0
OPENROUTER_API_KEY: worktree files=0  git-history-lines=0  devbuddy.db=0  logs=0
```
The SECRET_KEY / JWT_SECRET_KEY history hits are **the public placeholder** from `.env.example`
(commit 7013de9e), not a leaked secret. See F4: the dev `.env` still uses that placeholder.

```
# frontend bundle, built fresh from the worktree: npx vite build --outDir /tmp/vex-dist
$ grep -oE 'sk-ant-[A-Za-z0-9_-]{8,}|sk-or-v1-[A-Za-z0-9]{8,}|sk-(proj-)?[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}' /tmp/vex-dist/assets/*.js | wc -l
0
$ grep -oE '(ANTHROPIC|OPENAI|GEMINI|OPENROUTER|OPENWEBUI)_API_KEY|CREDENTIAL_ENCRYPTION_KEY|DEV_API_PROXY|VITE_[A-Z_]+' /tmp/vex-dist/assets/*.js | sort | uniq -c
(no output)

# key-shaped strings (incl. Fernet tokens gAAAAA…) in evidence, scripts, tests, and the whole branch history
$ grep -rnoE '<same patterns>|gAAAAA[A-Za-z0-9_=-]{20,}' docs/m1-evidence backend/scripts backend/tests
(no output)
$ git log -p feat/m1-ai-gateway | grep -oE '<same patterns>' | sort -u
(no output)

$ git check-ignore -v backend/.credential_key .env
.gitignore:83:backend/.credential_key	backend/.credential_key
.gitignore:46:.env	.env
$ git ls-files | grep -iE '(^|/)\.env|credential_key|\.db$|\.pem$|secret'
.env.example
$ stat -c '%a' .env
600
```

### Live probe (throwaway key, temp DB, committed backend)

`probe.py` runs the real app through `httpx.ASGITransport` against a `git archive 0432c800` copy, with a fake
key `sk-vexprobe-THROWAWAY-…`, three local stub servers (an "internal" JSON service, a 302 redirector, and a
provider that echoes the key back in its 401 body), and the root logger on DEBUG for every library.
Script and full output: `…/998a7ddf-…/m1-review/probe.py`, `probe-0432c800.out`.

```
5  save:  200 {"…","key_hint":"…cdef","status":"untested",…}        # no key field
6  list:  [{"…","key_hint":"…cdef",…}]
7  test (provider echoes key in 401): {"ok":false,"error_code":"auth_failed","message":"The provider rejected the API key. (HTTP 401)"}
8  draft test (echo): same, models: []
10 user B GET list: []
11 user B test A's slot: 404
12 user B delete A's slot: 404
13 user B draft with slot=text (reuse A key?): auth_failed        # A's key not reused
14 rows before revoke (count, with ciphertext): (1, 1)
15 A revoke: 204
16 rows after revoke: (0,)  key bytes in db file: 0  ciphertext bytes left in db file: 1  secure_delete: (0,)
17 no auth GET /api/ai/providers: 403
18 no auth POST /api/v1/scenes/analyze: 200
19 ai_usage columns: id,user_id,slot,provider,model,agent,source,started_at,latency_ms,input_tokens,output_tokens,ok,error_code
20 key in any HTTP response body: 0 | tail-16 of key in responses: 0
21 key in DEBUG logs (all loggers): 0 | log lines: 2026
22 key in usage rows: 0
```

Committed backend tests: `git archive 0432c800 backend` → `pytest -q` → **46 passed**.

## Findings

| # | Sev | Where | What | Owner |
|---|---|---|---|---|
| F1 | Medium (High once hosted) | `backend/app/schemas/ai.py:12-24`, `ai_gateway/providers.py:87-93`, `adapters/openai_provider.py:68` | base_url SSRF, follows redirects, reflects responses | Rio — Nova decides |
| F2 | Medium (pre-M1) | `backend/app/routers/scenes.py:19-22` | unauthenticated route spends the server .env key | Rio (sent) |
| F3 | Low | `.env.example` | `CREDENTIAL_ENCRYPTION_KEY` missing, though prod requires it | Rio (sent) |
| F4 | Medium (pre-M1) | `backend/app/config.py:12,60`, `backend/app/main.py:17-21` | no prod guard on placeholder JWT/secret key; dev .env uses the placeholder | Rio — Nova decides |
| F5 | Low | `ai_gateway/credentials.py:96-102` | revoke deletes the row, but ciphertext bytes stay in SQLite free pages | Rio — Nova decides |
| F6 | Low | `ai_gateway/gateway.py:44-67` | adapter cache keeps the plaintext key in memory after revoke | Rio — Nova decides |
| F7 | Info | `backend/app/main.py:39` | CORS merges ALLOWED_ORIGINS; `*` + credentials not refused | Rio |
| F8 | Info | `ai_gateway/crypto.py:38-39` | existing dev key file read without a mode check | Rio |

### F1 — base_url SSRF (Medium; High on any shared deployment)

Any logged-in user can make the backend send GET/POST to any host:port, including loopback, private
ranges and cloud metadata (169.254.169.254). Model ids from the target come back in the response. The
OpenAI and Anthropic SDK clients follow redirects, so a public URL that 302s inward bypasses any future
IP check that only looks at the saved URL. `ok`/`error_code` plus `latency_ms` also give a port-scan oracle.
Limits today: path always ends `/models` or `/chat/completions`, no query string, no userinfo, and httpx drops
`Authorization` on a cross-origin redirect, so the user's key does not follow the redirect.

Proof (probe lines 1-4):
```
1 SSRF direct: {"ok":true,"model_count":2,…,"models":[{"id":"INTERNAL-ONLY-db-admin.svc:5432"…},{"id":"build-token-should-not-leave"…}]}
2 SSRF via 302: {"ok":true,"model_count":2,…same internal ids…}
3 oracle closed port 1: ok=False error_code=unreachable
3 oracle open non-API port (redirector): ok=True error_code=None
4 metadata IP accepted by validator: 200
$ python -c "…AsyncOpenAI(…)._client.follow_redirects; AsyncAnthropic(…)._client.follow_redirects"
openai follow_redirects True
anthropic follow_redirects True
```

Fix (smallest guard, keeps local LLMs working in dev):
1. New setting `AI_ALLOW_PRIVATE_BASE_URLS` (default true only when `APP_ENV=development`).
2. One function in `ai_gateway/providers.py`, called from `effective_base_url`: resolve the host. Always
   reject link-local (169.254.0.0/16, fe80::/10) and the metadata names. When the setting is off, also
   reject loopback, private, CGNAT, unique-local and reserved addresses.
3. Build the SDK clients with `http_client=httpx.AsyncClient(follow_redirects=False)` (OpenAI and Anthropic
   adapters), so a redirect cannot route around step 2.
4. Later (M2): per-user rate limit on `/test-draft` and `/credentials/{slot}/test`.
DNS rebinding stays possible after this (resolve-then-connect). Pin the resolved IP only if Nexora gets hosted
for strangers.

### F2 — `/api/v1/scenes/analyze` has no auth and bills the server key (Medium, pre-M1)

`scenes.py:19-22` builds `ChoreographerAgent()` with no user. The gateway then resolves to the `.env`
default, so anyone who can reach the port spends Aki's key. `SCENE_CACHE` (line 11) also grows without
bound, and `GET /scene/{id}` is unauthenticated. This is the last agent constructor without a user:
```
$ grep -rnE '(Agent|…)[A-Za-z]*\(\)' backend/app | grep -v 'class '
app/routers/scenes.py:21:    choreographer = ChoreographerAgent()
probe 18: no auth POST /api/v1/scenes/analyze: 200
```
Fix: `current_user: User = Depends(get_current_user)` on both routes, `ChoreographerAgent(current_user.id)`.
Store the owner with each scene and check it on GET.

### F3 — `.env.example` has no `CREDENTIAL_ENCRYPTION_KEY` (Low)

`crypto.py:32-37` refuses to start outside development without it, but the template does not list it.
```
$ grep -c CREDENTIAL_ENCRYPTION_KEY .env.example
0
```
Fix: add `CREDENTIAL_ENCRYPTION_KEY=` with a one-line comment carrying the generate command from crypto.py:36.

### F4 — placeholder JWT / app secret, no prod guard (Medium, pre-M1, more impact now)

`config.py:12` and `:60` default to `dev-secret-change-in-production` / `jwt-secret-change-in-production`.
The worktree `.env` uses exactly those public values (lengths 42/40, checked by comparison, never printed).
M1 added a startup guard for the credential key (`crypto.py:32`), but nothing like it for the JWT secret.
With M1 a forged token can now test, list models with, overwrite or delete any user's saved provider key,
and spend it through the agents.
```
SECRET_KEY: equals a public placeholder/default (len 42)        # found in 7013de9e .env.example
JWT_SECRET_KEY: equals a public placeholder/default (len 40)
```
Fix: in `lifespan` (main.py:17), next to `ensure_credential_key()`, refuse to start when `APP_ENV != development`
and `jwt_secret_key` or `secret_key` is the placeholder or shorter than 32 chars. Put a fresh random value in
the dev `.env` too (Aki's file. Rotate, nothing to revoke).

### F5 — revoked ciphertext stays in SQLite free pages (Low)

Revoke deletes the row (`credentials.py:96-102`, probe 14-16: row count 1 → 0, API no longer returns it).
The Fernet bytes stay in the DB file until the page gets reused or VACUUMed (`secure_delete` is 0). They are
useless without the Fernet key, which lives in `.env`, not the DB. Same for a replaced key.
Fix: `PRAGMA secure_delete=ON` in a SQLite `connect` event in `app/database.py`. Postgres: fine as is (autovacuum).

### F6 — plaintext key stays in the adapter cache after revoke (Low)

`gateway.py:44-67` caches up to 32 adapters, each holding its plain key. `delete_credential` / `upsert_credential`
do not evict. Other users cannot reach it: the cache key includes a hash of the key, and every request resolves
from the DB first. It is just process memory that outlives the revoke.
Fix: on delete/upsert, drop the entries built from that credential (or call `clear_adapter_cache()`).

### F7 — CORS takes ALLOWED_ORIGINS from env with credentials on (Info)

`main.py:39` now merges `ALLOWED_ORIGINS`. Current value is localhost only (`http://localhost:3000,http://localhost:5183`).
If someone sets `*`, Starlette echoes any origin with `allow_credentials=True`. Fix: drop `*` and log a warning.

### F8 — dev key file mode not checked on read (Info)

`crypto.py:43` creates the file with `O_EXCL` + `0o600`, which is correct. `crypto.py:38-39` reads an existing file
whatever its mode. Not in use right now: the worktree sets `CREDENTIAL_ENCRYPTION_KEY`, and the file does not exist.
Fix: log a warning if `st_mode & 0o077`.

## Checked and passing

- **Responses**: built field by field (`routers/ai.py:54-66`). No schema field can hold a key (`schemas/ai.py:37-46`).
  Probe 5-8, 20: 0 hits, including when the provider echoes the key in a 401.
- **Logs / exceptions**: `errors.py:93` logs only code/status/class. Provider text is never passed through
  (`errors.py:19-26`). Probe 21: 0 hits in 2026 DEBUG lines from all loggers (httpx, httpcore, openai, app).
  `openai_provider.py:66` logs base_url at debug, which is safe because the validator forbids userinfo and query.
- **Usage rows**: no prompt/reply/key/URL columns (`models/ai.py:42-59`, probe 19, 22).
- **Fernet**: `crypto.py`: env key wins; outside development a missing key fails startup (`main.py:20`). Dev file is
  gitignored and created 0600 with O_EXCL. A bad key raises `CredentialKeyError`, which the API maps to a fixed message.
- **Key reuse guard**: a saved key is only reused for the same provider + base URL (`credentials.py:72-79`,
  `routers/ai.py:184-190`). It cannot be redirected to another host by saving or by draft test.
- **User isolation**: every `/api/ai` route has `Depends(get_current_user)`, and every query filters on `user_id`.
  Probe 10-13, 17. Agents get `current_user.id` in chat/learning/assessment (except F2).
- **Revoke**: the row is deleted, with 404 for other users (probe 12, 14-16). See F5 for file remnants.
- **Frontend (static)**: the key lives only in `useState` (`MentorSlotCard.tsx:55`) and is cleared on provider
  change, replace and save (`:68`, `:95`, `:168`). Errors are `redact()`ed (`:120`, `:151`, `:178`), and
  `describeRequestError` never touches the axios `config` (`aiErrors.ts`). The field has `type="password"`
  and `autoComplete="off"`. No store imports `aiApi`. The bundle's only `localStorage` use is zustand persist.
  `DEV_API_PROXY` has no `VITE_` prefix and is absent from the bundle.

## Decisions (Nova, 2026-11-25)

Rio is fixing all eight. The final delta review covers his fix commit.

| # | Decision |
|---|---|
| F1 | No redirects on SDK/httpx clients. No reflected provider bodies. `AI_ALLOW_PRIVATE_BASE_URLS` defaults to true only when `APP_ENV=development` |
| F2 | Auth on both scenes routes, and the agent gets the user |
| F3 | Add `CREDENTIAL_ENCRYPTION_KEY=` to `.env.example` |
| F4 | Refuse to start in production with placeholder `SECRET_KEY` / `JWT_SECRET_KEY` |
| F5 | `PRAGMA secure_delete=ON` for SQLite |
| F6 | Evict cached adapters on credential delete/upsert |
| F7 | Refuse `*` in ALLOWED_ORIGINS while credentials are on |
| F8 | Warn when the dev key file is group/world readable |

## Delta: e6e37671 (Kit, /settings follows updated contract + self-check video)

**Secrets found: none. No new findings.**

- **Bundle**: rebuilt from the worktree (frontend tree == e6e37671). It produced the same `index-yz_oMdes.js` that Kit logged.
  ```
  bundle key patterns: 0      # same sk-ant/sk-or/sk-/AIza regex as above
  bundle env names: 0         # *_API_KEY, CREDENTIAL_ENCRYPTION_KEY, DEV_API_PROXY
  e6e37671 diff key patterns (incl Fernet): 0     # git show e6e37671 --text, covers log, seed script, mp4 bytes
  vex_secret_scan.sh (now incl. /tmp/vex-dist2): all six .env values 0 hits in files/db/logs; history hits only the placeholders (F4)
  ```
- **Video** `docs/m1-evidence/videos/m1-settings-selfcheck.mp4`: no `.env` value appears in the file bytes. The only metadata
  tag is `encoder=Lavf63.1.102`. I pulled 1 fps frames and reviewed the key-entry stretches (desktop 9-29s, mobile 60-80s).
  Every key field shows only dots. After save, the screen shows `Saved, ends …7f3a`. That suffix matches none of the `.env`
  secrets (compared, not printed), so it is the test key. The wrong-key step shows only the fixed `auth_failed` text, (HTTP 400).
- **frontend-build.log**: tsc/build/ffprobe output and the playwright CHECK lines (storage, cookies, responses, console: no key).
  It holds no key value. The usage-row excerpt has no key column.
- **Code**: `testDraft` now sends `slot` (`lib/api.ts`). Backend only reuses the saved key for the same provider + base URL
  (`routers/ai.py:184-190`), so this does not open a new path. The optional key field for vLLM/LM Studio/custom keeps the
  same `type="password"` input and the same clear-after-save. `describeRequestError` shows the server `message` only
  for `bad_request`. Those messages are fixed text from `GatewayError` (`credentials.py`, `providers.py`) and never provider bodies.
- **seed_demo_lesson.py**: dev-only, uses bound SQL params, and holds no secrets. It is placed under docs/ on purpose (writes to the DB directly).

## Delta: c213db55 (Rio, timeouts, complete_json, streamed usage, F1-F8 fixes)

**Secrets found: none.** **F1-F8: all PASS.** New issues: two Info notes only, so nothing goes back to Rio.

Committed tree extracted with `git archive c213db55 | tar -x -C /tmp/vex-c213`. `pytest -q` → `98 passed`.
The test that failed on the uncommitted tree earlier (`timeout` vs `unreachable`) now passes.

### Secrets sweep

Script: `m1-review/vex_secret_scan_c213.sh`. Like the first script, it prints names and counts only. Output is in `m1-review/scan-c213db55.out`:

```
OPENWEBUI_API_KEY: c213-diff=0  backend-tests.log=0  git-history-lines=0  worktree-files=0
GEMINI_API_KEY: c213-diff=0  backend-tests.log=0  git-history-lines=0  worktree-files=0
SECRET_KEY: c213-diff=1  backend-tests.log=0  git-history-lines=3  worktree-files=2
CREDENTIAL_ENCRYPTION_KEY: c213-diff=0  backend-tests.log=0  git-history-lines=0  worktree-files=0
JWT_SECRET_KEY: c213-diff=2  backend-tests.log=0  git-history-lines=5  worktree-files=4
OPENROUTER_API_KEY: c213-diff=0  backend-tests.log=0  git-history-lines=0  worktree-files=0
key-shaped strings in c213 diff (+ lines): 0
key-shaped strings in backend-tests.log: 0
Authorization/Bearer/x-api-key in backend-tests.log: 3
.credential_key tracked by git: 0; ignored: yes
```

- **SECRET_KEY / JWT_SECRET_KEY hits:** the dev `.env` still holds the public placeholders (F4). The c213 diff hits are
  the `_PLACEHOLDER_SECRETS` deny-list in `config.py:15-20` and its tests. That list is meant to be there, and the values are not real secrets.
  Check: each `.env` value matched the placeholder list exactly (`known placeholder: 1`).
- **3 Bearer lines in backend-tests.log:** lines 725, 737 and 752, all from 0432c800. The token text starts with `$`/`<`
  (6/6/14 chars). These are shell placeholders, not tokens.

### F1-F8 against Nova's decisions

| # | Decision | Verdict | Where | Proof |
|---|---|---|---|---|
| F1 | No redirects, no reflected bodies, private URLs allowed by default only in development | **PASS** | `url_guard.py:41-65`; `providers.py:153-161` (every user config, defaults included); `credentials.py:68` (at save); `routers/ai.py:87,161` (test/models/draft); `openai_provider.py:77`, `anthropic_provider.py:28` (`follow_redirects=False`); `routers/ai.py:69-80` (model list capped at 500 × 200 chars, parsed fields only); `config.py:63,100-103` | See probes below |
| F2 | Auth on scenes | **PASS** | `scenes.py:30,45` (`get_current_user`); `scenes.py:48` (owner check, same 404); `scenes.py:17` (cache capped at 500); runs on the user's own config via `ChoreographerAgent(current_user.id)` | `test_scenes_require_login_and_owner` passes |
| F3 | `.env.example` key | **PASS** | `.env.example:34` `CREDENTIAL_ENCRYPTION_KEY=` (empty), `:38` documents `AI_ALLOW_PRIVATE_BASE_URLS` | diff |
| F4 | Refuse placeholder secrets in production | **PASS** | `config.py:15-20,113-124`; `main.py:20` runs it in lifespan before `ensure_credential_key` | `production` + placeholder → `REFUSED`; `staging` + short → `REFUSED`; `production` + 48-char random → starts; `development` + placeholders → starts |
| F5 | `secure_delete` | **PASS** | `database.py:15-24` (set on every SQLite connect) | `PRAGMA secure_delete via app engine = 1` (was 0) |
| F6 | Evict cache | **PASS** | `adapter_cache.py:52-62`; `credentials.py:78` (replace / switch target), `:114` (revoke); falls back to clearing the whole cache when it can't decrypt | `test_revoke_and_replace_evict_cached_adapter` passes |
| F7 | (Nova: fix) CORS `*` | **PASS** | `config.py:90-97` drops `*` and logs a warning | `cors_origins with '*': ['http://ok.example']` + `WARNING ALLOWED_ORIGINS contains '*', which is ignored` |
| F8 | (Nova: fix) Key file mode | **PASS** | `crypto.py:39-41` warns when the mode has any group/other bits. The warning shows the file name and path, never the key | chmod 644 → `WARNING .credential_key is readable by other users; run: chmod 600 …` |

**F1 probes** (`/tmp/vex-c213/guard_probe.py`, `probe2.py`):

```
APP_ENV development (allow_private=True)
  http://169.254.169.254/v1            blocked:bad_request
  http://[::ffff:169.254.169.254]/     blocked:bad_request
  http://metadata.google.internal/     blocked:bad_request
  http://169.254.169.254.nip.io/       blocked:bad_request   (DNS-resolved, so wildcard DNS doesn't help)
  http://127.0.0.1:11434/v1            ALLOWED               (local Ollama keeps working, per decision)
APP_ENV production (allow_private=False)
  127.0.0.1, 0.0.0.0, 2130706433, 0x7f.1, localhost, 10/8, 100.64/10, fd00::1, [::], [::1]   all blocked:bad_request
  https://api.openai.com/v1            ALLOWED

redirect: public-style base URL → 302 → 127.0.0.1 model list
  openai_compatible redirect NOT followed -> provider_error | The provider returned an error. (HTTP 302)
  anthropic         redirect NOT followed -> provider_error | The provider returned an error. (HTTP 302)
```

Before c213db55 the same 302 returned the internal model ids. The OpenRouter `check_auth` client (`openai_provider.py:206`)
and the OpenWebUI client both use plain `httpx.AsyncClient`, which doesn't follow redirects by default.

### New in c213db55: checked

- **Timeout errors don't leak provider text.** `gateway.py:44-46` builds fixed text plus the limit in seconds.
  `errors.py:24,80` maps a connect timeout to `unreachable` and every other timeout to `timeout`. A 302 error says only `(HTTP 302)`.
- **`JSONOutputError.raw_text`** holds the model's reply, not request data. It is not part of `str(exc)`. The only log of it is
  the existing `code_analyzer.py:362` debug line, which logged the same reply before (`0432c800:code_analyzer.py:368`). No key is involved.
- **Streamed usage** reads only token counts from the final chunk (`openai_provider.py:151-153`).
- **Needs-URL check** at save is still enforced, via `effective_base_url` (`providers.py`). `check_base_url(None)` is a no-op only for providers with a built-in public default.

### New in c213db55: Info notes (no action for M1)

- **I1 (Info): IPv4-embedded IPv6 forms pass the guard.** `[::a9fe:a9fe]` (IPv4-compatible) and `[64:ff9b::a9fe:a9fe]` (NAT64)
  are `ALLOWED` in both modes, because `url_guard.py:34-38` only unwraps `::ffff:` mapped addresses. On this host
  neither form reaches IPv4: `connect ::7f00:1 -> TimeoutError`, `connect 64:ff9b::7f00:1 -> TimeoutError`.
  They would matter only on an IPv6-only host behind NAT64. The fix is to also unwrap `ip.sixtofour`, `ip.teredo`
  and `64:ff9b::/96` in `_ip()` (about 5 lines) whenever the hosted-for-strangers work happens, next to the DNS-pinning fix.
- **I2 (Info): small eviction race.** `adapter_cache.get_adapter` (`adapter_cache.py:38-49`) awaits DNS in
  `build_checked_adapter` before it caches. If a revoke runs during that await, the adapter built from the
  old key is cached afterwards. The window is milliseconds and needs a request already in flight. The
  key then lives on until LRU eviction (32 entries) or a restart. Fix if wanted: a cache generation counter that
  revoke bumps, with `get_adapter` skipping the insert when the counter changed.
- **Known gap, unchanged:** DNS rebinding between the guard and the SDK's connect. It is documented in `url_guard.py:13-16`
  and accepted until public hosting.

## Not checked

- Kit's in-flight frontend commit (timeout error code, scenes auth). It was not committed when this delta was written.
- The frontend at runtime: I did not run it myself. I rely on Kit's e6e37671 video and the playwright CHECK lines, plus my frame review.
  Frames were sampled at 1 fps, so a sub-second flash of a plain key would not show. The field is `type="password"` throughout.
- A full agent generation through chat with the echoing provider. The probe hit 404 (no session). The key-in-logs check
  covers test/draft/models paths, and Rio's `test_ai_api.py` covers the generation leak path.
- Postgres behaviour (F5) and deployed CORS/TLS.
