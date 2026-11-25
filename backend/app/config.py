from pydantic import SecretStr
from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path

# Resolve .env from repo root regardless of where uvicorn is launched from
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    app_env: str = "development"
    secret_key: str = "dev-secret-change-in-production"
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    database_url: str = "sqlite+aiosqlite:///./devbuddy.db"

    # ── LLM Provider selection ────────────────────────────────────────────────
    # Options: anthropic | openrouter | openai | gemini | ollama | openwebui
    llm_provider: str = "anthropic"

    # Model name — format depends on provider:
    #   anthropic:   claude-sonnet-4-6 | claude-opus-4-7 | claude-haiku-4-5-20251001
    #   openrouter:  anthropic/claude-3.5-sonnet | openai/gpt-4o | google/gemini-pro
    #   openai:      gpt-4o | gpt-4o-mini | gpt-4-turbo
    #   gemini:      gemini-2.0-flash | gemini-2.5-pro | gemini-2.5-flash
    #   ollama:      llama3.2 | mistral | codellama (whatever you have pulled)
    #   openwebui:   (your open-webui model id)
    llm_model: str = "claude-sonnet-4-6"

    # ── Provider API keys (only the one you use is required) ─────────────────
    # SecretStr so printing or logging Settings never shows a key.
    # These are the server-wide dev default; per-user keys live encrypted in
    # the ai_credentials table (see app/ai_gateway).
    anthropic_api_key: SecretStr = SecretStr("")
    openrouter_api_key: SecretStr = SecretStr("")
    openai_api_key: SecretStr = SecretStr("")
    gemini_api_key: SecretStr = SecretStr("")
    openwebui_api_key: SecretStr = SecretStr("")

    # ── Per-user credential encryption (Fernet key, urlsafe base64) ──────────
    # Required outside development. In development, if empty, a key is
    # generated once into backend/.credential_key (gitignored, mode 600).
    credential_encryption_key: SecretStr = SecretStr("")

    # ── Local OpenAI-compatible servers (defaults for user credentials) ──────
    lmstudio_base_url: str = "http://localhost:1234/v1"
    vllm_base_url: str = "http://localhost:8000/v1"

    # ── OpenRouter optional metadata ─────────────────────────────────────────
    openrouter_site_url: str = "http://localhost:3000"
    openrouter_site_name: str = "devBuddy AI"

    # ── Ollama (local) ────────────────────────────────────────────────────────
    ollama_base_url: str = "http://localhost:11434/v1"

    # ── Open WebUI ────────────────────────────────────────────────────────────
    openwebui_base_url: str = "http://localhost:3000/api"

    # ── JWT Auth ──────────────────────────────────────────────────────────────
    jwt_secret_key: str = "jwt-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    class Config:
        env_file = str(_ENV_FILE)
        extra = "ignore"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
