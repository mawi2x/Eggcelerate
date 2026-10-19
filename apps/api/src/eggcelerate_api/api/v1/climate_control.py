"""Local hardware climate test controls, protected by the normal session/CSRF."""

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import AwareDatetime, BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from ...context import RequestContext
from ...database import climate_control
from ...database.schema import farms
from ...errors import AppError, ok_envelope
from .dependencies import get_request_context

router = APIRouter(prefix="/incubators", tags=["climate-control"])


@router.get("/{incubator_id}/offline-storage")
async def read_offline_storage(
    incubator_id: str,
    request: Request,
    context: RequestContext = Depends(get_request_context),
):
    from ...mqtt.offline import status

    database = request.app.state.database
    if not context.authenticated or database is None:
        raise AppError("unauthorized", "Sign in to view local recording status.")
    try:
        async with database.sessions.begin() as session:
            result = await status(session, UUID(context.farm_id), incubator_id)
    except (SQLAlchemyError, OSError, TimeoutError) as exc:
        raise AppError("offline", "Local recording status is unavailable.") from exc
    return ok_envelope(result)


class ClimateAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["stop", "reset", "resume"]


async def perform(request, context, unit_id, action=None):
    settings = request.app.state.settings
    if not settings.climate_control_enabled:
        if action:
            raise AppError(
                "rejected", "Automatic climate control is disabled on this server."
            )
        return ok_envelope(
            {"enabled": False, "fresh": False, "report": None, "request": None}
        )
    database = request.app.state.database
    if not context.authenticated or database is None:
        raise AppError("unauthorized", "Sign in to the local hardware dashboard.")
    farm_id = UUID(context.farm_id)
    try:
        async with database.sessions.begin() as session:
            if action:
                await session.scalar(
                    select(farms.c.id).where(farms.c.id == farm_id).with_for_update()
                )
                if action == "resume":
                    from ...database.schema import incubator_runtime

                    phase = await session.scalar(
                        select(incubator_runtime.c.cycle_phase).where(
                            incubator_runtime.c.farm_id == farm_id,
                            incubator_runtime.c.incubator_id == unit_id,
                        )
                    )
                    action = "prepare" if phase == "ready" else "incubate"
                result = await climate_control.set_intent(
                    session, farm_id, unit_id, action
                )
            else:
                result = await climate_control.status(session, farm_id, unit_id)
    except (SQLAlchemyError, OSError, TimeoutError) as exc:
        raise AppError("offline", "Climate control service is unavailable.") from exc
    return ok_envelope(result)


@router.get("/{incubator_id}/climate-control")
async def read_test(
    incubator_id: str,
    request: Request,
    context: RequestContext = Depends(get_request_context),
):
    return await perform(request, context, incubator_id)


@router.post("/{incubator_id}/climate-control")
async def change_test(
    incubator_id: str,
    body: ClimateAction,
    request: Request,
    context: RequestContext = Depends(get_request_context),
):
    return await perform(request, context, incubator_id, body.action)


@router.get("/{incubator_id}/climate-control/history")
async def read_control_history(
    incubator_id: str,
    request: Request,
    limit: int = Query(default=200, ge=1, le=2000),
    before: AwareDatetime | None = None,
    context: RequestContext = Depends(get_request_context),
):
    database = request.app.state.database
    if not context.authenticated or database is None:
        raise AppError("unauthorized", "Sign in to the local hardware dashboard.")
    try:
        async with database.sessions.begin() as session:
            rows = await climate_control.history(
                session, UUID(context.farm_id), incubator_id, limit, before
            )
    except (SQLAlchemyError, OSError, TimeoutError) as exc:
        raise AppError("offline", "Control history is unavailable.") from exc
    return ok_envelope({"reports": rows, "order": "received_at_desc"})


@router.get("/{incubator_id}/benchmarks")
async def read_benchmarks(
    incubator_id: str,
    request: Request,
    context: RequestContext = Depends(get_request_context),
):
    from ...database.schema import benchmark_runs, incubators

    database = request.app.state.database
    if not context.authenticated or database is None:
        raise AppError("unauthorized", "Sign in to view benchmark history.")
    farm_id = UUID(context.farm_id)
    async with database.sessions.begin() as session:
        exists = await session.scalar(
            select(incubators.c.id).where(
                incubators.c.farm_id == farm_id, incubators.c.public_id == incubator_id
            )
        )
        if not exists:
            raise AppError("not_found", "Incubator was not found.")
        rows = (
            (
                await session.execute(
                    select(benchmark_runs)
                    .where(
                        benchmark_runs.c.farm_id == farm_id,
                        benchmark_runs.c.incubator_id == incubator_id,
                    )
                    .order_by(benchmark_runs.c.started_at.desc())
                    .limit(100)
                )
            )
            .mappings()
            .all()
        )
        return ok_envelope({"runs": [dict(row) for row in rows]})


