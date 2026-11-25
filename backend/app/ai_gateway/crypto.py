"""Encryption at rest for user provider keys (Fernet, AES-128-CBC + HMAC).

Lives in the gateway because only the gateway decrypts keys, right before
building an adapter. The decrypted key is never stored, returned or logged.
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings

logger = logging.getLogger(__name__)

# backend/.credential_key — gitignored. Dev only.
DEV_KEY_FILE = Path(__file__).resolve().parent.parent.parent / ".credential_key"


class CredentialKeyError(RuntimeError):
    """The server encryption key is missing or unusable."""


def _load_key(key_file: Path) -> bytes:
    settings = get_settings()
    configured = settings.credential_encryption_key.get_secret_value().strip()
    if configured:
        return configured.encode()
    if settings.app_env != "development":
        raise CredentialKeyError(
            "CREDENTIAL_ENCRYPTION_KEY is not set. It is required when APP_ENV is not "
            "'development'. Generate one with: python -c \"from cryptography.fernet import "
            "Fernet; print(Fernet.generate_key().decode())\""
        )
    if key_file.exists():
        if key_file.stat().st_mode & 0o077:
            # We create it 0600; a wider mode means someone changed it. Warn, still start (dev only).
            logger.warning("%s is readable by other users; run: chmod 600 %s", key_file.name, key_file)
        return key_file.read_bytes().strip()
    key = Fernet.generate_key()
    # O_EXCL so two workers starting at once don't overwrite each other's key.
    try:
        fd = os.open(key_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        return key_file.read_bytes().strip()
    with os.fdopen(fd, "wb") as fh:
        fh.write(key)
    logger.info("Generated a development credential key file (backend/.credential_key)")
    return key


@lru_cache(maxsize=1)
def get_fernet() -> Fernet:
    try:
        return Fernet(_load_key(DEV_KEY_FILE))
    except ValueError as exc:  # malformed key
        raise CredentialKeyError("CREDENTIAL_ENCRYPTION_KEY is not a valid Fernet key.") from exc


def ensure_credential_key() -> None:
    """Called at startup so a missing key fails fast instead of at first save."""
    get_fernet()


def encrypt_secret(plain: str) -> str:
    return get_fernet().encrypt(plain.encode()).decode()


def decrypt_secret(token: str) -> str:
    try:
        return get_fernet().decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise CredentialKeyError("Stored credential cannot be decrypted with the current key.") from exc


def key_hint(plain: str) -> str:
    """Last 4 characters, for the Settings screen to show which key is saved."""
    return "…" + plain[-4:] if len(plain) >= 8 else "…"
