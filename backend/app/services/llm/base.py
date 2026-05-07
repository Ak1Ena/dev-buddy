from abc import ABC, abstractmethod
from typing import AsyncGenerator


class LLMProvider(ABC):
    """Abstract base for all LLM providers. Agents only talk to this interface."""

    @abstractmethod
    async def complete(
        self,
        messages: list[dict],
        system: str = "",
        max_tokens: int = 1000,
    ) -> str: ...

    @abstractmethod
    async def stream(
        self,
        messages: list[dict],
        system: str = "",
        max_tokens: int = 1000,
    ) -> AsyncGenerator[str, None]: ...
