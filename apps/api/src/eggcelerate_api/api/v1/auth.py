"""App-managed email/password account and cookie-session endpoints."""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Request, Response
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import insert, select, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from ...auth_security import hash_password, new_secret, secret_hash, verify_password
from ...context import RequestContext
from ...database.preferences import preference_values
from ...database.schema import (
    auth_sessions,
    farm_memberships,
    farm_preferences,
    farms,
    modes,
    users,
)
from ...database.store import PostgresStore, mode_values
from ...errors import AppError, conflict, ok_envelope
from ...session_auth import (
    SESSION_COOKIE_NAME,
    SessionIdentity,
    identity_payload,
    require_allowed_origin,
    require_csrf,
    resolve_session,
)
from ...store import MemoryStore

router = APIRouter(prefix="/auth", tags=["auth"])

SESSION_SECONDS = 12 * 60 * 60
REMEMBERED_SESSION_SECONDS = 30 * 24 * 60 * 60


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: Annotated[str, Field(min_length=3, max_length=254)]
    password: Annotated[str, Field(min_length=12, max_length=128)]
    display_name: Annotated[str, Field(min_length=1, max_length=35)]
    farm_name: Annotated[str, Field(min_length=1, max_length=30)]

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
            raise ValueError("Enter a valid email address.")
        return normalized

    @field_validator("display_name", "farm_name")
    @classmethod
    def trim_names(cls, value: str) -> str:
        result = value.strip()
        if not result:
            raise ValueError("This field cannot be empty.")
        return result


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: Annotated[str, Field(min_length=3, max_length=254)]
    password: Annotated[str, Field(min_length=1, max_length=128)]
    remember_me: bool = False

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


def _database(request: Request) -> PostgresStore:
    database: PostgresStore | None = request.app.state.database
    if request.app.state.settings.auth_mode != "sessions" or database is None:
        raise AppError("unauthorized", "Session authentication is not enabled.")
    return database


def _set_session_cookie(
    request: Request,
    response: Response,
    token: str,
    max_age: int,
) -> None:
    response.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        max_age=max_age,
        path="/api/v1",
        secure=request.app.state.settings.app_env == "production",
        httponly=True,
        samesite="lax",
    )
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"


def _clear_session_cookie(request: Request, response: Response) -> None:
    response.delete_cookie(
        SESSION_COOKIE_NAME,
        path="/api/v1",
        secure=request.app.state.settings.app_env == "production",
        httponly=True,
        samesite="lax",
    )
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"


async def _insert_session(
    session,
    user_id,
    farm_id,
    remember_me: bool,
) -> tuple[str, str, str, datetime, int]:
    now = datetime.now(UTC)
    max_age = REMEMBERED_SESSION_SECONDS if remember_me else SESSION_SECONDS
    expires_at = now + timedelta(seconds=max_age)
    token = new_secret()
    csrf_token = new_secret()
    session_hash = secret_hash(token)
    await session.execute(
        insert(auth_sessions).values(
            session_hash=session_hash,
            farm_id=farm_id,
            user_id=user_id,
            csrf_token=csrf_token,
            expires_at=expires_at,
        )
    )
    return token, csrf_token, session_hash, expires_at, max_age


def _identity(
    user_id,
    email: str,
    display_name: str,
    farm_id,
    farm_name: str,
    role: str,
    session_hash: str,
    csrf_token: str,
):
    return SessionIdentity(
        context=RequestContext(
            farm_id=str(farm_id),
            actor_id=str(user_id),
            role=role,
            authenticated=True,
            session_hash=session_hash,
            csrf_hash=secret_hash(csrf_token),
        ),
        email=email,
        display_name=display_name,
        farm_name=farm_name,
        csrf_token=csrf_token,
    )


