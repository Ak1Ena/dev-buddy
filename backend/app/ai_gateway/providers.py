"""Provider registry: which providers exist, what they need, and how to build an adapter.

This replaces app/services/llm/factory.py. It is the only place that maps a
provider id to an adapter class, so adding a provider is one entry here plus
(if it is not OpenAI-compatible) one adapter class.
"""
from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.ai_gateway.adapters.base import LLMProvider
from app.ai_gateway.errors import GatewayError
from app.ai_gateway.types import Capabilities, ResolvedConfig, Timeouts
from app.ai_gateway.url_guard import check_base_url
from app.config import get_settings

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# Per provider kind. Hosted APIs answer fast or not at all. Self-hosted servers
# (often a CPU or a small GPU) can need minutes to load a model and read a long
# prompt before the first token: on 2026-11-25 the designer agent took 108 s on
# local qwen2.5:0.5b (CPU). The SDKs also retry, so they get max_retries=1 and the
# gateway's own deadline (gateway.py) caps the whole call, retries included.
CLOUD_TIMEOUTS = Timeouts(connect=10.0, first_token=90.0, total=300.0)
LOCAL_TIMEOUTS = Timeouts(connect=5.0, first_token=300.0, total=600.0)
SDK_MAX_RETRIES = 1


@dataclass(frozen=True)
class ProviderSpec:
    id: str
    label: str
    needs_key: bool
    needs_base_url: bool
    default_base_url: str | None
    supports_live: bool
    local: bool
    capabilities: Capabilities
    # False for dev-only providers that users cannot pick in Settings.
    user_selectable: bool = True
    timeouts: Timeouts = CLOUD_TIMEOUTS


def _specs() -> dict[str, ProviderSpec]:
    # stream_usage: only where the server is known to accept stream_options.include_usage
    # (OpenAI, OpenRouter, Gemini's OpenAI endpoint, Ollama, vLLM). Unknown servers
    # (LM Studio, custom, OpenWebUI) are not sent the option, so their stream rows log null.
    s = get_settings()
    return {
        "anthropic": ProviderSpec(
            "anthropic", "Anthropic (Claude)", True, False, None, False, False,
            # Anthropic streams report usage natively; stream_usage is for the OpenAI wire format.
            Capabilities(streaming=True, json_mode=False, tools=True),
        ),
        "openai": ProviderSpec(
            "openai", "OpenAI", True, False, None, True, False,
            Capabilities(streaming=True, json_mode=True, tools=True, stream_usage=True),
        ),
        "gemini": ProviderSpec(
            "gemini", "Google Gemini", True, False, GEMINI_BASE_URL, True, False,
            Capabilities(streaming=True, json_mode=True, tools=True, stream_usage=True),
        ),
        "openrouter": ProviderSpec(
            "openrouter", "OpenRouter", True, False, OPENROUTER_BASE_URL, False, False,
            Capabilities(streaming=True, json_mode=True, tools=True, stream_usage=True),
        ),
        "ollama": ProviderSpec(
            "ollama", "Ollama (local)", False, False, s.ollama_base_url, False, True,
            Capabilities(streaming=True, json_mode=True, local=True, stream_usage=True),
            timeouts=LOCAL_TIMEOUTS,
        ),
        "lmstudio": ProviderSpec(
            "lmstudio", "LM Studio (local)", False, True, s.lmstudio_base_url, False, True,
            Capabilities(streaming=True, local=True), timeouts=LOCAL_TIMEOUTS,
        ),
        "vllm": ProviderSpec(
            "vllm", "vLLM", False, True, s.vllm_base_url, False, True,
            Capabilities(streaming=True, local=True, stream_usage=True), timeouts=LOCAL_TIMEOUTS,
        ),
        "openai_compatible": ProviderSpec(
            "openai_compatible", "Custom (OpenAI-compatible)", False, True, None, False, False,
            # Usually self-hosted, so it gets the patient timeouts.
            Capabilities(streaming=True), timeouts=LOCAL_TIMEOUTS,
        ),
        "openwebui": ProviderSpec(
            "openwebui", "Open WebUI (dev .env only)", True, True, s.openwebui_base_url, False, False,
            Capabilities(streaming=True), user_selectable=False,
        ),
    }


