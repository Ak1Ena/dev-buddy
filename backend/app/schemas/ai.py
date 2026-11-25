"""HTTP shapes for /api/ai. No response model has a field that can hold a key."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

ErrorCodeLiteral = Literal[
    "auth_failed", "not_found", "rate_limited", "unreachable", "bad_request", "provider_error"
]


def _check_base_url(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    if not v:
        return None
    if not v.startswith(("http://", "https://")) or any(c.isspace() for c in v):
        raise ValueError("base_url must be an http(s) URL")
    if "@" in v.split("/", 3)[2]:
        raise ValueError("base_url must not contain credentials")
    if "?" in v or "#" in v:
        raise ValueError("base_url must not contain a query string or fragment")
    return v


class ProviderOut(BaseModel):
    id: str
    label: str
    needs_key: bool
    needs_base_url: bool
    default_base_url: str | None
    supports_live: bool
    local: bool


class CredentialOut(BaseModel):
    id: str
    slot: str
    provider: str
    model: str | None
    base_url: str | None
    key_hint: str | None
    status: Literal["untested", "ok", "failed"]
    last_checked_at: datetime | None
    last_error: str | None


class CredentialIn(BaseModel):
    provider: str = Field(max_length=40)
    model: str | None = Field(default=None, max_length=200)
    base_url: str | None = Field(default=None, max_length=500)
    # Write-only. Omit to keep the stored key (same provider and base URL only).
    api_key: str | None = Field(default=None, max_length=500)

    _v_url = field_validator("base_url")(_check_base_url)


class DraftTestIn(BaseModel):
    provider: str = Field(max_length=40)
    base_url: str | None = Field(default=None, max_length=500)
    api_key: str | None = Field(default=None, max_length=500)
    # Optional: reuse the key already saved in this slot when api_key is omitted
    # (same provider and base URL only), e.g. to refresh the model list.
    slot: Literal["text", "live"] | None = None

    _v_url = field_validator("base_url")(_check_base_url)


class ModelOut(BaseModel):
    id: str
    label: str | None = None
    context_window: int | None = None


class TestResultOut(BaseModel):
    ok: bool
    latency_ms: int
    model_count: int
    error_code: ErrorCodeLiteral | None = None
    message: str | None = None


class DraftTestResultOut(TestResultOut):
    models: list[ModelOut] = []
