"""M1 evidence: connection test per provider over the real /api/ai HTTP API.

Not used by the app. Needs a running backend (default http://127.0.0.1:8011) and,
for anthropic/openai, scripts/stub_ai_server.py on 127.0.0.1:8790.
Run from backend/:  .venv/bin/python scripts/m1_evidence_connections.py

Real keys are read from the repo .env through app settings and are never printed:
request bodies show "<GEMINI_API_KEY from .env>" instead, and the script checks its own
output for every key value before exiting (exit 3 if one is found).
Each provider gets its own test user, so a later script can reuse the saved credentials.
"""
from __future__ import annotations

import io
import json
import sys
import time

import httpx

from app.config import get_settings

API = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8011"
OLLAMA_V1 = "http://localhost:11434/v1"
STUB = "http://127.0.0.1:8790"
LOCAL_MODEL = "qwen2.5:0.5b"

s = get_settings()
REAL_KEYS = {
    "GEMINI_API_KEY": s.gemini_api_key.get_secret_value(),
    "OPENROUTER_API_KEY": s.openrouter_api_key.get_secret_value(),
    "OPENWEBUI_API_KEY": s.openwebui_api_key.get_secret_value(),
    "ANTHROPIC_API_KEY": s.anthropic_api_key.get_secret_value(),
    "OPENAI_API_KEY": s.openai_api_key.get_secret_value(),
}
_out = io.StringIO()
_responses = io.StringIO()  # raw response bodies, checked for key values at the end


def say(text: str = "") -> None:
    for name, value in REAL_KEYS.items():
        if value:
            text = text.replace(value, f"<{name} from .env>")  # request bodies we echo
    print(text, flush=True)
    _out.write(text + "\n")


def show(body: dict | None) -> str:
    if body is None:
        return ""
    shown = dict(body)
    if shown.get("api_key"):
        for name, value in REAL_KEYS.items():
            if value and shown["api_key"] == value:
                shown["api_key"] = f"<{name} from .env>"
    return " " + json.dumps(shown, ensure_ascii=False)


def trim_models(data):
    """Model lists can be hundreds long: keep the count and the first 5 ids."""
    if isinstance(data, list) and data and isinstance(data[0], dict) and "id" in data[0]:
        return {"count": len(data), "first_ids": [m["id"] for m in data[:5]]}
    if isinstance(data, dict) and isinstance(data.get("models"), list):
        data = dict(data)
        data["models"] = trim_models(data["models"]) if data["models"] else []
    return data


def call(c: httpx.Client, method: str, path: str, token: str | None = None,
         body: dict | None = None) -> httpx.Response:
    say(f"$ {method} {path}{show(body)}")
    t0 = time.monotonic()
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    r = c.request(method, path, json=body, headers=headers)
    ms = int((time.monotonic() - t0) * 1000)
    _responses.write(r.text + "\n")
    try:
        data = trim_models(r.json()) if r.content else None
        text = json.dumps(data, ensure_ascii=False)
    except ValueError:
        text = r.text[:300]
    if path.startswith("/api/v1/auth") and r.is_success:
        text = f"(token response, {len(r.content)} bytes, not shown)"
    say(f"-> HTTP {r.status_code} in {ms} ms: {text}")
    return r


def register(c: httpx.Client, name: str) -> str:
    r = call(c, "POST", "/api/v1/auth/register", body={
        "email": f"{name}@example.com", "username": name, "password": "evidence-pass-1"})
    if r.status_code == 400:  # rerun: user exists
        r = call(c, "POST", "/api/v1/auth/login", body={
            "email": f"{name}@example.com", "password": "evidence-pass-1"})
    return r.json()["access_token"]


def pick(models: list[dict], prefer: list[str]) -> str:
    ids = [m["id"] for m in models]
    for p in prefer:  # "*:free" means any id ending in ":free"
        for i in ids:
            if i == p or i.endswith("/" + p) or (p.startswith("*") and i.endswith(p[1:])):
                return i
    return ids[0]