@router.post("/{incubator_id}/benchmarks")
async def start_benchmark(
    incubator_id: str,
    context: RequestContext = Depends(get_request_context),
):
    if not context.authenticated:
        raise AppError("unauthorized", "Sign in to manage benchmark history.")
    raise AppError(
        "rejected",
        "Benchmark modes are retired. Saved records and readings remain available in Trends → Incubation History.",
    )


@router.post("/{incubator_id}/benchmarks/stop")
async def stop_benchmark(
    incubator_id: str,
    request: Request,
    context: RequestContext = Depends(get_request_context),
):
    from ...database import benchmarks

    database = request.app.state.database
    if not context.authenticated or database is None:
        raise AppError("unauthorized", "Sign in to stop a benchmark.")
    farm_id = UUID(context.farm_id)
    async with database.sessions.begin() as session:
        await session.scalar(
            select(farms.c.id).where(farms.c.id == farm_id).with_for_update()
        )
        result = await benchmarks.stop(session, farm_id, incubator_id)
    return ok_envelope(result)


@router.get("/{incubator_id}/benchmarks/{run_id}/readings")
async def benchmark_readings(
    incubator_id: str,
    run_id: UUID,
    request: Request,
    before: AwareDatetime | None = None,
    context: RequestContext = Depends(get_request_context),
):
    from ...database.schema import (
        benchmark_runs,
        climate_report_history,
        offline_records,
    )

    database = request.app.state.database
    if not context.authenticated or database is None:
        raise AppError("unauthorized", "Sign in to view benchmark readings.")
    async with database.sessions.begin() as session:
        run = (
            (
                await session.execute(
                    select(benchmark_runs).where(
                        benchmark_runs.c.id == run_id,
                        benchmark_runs.c.farm_id == UUID(context.farm_id),
                        benchmark_runs.c.incubator_id == incubator_id,
                    )
                )
            )
            .mappings()
            .first()
        )
        if not run:
            raise AppError("not_found", "Benchmark was not found.")
        query = select(climate_report_history).where(
            climate_report_history.c.farm_id == UUID(context.farm_id),
            climate_report_history.c.incubator_id == incubator_id,
            climate_report_history.c.device_id == run["device_id"],
            climate_report_history.c.report["benchmark"]["run_id"].astext
            == str(run_id),
        )
        if run["ended_at"]:
            query = query.where(climate_report_history.c.observed_at <= run["ended_at"])
        if before:
            query = query.where(climate_report_history.c.observed_at < before)
        rows = (
            (
                await session.execute(
                    query.order_by(climate_report_history.c.observed_at.desc()).limit(
                        2000
                    )
                )
            )
            .mappings()
            .all()
        )
        merged = {row["observed_at"]: dict(row, source="live") for row in rows}
        device_start = (run["settings"] or {}).get("device_started_at")
        if device_start:
            from datetime import UTC, datetime

            offline_query = select(offline_records).where(
                offline_records.c.farm_id == UUID(context.farm_id),
                offline_records.c.device_id == run["device_id"],
                offline_records.c.observed_at >= datetime.fromisoformat(device_start),
                offline_records.c.observed_at <= (run["ended_at"] or datetime.now(UTC)),
                offline_records.c.outcome.in_(
                    ("imported", "duplicate_sample", "sensor_invalid")
                ),
            )
            if before:
                offline_query = offline_query.where(
                    offline_records.c.observed_at < before
                )
            saved = (
                await session.execute(
                    offline_query.order_by(offline_records.c.observed_at.desc()).limit(
                        2000
                    )
                )
            ).mappings()
            for row in saved:
                value = row["record"]
                valid = (
                    value.get("v") is True
                    and value.get("a", 999999) <= 5000
                    and value.get("c") is not None
                    and value.get("h") is not None
                )
                merged.setdefault(
                    row["observed_at"],
                    dict(
                        observed_at=row["observed_at"],
                        received_at=row["received_at"],
                        temperature_c=value["c"] / 100 if valid else None,
                        humidity_pct=value["h"] / 100 if valid else None,
                        report={"sensor_valid": valid},
                        source="local_recording",
                    ),
                )
        rows = sorted(
            merged.values(), key=lambda row: row["observed_at"], reverse=True
        )[:2000]
    return ok_envelope(
        {
            "readings": [dict(row) for row in rows],
            "next_before": rows[-1]["observed_at"].isoformat()
            if len(rows) == 2000
            else None,
        }
    )
