"""AI usage log: one ai_usage row per generation call.

Writes run as background tasks on their own DB session, so a slow or locked
SQLite write never delays or fails the learner's request. A failed write is
logged (type only) and dropped: the usage log must never break a lesson.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime

from app import database
from app.models.ai import AIUsage

logger = logging.getLogger(__name__)

_pending: set[asyncio.Task] = set()


@dataclass
class UsageEntry:
    user_id: str | None
    slot: str
    provider: str
    model: str
    agent: str
    source: str
    started_at: datetime
    latency_ms: int
    input_tokens: int | None
    output_tokens: int | None
    ok: bool
    error_code: str | None


async def _write(entry: UsageEntry) -> None:
    try:
        async with database.AsyncSessionLocal() as db:
            db.add(AIUsage(**entry.__dict__))
            await db.commit()
    except Exception as exc:  # never let logging break a call
        logger.warning("ai_usage write failed: %s", type(exc).__name__)


def record_usage(entry: UsageEntry) -> None:
    try:
        task = asyncio.get_running_loop().create_task(_write(entry))
    except RuntimeError:
        return
    _pending.add(task)
    task.add_done_callback(_pending.discard)


async def flush_usage() -> None:
    """Wait for queued writes (tests, shutdown)."""
    if _pending:
        await asyncio.gather(*list(_pending), return_exceptions=True)
