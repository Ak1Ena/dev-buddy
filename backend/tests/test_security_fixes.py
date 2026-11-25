"""Vex review 2026-11-25 (docs/m1-evidence/vex-review.md), one test group per finding."""
import asyncio
import logging
import os
import pathlib

import pytest

from app import database, main
from app.ai_gateway import adapter_cache, crypto
from app.ai_gateway.errors import GatewayError
from app.ai_gateway.gateway import AIGateway
from app.ai_gateway.providers import build_adapter
from app.ai_gateway.types import ModelInfo, ResolvedConfig
from app.ai_gateway.url_guard import check_addresses, check_base_url
from app.config import Settings, check_app_secrets, get_settings
from app.routers import ai as ai_router
from app.routers import scenes
from tests.conftest import SECRET, auth

DEAD_URL = "http://127.0.0.1:9/v1"
PLACEHOLDER = "your-jwt-secret-key-change-in-production"
STRONG = "x" * 48


def _settings(**kw) -> Settings:
    return Settings(_env_file=None, **kw)


@pytest.fixture
def no_private_urls(monkeypatch):
    """Production-like guard while the rest of the test env stays development."""
    monkeypatch.setattr(get_settings(), "ai_allow_private_base_urls", False)


# ── F1: base_url SSRF ────────────────────────────────────────────────────────
@pytest.mark.parametrize("addr", ["169.254.169.254", "fe80::1"])
def test_link_local_is_refused_even_when_private_is_allowed(addr):
    with pytest.raises(GatewayError) as ei:
        check_addresses([addr], allow_private=True)
    assert ei.value.code == "bad_request" and "link-local" in ei.value.message


@pytest.mark.parametrize("addr", ["127.0.0.1", "10.1.2.3", "192.168.1.5", "172.16.0.1", "100.64.0.1",
                                  "0.0.0.0", "::1", "fd00::1", "::ffff:127.0.0.1"])
def test_private_addresses_refused_when_not_allowed(addr):
    check_addresses([addr], allow_private=True)  # dev: fine
    with pytest.raises(GatewayError):
        check_addresses([addr], allow_private=False)


def test_public_address_allowed():
    check_addresses(["8.8.8.8", "2606:4700:4700::1111"], allow_private=False)


def test_private_urls_allowed_by_default_only_in_development():
    assert _settings(app_env="development").allow_private_base_urls is True
    assert _settings(app_env="production").allow_private_base_urls is False
    assert _settings(app_env="production", ai_allow_private_base_urls=True).allow_private_base_urls is True


async def test_metadata_host_and_ip_refused_in_development():
    for url in ("http://169.254.169.254/latest", "http://metadata.google.internal/v1"):
        with pytest.raises(GatewayError):
            await check_base_url(url)


async def test_save_and_draft_test_refuse_loopback_when_not_allowed(client, user_a, no_private_urls):
    r = await client.put("/api/ai/credentials/text", headers=auth(user_a),
                         json={"provider": "openai", "model": "m", "api_key": SECRET, "base_url": DEAD_URL})
    assert r.status_code == 400 and r.json()["detail"]["error_code"] == "bad_request"
    # Default URL of a local provider is checked too (vLLM default is localhost:8000).
    r = await client.put("/api/ai/credentials/text", headers=auth(user_a), json={"provider": "vllm", "model": "m"})
    assert r.status_code == 400
    r = await client.post("/api/ai/test-draft", headers=auth(user_a),
                          json={"provider": "openai", "api_key": SECRET, "base_url": DEAD_URL})
    out = r.json()
    assert out["ok"] is False and out["error_code"] == "bad_request" and out["models"] == []


async def test_env_default_is_admin_config_and_not_checked(no_private_urls):
    # conftest's .env default is ollama on 127.0.0.1:9: the guard must not block it.
    cfg = await AIGateway().get_config()
    assert cfg.source == "env"


async def test_redirect_is_not_followed():
    """A provider answering 302 to an internal host: the SDK must not follow it."""
    hits: list[str] = []

    async def internal(reader, writer):
        hits.append("internal")
        writer.close()

    inner = await asyncio.start_server(internal, "127.0.0.1", 0)
    inner_port = inner.sockets[0].getsockname()[1]

    async def redirector(reader, writer):
        await reader.readuntil(b"\r\n\r\n")
        writer.write(f"HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1:{inner_port}/v1/models\r\n"
                     "Content-Length: 0\r\nConnection: close\r\n\r\n".encode())
        await writer.drain()
        writer.close()

    outer = await asyncio.start_server(redirector, "127.0.0.1", 0)
    url = f"http://127.0.0.1:{outer.sockets[0].getsockname()[1]}/v1"
    cfg = ResolvedConfig(provider="openai_compatible", model="", base_url=url, source="draft")
    adapter = build_adapter(cfg)
    try:
        status = await AIGateway(config=cfg, adapter=adapter).validate_connection()
    finally:
        await adapter.aclose()
        outer.close()
        inner.close()
    assert status.ok is False and status.models == []
    assert hits == []


def test_model_list_to_browser_is_capped():
    models = [ModelInfo(id="m" * 1000, label="l" * 1000)] * 900
    out = ai_router._models_out(models)
    assert len(out) == 500 and len(out[0].id) == 200 and len(out[0].label) == 200


