from typing import AsyncGenerator
from openai import AsyncOpenAI

from app.services.llm.base import LLMProvider


class OpenAIProvider(LLMProvider):
    """Works for direct OpenAI and any OpenAI-compatible API (OpenRouter, Ollama, etc.)"""

    def __init__(
        self,
        api_key: str,
        model: str,
        base_url: str | None = None,
        extra_headers: dict | None = None,
    ):
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = model
        self.extra_headers = extra_headers or {}

    def _build_messages(self, messages: list[dict], system: str) -> list[dict]:
        if system:
            return [{"role": "system", "content": system}] + messages
        return messages

    async def complete(
        self,
        messages: list[dict],
        system: str = "",
        max_tokens: int = 1000,
    ) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=self._build_messages(messages, system),
            extra_headers=self.extra_headers,
        )
        msg = response.choices[0].message
        # Reasoning models (e.g. OpenRouter) may put the answer in .reasoning
        # when .content is empty
        content = msg.content
        if not content:
            content = getattr(msg, "reasoning", None) or ""
        return content

    async def stream(
        self,
        messages: list[dict],
        system: str = "",
        max_tokens: int = 1000,
    ) -> AsyncGenerator[str, None]:
        stream = await self.client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=self._build_messages(messages, system),
            extra_headers=self.extra_headers,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