@router.post("/register", status_code=201)
async def register(body: RegisterRequest, request: Request, response: Response) -> dict:
    require_allowed_origin(request)
    database = _database(request)
    user_id = uuid4()
    farm_id = uuid4()
    password_hash = await run_in_threadpool(hash_password, body.password)
    seed = MemoryStore()
    seed.preferences = seed.preferences.model_copy(
        update={
            "farm_name": body.farm_name,
            "account_holder": body.display_name,
            "display_name": body.display_name,
        }
    )
    token = csrf_token = session_hash = ""
    max_age = SESSION_SECONDS
    try:
        async with database.sessions.begin() as session:
            await session.execute(
                insert(users).values(
                    id=user_id,
                    email=body.email,
                    password_hash=password_hash,
                    display_name=body.display_name,
                )
            )
            await session.execute(insert(farms).values(id=farm_id, name=body.farm_name))
            await session.execute(
                insert(farm_memberships).values(
                    farm_id=farm_id,
                    user_id=user_id,
                    role="owner",
                )
            )
            for position, mode in enumerate(seed.modes.values()):
                await session.execute(
                    insert(modes).values(**mode_values(farm_id, mode, position))
                )
            await session.execute(
                insert(farm_preferences).values(
                    **preference_values(farm_id, seed.preferences)
                )
            )
            (
                token,
                csrf_token,
                session_hash,
                _expires_at,
                max_age,
            ) = await _insert_session(session, user_id, farm_id, False)
    except IntegrityError as exc:
        raise conflict("An account with this email already exists.") from exc
    except (SQLAlchemyError, OSError, TimeoutError) as exc:
        raise AppError("offline", "The account service is unavailable.") from exc

    _set_session_cookie(request, response, token, max_age)
    identity = _identity(
        user_id,
        body.email,
        body.display_name,
        farm_id,
        body.farm_name,
        "owner",
        session_hash,
        csrf_token,
    )
    return ok_envelope(identity_payload(identity, csrf_token))


@router.post("/login")
async def login(body: LoginRequest, request: Request, response: Response) -> dict:
    require_allowed_origin(request)
    database = _database(request)
    query = (
        select(
            users.c.id.label("user_id"),
            users.c.email,
            users.c.password_hash,
            users.c.display_name,
            farm_memberships.c.farm_id,
            farm_memberships.c.role,
            farms.c.name.label("farm_name"),
        )
        .select_from(
            users.join(farm_memberships, farm_memberships.c.user_id == users.c.id).join(
                farms, farms.c.id == farm_memberships.c.farm_id
            )
        )
        .where(users.c.email == body.email, users.c.disabled_at.is_(None))
        .order_by(farm_memberships.c.created_at)
        .limit(1)
    )
    try:
        async with database.sessions() as session:
            row = (await session.execute(query)).mappings().first()
    except (SQLAlchemyError, OSError, TimeoutError) as exc:
        raise AppError("offline", "The account service is unavailable.") from exc
    valid = await run_in_threadpool(
        verify_password,
        row["password_hash"] if row is not None else None,
        body.password,
    )
    if row is None or not valid:
        raise AppError("unauthorized", "Email or password is incorrect.")

    try:
        async with database.sessions.begin() as session:
            (
                token,
                csrf_token,
                session_hash,
                _expires_at,
                max_age,
            ) = await _insert_session(
                session,
                row["user_id"],
                row["farm_id"],
                body.remember_me,
            )
    except (SQLAlchemyError, OSError, TimeoutError) as exc:
        raise AppError("offline", "The account service is unavailable.") from exc

    _set_session_cookie(request, response, token, max_age)
    identity = _identity(
        row["user_id"],
        row["email"],
        row["display_name"],
        row["farm_id"],
        row["farm_name"],
        row["role"],
        session_hash,
        csrf_token,
    )
    return ok_envelope(identity_payload(identity, csrf_token))


@router.get("/session")
async def current_session(request: Request, response: Response) -> dict:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    if request.app.state.settings.auth_mode != "sessions":
        return ok_envelope({"authenticated": False})
    database = _database(request)
    token = request.cookies.get(SESSION_COOKIE_NAME)
    try:
        identity = await resolve_session(database, token)
    except (SQLAlchemyError, OSError, TimeoutError) as exc:
        raise AppError("offline", "The account service is unavailable.") from exc
    if identity is None:
        if token:
            _clear_session_cookie(request, response)
        return ok_envelope({"authenticated": False})
    return ok_envelope(identity_payload(identity, identity.csrf_token))


@router.post("/logout")
async def logout(request: Request, response: Response) -> dict:
    require_allowed_origin(request)
    database = request.app.state.database
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if request.app.state.settings.auth_mode == "sessions" and database and token:
        try:
            identity = await resolve_session(database, token)
        except (SQLAlchemyError, OSError, TimeoutError) as exc:
            raise AppError("offline", "The account service is unavailable.") from exc
        if identity is not None:
            require_csrf(request, identity.context)
            try:
                async with database.sessions.begin() as session:
                    await session.execute(
                        update(auth_sessions)
                        .where(
                            auth_sessions.c.session_hash
                            == identity.context.session_hash,
                            auth_sessions.c.revoked_at.is_(None),
                        )
                        .values(revoked_at=datetime.now(UTC))
                    )
            except (SQLAlchemyError, OSError, TimeoutError) as exc:
                raise AppError(
                    "offline", "The account service is unavailable."
                ) from exc
    _clear_session_cookie(request, response)
    return ok_envelope({"authenticated": False})
