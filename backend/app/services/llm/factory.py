from functools import lru_cache
from app.services.llm.base import LLMProvider


@lru_cache(maxsize=1)
def get_llm_provider() -> LLMProvider:
    """
    Cached singleton — reads config once at first AI call.
    To force a reload (e.g. after changing .env), restart the server.
    """
    from app.config import get_settings
    settings = get_settings()
    provider = settings.llm_provider.lower()

    if provider == "anthropic":
        if not settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY is not set in .env")
        from app.services.llm.anthropic_provider import AnthropicProvider
        return AnthropicProvider(api_key=settings.anthropic_api_key, model=settings.llm_model)

    if provider == "openrouter":
        if not settings.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY is not set in .env")
        from app.services.llm.openai_provider import OpenAIProvider
        return OpenAIProvider(
            api_key=settings.openrouter_api_key,
            model=settings.llm_model,
            base_url="https://openrouter.ai/api/v1",
            extra_headers={
                "HTTP-Referer": settings.openrouter_site_url,
                "X-Title": settings.openrouter_site_name,
            },
        )

    if provider == "openai":
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is not set in .env")
        from app.services.llm.openai_provider import OpenAIProvider
        return OpenAIProvider(api_key=settings.openai_api_key, model=settings.llm_model)

    if provider == "gemini":
        if not settings.gemini_api_key:
            raise ValueError("GEMINI_API_KEY is not set in .env")
        from app.services.llm.openai_provider import OpenAIProvider
        return OpenAIProvider(
            api_key=settings.gemini_api_key,
            model=settings.llm_model,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        )

    if provider == "ollama":
        from app.services.llm.openai_provider import OpenAIProvider
        return OpenAIProvider(
            api_key="ollama",
            model=settings.llm_model,
            base_url=settings.ollama_base_url,
        )

    raise ValueError(
        f"Unknown LLM provider: '{provider}'. "
        "Choose from: anthropic, openrouter, openai, gemini, ollama"
    )
