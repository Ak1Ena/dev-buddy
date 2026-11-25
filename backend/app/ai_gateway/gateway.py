"""AIGateway: the one door every agent uses to reach a model.

Resolution per call: the user's saved credential for the slot, else the
server .env default (text slot only). No silent fallback to another provider
after an error: the caller gets a typed GatewayError.

Agents keep their old call shape through `gateway.for_agent(name)`, which
returns an object with the same complete()/stream() signatures the old
LLMProvider had, so agent prompts and parsing did not have to change.
"""
from __future__ import annotations

import asyncio
import time
from datetime import datetime
from typing import AsyncGenerator, AsyncIterator, TypeVar

from pydantic import BaseModel

from app import database
from app.ai_gateway.adapter_cache import clear_adapter_cache, get_adapter  # noqa: F401 (re-export)
from app.ai_gateway.adapters.base import LLMProvider
from app.ai_gateway.credentials import check_slot, config_from_credential, get_credential
from app.ai_gateway.crypto import CredentialKeyError
from app.ai_gateway.errors import GatewayError, map_exception
from app.ai_gateway.json_output import JSONOutputError, parse_into, schema_instruction
from app.ai_gateway.providers import env_default_config, get_spec
from app.ai_gateway.types import (
    AIEvent,
    Capabilities,
    ConnectionStatus,
    GenerateRequest,
    GenerateResult,
    ModelInfo,
    ResolvedConfig,
    Timeouts,
    Usage,
)
from app.ai_gateway.usage import UsageEntry, record_usage

T = TypeVar("T", bound=BaseModel)


def _timeout_error(what: str, seconds: float) -> GatewayError:
    # Fixed text plus the limit; nothing from the provider.
    return GatewayError("timeout", f"The provider took too long to answer ({what} limit {seconds:g} s).")

async def resolve_config(user_id: str | None, slot: str = "text") -> ResolvedConfig:
    check_slot(slot)
    if user_id:
        async with database.AsyncSessionLocal() as db:
            cred = await get_credential(db, user_id, slot)
        if cred is not None:
            try:
                return config_from_credential(cred)
            except CredentialKeyError as exc:
                raise GatewayError(
                    "auth_failed", "The saved API key could not be read. Save it again in Settings."
                ) from exc
    return env_default_config(slot)


