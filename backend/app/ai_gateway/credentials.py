"""Per-user credential store: save, read, revoke, and turn a row into a ResolvedConfig.

Every query filters by user_id, so one user can never read, test or delete
another user's credential. Plain keys exist only inside this module and the
adapter built from them.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_gateway.crypto import decrypt_secret, encrypt_secret, key_hint
from app.ai_gateway.errors import GatewayError
from app.ai_gateway.providers import get_spec
from app.ai_gateway.types import SLOTS, ConnectionStatus, ResolvedConfig
from app.models.ai import AICredential


def check_slot(slot: str) -> None:
    if slot not in SLOTS:
        raise GatewayError("bad_request", f"Unknown slot '{slot}'. Use one of: {', '.join(SLOTS)}.")


async def get_credential(db: AsyncSession, user_id: str, slot: str) -> AICredential | None:
    result = await db.execute(
        select(AICredential).where(AICredential.user_id == user_id, AICredential.slot == slot)
    )
    return result.scalar_one_or_none()


async def list_credentials(db: AsyncSession, user_id: str) -> list[AICredential]:
    result = await db.execute(
        select(AICredential).where(AICredential.user_id == user_id).order_by(AICredential.slot)
    )
    return list(result.scalars().all())


def _norm_url(url: str | None) -> str | None:
    url = (url or "").strip().rstrip("/")
    return url or None


async def upsert_credential(
    db: AsyncSession,
    user_id: str,
    slot: str,
    provider: str,
    model: str | None,
    base_url: str | None,
    api_key: str | None,
) -> AICredential:
    """Create or replace the user's credential for a slot.

    api_key None keeps the stored key, but only if provider and base URL are
    unchanged: a key saved for one host must never be sent to another.
    """
    check_slot(slot)
    spec = get_spec(provider)
    if not spec.user_selectable:
        raise GatewayError("bad_request", f"{spec.label} cannot be saved as a user credential.")
    base_url = _norm_url(base_url)
    if spec.needs_base_url and not (base_url or spec.default_base_url):
        raise GatewayError("bad_request", f"{spec.label} needs a base URL.")

    cred = await get_credential(db, user_id, slot)
    if cred is None:
        cred = AICredential(user_id=user_id, slot=slot, provider=provider)
        db.add(cred)

    same_target = cred.provider == provider and _norm_url(cred.base_url) == base_url
    new_key = (api_key or "").strip()
    if new_key:
        cred.key_ciphertext = encrypt_secret(new_key)
        cred.key_hint = key_hint(new_key)
    elif not same_target:
        cred.key_ciphertext = None
        cred.key_hint = None

    if spec.needs_key and not cred.key_ciphertext:
        raise GatewayError("bad_request", f"{spec.label} needs an API key.")

    cred.provider = provider
    cred.model = (model or "").strip() or None
    cred.base_url = base_url
    cred.status = "untested"
    cred.last_checked_at = None
    cred.last_error = None
    cred.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(cred)
    return cred


async def delete_credential(db: AsyncSession, user_id: str, slot: str) -> bool:
    """Revoke: the row (and with it the ciphertext) is deleted."""
    result = await db.execute(
        delete(AICredential).where(AICredential.user_id == user_id, AICredential.slot == slot)
    )
    await db.commit()
    return (result.rowcount or 0) > 0


async def record_check(db: AsyncSession, cred: AICredential, status: ConnectionStatus) -> None:
    cred.status = "ok" if status.ok else "failed"
    cred.last_checked_at = datetime.utcnow()
    cred.last_error = None if status.ok else f"{status.error_code}: {status.message}"[:300]
    await db.commit()


def config_from_credential(cred: AICredential) -> ResolvedConfig:
    return ResolvedConfig(
        provider=cred.provider,
        model=cred.model or "",
        base_url=cred.base_url,
        api_key=decrypt_secret(cred.key_ciphertext) if cred.key_ciphertext else "",
        source="user",
        slot=cred.slot,
        checked_at=cred.last_checked_at,
    )
