"""Gateway deadlines and streamed token counts.

The stalled-server tests use a real local HTTP server and the real OpenAI SDK
adapter, so they prove the whole path (SDK -> httpx -> gateway deadline), not
just the fake adapter.
"""
import asyncio
import json
import time

import httpx
import pytest
from sqlalchemy import select

from app import database
from app.ai_gateway import GatewayError, GenerateRequest, Timeouts
from app.ai_gateway.adapters.openai_provider import OpenAIProvider
from app.ai_gateway.gateway import AIGateway
from app.ai_gateway.providers import CLOUD_TIMEOUTS, LOCAL_TIMEOUTS, SDK_MAX_RETRIES, build_adapter, get_spec
from app.ai_gateway.types import ResolvedConfig
from app.ai_gateway.usage import flush_usage
from app.models.ai import AIUsage
from tests.conftest import FakeProvider

SHORT = Timeouts(connect=1.0, first_token=0.5, total=2.0)
REQ = GenerateRequest([{"role": "user", "content": "hi"}], agent="socratic_mentor")


class StallingProvider(FakeProvider):
    """Sends `before` chunks, then never sends another one."""

    def __init__(self, before: int = 0):
        super().__init__()
        self.before = before

    async def stream(self, messages, system="", max_tokens=1000, usage=None):
        for i in range(self.before):
            yield f"part{i} "
        await asyncio.sleep(3600)
        yield "never"

    async def complete(self, messages, system="", max_tokens=1000, usage=None):
        await asyncio.sleep(3600)
        return "never"


def _gw(adapter, timeouts=SHORT, user_id=None) -> AIGateway:
    cfg = ResolvedConfig(provider="ollama", model="m", base_url=None, source="env")
    return AIGateway(user_id=user_id, config=cfg, adapter=adapter, timeouts=timeouts)


# ── fake adapter: the gateway's own deadlines ───────────────────────────────
async def test_no_first_token_ends_with_timeout_error_inside_the_limit():
    t0 = time.monotonic()
    events = [e async for e in _gw(StallingProvider()).generate(REQ)]
    elapsed = time.monotonic() - t0
    assert [e.type for e in events] == ["error"]
    assert events[0].error_code == "timeout"
    assert "first token" in events[0].message
    assert 0.4 < elapsed < 1.0, elapsed


async def test_stream_that_stalls_midway_hits_the_total_limit():
    limits = Timeouts(connect=1.0, first_token=0.5, total=1.0)
    t0 = time.monotonic()
    events = [e async for e in _gw(StallingProvider(before=2), limits).generate(REQ)]
    elapsed = time.monotonic() - t0
    assert [e.type for e in events] == ["text_delta", "text_delta", "error"]
    assert events[-1].error_code == "timeout" and "total" in events[-1].message
    assert 0.9 < elapsed < 1.5, elapsed


async def test_complete_hits_total_limit():
    limits = Timeouts(connect=1.0, first_token=5.0, total=0.5)
    t0 = time.monotonic()
    with pytest.raises(GatewayError) as ei:
        await _gw(StallingProvider(), limits).complete(REQ)
    assert ei.value.code == "timeout"
    assert time.monotonic() - t0 < 1.0


async def test_timeout_is_logged_as_failed_usage_row(user_a):
    [e async for e in _gw(StallingProvider(), user_id=user_a.id).generate(REQ)]
    await flush_usage()
    async with database.AsyncSessionLocal() as db:
        [row] = (await db.execute(select(AIUsage))).scalars().all()
    assert (row.ok, row.error_code, row.agent) == (False, "timeout", "socratic_mentor")


# ── per-provider limits reach the SDK ───────────────────────────────────────
def test_limits_per_provider_kind_and_sdk_retries_low():
    assert get_spec("ollama").timeouts == LOCAL_TIMEOUTS
    assert get_spec("openai_compatible").timeouts == LOCAL_TIMEOUTS
    assert get_spec("gemini").timeouts == CLOUD_TIMEOUTS
    assert LOCAL_TIMEOUTS.first_token > CLOUD_TIMEOUTS.first_token
    cloud = build_adapter(ResolvedConfig(provider="gemini", model="g", base_url=None, api_key="k", source="user"))
    local = build_adapter(ResolvedConfig(provider="ollama", model="o", base_url=None, source="user"))
    for adapter, limits in ((cloud, CLOUD_TIMEOUTS), (local, LOCAL_TIMEOUTS)):
        assert adapter.client.max_retries == SDK_MAX_RETRIES == 1
        assert adapter.client.timeout.connect == limits.connect
        assert adapter.client.timeout.read == limits.total
        assert adapter.client._client.follow_redirects is False


