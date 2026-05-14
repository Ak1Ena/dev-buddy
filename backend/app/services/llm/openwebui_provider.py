"""
Custom LLM Provider for OpenWebUI instances that use the /api/v1/messages endpoint.
"""
import httpx
import json
from typing import AsyncGenerator

from app.services.llm.base import LLMProvider

class OpenWebUIProvider(LLMProvider):
    """
    Custom provider for OpenWebUI instances using the non-standard /api/v1/messages
    endpoint and x-api-key authentication.
    """

    def __init__(self, api_key: str, model: str, base_url: str):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient()

    def _build_payload(self, messages: list[dict], system: str, max_tokens: int, stream: bool) -> dict:
        # Transform the standard messages format to the expected payload
        if system:
            final_messages = [{"role": "system", "content": system}] + messages
        else:
            final_messages = messages

        return {
            "model": self.model,
            "messages": final_messages,
            "max_tokens": max_tokens,
            "stream": stream,
        }

    async def complete(
        self,
        messages: list[dict],
        system: str = "",
        max_tokens: int = 1000,
    ) -> str:
        base = self.base_url.rstrip('/')
        # Handle user providing .../api or just ...
        if '/api' in base:
            url = f"{base.rsplit('/api', 1)[0]}/api/v1/messages"
        else:
            url = f"{base}/api/v1/messages"

        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
        }
        payload = self._build_payload(messages, system, max_tokens, stream=False)

        response = await self.client.post(url, headers=headers, json=payload, timeout=60.0)
        response.raise_for_status() # Raise an exception for bad status codes

        data = response.json()
        # Assuming the response format is similar to OpenAI's and has choices
        if data.get("choices") and len(data["choices"]) > 0:
            return data["choices"][0].get("message", {}).get("content", "")
        
        # Fallback for other possible structures
        if data.get("message", {}).get("content"):
             return data["message"]["content"]

        return "" # Return empty string if no content found

    async def stream(
        self,
        messages: list[dict],
        system: str = "",
        max_tokens: int = 1000,
    ) -> AsyncGenerator[str, None]:
        base = self.base_url.rstrip('/')
        # Handle user providing .../api or just ...
        if '/api' in base:
            url = f"{base.rsplit('/api', 1)[0]}/api/v1/messages"
        else:
            url = f"{base}/api/v1/messages"

        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
        }
        payload = self._build_payload(messages, system, max_tokens, stream=True)

        async with self.client.stream("POST", url, headers=headers, json=payload, timeout=60.0) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith("data:"):
                    try:
                        chunk = json.loads(line[5:])
                        if chunk.get("choices") and len(chunk["choices"]) > 0:
                            delta = chunk["choices"][0].get("delta", {}).get("content")
                            if delta:
                                yield delta
                    except json.JSONDecodeError:
                        continue
