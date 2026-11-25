"""Gateway behaviour: resolution order, error mapping, JSON retry, usage log, agents."""
import asyncio

import anthropic
import httpx
import openai
import pytest
from pydantic import BaseModel
from sqlalchemy import select

from app import database
from app.agents.socratic_mentor import SYSTEM as MENTOR_SYSTEM
from app.agents.socratic_mentor import SocraticMentorAgent
from app.ai_gateway import GatewayError, GenerateRequest, JSONOutputError
from app.ai_gateway.credentials import upsert_credential
from app.ai_gateway.errors import map_exception
from app.ai_gateway.gateway import resolve_config
from app.ai_gateway.usage import flush_usage
from app.models.ai import AIUsage
from tests.conftest import SECRET, FakeProvider, fake_gateway


# ── resolution order ────────────────────────────────────────────────────────
async def test_no_user_credential_uses_env_default(user_a):
    cfg = await resolve_config(user_a.id, "text")
    assert (cfg.source, cfg.provider, cfg.model) == ("env", "ollama", "env-default-model")


async def test_user_credential_wins_over_env(user_a):
    async with database.AsyncSessionLocal() as db:
        await upsert_credential(db, user_a.id, "text", "gemini", "gemini-x", None, SECRET)
    cfg = await resolve_config(user_a.id, "text")
    assert (cfg.source, cfg.provider, cfg.model, cfg.api_key) == ("user", "gemini", "gemini-x", SECRET)
    assert SECRET not in repr(cfg)  # key excluded from repr


async def test_other_users_credential_is_not_used(user_a, user_b):
    async with database.AsyncSessionLocal() as db:
        await upsert_credential(db, user_a.id, "text", "gemini", "gemini-x", None, SECRET)
    assert (await resolve_config(user_b.id, "text")).source == "env"


async def test_live_slot_has_no_env_default(user_a):
    with pytest.raises(GatewayError) as ei:
        await resolve_config(user_a.id, "live")
    assert ei.value.code == "bad_request"


# ── error mapping ───────────────────────────────────────────────────────────
def _resp(status: int, body: str = "") -> httpx.Response:
    return httpx.Response(status, text=body, request=httpx.Request("POST", "https://api.example/v1/x"))


# Gemini's real reply to a bad key (checked live 2026-11-25), plus our SECRET to prove no echo.
GEMINI_BAD_KEY = '{"error": {"code": 400, "message": "Please pass a valid API key ' + SECRET + '"}}'


@pytest.mark.parametrize("exc, code", [
    (openai.AuthenticationError(f"Incorrect API key provided: {SECRET}", response=_resp(401), body=None), "auth_failed"),
    (anthropic.AuthenticationError(f"invalid x-api-key {SECRET}", response=_resp(401), body=None), "auth_failed"),
    (openai.PermissionDeniedError("no", response=_resp(403), body=None), "auth_failed"),
    (openai.NotFoundError("model missing", response=_resp(404), body=None), "not_found"),
    (openai.RateLimitError("slow down", response=_resp(429), body=None), "rate_limited"),
    (anthropic.RateLimitError("slow down", response=_resp(429), body=None), "rate_limited"),
    (openai.BadRequestError("bad", response=_resp(400), body=None), "bad_request"),
    (openai.BadRequestError("bad", response=_resp(400, GEMINI_BAD_KEY), body=None), "auth_failed"),
    (openai.InternalServerError("boom", response=_resp(500), body=None), "provider_error"),
    (openai.APIConnectionError(request=httpx.Request("GET", "http://x")), "unreachable"),
    (httpx.ConnectError("refused"), "unreachable"),
    (asyncio.TimeoutError(), "unreachable"),
    (httpx.HTTPStatusError("x", request=_resp(401).request, response=_resp(401)), "auth_failed"),
    (httpx.HTTPStatusError("x", request=_resp(503).request, response=_resp(503)), "provider_error"),
    (RuntimeError(f"weird {SECRET}"), "provider_error"),
])
def test_error_mapping_is_typed_and_never_echoes_provider_text(exc, code):
    err = map_exception(exc)
    assert err.code == code
    assert SECRET not in err.message and SECRET not in str(err)


async def test_gateway_errors_have_no_silent_fallback():
    adapter = FakeProvider(error=openai.RateLimitError("x", response=_resp(429), body=None))
    gw = fake_gateway(adapter)
    with pytest.raises(GatewayError) as ei:
        await gw.complete(GenerateRequest([{"role": "user", "content": "hi"}]))
    assert ei.value.code == "rate_limited"
    assert len(adapter.calls) == 1  # no retry against another provider


async def test_stream_error_becomes_error_event():
    gw = fake_gateway(FakeProvider(error=httpx.ConnectError("refused")))
    events = [e async for e in gw.generate(GenerateRequest([{"role": "user", "content": "hi"}]))]
    assert [e.type for e in events] == ["error"]
    assert events[0].error_code == "unreachable"


