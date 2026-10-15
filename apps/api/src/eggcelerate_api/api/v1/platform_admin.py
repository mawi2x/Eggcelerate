"""Platform account administration; farm ownership alone grants no access."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.concurrency import run_in_threadpool
from pydantic import Field
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from ...auth_security import hash_password
from ...database.accounts import create_farm_owner
from ...database.schema import auth_sessions, farm_memberships, farms, users
from ...errors import AppError, conflict, ok_envelope
from ...session_auth import require_allowed_origin, require_csrf
from .auth import RegisterRequest, _database
from .dependencies import get_request_context


async def require_platform_admin(request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    database = _database(request)
    context = await get_request_context(request)
    if not context.authenticated:
        raise AppError("unauthorized", "Sign in as an administrator.")
    try:
        async with database.sessions() as session:
            allowed = await session.scalar(
                select(users.c.is_platform_admin).where(
                    users.c.id == UUID(context.actor_id),
                    users.c.disabled_at.is_(None),
                )
            )
    except (SQLAlchemyError, OSError, TimeoutError) as exc:
        raise AppError("offline", "The account service is unavailable.") from exc
    if allowed is not True:
        raise AppError("rejected", "Administrator access is required.")
    require_allowed_origin(request)
    require_csrf(request, context)
    return context


router = APIRouter(
    prefix="/admin",
    tags=["administration"],
    dependencies=[Depends(require_platform_admin)],
)


@router.get("/session")
async def admin_session() -> dict:
    return ok_envelope({"administrator": True})


@router.get("/users")
async def list_users(
    request: Request,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> dict:
    database = _database(request)
    try:
        async with database.sessions() as session:
            total = await session.scalar(select(func.count()).select_from(users))
            rows = (
                (
                    await session.execute(
                        select(
                            users.c.id,
                            users.c.email,
                            users.c.display_name,
                            users.c.is_platform_admin,
                            users.c.created_at,
                            users.c.disabled_at,
                            farms.c.name.label("farm_name"),
                        )
                        .select_from(users.join(farm_memberships).join(farms))
                        .order_by(users.c.created_at.desc(), users.c.id)
                        .offset(offset)
                        .limit(limit)
                    )
                )
                .mappings()
                .all()
            )
    except (SQLAlchemyError, OSError, TimeoutError) as exc:
        raise AppError("offline", "The account service is unavailable.") from exc
    return ok_envelope(
        {
            "users": [
                {
                    "id": str(row["id"]),
                    "email": row["email"],
                    "display_name": row["display_name"],
                    "farm_name": row["farm_name"],
                    "administrator": row["is_platform_admin"],
                    "created_at": row["created_at"].isoformat(),
                    "disabled": row["disabled_at"] is not None,
                }
                for row in rows
            ],
            "total": total,
            "offset": offset,
            "limit": limit,
        }
    )


@router.post("/users", status_code=201)
async def create_user(body: RegisterRequest, request: Request) -> dict:
    database = _database(request)
    user_id, farm_id = uuid4(), uuid4()
    password_hash = await run_in_threadpool(hash_password, body.password)
    try:
        async with database.sessions.begin() as session:
            await create_farm_owner(
                session,
                user_id=user_id,
                farm_id=farm_id,
                email=body.email,
                password_hash=password_hash,
                display_name=body.display_name,
                farm_name=body.farm_name,
            )
    except IntegrityError as exc:
        raise conflict("An account with this email already exists.") from exc
    except (SQLAlchemyError, OSError, TimeoutError) as exc:
        raise AppError("offline", "The account service is unavailable.") from exc
    return ok_envelope(
        {"id": str(user_id), "farm_id": str(farm_id), "email": body.email}
    )


class UpdateUserRequest(RegisterRequest):
    password: Annotated[str | None, Field(min_length=12, max_length=128)] = None


@router.patch("/users/{user_id}")
async def update_user(user_id: UUID, body: UpdateUserRequest, request: Request) -> dict:
    database = _database(request)
    password_hash = (
        await run_in_threadpool(hash_password, body.password)
        if body.password is not None
        else None
    )
    try:
        async with database.sessions.begin() as session:
            target = (
                (
                    await session.execute(
                        select(users).where(users.c.id == user_id).with_for_update()
                    )
                )
                .mappings()
                .first()
            )
            if target is None:
                raise AppError("not_found", "This user no longer exists.")
            if target["is_platform_admin"]:
                raise AppError(
                    "rejected", "Administrator accounts cannot be edited here."
                )
            farm_ids = (
                await session.scalars(
                    select(farm_memberships.c.farm_id).where(
                        farm_memberships.c.user_id == user_id
                    )
                )
            ).all()
            if len(farm_ids) != 1:
                raise conflict("This account does not have exactly one assigned farm.")
            values = {"email": body.email, "display_name": body.display_name}
            if password_hash is not None:
                values["password_hash"] = password_hash
            await session.execute(
                update(users).where(users.c.id == user_id).values(**values)
            )
            await session.execute(
                update(farms)
                .where(farms.c.id == farm_ids[0])
                .values(name=body.farm_name)
            )
            await session.execute(
                update(auth_sessions)
                .where(
                    auth_sessions.c.user_id == user_id,
                    auth_sessions.c.revoked_at.is_(None),
                )
                .values(revoked_at=datetime.now(UTC))
            )
    except IntegrityError as exc:
        raise conflict("An account with this email already exists.") from exc
    except (SQLAlchemyError, OSError, TimeoutError) as exc:
        raise AppError("offline", "The account service is unavailable.") from exc
    return ok_envelope({"id": str(user_id), "email": body.email})


@router.delete("/users/{user_id}")
async def delete_user(user_id: UUID, request: Request) -> dict:
    database = _database(request)
    try:
        async with database.sessions.begin() as session:
            target = (
                (
                    await session.execute(
                        select(users).where(users.c.id == user_id).with_for_update()
                    )
                )
                .mappings()
                .first()
            )
            if target is None:
                raise AppError("not_found", "This user no longer exists.")
            if target["is_platform_admin"]:
                raise AppError(
                    "rejected", "Administrator accounts cannot be deleted here."
                )
            # Memberships and sessions cascade; the farm and its history remain.
            await session.execute(delete(users).where(users.c.id == user_id))
    except (SQLAlchemyError, OSError, TimeoutError) as exc:
        raise AppError("offline", "The account service is unavailable.") from exc
    return ok_envelope({"id": str(user_id)})