# ── F2: scenes need a login and only show your own scene ─────────────────────
async def test_scenes_require_login_and_owner(client, user_a, user_b, monkeypatch):
    built_for: list[str | None] = []

    class FakeChoreographer:
        def __init__(self, user_id=None, gateway=None):
            built_for.append(user_id)

        async def choreograph(self, code):
            return {"version": "1.0", "timeline": [{"t": 0}]}

    monkeypatch.setattr(scenes, "ChoreographerAgent", FakeChoreographer)
    assert (await client.post("/api/v1/scenes/analyze", json={"code": "x = 1"})).status_code in (401, 403)

    r = await client.post("/api/v1/scenes/analyze", json={"code": "x = 1"}, headers=auth(user_a))
    assert r.status_code == 200 and built_for == [user_a.id]  # runs on A's own AI settings
    sid = r.json()["session_id"]
    assert (await client.get(f"/api/v1/scenes/scene/{sid}")).status_code in (401, 403)
    assert (await client.get(f"/api/v1/scenes/scene/{sid}", headers=auth(user_b))).status_code == 404
    mine = await client.get(f"/api/v1/scenes/scene/{sid}", headers=auth(user_a))
    assert mine.json() == {"version": "1.0", "timeline": [{"t": 0}]}


# ── F3: .env.example lists the credential key, empty ─────────────────────────
def test_env_example_has_empty_credential_key():
    example = pathlib.Path(__file__).resolve().parents[2] / ".env.example"
    lines = example.read_text().splitlines()
    assert "CREDENTIAL_ENCRYPTION_KEY=" in lines


# ── F4: no start outside development with placeholder secrets ───────────────
def test_placeholder_secrets_refused_outside_development():
    with pytest.raises(RuntimeError) as ei:
        check_app_secrets(_settings(app_env="production", secret_key=STRONG, jwt_secret_key=PLACEHOLDER))
    assert "JWT_SECRET_KEY" in str(ei.value) and PLACEHOLDER not in str(ei.value)
    with pytest.raises(RuntimeError):
        check_app_secrets(_settings(app_env="production", secret_key="short", jwt_secret_key=STRONG))
    check_app_secrets(_settings(app_env="production", secret_key=STRONG, jwt_secret_key=STRONG))
    check_app_secrets(_settings(app_env="development", jwt_secret_key=PLACEHOLDER))  # dev may


async def test_lifespan_refuses_to_start(monkeypatch):
    monkeypatch.setattr(main, "settings", _settings(app_env="production"))  # code defaults = placeholders
    with pytest.raises(RuntimeError):
        async with main.lifespan(main.app):
            pass


# ── F5: SQLite zeroes deleted rows ───────────────────────────────────────────
async def test_sqlite_secure_delete_is_on():
    async with database.engine.connect() as conn:
        value = (await conn.exec_driver_sql("PRAGMA secure_delete")).scalar()
    assert value == 1


# ── F6: revoke / replace drops the cached adapter (and its plain key) ────────
async def _save(client, user, key=SECRET):
    r = await client.put("/api/ai/credentials/text", headers=auth(user),
                         json={"provider": "openai", "model": "m", "api_key": key, "base_url": DEAD_URL})
    assert r.status_code == 200, r.text


async def test_revoke_and_replace_evict_cached_adapter(client, user_a, user_b):
    await _save(client, user_a)
    await _save(client, user_b, key=SECRET + "-b")
    await AIGateway(user_id=user_a.id).get_config()
    await AIGateway(user_id=user_b.id).get_config()
    assert adapter_cache.cached_count() == 2

    await _save(client, user_a, key=SECRET + "-new")  # replace A's key
    assert adapter_cache.cached_count() == 1          # B's stays
    await AIGateway(user_id=user_a.id).get_config()
    assert adapter_cache.cached_count() == 2

    assert (await client.delete("/api/ai/credentials/text", headers=auth(user_a))).status_code == 204
    assert adapter_cache.cached_count() == 1


# ── F7: "*" is never used as a CORS origin ───────────────────────────────────
def test_cors_star_dropped_with_warning(caplog):
    with caplog.at_level(logging.WARNING):
        origins = _settings(allowed_origins="*, http://localhost:5183").cors_origins
    assert origins == ["http://localhost:5183"]
    assert "ignored" in caplog.text
    [cors] = [m for m in main.app.user_middleware if m.cls.__name__ == "CORSMiddleware"]
    assert "*" not in cors.kwargs["allow_origins"]


# ── F8: a dev key file readable by others is warned about ────────────────────
def test_dev_key_file_with_wide_mode_warns(tmp_path, monkeypatch, caplog):
    monkeypatch.setattr(crypto, "get_settings",
                        lambda: _settings(app_env="development", credential_encryption_key=""))
    key_file = tmp_path / ".credential_key"
    key_file.write_bytes(b"k" * 44)
    os.chmod(key_file, 0o644)
    with caplog.at_level(logging.WARNING):
        crypto._load_key(key_file)
    assert "chmod 600" in caplog.text
    caplog.clear()
    os.chmod(key_file, 0o600)
    with caplog.at_level(logging.WARNING):
        crypto._load_key(key_file)
    assert "chmod 600" not in caplog.text
