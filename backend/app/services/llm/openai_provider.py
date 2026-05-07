import json
from typing import AsyncGenerator
from openai import AsyncOpenAI

from app.services.llm.base import LLMProvider


def _unwrap_text(content: str) -> str:
    """Some models return {"type":"text","text":"..."} instead of plain text."""
    if not content or not content.strip().startswith("{"):
        return content
    try:
        obj = json.loads(content)
        if isinstance(obj, dict) and obj.get("type") == "text" and "text" in obj:
            return obj["text"]
        if isinstance(obj, list):
            parts = [
                item.get("text", "") for item in obj
                if isinstance(item, dict) and item.get("type") == "text"
            ]
            if parts:
                return "\n".join(parts)
    except (json.JSONDecodeError, AttributeError):
        pass
    return content


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
        content = msg.content
        if not content:
            content = getattr(msg, "reasoning", None) or ""
        return _unwrap_text(content)

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
