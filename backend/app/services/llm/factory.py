from app.services.llm.base import LLMProvider

_provider: LLMProvider | None = None


def get_llm_provider() -> LLMProvider:
    """Lazy singleton — instantiated on first actual use, not at import time."""
    global _provider
    if _provider is not None:
        return _provider

    from app.config import get_settings
    settings = get_settings()
    provider = settings.llm_provider.lower()

    if provider == "anthropic":
        if not settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY is not set in .env")
        from app.services.llm.anthropic_provider import AnthropicProvider
        _provider = AnthropicProvider(api_key=settings.anthropic_api_key, model=settings.llm_model)

    elif provider == "openrouter":
        if not settings.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY is not set in .env")
        from app.services.llm.openai_provider import OpenAIProvider
        _provider = OpenAIProvider(
            api_key=settings.openrouter_api_key,
            model=settings.llm_model,
            base_url="https://openrouter.ai/api/v1",
            extra_headers={
                "HTTP-Referer": settings.openrouter_site_url,
                "X-Title": settings.openrouter_site_name,
            },
        )

    elif provider == "openai":
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is not set in .env")
        from app.services.llm.openai_provider import OpenAIProvider
        _provider = OpenAIProvider(api_key=settings.openai_api_key, model=settings.llm_model)

    elif provider == "ollama":
        from app.services.llm.openai_provider import OpenAIProvider
        _provider = OpenAIProvider(
            api_key="ollama",
            model=settings.llm_model,
            base_url=settings.ollama_base_url,
        )

    else:
        raise ValueError(
            f"Unknown LLM provider: '{provider}'. "
            "Choose from: anthropic, openrouter, openai, ollama"
        )

    return _provider
