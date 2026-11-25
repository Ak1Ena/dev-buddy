import logging

from pydantic import SecretStr
from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

# Resolve .env from repo root regardless of where uvicorn is launched from
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"

# Public values: the defaults below and the ones in .env.example. A server
# outside development refuses to start with any of these (see insecure_secrets).
_PLACEHOLDER_SECRETS = {
    "dev-secret-change-in-production",
    "jwt-secret-change-in-production",
    "your-super-secret-key-change-in-production",
    "your-jwt-secret-key-change-in-production",
}
_MIN_SECRET_LEN = 32


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

    # ── User base URLs (SSRF guard, app/ai_gateway/url_guard.py) ─────────────
    # May a user's provider base URL point at loopback/private/CGNAT addresses?
    # Unset = yes only when APP_ENV=development (local Ollama/LM Studio work);
    # link-local and cloud metadata addresses are refused either way.
    ai_allow_private_base_urls: bool | None = None

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
        origins = [o.strip() for o in self.allowed_origins.split(",") if o.strip()]
        if "*" in origins:
            # CORS runs with allow_credentials=True, where "*" would echo any origin
            # back and let any site make logged-in requests.
            logger.warning("ALLOWED_ORIGINS contains '*', which is ignored: list the origins instead.")
            origins = [o for o in origins if o != "*"]
        return origins

    @property
    def allow_private_base_urls(self) -> bool:
        if self.ai_allow_private_base_urls is not None:
            return self.ai_allow_private_base_urls
        return self.app_env == "development"

    def insecure_secrets(self) -> list[str]:
        """Names of app secrets that are a public placeholder or too short."""
        return [
            name for name, value in (("SECRET_KEY", self.secret_key), ("JWT_SECRET_KEY", self.jwt_secret_key))
            if value.strip() in _PLACEHOLDER_SECRETS or len(value.strip()) < _MIN_SECRET_LEN
        ]


def check_app_secrets(settings: "Settings") -> None:
    """Startup guard: outside development, refuse placeholder JWT / app secrets.
    With M1 a forged JWT can use, replace or delete any user's saved provider key."""
    if settings.app_env == "development":
        return
    bad = settings.insecure_secrets()
    if bad:
        raise RuntimeError(
            f"Refusing to start with APP_ENV={settings.app_env}: {', '.join(bad)} is a public placeholder "
            f"or shorter than {_MIN_SECRET_LEN} characters. Generate one with: "
            "python -c \"import secrets; print(secrets.token_urlsafe(48))\""
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
