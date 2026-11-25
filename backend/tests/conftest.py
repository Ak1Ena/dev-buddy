"""Test setup: isolated SQLite file, a throwaway encryption key, no real provider keys.

Env vars are set before any app import because Settings is cached at first use.
Env vars win over the repo .env, so real keys in .env are never used here.
"""
import os
import tempfile
from pathlib import Path

from cryptography.fernet import Fernet

_TMP = Path(tempfile.mkdtemp(prefix="nexora-tests-"))
os.environ.update({
    "APP_ENV": "development",
    "DATABASE_URL": f"sqlite+aiosqlite:///{_TMP / 'test.db'}",
    "CREDENTIAL_ENCRYPTION_KEY": Fernet.generate_key().decode(),
    "LLM_PROVIDER": "ollama",
    "LLM_MODEL": "env-default-model",
    "OLLAMA_BASE_URL": "http://127.0.0.1:9/v1",
    "ANTHROPIC_API_KEY": "",
    "OPENAI_API_KEY": "",
    "GEMINI_API_KEY": "",
    "OPENROUTER_API_KEY": "",
    "OPENWEBUI_API_KEY": "",
})

from typing import AsyncGenerator  # noqa: E402

import httpx  # noqa: E402
import pytest  # noqa: E402

from app import database  # noqa: E402
from app.ai_gateway.adapters.base import LLMProvider  # noqa: E402
from app.ai_gateway.gateway import AIGateway, clear_adapter_cache  # noqa: E402
from app.ai_gateway.types import ModelInfo, ResolvedConfig, Usage  # noqa: E402
from app.ai_gateway.usage import flush_usage  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User  # noqa: E402
from app.utils.auth import create_access_token  # noqa: E402

# A value that looks like a real key, so leak checks are meaningful.
SECRET = "sk-test-NEXORA-do-not-leak-7f3a9c"


class FakeProvider(LLMProvider):
    """Scripted adapter: returns replies in order and records every call."""

    def __init__(self, replies: list[str] | None = None, models: list[str] | None = None,
                 error: Exception | None = None):
        self.replies = list(replies or ["ok"])
        self.models = models or ["fake-1", "fake-2"]
        self.error = error
        self.calls: list[dict] = []

    async def complete(self, messages, system="", max_tokens=1000, usage: Usage | None = None) -> str:
        self.calls.append({"messages": messages, "system": system, "max_tokens": max_tokens})
        if self.error:
            raise self.error
        if usage is not None:
            usage.input_tokens, usage.output_tokens = 11, 7
        return self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]

    async def stream(self, messages, system="", max_tokens=1000,
                     usage: Usage | None = None) -> AsyncGenerator[str, None]:
        self.calls.append({"messages": messages, "system": system, "max_tokens": max_tokens})
        if self.error:
            raise self.error
        for part in self.replies[0].split(" "):
            yield part + " "

    async def list_models(self) -> list[ModelInfo]:
        if self.error:
            raise self.error
        return [ModelInfo(id=m) for m in self.models]


def fake_gateway(adapter: FakeProvider, user_id: str | None = None) -> AIGateway:
    cfg = ResolvedConfig(provider="ollama", model="fake-model", base_url=None, source="env")
    return AIGateway(user_id=user_id, config=cfg, adapter=adapter)


@pytest.fixture(autouse=True)
async def fresh_db():
    async with database.engine.begin() as conn:
        await conn.run_sync(database.Base.metadata.drop_all)
        await conn.run_sync(database.Base.metadata.create_all)
    clear_adapter_cache()
    yield
    await flush_usage()
    # Pooled aiosqlite connections are bound to this test's event loop.
    await database.engine.dispose()


async def _make_user(name: str) -> User:
    async with database.AsyncSessionLocal() as db:
        user = User(email=f"{name}@example.test", username=name, hashed_password="x")
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user


@pytest.fixture
async def user_a() -> User:
    return await _make_user("alice")


@pytest.fixture
async def user_b() -> User:
    return await _make_user("bob")


def auth(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest.fixture
async def client() -> AsyncGenerator[httpx.AsyncClient, None]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