class AIGateway:
    def __init__(
        self,
        user_id: str | None = None,
        slot: str = "text",
        *,
        config: ResolvedConfig | None = None,
        adapter: LLMProvider | None = None,
        timeouts: Timeouts | None = None,
    ):
        self.user_id = user_id
        self.slot = slot
        self._config = config
        self._adapter = adapter
        # None = the provider kind's limits (providers.py). Tests pass short ones.
        self._timeouts = timeouts
        self._lock = asyncio.Lock()

    # ── resolution ──────────────────────────────────────────────────────────
    async def _ensure(self) -> tuple[ResolvedConfig, LLMProvider]:
        async with self._lock:
            if self._config is None:
                self._config = await resolve_config(self.user_id, self.slot)
            if self._adapter is None:
                self._adapter = await get_adapter(self._config)
        return self._config, self._adapter

    @staticmethod
    def _require_model(cfg: ResolvedConfig) -> None:
        if not cfg.model:
            raise GatewayError("bad_request", "No model is selected. Pick one in Settings.")

    async def get_config(self) -> ResolvedConfig:
        cfg, _ = await self._ensure()
        return cfg

    async def get_capabilities(self) -> Capabilities:
        cfg, _ = await self._ensure()
        return get_spec(cfg.provider).capabilities

    def _limits(self, cfg: ResolvedConfig) -> Timeouts:
        return self._timeouts or get_spec(cfg.provider).timeouts

    @staticmethod
    async def _stream_with_deadlines(
        chunks: AsyncGenerator[str, None], limits: Timeouts, t0: float
    ) -> AsyncGenerator[str, None]:
        """Yield chunks, raising GatewayError('timeout') when the first chunk takes longer
        than first_token or the whole stream runs past total. Closes the adapter stream
        (and so its HTTP response) on every exit path."""
        first = True
        try:
            while True:
                remaining = limits.total - (time.monotonic() - t0)
                wait = min(limits.first_token, remaining) if first else remaining
                try:
                    chunk = await asyncio.wait_for(chunks.__anext__(), timeout=max(wait, 0.0))
                except StopAsyncIteration:
                    return
                except asyncio.TimeoutError:
                    if first and limits.first_token <= remaining:
                        raise _timeout_error("first token", limits.first_token) from None
                    raise _timeout_error("total", limits.total) from None
                first = False
                yield chunk
        finally:
            await chunks.aclose()

    def _log(self, agent: str, started: datetime, t0: float, usage: Usage, ok: bool, code: str | None) -> None:
        cfg = self._config
        record_usage(UsageEntry(
            user_id=self.user_id,
            slot=self.slot,
            provider=cfg.provider if cfg else "unresolved",
            model=(cfg.model if cfg else "") or "",
            agent=agent,
            source=cfg.source if cfg else "env",
            started_at=started,
            latency_ms=int((time.monotonic() - t0) * 1000),
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            ok=ok,
            error_code=code,
        ))

    # ── generation ──────────────────────────────────────────────────────────
    async def generate(self, req: GenerateRequest) -> AsyncIterator[AIEvent]:
        """Stream events: text_delta*, then done(usage) or error. Never raises provider errors."""
        started, t0 = datetime.utcnow(), time.monotonic()
        usage = Usage()
        ok, code = False, "cancelled"
        try:
            cfg, adapter = await self._ensure()
            self._require_model(cfg)
            chunks = adapter.stream(req.messages, req.system, req.max_tokens, usage=usage)
            async for chunk in self._stream_with_deadlines(chunks, self._limits(cfg), t0):
                yield AIEvent("text_delta", text=chunk)
            ok, code = True, None
            yield AIEvent("done", usage=usage)
        except Exception as exc:
            err = map_exception(exc)
            code = err.code
            yield AIEvent("error", error_code=err.code, message=err.message)
        finally:
            self._log(req.agent, started, t0, usage, ok, code)

    async def complete(self, req: GenerateRequest) -> GenerateResult:
        """Non-streaming call. Raises GatewayError."""
        started, t0 = datetime.utcnow(), time.monotonic()
        usage = Usage()
        ok, code = False, "cancelled"
        try:
            cfg, adapter = await self._ensure()
            self._require_model(cfg)
            limit = self._limits(cfg).total
            try:
                text = await asyncio.wait_for(
                    adapter.complete(req.messages, req.system, req.max_tokens, usage=usage), timeout=limit)
            except asyncio.TimeoutError:
                raise _timeout_error("total", limit) from None
            ok, code = True, None
            return GenerateResult(
                text=text, provider=cfg.provider, model=cfg.model, usage=usage,
                latency_ms=int((time.monotonic() - t0) * 1000),
            )
        except Exception as exc:
            err = map_exception(exc)
            code = err.code
            raise err from None
        finally:
            self._log(req.agent, started, t0, usage, ok, code)

    async def complete_json(
        self, req: GenerateRequest, schema: type[T], retries: int = 1, describe_schema: bool = True
    ) -> T:
        """Ask for JSON matching `schema`; on a bad reply, say what was wrong and retry.

        describe_schema=False keeps the caller's system prompt unchanged, for prompts
        that already spell out the exact JSON (the agents' prompts do).
        Raises JSONOutputError after 1 + retries bad replies (its raw_text is the last
        reply, for callers that salvage partial output), GatewayError on provider errors.
        """
        system = (req.system or "") + (schema_instruction(schema) if describe_schema else "")
        messages = list(req.messages)
        last_error: JSONOutputError | None = None
        for _ in range(retries + 1):
            result = await self.complete(GenerateRequest(messages, system, req.max_tokens, req.agent))
            try:
                return parse_into(result.text, schema)
            except JSONOutputError as exc:
                exc.raw_text = result.text
                last_error = exc
                messages = messages + [
                    {"role": "assistant", "content": result.text},
                    {"role": "user", "content": f"That reply was not usable: {exc} "
                                                "Reply again with ONLY the corrected JSON."},
                ]
        assert last_error is not None
        raise last_error

    # ── provider info ───────────────────────────────────────────────────────
    async def get_models(self) -> list[ModelInfo]:
        try:
            cfg, adapter = await self._ensure()
            models = await asyncio.wait_for(adapter.list_models(), timeout=self._limits(cfg).first_token)
        except Exception as exc:
            raise map_exception(exc) from None
        return sorted(models, key=lambda m: m.id)

    async def validate_connection(self) -> ConnectionStatus:
        """Cheap auth + reachability check. Never raises; never spends tokens unless the
        provider has no other way to check (OpenWebUI hosts without /api/models)."""
        t0 = time.monotonic()
        try:
            cfg, adapter = await self._ensure()
            # A check is a model list or an auth probe, so the first-token limit is plenty.
            models = await asyncio.wait_for(self._check(adapter), timeout=self._limits(cfg).first_token)
        except Exception as exc:
            err = map_exception(exc)
            return ConnectionStatus(
                ok=False, latency_ms=int((time.monotonic() - t0) * 1000),
                error_code=err.code, message=err.message,
            )
        models = sorted(models, key=lambda m: m.id)
        return ConnectionStatus(
            ok=True, latency_ms=int((time.monotonic() - t0) * 1000),
            model_count=len(models), models=models,
        )

    @staticmethod
    async def _check(adapter: LLMProvider) -> list[ModelInfo]:
        has_own_check = type(adapter).check_auth is not LLMProvider.check_auth
        models: list[ModelInfo] = []
        try:
            models = await adapter.list_models()
        except Exception:
            if not has_own_check:
                raise
        if has_own_check:
            await adapter.check_auth()
        return models

    def for_agent(self, agent: str) -> "AgentLLM":
        return AgentLLM(self, agent)