# ── real HTTP: a server that accepts the request and then goes quiet ────────
class StubServer:
    """Minimal HTTP/1.1 server on 127.0.0.1. `handler(body) -> list[bytes]` gives the
    SSE events to send; None as an item means stall forever."""

    def __init__(self, handler):
        self.handler = handler
        self.bodies: list[dict] = []
        self._tasks: set[asyncio.Task] = set()

    async def __aenter__(self):
        self.server = await asyncio.start_server(self._serve, "127.0.0.1", 0)
        self.url = f"http://127.0.0.1:{self.server.sockets[0].getsockname()[1]}/v1"
        return self

    async def __aexit__(self, *exc):
        self.server.close()
        for task in self._tasks:  # a stalled handler would outlive the test's event loop
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)

    async def _serve(self, reader, writer):
        self._tasks.add(asyncio.current_task())
        try:
            head = await reader.readuntil(b"\r\n\r\n")
            length = next((int(line.split(b":")[1]) for line in head.split(b"\r\n")
                           if line.lower().startswith(b"content-length")), 0)
            body = json.loads(await reader.readexactly(length)) if length else {}
            self.bodies.append(body)
            writer.write(b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\n"
                         b"Cache-Control: no-cache\r\nConnection: close\r\n\r\n")
            await writer.drain()
            for event in self.handler(body):
                if event is None:
                    await asyncio.sleep(3600)
                writer.write(b"data: " + event + b"\n\n")
                await writer.drain()
            writer.write(b"data: [DONE]\n\n")
            await writer.drain()
        except (ConnectionError, asyncio.IncompleteReadError, asyncio.CancelledError):
            pass
        finally:
            writer.close()


def _chunk(text: str | None = None, usage: dict | None = None) -> bytes:
    choices = [] if text is None else [{"index": 0, "delta": {"content": text}, "finish_reason": None}]
    obj = {"id": "c1", "object": "chat.completion.chunk", "created": 0, "model": "m", "choices": choices}
    if usage is not None:
        obj["usage"] = usage
    return json.dumps(obj).encode()


def _real_gw(url: str, stream_usage: bool, timeouts=SHORT) -> AIGateway:
    adapter = OpenAIProvider(api_key="not-needed", model="m", base_url=url,
                             timeout=httpx.Timeout(timeouts.total, connect=timeouts.connect),
                             max_retries=1, stream_usage=stream_usage)
    return _gw(adapter, timeouts)


async def test_stalled_http_stream_ends_with_typed_timeout_inside_the_limit():
    async with StubServer(lambda body: [None]) as srv:
        t0 = time.monotonic()
        events = [e async for e in _real_gw(srv.url, stream_usage=False).generate(REQ)]
        elapsed = time.monotonic() - t0
    assert [e.type for e in events] == ["error"]
    assert events[0].error_code == "timeout"
    assert elapsed < SHORT.first_token + 0.5, elapsed


async def test_stream_usage_read_from_final_chunk_when_supported():
    usage = {"prompt_tokens": 21, "completion_tokens": 3, "total_tokens": 24}
    send = lambda body: [_chunk("Hello "), _chunk("there"), _chunk(None, usage)]  # noqa: E731
    async with StubServer(send) as srv:
        events = [e async for e in _real_gw(srv.url, stream_usage=True).generate(REQ)]
    assert "".join(e.text for e in events if e.type == "text_delta") == "Hello there"
    done = events[-1]
    assert done.type == "done"
    assert (done.usage.input_tokens, done.usage.output_tokens) == (21, 3)
    assert srv.bodies[0]["stream_options"] == {"include_usage": True}


async def test_stream_usage_stays_null_when_provider_not_marked_supported():
    async with StubServer(lambda body: [_chunk("Hi")]) as srv:
        events = [e async for e in _real_gw(srv.url, stream_usage=False).generate(REQ)]
    assert events[-1].type == "done"
    assert (events[-1].usage.input_tokens, events[-1].usage.output_tokens) == (None, None)
    assert "stream_options" not in srv.bodies[0]
