"""Resolve cookie sessions into request-local farm and user authority."""

from __future__ import annotations

import hmac
from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import Request
from sqlalchemy import select

from .auth_security import secret_hash
from .context import RequestContext
from .database.schema import auth_sessions, farm_memberships, farms, users
from .database.store import PostgresStore
from .errors import AppError

SESSION_COOKIE_NAME = "egg_session"
CSRF_HEADER_NAME = "X-CSRF-Token"


@dataclass(frozen=True)
class SessionIdentity:
    context: RequestContext
    email: str
    display_name: str
    farm_name: str
    csrf_token: str


async def resolve_session(
    database: PostgresStore, token: str | None, *, now: datetime | None = None
) -> SessionIdentity | None:
    if not token or len(token) > 256:
        return None
    token_digest = secret_hash(token)
    current = now or datetime.now(UTC)
    query = (
        select(
            auth_sessions.c.session_hash,
            auth_sessions.c.csrf_token,
            users.c.id.label("user_id"),
            users.c.email,
            users.c.display_name,
            farm_memberships.c.farm_id,
            farm_memberships.c.role,
            farms.c.name.label("farm_name"),
        )
        .select_from(
            auth_sessions.join(users, users.c.id == auth_sessions.c.user_id)
            .join(
                farm_memberships,
                (farm_memberships.c.user_id == auth_sessions.c.user_id)
                & (farm_memberships.c.farm_id == auth_sessions.c.farm_id),
            )
            .join(farms, farms.c.id == auth_sessions.c.farm_id)
        )
        .where(
            auth_sessions.c.session_hash == token_digest,
            auth_sessions.c.revoked_at.is_(None),
            auth_sessions.c.expires_at > current,
            users.c.disabled_at.is_(None),
        )
    )
    async with database.sessions() as session:
        row = (await session.execute(query)).mappings().first()
    if row is None:
        return None
    context = RequestContext(
        farm_id=str(row["farm_id"]),
        actor_id=str(row["user_id"]),
        role=row["role"],
        authenticated=True,
        session_hash=row["session_hash"],
        csrf_hash=secret_hash(row["csrf_token"]),
    )
    return SessionIdentity(
        context=context,
        email=row["email"],
        display_name=row["display_name"],
        farm_name=row["farm_name"],
        csrf_token=row["csrf_token"],
    )


def require_csrf(request: Request, context: RequestContext) -> None:
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    token = request.headers.get(CSRF_HEADER_NAME, "")
    if not token or not context.csrf_hash:
        raise AppError("unauthorized", "A valid CSRF token is required.")
    candidate = secret_hash(token)
    if not hmac.compare_digest(candidate, context.csrf_hash):
        raise AppError("unauthorized", "A valid CSRF token is required.")


def require_allowed_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if origin and origin not in request.app.state.settings.cors_origins:
        raise AppError("unauthorized", "This request origin is not allowed.")


def identity_payload(identity: SessionIdentity, csrf_token: str) -> dict:
    return {
        "authenticated": True,
        "user": {
            "id": identity.context.actor_id,
            "email": identity.email,
            "display_name": identity.display_name,
            "role": identity.context.role,
        },
        "farm": {"id": identity.context.farm_id, "name": identity.farm_name},
        "csrf_token": csrf_token,
    }
