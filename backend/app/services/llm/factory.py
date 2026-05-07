from functools import lru_cache
from app.services.llm.base import LLMProvider


@lru_cache
def get_llm_provider() -> LLMProvider:
    from app.config import get_settings
    settings = get_settings()

    provider = settings.llm_provider.lower()

    if provider == "anthropic":
        from app.services.llm.anthropic_provider import AnthropicProvider
        return AnthropicProvider(
            api_key=settings.anthropic_api_key,
            model=settings.llm_model,
        )

    if provider == "openrouter":
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
        from app.services.llm.openai_provider import OpenAIProvider
        return OpenAIProvider(
            api_key=settings.openai_api_key,
            model=settings.llm_model,
        )

    if provider == "ollama":
        from app.services.llm.openai_provider import OpenAIProvider
        return OpenAIProvider(
            api_key="ollama",  # Ollama doesn't require a real key
            model=settings.llm_model,
            base_url=settings.ollama_base_url,
        )

    raise ValueError(
        f"Unknown LLM provider: '{provider}'. "
        "Choose from: anthropic, openrouter, openai, ollama"
    )
