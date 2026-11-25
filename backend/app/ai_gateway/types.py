"""Plain data types shared by the gateway, its adapters and the /api/ai router.

They live in the gateway package (not app/schemas) because agents and adapters
use them too, and none of them should depend on the HTTP layer.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

Slot = Literal["text", "live"]
SLOTS: tuple[str, ...] = ("text", "live")

ErrorCode = Literal[
    "auth_failed",
    "not_found",
    "rate_limited",
    "unreachable",
    "timeout",
    "bad_request",
    "provider_error",
]

EventType = Literal["text_delta", "done", "error"]


@dataclass
class Usage:
    """Token counts as reported by the provider. None when it did not report them."""

    input_tokens: int | None = None
    output_tokens: int | None = None


@dataclass
class GenerateRequest:
    messages: list[dict]
    system: str = ""
    max_tokens: int = 1000
    # Caller name for the usage log ("planner", "socratic_mentor", ...).
    agent: str = "unknown"


@dataclass
class GenerateResult:
    text: str
    provider: str
    model: str
    usage: Usage = field(default_factory=Usage)
    latency_ms: int = 0


@dataclass
class AIEvent:
    type: EventType
    text: str = ""
    usage: Usage | None = None
    error_code: ErrorCode | None = None
    message: str | None = None


@dataclass
class ModelInfo:
    id: str
    label: str | None = None
    context_window: int | None = None


@dataclass
class ConnectionStatus:
    ok: bool
    latency_ms: int
    model_count: int = 0
    error_code: ErrorCode | None = None
    message: str | None = None
    models: list[ModelInfo] = field(default_factory=list)


@dataclass(frozen=True)
class Capabilities:
    streaming: bool = True
    json_mode: bool = False
    tools: bool = False
    realtime: bool = False
    local: bool = False
    # Server accepts stream_options.include_usage, so streamed calls get token counts.
    stream_usage: bool = False


@dataclass(frozen=True)
class Timeouts:
    """Seconds. connect: TCP/TLS setup. first_token: until the first streamed text
    (for non-streamed calls only `total` applies). total: the whole call."""

    connect: float
    first_token: float
    total: float


@dataclass(frozen=True)
class ResolvedConfig:
    """Everything needed to build an adapter for one call.

    api_key is excluded from repr so an accidental log of this object never
    prints the key.
    """

    provider: str
    model: str
    base_url: str | None
    api_key: str = field(default="", repr=False)
    source: Literal["user", "env", "draft"] = "env"
    slot: str = "text"
    checked_at: datetime | None = None
