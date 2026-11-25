"""Adapter interface: one class per provider wire format.

Moved here from app/services/llm/base.py in M1. Only the gateway talks to
adapters; agents talk to the gateway. `usage` is an optional sink the adapter
fills with token counts when the provider reports them.
"""
from abc import ABC, abstractmethod
from typing import AsyncGenerator

from app.ai_gateway.types import ModelInfo, Usage


class LLMProvider(ABC):
    """Abstract base for all LLM provider adapters."""

    @abstractmethod
    async def complete(
        self,
        messages: list[dict],
        system: str = "",
        max_tokens: int = 1000,
        usage: Usage | None = None,
    ) -> str: ...

    @abstractmethod
    def stream(
        self,
        messages: list[dict],
        system: str = "",
        max_tokens: int = 1000,
        usage: Usage | None = None,
    ) -> AsyncGenerator[str, None]: ...

    @abstractmethod
    async def list_models(self) -> list[ModelInfo]: ...

    async def check_auth(self) -> None:
        """Raise if the credential is not accepted. Default: listing models needs auth."""
        await self.list_models()

    async def aclose(self) -> None:
        """Release HTTP clients. Adapters without their own client do nothing."""
        return None
