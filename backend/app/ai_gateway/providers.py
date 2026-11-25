"""Provider registry: which providers exist, what they need, and how to build an adapter.

This replaces app/services/llm/factory.py. It is the only place that maps a
provider id to an adapter class, so adding a provider is one entry here plus
(if it is not OpenAI-compatible) one adapter class.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.ai_gateway.adapters.base import LLMProvider
from app.ai_gateway.errors import GatewayError
from app.ai_gateway.types import Capabilities, ResolvedConfig
from app.config import get_settings

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


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


def _specs() -> dict[str, ProviderSpec]:
    s = get_settings()
    return {
        "anthropic": ProviderSpec(
            "anthropic", "Anthropic (Claude)", True, False, None, False, False,
            Capabilities(streaming=True, json_mode=False, tools=True),
        ),
        "openai": ProviderSpec(
            "openai", "OpenAI", True, False, None, True, False,
            Capabilities(streaming=True, json_mode=True, tools=True),
        ),
        "gemini": ProviderSpec(
            "gemini", "Google Gemini", True, False, GEMINI_BASE_URL, True, False,
            Capabilities(streaming=True, json_mode=True, tools=True),
        ),
        "openrouter": ProviderSpec(
            "openrouter", "OpenRouter", True, False, OPENROUTER_BASE_URL, False, False,
            Capabilities(streaming=True, json_mode=True, tools=True),
        ),
        "ollama": ProviderSpec(
            "ollama", "Ollama (local)", False, False, s.ollama_base_url, False, True,
            Capabilities(streaming=True, json_mode=True, local=True),
        ),
        "lmstudio": ProviderSpec(
            "lmstudio", "LM Studio (local)", False, True, s.lmstudio_base_url, False, True,
            Capabilities(streaming=True, local=True),
        ),
        "vllm": ProviderSpec(
            "vllm", "vLLM", False, True, s.vllm_base_url, False, True,
            Capabilities(streaming=True, local=True),
        ),
        "openai_compatible": ProviderSpec(
            "openai_compatible", "Custom (OpenAI-compatible)", False, True, None, False, False,
            Capabilities(streaming=True),
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

    if cfg.provider == "anthropic":
        from app.ai_gateway.adapters.anthropic_provider import AnthropicProvider
        return AnthropicProvider(api_key=cfg.api_key, model=cfg.model, base_url=base_url)

    if cfg.provider == "openwebui":
        from app.ai_gateway.adapters.openwebui_provider import OpenWebUIProvider
        return OpenWebUIProvider(api_key=cfg.api_key, model=cfg.model, base_url=base_url or "")

    from app.ai_gateway.adapters.openai_provider import OpenAIProvider
    if cfg.provider == "openrouter":
        s = get_settings()
        root = (base_url or OPENROUTER_BASE_URL).rstrip("/")
        return OpenAIProvider(
            api_key=cfg.api_key,
            model=cfg.model,
            base_url=root,
            extra_headers={"HTTP-Referer": s.openrouter_site_url, "X-Title": s.openrouter_site_name},
            auth_check_url=f"{root}/key",
        )
    # openai, gemini, ollama, lmstudio, vllm, openai_compatible: same wire format.
    # Local servers ignore the key, but the SDK requires a non-empty string.
    return OpenAIProvider(api_key=cfg.api_key or "not-needed", model=cfg.model, base_url=base_url)


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
