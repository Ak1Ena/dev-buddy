"""Encryption at rest for user provider keys."""
import stat
from types import SimpleNamespace

import pytest
from cryptography.fernet import Fernet
from pydantic import SecretStr

from app.ai_gateway import crypto


def test_round_trip_and_ciphertext_hides_key():
    token = crypto.encrypt_secret("sk-live-abcdef123456")
    assert "abcdef" not in token
    assert crypto.decrypt_secret(token) == "sk-live-abcdef123456"


def test_same_key_encrypts_differently_each_time():
    assert crypto.encrypt_secret("same") != crypto.encrypt_secret("same")


def test_wrong_server_key_cannot_decrypt():
    other = Fernet(Fernet.generate_key()).encrypt(b"secret").decode()
    with pytest.raises(crypto.CredentialKeyError):
        crypto.decrypt_secret(other)


def test_key_hint_shows_only_last_four():
    assert crypto.key_hint("sk-abcdefgh1234") == "…1234"
    assert crypto.key_hint("short") == "…"


def _settings(app_env: str, key: str = "") -> SimpleNamespace:
    return SimpleNamespace(app_env=app_env, credential_encryption_key=SecretStr(key))


def test_dev_generates_key_file_with_mode_600(tmp_path, monkeypatch):
    monkeypatch.setattr(crypto, "get_settings", lambda: _settings("development"))
    key_file = tmp_path / ".credential_key"
    key = crypto._load_key(key_file)
    assert key_file.exists()
    assert stat.S_IMODE(key_file.stat().st_mode) == 0o600
    Fernet(key)  # valid key
    assert crypto._load_key(key_file) == key  # reused, not regenerated


def test_missing_key_outside_development_is_an_error(tmp_path, monkeypatch):
    monkeypatch.setattr(crypto, "get_settings", lambda: _settings("production"))
    with pytest.raises(crypto.CredentialKeyError):
        crypto._load_key(tmp_path / ".credential_key")
    assert not (tmp_path / ".credential_key").exists()