async def test_validate_connection_reports_models_and_failures():
    ok = await fake_gateway(FakeProvider(models=["b", "a"])).validate_connection()
    assert ok.ok and ok.model_count == 2 and [m.id for m in ok.models] == ["a", "b"]
    bad = await fake_gateway(FakeProvider(
        error=openai.AuthenticationError("x", response=_resp(401), body=None))).validate_connection()
    assert not bad.ok and bad.error_code == "auth_failed"


# ── complete_json ───────────────────────────────────────────────────────────
class Lesson(BaseModel):
    title: str
    minutes: int


async def test_complete_json_first_try():
    gw = fake_gateway(FakeProvider(['```json\n{"title": "Loops", "minutes": 10}\n```']))
    out = await gw.complete_json(GenerateRequest([{"role": "user", "content": "x"}]), Lesson)
    assert out == Lesson(title="Loops", minutes=10)


async def test_complete_json_retries_with_reason_then_succeeds():
    adapter = FakeProvider(["Sure! here you go", '{"title": "Loops", "minutes": 10}'])
    gw = fake_gateway(adapter)
    out = await gw.complete_json(GenerateRequest([{"role": "user", "content": "x"}]), Lesson, retries=1)
    assert out.title == "Loops"
    assert len(adapter.calls) == 2
    retry_msgs = adapter.calls[1]["messages"]
    assert retry_msgs[-2] == {"role": "assistant", "content": "Sure! here you go"}
    assert "not usable" in retry_msgs[-1]["content"]
    assert '"minutes"' in adapter.calls[0]["system"]  # schema was in the prompt


async def test_complete_json_schema_mismatch_retries_then_fails():
    adapter = FakeProvider(['{"title": "Loops"}'])  # missing minutes, every time
    gw = fake_gateway(adapter)
    with pytest.raises(JSONOutputError) as ei:
        await gw.complete_json(GenerateRequest([{"role": "user", "content": "x"}]), Lesson, retries=1)
    assert "minutes" in str(ei.value)
    assert len(adapter.calls) == 2


# ── usage log ───────────────────────────────────────────────────────────────
async def test_usage_row_per_call_without_prompt_or_reply(user_a):
    gw = fake_gateway(FakeProvider(["the reply text"]), user_id=user_a.id)
    await gw.for_agent("planner").complete([{"role": "user", "content": "the prompt text"}])
    with pytest.raises(GatewayError):
        await fake_gateway(FakeProvider(error=httpx.ConnectError("x")), user_id=user_a.id) \
            .for_agent("designer").complete([{"role": "user", "content": "p"}])
    await flush_usage()
    async with database.AsyncSessionLocal() as db:
        # Writes are concurrent background tasks, so id order is not call order.
        rows = (await db.execute(select(AIUsage).order_by(AIUsage.started_at))).scalars().all()
    assert [(r.agent, r.ok, r.error_code) for r in rows] == [
        ("planner", True, None), ("designer", False, "unreachable")]
    first = rows[0]
    assert (first.user_id, first.provider, first.model) == (user_a.id, "ollama", "fake-model")
    assert (first.input_tokens, first.output_tokens) == (11, 7)
    assert first.latency_ms >= 0
    values = " ".join(str(v) for v in vars(first).values())
    assert "prompt text" not in values and "reply text" not in values


# ── agents go through the gateway; mentor behaviour unchanged ──────────────
async def test_mentor_uses_gateway_with_unchanged_system_prompt():
    adapter = FakeProvider(["What do you think the loop does?"])
    mentor = SocraticMentorAgent(gateway=fake_gateway(adapter))
    reply = await mentor.chat("how do I fix this", [], hint_level=2)
    assert reply == "What do you think the loop does?"
    system = adapter.calls[0]["system"]
    assert system.startswith(MENTOR_SYSTEM)
    assert "Hint Level: 2" in system
    assert adapter.calls[0]["max_tokens"] == 4000


async def test_mentor_stream_through_gateway():
    mentor = SocraticMentorAgent(gateway=fake_gateway(FakeProvider(["a b c"])))
    chunks = [c async for c in mentor.stream_chat("hi", [], hint_level=0)]
    assert "".join(chunks).split() == ["a", "b", "c"]


async def test_agent_stream_raises_gateway_error():
    mentor = SocraticMentorAgent(gateway=fake_gateway(FakeProvider(error=httpx.ConnectError("x"))))
    with pytest.raises(GatewayError):
        async for _ in mentor.stream_chat("hi", []):
            pass


def test_no_agent_or_router_imports_a_provider_sdk_or_old_factory():
    import pathlib
    root = pathlib.Path(__file__).resolve().parent.parent / "app"
    for folder in ("agents", "routers"):
        for f in (root / folder).glob("*.py"):
            src = f.read_text()
            for banned in ("get_llm_provider", "import anthropic", "import openai", "from openai", "from anthropic"):
                assert banned not in src, f"{f.name} contains {banned!r}"
