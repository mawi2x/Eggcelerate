"""Bounded sparse charts and snapshot-scoped raw export, separate from legacy reads."""

import csv
import io
import math
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import and_, case, false, func, literal, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..errors import AppError
from .readings import backfilled_sample, query_readings
from .schema import cycles, incubator_runtime, incubators
from .schema import telemetry_samples as samples

CHART_POINTS = 600
PREVIEW_ROWS = 200


async def scopes(
    session: AsyncSession,
    farm: UUID,
    ids: list[str],
    window: str,
    end: datetime,
    start: datetime | None = None,
) -> list[dict[str, Any]]:
    if window not in {"24h", "7d", "full"}:
        raise AppError("validation_error", "window must be 24h, 7d or full.")
    if not ids or len(ids) > 100 or len(set(ids)) != len(ids):
        raise AppError(
            "validation_error", "Select 1 to 100 distinct chamber identifiers."
        )
    if start is not None and (
        start.tzinfo is None or start.utcoffset() is None or start >= end
    ):
        raise AppError(
            "validation_error", "start must be before end and include a timezone."
        )
    rows = (
        (
            await session.execute(
                select(
                    incubators.c.public_id,
                    incubators.c.name,
                    incubators.c.device_id,
                    cycles.c.started_on,
                    incubator_runtime.c.day_of_incubation,
                )
                .select_from(incubators)
                .outerjoin(
                    incubator_runtime,
                    and_(
                        incubator_runtime.c.farm_id == farm,
                        incubator_runtime.c.incubator_id == incubators.c.public_id,
                    ),
                )
                .outerjoin(
                    cycles,
                    and_(
                        cycles.c.farm_id == farm,
                        cycles.c.id == incubator_runtime.c.cycle_id,
                    ),
                )
                .where(incubators.c.farm_id == farm, incubators.c.public_id.in_(ids))
            )
        )
        .mappings()
        .all()
    )
    if len(rows) != len(ids):
        raise AppError("not_found", "An incubator was not found in this farm.")
    result = []
    for row in rows:
        lower = start or end - timedelta(days=1 if window == "24h" else 7)
        if start is None and window == "full":
            if not row["started_on"] or not row["day_of_incubation"]:
                continue
            lower = datetime.fromisoformat(row["started_on"]).replace(tzinfo=UTC)
        if lower < end:
            result.append({**dict(row), "start": lower, "end": end})
    return result


async def chart(
    session: AsyncSession,
    farm: UUID,
    incubator_id: str,
    window: str,
    end: datetime,
    start: datetime | None = None,
    run_id: UUID | None = None,
) -> list[dict[str, Any]]:
    if run_id:
        from .run_history import selected_scope

        source = await selected_scope(session, farm, run_id, end=end, start=start)
        if source["public_id"] != incubator_id:
            raise AppError("not_found", "Run does not belong to this chamber.")
        scope = [source] if source["start"] < source["end"] else []
        end = source["end"]
    else:
        scope = await scopes(session, farm, [incubator_id], window, end, start)
    if not scope:
        return []
    source = scope[0]
    seconds = max(
        1, math.ceil((end - source["start"]).total_seconds() / (CHART_POINTS - 1))
    )
    rows = await query_readings(
        session,
        farm,
        source["device_id"],
        source["start"],
        end,
        research=True,
        bucket_seconds=seconds,
    )
    return [
        {
            "observed_at": r["bucket_start"],
            "temperature_c": r["temperature_c_avg"],
            "humidity_pct": r["humidity_pct_avg"],
            "temperature_min": r["temperature_c_min"],
            "temperature_max": r["temperature_c_max"],
            "humidity_min": r["humidity_pct_min"],
            "humidity_max": r["humidity_pct_max"],
            "sample_count": r["count"],
            "backfilled_count": r["backfilled_count"],
            "bucket_seconds": seconds,
            "water_not_ok_count": r["water_not_ok_count"],
        }
        for r in rows
    ]


def raw_statement(
    farm: UUID,
    scope: list[dict[str, Any]],
    end: datetime,
    receipt_cutoff: datetime | None = None,
    order: str = "oldest",
):
    # Receipt cutoff freezes membership across preview/export requests, including
    # late samples. Raw rows are immutable and receipt time is server-assigned.
    bounds = [
        and_(
            samples.c.device_id == s["device_id"],
            samples.c.observed_at >= s["start"],
            samples.c.observed_at < end,
        )
        for s in scope
    ]
    chamber_id = (
        case({s["device_id"]: s["public_id"] for s in scope}, value=samples.c.device_id)
        if scope
        else literal("")
    )
    chamber_name = (
        case({s["device_id"]: s["name"] for s in scope}, value=samples.c.device_id)
        if scope
        else literal("")
    )
    observed_at_order = (
        samples.c.observed_at.desc() if order == "newest" else samples.c.observed_at
    )
    chamber_order = chamber_id.desc() if order == "newest" else chamber_id
    return (
        select(
            chamber_id.label("incubator_id"),
            chamber_name.label("chamber"),
            samples.c.observed_at,
            samples.c.received_at,
            samples.c.temperature_c,
            samples.c.humidity_pct,
            samples.c.water_ok,
            backfilled_sample().label("backfilled"),
        )
        .where(
            samples.c.farm_id == farm,
            samples.c.received_at <= (receipt_cutoff or end),
            or_(*bounds) if bounds else false(),
        )
        .order_by(observed_at_order, chamber_order)
    )


async def preview(
    session: AsyncSession,
    farm: UUID,
    scope: list[dict[str, Any]],
    end: datetime,
    receipt_cutoff: datetime | None = None,
    *,
    offset: int = 0,
    limit: int = PREVIEW_ROWS,
    order: str = "newest",
) -> dict[str, Any]:
    statement = raw_statement(farm, scope, end, receipt_cutoff, order)
    total = await session.scalar(
        select(func.count()).select_from(statement.order_by(None).subquery())
    )
    rows = [
        dict(r)
        for r in (
            await session.execute(statement.offset(offset).limit(limit))
        ).mappings()
    ]
    return {"rows": rows, "total": total, "end": end}


def csv_chunk(rows: list[dict[str, Any]], *, header: bool = False) -> str:
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    if header:
        writer.writerow(
            [
                "Chamber ID",
                "Chamber",
                "Timestamp (UTC)",
                "Received (UTC)",
                "Temperature (C)",
                "Humidity (%)",
            ]
        )
    for r in rows:
        # Prevent spreadsheet formula execution in user-editable chamber names.
        name = str(r["chamber"])
        if name.lstrip().startswith(("=", "+", "-", "@")):
            name = "'" + name
        writer.writerow(
            [
                r["incubator_id"],
                name,
                r["observed_at"].astimezone(UTC).isoformat(),
                r["received_at"].astimezone(UTC).isoformat(),
                r["temperature_c"],
                r["humidity_pct"],
            ]
        )
    return output.getvalue()


async def stream_csv(
    database: Any,
    scope: list[dict[str, Any]],
    end: datetime,
    receipt_cutoff: datetime | None = None,
) -> AsyncIterator[str]:
    async with database.sessions() as session, session.begin():
        result = await session.stream(
            raw_statement(
                database.farm_id, scope, end, receipt_cutoff
            ).execution_options(yield_per=1000)
        )
        yield csv_chunk([], header=True)
        async for batch in result.mappings().partitions(1000):
            yield csv_chunk([dict(r) for r in batch])