def provider_case(c, title, user, provider, model, *, key=None, key_name=None,
                  base_url=None, prefer=None, bad_key=False, slot="text"):
    say()
    say(f"## {title}")
    token = register(c, user)
    key_val = REAL_KEYS.get(key_name) if key_name else key
    draft = {"provider": provider, "api_key": key_val, "base_url": base_url}
    draft = {k: v for k, v in draft.items() if v is not None}
    if model is None:
        # Pick a model the key can really use, from the provider's live list.
        r = c.post("/api/ai/test-draft", json=draft, headers={"Authorization": f"Bearer {token}"})
        models = r.json().get("models") or []
        model = pick(models, prefer or []) if models else ""
        say(f"# model chosen from the live list ({len(models)} models): {model}")
    body = {"provider": provider, "model": model, "api_key": key_val, "base_url": base_url}
    body = {k: v for k, v in body.items() if v is not None}
    call(c, "PUT", f"/api/ai/credentials/{slot}", token, body)
    call(c, "POST", f"/api/ai/credentials/{slot}/test", token)
    call(c, "GET", f"/api/ai/credentials/{slot}/models", token)
    call(c, "GET", "/api/ai/credentials", token)
    if bad_key:
        bad = dict(draft, api_key="bad-key-for-evidence-0000")
        call(c, "POST", "/api/ai/test-draft", token, bad)


def main() -> int:
    for name, value in REAL_KEYS.items():
        say(f"# {name} in .env: {'set' if value else 'empty'} (value not shown)")
    with httpx.Client(base_url=API, timeout=90) as c:
        token = register(c, "ev_admin")
        call(c, "GET", "/api/ai/providers", token)

        provider_case(c, "gemini (LIVE)", "ev_gemini", "gemini", None, key_name="GEMINI_API_KEY",
                      # 2.5/2.0-flash are listed but 404 "no longer available to new users".
                      prefer=["gemini-3.8-flash", "gemini-flash-latest"], bad_key=True)
        provider_case(c, "openrouter (LIVE)", "ev_openrouter", "openrouter", None,
                      key_name="OPENROUTER_API_KEY",
                      prefer=["google/gemma-4-31b-it:free", "*:free"],
                      bad_key=True)
        provider_case(c, f"ollama (LIVE, local, {LOCAL_MODEL})", "ev_ollama", "ollama", LOCAL_MODEL)
        provider_case(c, "ollama in the live slot (LIVE, local)", "ev_ollama", "ollama", LOCAL_MODEL,
                      slot="live")
        for p in ("lmstudio", "vllm", "openai_compatible"):
            provider_case(c, f"{p} (LIVE via the OpenAI-compatible path, against Ollama /v1)",
                          f"ev_{p}", p, LOCAL_MODEL, base_url=OLLAMA_V1)
        provider_case(c, "anthropic (stub, not live)", "ev_anthropic", "anthropic", "claude-stub-1",
                      key="stub-key", base_url=STUB, bad_key=True)
        provider_case(c, "openai (stub, not live)", "ev_openai", "openai", "gpt-stub-1",
                      key="stub-key", base_url=STUB + "/v1", bad_key=True)

        say()
        say("## unreachable host gives a typed error, not a crash")
        call(c, "POST", "/api/ai/test-draft", token,
             {"provider": "openai_compatible", "base_url": "http://127.0.0.1:9/v1"})
        say()
        say("## user isolation over HTTP: ev_admin has no credentials and cannot use ev_gemini's")
        call(c, "GET", "/api/ai/credentials", token)
        call(c, "GET", "/api/ai/credentials/text/models", token)

    raw = _responses.getvalue()
    leaked = [n for n, v in REAL_KEYS.items() if v and (v in raw or v[4:-4] in raw)]
    say()
    say(f"# leak check of every raw API response (full key and inner fragment) against .env keys: "
        f"{'FOUND ' + ','.join(leaked) if leaked else 'none found'}")
    return 3 if leaked else 0


if __name__ == "__main__":
    sys.exit(main())
