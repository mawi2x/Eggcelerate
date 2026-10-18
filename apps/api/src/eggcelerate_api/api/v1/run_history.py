"""Farm-scoped automatic preparation and incubation history."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from ...context import RequestContext
from ...database.schema import incubation_runs
from ...errors import AppError, ok_envelope
from .dependencies import get_request_context

router = APIRouter(prefix="/runs", tags=["run history"])


@router.get("")
async def list_runs(
    request: Request,
    context: RequestContext = Depends(get_request_context),
    before: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    incubator_id: str | None = None,
    mode_id: str | None = None,
    status: str | None = None,
    run_id: UUID | None = None,
):
    database = request.app.state.database
    if database is None:
        return ok_envelope({"runs": [], "has_more": False})
    # Keyset paging preserves history beyond the first page without unbounded
    # responses. The opaque cursor carries a timestamp and stable UUID tie-break.
    from datetime import datetime

    from sqlalchemy import and_, or_

    query = select(incubation_runs).where(
        incubation_runs.c.farm_id == UUID(context.farm_id)
    )
    if run_id:
        query = query.where(incubation_runs.c.id == run_id)
    if incubator_id:
        query = query.where(incubation_runs.c.incubator_id == incubator_id)
    if mode_id:
        query = query.where(incubation_runs.c.mode["id"].astext == mode_id)
    if status:
        if status not in {
            "preparing",
            "incubating",
            "completed",
            "stopped",
            "cancelled",
        }:
            raise AppError("validation_error", "Invalid run status.")
        query = query.where(incubation_runs.c.status == status)
    if before:
        try:
            stamp, ident = before.split("|", 1)
            at = datetime.fromisoformat(stamp)
            if at.tzinfo is None:
                raise ValueError("timezone")
            key = UUID(ident)
        except (ValueError, TypeError) as exc:
            raise AppError("validation_error", "Invalid run history page.") from exc
        query = query.where(
            or_(
                incubation_runs.c.started_at < at,
                and_(incubation_runs.c.started_at == at, incubation_runs.c.id < key),
            )
        )
    query = query.order_by(
        incubation_runs.c.started_at.desc(), incubation_runs.c.id.desc()
    ).limit(limit + 1)
    try:
        async with database.sessions() as session:
            rows = (await session.execute(query)).mappings().all()
    except (SQLAlchemyError, OSError, TimeoutError) as exc:
        raise AppError("offline", "Run history is unavailable.") from exc
    selected = rows[:limit]
    cursor = (
        f"{selected[-1]['started_at'].isoformat()}|{selected[-1]['id']}"
        if len(rows) > limit
        else None
    )
    return ok_envelope(
        {
            "runs": [dict(r) for r in selected],
            "has_more": len(rows) > limit,
            "next_cursor": cursor,
        }
    )
