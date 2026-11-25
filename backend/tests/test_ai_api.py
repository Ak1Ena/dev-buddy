"""/api/ai endpoints: keys never returned, revoke, user isolation."""
from sqlalchemy import select

from app import database
from app.models.ai import AICredential
from tests.conftest import SECRET, auth

# Port 9 (discard) is closed locally, so connection tests fail fast and offline.
DEAD_URL = "http://127.0.0.1:9/v1"


async def _rows() -> list[AICredential]:
    async with database.AsyncSessionLocal() as db:
        return list((await db.execute(select(AICredential))).scalars().all())


async def _save(client, user, slot="text", **body):
    payload = {"provider": "openai", "model": "gpt-x", "api_key": SECRET, "base_url": DEAD_URL}
    payload.update(body)
    return await client.put(f"/api/ai/credentials/{slot}", json=payload, headers=auth(user))


async def test_requires_login(client):
    assert (await client.get("/api/ai/credentials")).status_code in (401, 403)
    assert (await client.get("/api/ai/providers")).status_code in (401, 403)


async def test_providers_list_has_m1_ids_and_no_dev_only(client, user_a):
    r = await client.get("/api/ai/providers", headers=auth(user_a))
    ids = [p["id"] for p in r.json()]
    assert ids == ["anthropic", "openai", "gemini", "openrouter", "ollama",
                   "lmstudio", "vllm", "openai_compatible"]


async def test_key_never_in_any_response(client, user_a):
    saved = await _save(client, user_a)
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert body["key_hint"] == "…" + SECRET[-4:]
    assert body["status"] == "untested"

    responses = [
        saved,
        await client.get("/api/ai/credentials", headers=auth(user_a)),
        await client.post("/api/ai/credentials/text/test", headers=auth(user_a)),
        await client.get("/api/ai/credentials/text/models", headers=auth(user_a)),
        await client.post("/api/ai/test-draft", headers=auth(user_a),
                          json={"provider": "openai", "api_key": SECRET, "base_url": DEAD_URL}),
        await client.post("/api/ai/test-draft", headers=auth(user_a),
                          json={"provider": "openai", "base_url": DEAD_URL, "slot": "text"}),
    ]
    for r in responses:
        assert SECRET not in r.text
        assert SECRET[3:-4] not in r.text  # no partial key either
        assert "ciphertext" not in r.text

    # Stored encrypted, not in plain text.
    [row] = await _rows()
    assert row.key_ciphertext and SECRET not in row.key_ciphertext


async def test_connection_test_updates_status_with_typed_error(client, user_a):
    await _save(client, user_a)
    r = await client.post("/api/ai/credentials/text/test", headers=auth(user_a))
    assert r.status_code == 200
    out = r.json()
    assert out["ok"] is False and out["error_code"] == "unreachable"
    [cred] = (await client.get("/api/ai/credentials", headers=auth(user_a))).json()
    assert cred["status"] == "failed" and cred["last_checked_at"]
    assert cred["last_error"].startswith("unreachable")


async def test_models_error_maps_to_502_not_401(client, user_a):
    await _save(client, user_a)
    r = await client.get("/api/ai/credentials/text/models", headers=auth(user_a))
    assert r.status_code == 502
    assert r.json()["detail"]["error_code"] == "unreachable"


async def test_revoke_deletes_row_and_ciphertext(client, user_a):
    await _save(client, user_a)
    assert len(await _rows()) == 1
    r = await client.delete("/api/ai/credentials/text", headers=auth(user_a))
    assert r.status_code == 204
    assert await _rows() == []
    assert (await client.get("/api/ai/credentials", headers=auth(user_a))).json() == []
    assert (await client.delete("/api/ai/credentials/text", headers=auth(user_a))).status_code == 404


async def test_user_b_cannot_see_test_use_or_delete_user_a_credential(client, user_a, user_b):
    await _save(client, user_a)
    b = auth(user_b)
    assert (await client.get("/api/ai/credentials", headers=b)).json() == []
    assert (await client.post("/api/ai/credentials/text/test", headers=b)).status_code == 404
    assert (await client.get("/api/ai/credentials/text/models", headers=b)).status_code == 404
    assert (await client.delete("/api/ai/credentials/text", headers=b)).status_code == 404
    # test-draft with slot must not borrow A's stored key for B.
    r = await client.post("/api/ai/test-draft", headers=b,
                          json={"provider": "openai", "base_url": DEAD_URL, "slot": "text"})
    assert r.json()["error_code"] == "bad_request"  # "needs an API key": B has none
    [row] = await _rows()
    assert row.user_id == user_a.id


async def test_omitting_key_keeps_it_only_for_same_provider_and_url(client, user_a):
    await _save(client, user_a)
    kept = await _save(client, user_a, api_key=None, model="gpt-y")
    assert kept.status_code == 200 and kept.json()["key_hint"] == "…" + SECRET[-4:]
    # Moving the key to another host without re-entering it is refused.
    moved = await _save(client, user_a, api_key=None, base_url="http://127.0.0.1:10/v1")
    assert moved.status_code == 400
    assert moved.json()["detail"]["error_code"] == "bad_request"
    [row] = await _rows()
    assert row.base_url == DEAD_URL  # rolled back, old row intact


async def test_validation_rejects_bad_slot_provider_and_url(client, user_a):
    h = auth(user_a)
    assert (await _save(client, user_a, slot="video")).status_code == 400
    assert (await _save(client, user_a, provider="nope")).status_code == 400
    assert (await _save(client, user_a, provider="openwebui")).status_code == 400  # dev-only
    assert (await _save(client, user_a, base_url="ftp://x")).status_code == 422
    assert (await _save(client, user_a, base_url="http://u:p@host/v1")).status_code == 422
    r = await client.put("/api/ai/credentials/text", headers=h,
                         json={"provider": "openai_compatible", "model": "m"})
    assert r.status_code == 400  # needs a base URL


async def test_local_provider_saves_without_key(client, user_a):
    r = await client.put("/api/ai/credentials/live", headers=auth(user_a),
                         json={"provider": "ollama", "model": "qwen2.5:0.5b"})
    assert r.status_code == 200
    assert r.json()["slot"] == "live" and r.json()["key_hint"] is None
