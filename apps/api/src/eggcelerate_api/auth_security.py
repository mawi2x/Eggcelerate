"""Password hashing and opaque, server-stored session token helpers."""

from __future__ import annotations

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError

PASSWORD_HASHER = PasswordHasher(
    time_cost=2,
    memory_cost=19 * 1024,
    parallelism=1,
    hash_len=32,
    salt_len=16,
)
_DUMMY_PASSWORD_HASH = PASSWORD_HASHER.hash("not-a-real-eggcelerate-password")


def hash_password(password: str) -> str:
    return PASSWORD_HASHER.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    """Use a dummy hash for unknown accounts to avoid a cheap timing oracle."""
    selected_hash = password_hash or _DUMMY_PASSWORD_HASH
    try:
        return (
            PASSWORD_HASHER.verify(selected_hash, password)
            and password_hash is not None
        )
    except VerificationError:
        return False


def new_secret() -> str:
    return secrets.token_urlsafe(32)


def secret_hash(secret: str) -> str:
    return hashlib.sha256(secret.encode("ascii")).hexdigest()
