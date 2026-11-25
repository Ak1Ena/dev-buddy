"""/api/ai: provider list, per-user credentials, connection tests, model lists.

Thin HTTP layer over app/ai_gateway. Every route needs a logged-in user and
only touches that user's rows. No response contains a key: responses are
built from explicit fields, never from the ORM row.
"""
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_gateway.credentials import (
    check_slot,
    config_from_credential,
    delete_credential,
    get_credential,
    list_credentials,
    record_check,
    upsert_credential,
)
from app.ai_gateway.crypto import CredentialKeyError, decrypt_secret
from app.ai_gateway.errors import GatewayError
from app.ai_gateway.gateway import AIGateway
from app.ai_gateway.providers import build_adapter, effective_base_url, get_spec, list_specs
from app.ai_gateway.types import ConnectionStatus, ResolvedConfig
from app.database import get_db
from app.models.ai import AICredential
from app.models.user import User
from app.schemas.ai import (
    CredentialIn,
    CredentialOut,
    DraftTestIn,
    DraftTestResultOut,
    ModelOut,
    ProviderOut,
    TestResultOut,
)
from app.utils.auth import get_current_user

router = APIRouter(prefix="/ai", tags=["ai"])


def _http_error(err: GatewayError) -> HTTPException:
    # 502 rather than 401 for auth_failed: the frontend treats 401 as "you are logged out".
    status = 400 if err.code == "bad_request" else 502
    return HTTPException(status_code=status, detail={"error_code": err.code, "message": err.message})


def _slot_or_400(slot: str) -> None:
    try:
        check_slot(slot)
    except GatewayError as err:
        raise _http_error(err)


def _cred_out(c: AICredential) -> CredentialOut:
    return CredentialOut(
        id=c.id, slot=c.slot, provider=c.provider, model=c.model, base_url=c.base_url,
        key_hint=c.key_hint, status=c.status, last_checked_at=c.last_checked_at,
        last_error=c.last_error,
    )


def _test_out(s: ConnectionStatus) -> TestResultOut:
    return TestResultOut(
        ok=s.ok, latency_ms=s.latency_ms, model_count=s.model_count,
        error_code=s.error_code, message=s.message,
    )


async def _check(cfg: ResolvedConfig) -> ConnectionStatus:
    """Run a connection check on a fresh adapter (not the shared cache) and close it."""
    try:
        adapter = build_adapter(cfg)
    except GatewayError as err:
        return ConnectionStatus(ok=False, latency_ms=0, error_code=err.code, message=err.message)
    try:
        return await AIGateway(config=cfg, adapter=adapter).validate_connection()
    finally:
        await adapter.aclose()


async def _stored_config(db: AsyncSession, user: User, slot: str) -> tuple[AICredential, ResolvedConfig]:
    _slot_or_400(slot)
    cred = await get_credential(db, user.id, slot)
    if cred is None:
        raise HTTPException(status_code=404, detail="No credential saved for this slot.")
    try:
        return cred, config_from_credential(cred)
    except CredentialKeyError:
        raise _http_error(GatewayError(
            "auth_failed", "The saved API key could not be read. Save it again in Settings."
        ))


@router.get("/providers", response_model=list[ProviderOut])
async def list_providers(current_user: User = Depends(get_current_user)) -> list[ProviderOut]:
    return [
        ProviderOut(
            id=s.id, label=s.label, needs_key=s.needs_key, needs_base_url=s.needs_base_url,
            default_base_url=s.default_base_url, supports_live=s.supports_live, local=s.local,
        )
        for s in list_specs()
    ]


@router.get("/credentials", response_model=list[CredentialOut])
async def get_credentials(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[CredentialOut]:
    return [_cred_out(c) for c in await list_credentials(db, current_user.id)]


@router.put("/credentials/{slot}", response_model=CredentialOut)
async def save_credential(
    slot: str,
    body: CredentialIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CredentialOut:
    _slot_or_400(slot)
    try:
        cred = await upsert_credential(
            db, current_user.id, slot, body.provider, body.model, body.base_url, body.api_key
        )
    except GatewayError as err:
        await db.rollback()
        raise _http_error(err)
    return _cred_out(cred)


@router.post("/credentials/{slot}/test", response_model=TestResultOut)
async def test_credential(
    slot: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> TestResultOut:
    cred, cfg = await _stored_config(db, current_user, slot)
    status = await _check(cfg)
    await record_check(db, cred, status)
    return _test_out(status)


@router.get("/credentials/{slot}/models", response_model=list[ModelOut])
async def credential_models(
    slot: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[ModelOut]:
    _, cfg = await _stored_config(db, current_user, slot)
    try:
        adapter = build_adapter(cfg)
    except GatewayError as err:
        raise _http_error(err)
    try:
        models = await AIGateway(config=cfg, adapter=adapter).get_models()
    except GatewayError as err:
        raise _http_error(err)
    finally:
        await adapter.aclose()
    return [ModelOut(id=m.id, label=m.label, context_window=m.context_window) for m in models]


@router.delete("/credentials/{slot}", status_code=204)
async def revoke_credential(
    slot: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> Response:
    _slot_or_400(slot)
    if not await delete_credential(db, current_user.id, slot):
        raise HTTPException(status_code=404, detail="No credential saved for this slot.")
    return Response(status_code=204)


@router.post("/test-draft", response_model=DraftTestResultOut)
async def test_draft(
    body: DraftTestIn, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> DraftTestResultOut:
    """Test a provider config before saving it. Nothing is stored."""
    try:
        get_spec(body.provider)
        if not get_spec(body.provider).user_selectable:
            raise GatewayError("bad_request", "This provider cannot be used from Settings.")
        base_url = effective_base_url(body.provider, body.base_url)
    except GatewayError as err:
        raise _http_error(err)

    api_key = (body.api_key or "").strip()
    if not api_key and body.slot:
        stored = await get_credential(db, current_user.id, body.slot)
        same_target = (
            stored is not None
            and stored.provider == body.provider
            and effective_base_url(stored.provider, stored.base_url) == base_url
        )
        if same_target and stored.key_ciphertext:
            try:
                api_key = decrypt_secret(stored.key_ciphertext)
            except CredentialKeyError:
                api_key = ""

    cfg = ResolvedConfig(
        provider=body.provider, model="", base_url=body.base_url, api_key=api_key, source="draft",
    )
    status = await _check(cfg)
    out = _test_out(status)
    return DraftTestResultOut(
        **out.model_dump(),
        models=[ModelOut(id=m.id, label=m.label, context_window=m.context_window) for m in status.models],
    )
