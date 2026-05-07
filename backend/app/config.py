from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_env: str = "development"
    secret_key: str = "dev-secret-change-in-production"
    allowed_origins: str = "http://localhost:3000"

    database_url: str = "sqlite+aiosqlite:///./devbuddy.db"

    # ── LLM Provider selection ────────────────────────────────────────────────
    # Options: anthropic | openrouter | openai | ollama
    llm_provider: str = "anthropic"

    # Model name — format depends on provider:
    #   anthropic:   claude-sonnet-4-6 | claude-opus-4-7 | claude-haiku-4-5-20251001
    #   openrouter:  anthropic/claude-3.5-sonnet | openai/gpt-4o | google/gemini-pro
    #   openai:      gpt-4o | gpt-4o-mini | gpt-4-turbo
    #   ollama:      llama3.2 | mistral | codellama (whatever you have pulled)
    llm_model: str = "claude-sonnet-4-6"

    # ── Provider API keys (only the one you use is required) ─────────────────
    anthropic_api_key: str = ""
    openrouter_api_key: str = ""
    openai_api_key: str = ""

    # ── OpenRouter optional metadata ─────────────────────────────────────────
    openrouter_site_url: str = "http://localhost:3000"
    openrouter_site_name: str = "devBuddy AI"

    # ── Ollama (local) ────────────────────────────────────────────────────────
    ollama_base_url: str = "http://localhost:11434/v1"

    # ── JWT Auth ──────────────────────────────────────────────────────────────
    jwt_secret_key: str = "jwt-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    class Config:
        env_file = ".env"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
