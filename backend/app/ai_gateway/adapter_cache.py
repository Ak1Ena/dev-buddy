"""Shared adapter cache (moved out of gateway.py).

Agents are built per request; without a cache every request would open a new
HTTP client pool. Keyed by a hash of the key so the plain key is not a dict key.

Its own module so credentials.py can evict on save/revoke (Vex review F6)
without importing gateway.py, which imports credentials.py.
"""
from __future__ import annotations

import asyncio
import hashlib
from collections import OrderedDict

from app.ai_gateway.adapters.base import LLMProvider
from app.ai_gateway.providers import build_checked_adapter
from app.ai_gateway.types import ResolvedConfig

_ADAPTER_CACHE_SIZE = 32
_adapter_cache: "OrderedDict[tuple, LLMProvider]" = OrderedDict()


def _digest(api_key: str) -> str:
    return hashlib.sha256(api_key.encode()).hexdigest()


def _cache_key(cfg: ResolvedConfig) -> tuple:
    return (cfg.provider, cfg.model, cfg.base_url, _digest(cfg.api_key))


def _close_later(adapter: LLMProvider) -> None:
    try:
        asyncio.get_running_loop().create_task(adapter.aclose())
    except RuntimeError:  # no running loop (sync test teardown): let GC close it
        pass


async def get_adapter(cfg: ResolvedConfig) -> LLMProvider:
    key = _cache_key(cfg)
    adapter = _adapter_cache.get(key)
    if adapter is not None:
        _adapter_cache.move_to_end(key)
        return adapter
    adapter = await build_checked_adapter(cfg)
    _adapter_cache[key] = adapter
    if len(_adapter_cache) > _ADAPTER_CACHE_SIZE:
        _, old = _adapter_cache.popitem(last=False)
        _close_later(old)
    return adapter


def evict_key(api_key: str | None) -> int:
    """Drop and close every cached adapter built with this key (after a revoke or
    replace), so the plain key does not outlive it in process memory. A call
    already running keeps its own reference and finishes or fails on its own."""
    if not api_key:
        return 0
    digest = _digest(api_key)
    stale = [k for k in _adapter_cache if k[3] == digest]
    for k in stale:
        _close_later(_adapter_cache.pop(k))
    return len(stale)


def clear_adapter_cache() -> None:
    _adapter_cache.clear()


def cached_count() -> int:
    return len(_adapter_cache)