def get_spec(provider: str) -> ProviderSpec:
    spec = _specs().get(provider)
    if spec is None:
        raise GatewayError("bad_request", f"Unknown provider '{provider}'.")
    return spec


def list_specs(user_selectable_only: bool = True) -> list[ProviderSpec]:
    return [s for s in _specs().values() if s.user_selectable or not user_selectable_only]


def effective_base_url(provider: str, base_url: str | None) -> str | None:
    """The base URL a call will use: the saved one, else the provider default."""
    spec = get_spec(provider)
    url = (base_url or "").strip() or spec.default_base_url
    if spec.needs_base_url and not url:
        raise GatewayError("bad_request", f"{spec.label} needs a base URL.")
    return url


def build_adapter(cfg: ResolvedConfig) -> LLMProvider:
    """Construct the adapter for a resolved config. Raises GatewayError(bad_request) on bad config."""
    spec = get_spec(cfg.provider)
    if spec.needs_key and not cfg.api_key:
        raise GatewayError("bad_request", f"{spec.label} needs an API key.")
    base_url = effective_base_url(cfg.provider, cfg.base_url)
    # HTTP-level limits. The read limit is the whole call because a non-streamed
    # reply sends nothing until it is done; first_token is enforced by the gateway.
    http_timeout = httpx.Timeout(spec.timeouts.total, connect=spec.timeouts.connect)

    if cfg.provider == "anthropic":
        from app.ai_gateway.adapters.anthropic_provider import AnthropicProvider
        return AnthropicProvider(api_key=cfg.api_key, model=cfg.model, base_url=base_url,
                                 timeout=http_timeout, max_retries=SDK_MAX_RETRIES)

    if cfg.provider == "openwebui":
        from app.ai_gateway.adapters.openwebui_provider import OpenWebUIProvider
        return OpenWebUIProvider(api_key=cfg.api_key, model=cfg.model, base_url=base_url or "",
                                 timeout=http_timeout)

    from app.ai_gateway.adapters.openai_provider import OpenAIProvider
    common = dict(model=cfg.model, timeout=http_timeout, max_retries=SDK_MAX_RETRIES,
                  stream_usage=spec.capabilities.stream_usage)
    if cfg.provider == "openrouter":
        s = get_settings()
        root = (base_url or OPENROUTER_BASE_URL).rstrip("/")
        return OpenAIProvider(
            api_key=cfg.api_key,
            base_url=root,
            extra_headers={"HTTP-Referer": s.openrouter_site_url, "X-Title": s.openrouter_site_name},
            auth_check_url=f"{root}/key",
            **common,
        )
    # openai, gemini, ollama, lmstudio, vllm, openai_compatible: same wire format.
    # Local servers ignore the key, but the SDK requires a non-empty string.
    return OpenAIProvider(api_key=cfg.api_key or "not-needed", base_url=base_url, **common)


async def build_checked_adapter(cfg: ResolvedConfig) -> LLMProvider:
    """build_adapter plus the SSRF guard (url_guard.py) for configs a user chose.

    The server .env default (source "env") is admin config and is not checked.
    A user config is checked on its effective URL, defaults included, so picking
    "vLLM" with no URL cannot reach the server's own localhost:8000 in production.
    """
    if cfg.source != "env":
        await check_base_url(effective_base_url(cfg.provider, cfg.base_url))
    return build_adapter(cfg)


def env_default_config(slot: str = "text") -> ResolvedConfig:
    """The server .env provider (dev default). Only the text slot has one."""
    if slot != "text":
        raise GatewayError("bad_request", f"No AI provider is set up for the '{slot}' slot.")
    s = get_settings()
    provider = s.llm_provider.lower().strip()
    keys = {
        "anthropic": s.anthropic_api_key,
        "openai": s.openai_api_key,
        "gemini": s.gemini_api_key,
        "openrouter": s.openrouter_api_key,
        "openwebui": s.openwebui_api_key,
    }
    secret = keys.get(provider)
    get_spec(provider)  # unknown provider -> GatewayError
    return ResolvedConfig(
        provider=provider,
        model=s.llm_model.strip(),
        base_url=None,
        api_key=secret.get_secret_value().strip() if secret else "",
        source="env",
        slot=slot,
    )
