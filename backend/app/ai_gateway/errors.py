"""Typed gateway errors and the mapping from provider SDK / HTTP exceptions.

Lives in the gateway so agents and routers only ever see GatewayError, never an
SDK exception. Messages are fixed text per code: provider error bodies are not
passed through, because some of them echo part of the API key back
(e.g. OpenAI's "Incorrect API key provided: sk-...").
"""
from __future__ import annotations

import asyncio
import logging

import httpx

from app.ai_gateway.types import ErrorCode

logger = logging.getLogger(__name__)

_MESSAGES: dict[str, str] = {
    "auth_failed": "The provider rejected the API key.",
    "not_found": "The provider could not find that model or endpoint.",
    "rate_limited": "The provider is rate limiting requests. Try again shortly.",
    "unreachable": "Could not reach the provider. Check the base URL and that it is running.",
    "bad_request": "The provider rejected the request.",
    "provider_error": "The provider returned an error.",
}


class GatewayError(Exception):
    """The only exception type that leaves the gateway."""

    def __init__(self, code: ErrorCode, message: str | None = None, status: int | None = None):
        self.code: ErrorCode = code
        self.status = status
        self.message = message or _MESSAGES[code]
        super().__init__(f"[{code}] {self.message}")


def _code_for_status(status: int) -> ErrorCode:
    if status in (401, 403):
        return "auth_failed"
    if status == 404:
        return "not_found"
    if status == 429:
        return "rate_limited"
    if status in (400, 409, 413, 422):
        return "bad_request"
    return "provider_error"


# Gemini answers a bad key with HTTP 400 INVALID_ARGUMENT, not 401. These markers are
# only matched, never echoed, so the user sees "rejected the API key" instead of
# a generic bad request.
_BAD_KEY_MARKERS = ("api_key_invalid", "api key not valid", "pass a valid api key")


def _says_bad_key(response: httpx.Response | None) -> bool:
    try:
        text = response.text.lower() if response is not None else ""
    except Exception:  # unread streaming body
        return False
    return any(m in text for m in _BAD_KEY_MARKERS)


def map_exception(exc: BaseException) -> GatewayError:
    """Turn any adapter-side exception into a GatewayError with a safe message."""
    if isinstance(exc, GatewayError):
        return exc

    # Import lazily: both SDKs are optional at runtime for a given provider.
    import anthropic
    import openai

    status: int | None = None
    code: ErrorCode
    if isinstance(exc, (openai.APITimeoutError, anthropic.APITimeoutError,
                        openai.APIConnectionError, anthropic.APIConnectionError,
                        httpx.TimeoutException, httpx.ConnectError, httpx.NetworkError,
                        asyncio.TimeoutError, ConnectionError)):
        code = "unreachable"
    elif isinstance(exc, (openai.APIStatusError, anthropic.APIStatusError)):
        status = exc.status_code
        code = _code_for_status(status)
    elif isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        code = _code_for_status(status)
    else:
        code = "provider_error"
    if code == "bad_request" and _says_bad_key(getattr(exc, "response", None)):
        code = "auth_failed"

    # Log the class name and status only: exception text can carry key fragments.
    logger.warning("AI gateway error: code=%s status=%s type=%s", code, status, type(exc).__name__)
    message = _MESSAGES[code] + (f" (HTTP {status})" if status else "")
    return GatewayError(code, message, status)
