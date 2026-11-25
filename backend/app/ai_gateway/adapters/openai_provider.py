import asyncio
import json
import re
import logging
from typing import AsyncGenerator

import httpx
from openai import AsyncOpenAI, DefaultAsyncHttpxClient

from app.ai_gateway.adapters.base import LLMProvider
from app.ai_gateway.types import ModelInfo, Usage

logger = logging.getLogger(__name__)

# Global rate limiter — caps concurrent requests to the API to prevent 429s.
_openai_semaphore = asyncio.Semaphore(2)


# Strip inline reasoning that some models (Gemini 2.5, DeepSeek-R1, etc.) emit
# as part of their content. We never want this in user-facing answers.
_THOUGHT_TAGS = re.compile(
    r"<\s*(thought|thinking|reasoning|scratch(?:pad)?)\s*>.*?<\s*/\s*\1\s*>",
    re.DOTALL | re.IGNORECASE,
)


def _strip_thoughts(text: str) -> str:
    if not text:
        return text
    cleaned = _THOUGHT_TAGS.sub("", text).strip()
    return cleaned or text  # if removing leaves empty, return original


def _unwrap_text(content: str | None) -> str:
    """Some models return {"type":"text","text":"..."} instead of plain text."""
    if not content:
        return ""
    if content.strip().startswith("{"):
        try:
            obj = json.loads(content)
            if isinstance(obj, dict) and obj.get("type") == "text" and "text" in obj:
                return _strip_thoughts(obj["text"])
            if isinstance(obj, list):
                parts = [
                    item.get("text", "") for item in obj
                    if isinstance(item, dict) and item.get("type") == "text"
                ]
                if parts:
                    return _strip_thoughts("\n".join(parts))
        except (json.JSONDecodeError, AttributeError):
            pass
    return _strip_thoughts(content)


class OpenAIProvider(LLMProvider):
    """Works for direct OpenAI and any OpenAI-compatible API (OpenRouter, Ollama, etc.)"""

    def __init__(
        self,
        api_key: str,
        model: str,
        base_url: str | None = None,
        extra_headers: dict | None = None,
        auth_check_url: str | None = None,
        timeout: httpx.Timeout | float | None = None,
        max_retries: int = 1,
        stream_usage: bool = False,
    ):
        logger.debug("Initializing OpenAIProvider with base_url: %s", base_url)

        # The SDK default is 600 s and 2 retries; the gateway passes its per-provider limits.
        # follow_redirects=False: the SDK's default client follows them, which would let a
        # public base URL 302 the server to an internal host after the URL guard passed it.
        limits = {"timeout": timeout} if timeout is not None else {}
        self.client = AsyncOpenAI(
            api_key=api_key, base_url=base_url, max_retries=max_retries,
            http_client=DefaultAsyncHttpxClient(follow_redirects=False, **limits), **limits,
        )
        self.model = model
        self.extra_headers = extra_headers or {}
        self.stream_usage = stream_usage
        # Some hosts (OpenRouter) list models without auth, so a model list
        # alone does not prove the key works. They give an endpoint that does.
        self._auth_check_url = auth_check_url
        self._api_key = api_key

    def _build_messages(self, messages: list[dict], system: str) -> list[dict]:
        if system:
            return [{"role": "system", "content": system}] + messages
        return messages

    async def complete(
        self,
        messages: list[dict],
        system: str = "",
        max_tokens: int = 1000,
        usage: Usage | None = None,
    ) -> str:
        async with _openai_semaphore:
            response = await self.client.chat.completions.create(
                model=self.model,
                max_tokens=max_tokens,
                messages=self._build_messages(messages, system),
                extra_headers=self.extra_headers,
            )
        if usage is not None and response.usage is not None:
            usage.input_tokens = response.usage.prompt_tokens
            usage.output_tokens = response.usage.completion_tokens
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
        usage: Usage | None = None,
    ) -> AsyncGenerator[str, None]:
        # Token usage arrives in one extra final chunk (with no choices) when
        # stream_options.include_usage is sent. Not every OpenAI-compatible server
        # accepts the option, so it is only sent where the provider spec says so;
        # elsewhere the usage log keeps None.
        extra = {"stream_options": {"include_usage": True}} if self.stream_usage else {}
        stream = await self.client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=self._build_messages(messages, system),
            extra_headers=self.extra_headers,
            stream=True,
            **extra,
        )
        # Closing the stream closes the HTTP response, also when the gateway
        # cancels this generator on a timeout or the learner disconnects.
        async with stream:
            async for text in self._visible_text(stream, usage):
                yield text

    async def _visible_text(self, stream, usage: Usage | None) -> AsyncGenerator[str, None]:
        # Stream while skipping any <thought>…</thought> / <thinking>…</thinking>
        # block. Gemini-class models can emit these mid-stream; we buffer when
        # we see an opening tag and flush only what's outside the block.
        OPEN  = re.compile(r"<\s*(thought|thinking|reasoning|scratch(?:pad)?)\s*>", re.IGNORECASE)
        CLOSE_OF = lambda tag: re.compile(rf"<\s*/\s*{tag}\s*>", re.IGNORECASE)

        buf = ""
        skipping_tag: str | None = None
        async for chunk in stream:
            if usage is not None and getattr(chunk, "usage", None) is not None:
                usage.input_tokens = chunk.usage.prompt_tokens
                usage.output_tokens = chunk.usage.completion_tokens
            # Some hosts send keep-alive / usage chunks with no choices.
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if not delta:
                continue
            buf += delta
            while True:
                if skipping_tag is None:
                    m = OPEN.search(buf)
                    if not m:
                        # Nothing to skip — but hold back the tail in case a
                        # tag is being formed across chunk boundaries.
                        safe_until = max(0, len(buf) - 16)
                        if safe_until > 0:
                            yield buf[:safe_until]
                            buf = buf[safe_until:]
                        break
                    # Yield text before the opening tag, then enter skip mode.
                    if m.start() > 0:
                        yield buf[:m.start()]
                    skipping_tag = m.group(1).lower()
                    buf = buf[m.end():]
                else:
                    m = CLOSE_OF(skipping_tag).search(buf)
                    if not m:
                        # Stay in skip mode; keep at most a partial-close-tag tail.
                        if len(buf) > 32:
                            buf = buf[-32:]
                        break
                    buf = buf[m.end():]
                    skipping_tag = None
        if buf and skipping_tag is None:
            yield buf

    async def list_models(self) -> list[ModelInfo]:
        page = await self.client.models.list(extra_headers=self.extra_headers)
        models: list[ModelInfo] = []
        for m in page.data:
            extra = m.model_extra or {}
            ctx = extra.get("context_length") or extra.get("context_window")
            models.append(ModelInfo(
                id=m.id,
                label=extra.get("name") or extra.get("display_name"),
                context_window=ctx if isinstance(ctx, int) else None,
            ))
        return models

    async def check_auth(self) -> None:
        if not self._auth_check_url:
            await self.list_models()
            return
        async with httpx.AsyncClient(timeout=15.0) as http:
            resp = await http.get(
                self._auth_check_url,
                headers={"Authorization": f"Bearer {self._api_key}"},
            )
            resp.raise_for_status()

    async def aclose(self) -> None:
        await self.client.close()
