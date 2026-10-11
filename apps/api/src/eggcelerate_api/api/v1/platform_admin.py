"""Platform account administration; farm ownership alone grants no access."""

from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from ...auth_security import hash_password
from ...database.accounts import create_farm_owner
from ...database.schema import farm_memberships, farms, users
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