class AgentLLM:
    """The old LLMProvider call shape, routed through the gateway with the agent's name."""

    def __init__(self, gateway: AIGateway, agent: str):
        self.gateway = gateway
        self.agent = agent

    async def complete(self, messages: list[dict], system: str = "", max_tokens: int = 1000) -> str:
        result = await self.gateway.complete(GenerateRequest(messages, system, max_tokens, self.agent))
        return result.text

    async def complete_json(
        self, messages: list[dict], schema: type[T], system: str = "", max_tokens: int = 1000,
        retries: int = 1,
    ) -> T:
        """Agents' JSON calls. Their prompts already show the exact JSON, so the schema is
        used to validate and to explain a bad reply on the retry, not added to the prompt."""
        return await self.gateway.complete_json(
            GenerateRequest(messages, system, max_tokens, self.agent), schema,
            retries=retries, describe_schema=False,
        )

    async def stream(
        self, messages: list[dict], system: str = "", max_tokens: int = 1000
    ) -> AsyncGenerator[str, None]:
        async for event in self.gateway.generate(GenerateRequest(messages, system, max_tokens, self.agent)):
            if event.type == "text_delta":
                yield event.text
            elif event.type == "error":
                raise GatewayError(event.error_code or "provider_error", event.message)


def get_gateway(user_id: str | None = None, slot: str = "text") -> AIGateway:
    """Gateway for a user (their saved credential) or None (server .env default)."""
    return AIGateway(user_id=user_id, slot=slot)


def agent_llm(agent: str, user_id: str | None = None, gateway: AIGateway | None = None) -> AgentLLM:
    """What agent constructors call: an injected gateway (tests) or the user's gateway."""
    return (gateway or get_gateway(user_id)).for_agent(agent)
