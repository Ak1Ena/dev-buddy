import asyncio
from typing import AsyncGenerator

import anthropic
import httpx

from app.ai_gateway.adapters.base import LLMProvider
from app.ai_gateway.types import ModelInfo, Usage

# Global rate limiter — caps concurrent requests to Anthropic to prevent 429s.
# Each lesson generation fires 2 concurrent LLM calls (planner + designer),
# so this semaphore also limits background prefill + on-demand generation.
_anthropic_semaphore = asyncio.Semaphore(2)

_DEFAULT_BASE_URL = "https://api.anthropic.com"
_API_VERSION = "2023-06-01"


class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str, model: str, base_url: str | None = None):
        self.base_url = (base_url or _DEFAULT_BASE_URL).rstrip("/")
        self.client = anthropic.AsyncAnthropic(api_key=api_key, base_url=self.base_url)
        self._api_key = api_key
        self.model = model

    async def complete(
        self,
        messages: list[dict],
        system: str = "",
        max_tokens: int = 1000,
        usage: Usage | None = None,
    ) -> str:
        kwargs = dict(model=self.model, max_tokens=max_tokens, messages=messages)
        if system:
            kwargs["system"] = system
        async with _anthropic_semaphore:
            response = await self.client.messages.create(**kwargs)
        if usage is not None and response.usage is not None:
            usage.input_tokens = response.usage.input_tokens
            usage.output_tokens = response.usage.output_tokens
        return response.content[0].text

    async def stream(
        self,
        messages: list[dict],
        system: str = "",
        max_tokens: int = 1000,
        usage: Usage | None = None,
    ) -> AsyncGenerator[str, None]:
        kwargs = dict(model=self.model, max_tokens=max_tokens, messages=messages)
        if system:
            kwargs["system"] = system
        async with self.client.messages.stream(**kwargs) as s:
            async for chunk in s.text_stream:
                yield chunk
            if usage is not None:
                final = await s.get_final_message()
                usage.input_tokens = final.usage.input_tokens
                usage.output_tokens = final.usage.output_tokens

    async def list_models(self) -> list[ModelInfo]:
        # anthropic SDK 0.40 has no models API, so call the REST endpoint directly.
        async with httpx.AsyncClient(timeout=15.0) as http:
            resp = await http.get(
                f"{self.base_url}/v1/models",
                headers={"x-api-key": self._api_key, "anthropic-version": _API_VERSION},
                params={"limit": 100},
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])
        return [ModelInfo(id=m["id"], label=m.get("display_name")) for m in data if m.get("id")]

    async def aclose(self) -> None:
        await self.client.close()
