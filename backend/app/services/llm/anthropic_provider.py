import asyncio
from typing import AsyncGenerator
import anthropic

from app.services.llm.base import LLMProvider

# Global rate limiter — caps concurrent requests to Anthropic to prevent 429s.
# Each lesson generation fires 2 concurrent LLM calls (planner + designer),
# so this semaphore also limits background prefill + on-demand generation.
_anthropic_semaphore = asyncio.Semaphore(2)


class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str, model: str):
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model = model

    async def complete(
        self,
        messages: list[dict],
        system: str = "",
        max_tokens: int = 1000,
    ) -> str:
        kwargs = dict(model=self.model, max_tokens=max_tokens, messages=messages)
        if system:
            kwargs["system"] = system
        async with _anthropic_semaphore:
            response = await self.client.messages.create(**kwargs)
        return response.content[0].text

    async def stream(
        self,
        messages: list[dict],
        system: str = "",
        max_tokens: int = 1000,
    ) -> AsyncGenerator[str, None]:
        kwargs = dict(model=self.model, max_tokens=max_tokens, messages=messages)
        if system:
            kwargs["system"] = system
        async with self.client.messages.stream(**kwargs) as s:
            async for chunk in s.text_stream:
                yield chunk
