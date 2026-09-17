"""Internal telemetry boundary; caller owns the transaction and trusted farm scope.

Identity is device + observed instant. Re-delivery preserves first receipt time;
changing values at the same instant conflicts. No MQTT or HTTP ingestion yet.
"""

from datetime import UTC, datetime, timedelta
from typing import Annotated, Any
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..errors import AppError
from .schema import telemetry_samples as samples


class TelemetrySample(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    observed_at: AwareDatetime
    temperature_c: float
    humidity_pct: Annotated[float, Field(ge=0, le=100)]
    water_ok: bool


async def ingest_sample(
    session: AsyncSession, farm_id: UUID, device_id: UUID, sample: TelemetrySample
) -> bool:
    """Return True for insertion, False for an exact retry; never overwrite."""
    values = sample.model_dump()
    result = await session.execute(
        insert(samples)
        .values(
            farm_id=farm_id,
            device_id=device_id,
            received_at=datetime.now(UTC),
            **values,
        )
        .on_conflict_do_nothing()
        .returning(samples.c.observed_at)
    )
    if result.scalar_one_or_none() is not None:
        return True
    row = (
        (
            await session.execute(
                select(samples).where(
                    samples.c.farm_id == farm_id,
                    samples.c.device_id == device_id,
                    samples.c.observed_at == sample.observed_at,
                )
            )
        )
        .mappings()
        .one()
    )
    if any(row[key] != value for key, value in values.items()):
        raise AppError(
            "conflict", "A different sample already exists at this observed instant."
        )
    return False


async def query_readings(
    session: AsyncSession,
    farm_id: UUID,
    device_id: UUID,
    start: datetime,
    end: datetime,
    *,
    research: bool = False,
) -> list[dict[str, Any]]:
    """UTC [start, end); research aggregates only samples inside that interval.

    Five-minute buckets are sparse and may be partial at range boundaries.
    Late arrivals appear immediately; there is no refresh job or interpolation.
    """
    if (
        any(value.tzinfo is None or value.utcoffset() is None for value in (start, end))
        or start >= end
    ):
        raise AppError(
            "validation_error",
            "Reading bounds must be aware timestamps with start before end.",
        )
    if research:
        bucket = func.time_bucket(timedelta(minutes=5), samples.c.observed_at).label(
            "bucket_start"
        )
        columns = [bucket, func.count().label("count")]
        for name in ("temperature_c", "humidity_pct"):
            column = samples.c[name]
            columns.extend(
                getattr(func, op)(column).label(f"{name}_{op}")
                for op in ("avg", "min", "max")
            )
        columns.append(
            func.count()
            .filter(samples.c.water_ok.is_(False))
            .label("water_not_ok_count")
        )
        query = select(*columns).group_by(bucket).order_by(bucket)
    else:
        query = select(
            samples.c.observed_at,
            samples.c.received_at,
            samples.c.temperature_c,
            samples.c.humidity_pct,
            samples.c.water_ok,
        ).order_by(samples.c.observed_at)
    query = query.where(
        samples.c.farm_id == farm_id,
        samples.c.device_id == device_id,
        samples.c.observed_at >= start,
        samples.c.observed_at < end,
    )
    return [dict(row) for row in (await session.execute(query)).mappings()]


async def chamber_readings(
    session: AsyncSession,
    farm_id: UUID,
    incubator_id: str,
    window: str,
    now: datetime,
) -> list[dict[str, Any]]:
    """Resolve persisted chamber scope without hydrating the in-memory dashboard."""
    from .schema import cycles, incubator_runtime, incubators

    if window not in ("24h", "7d", "full"):
        raise AppError("validation_error", "window must be 24h, 7d or full.")
    unit = (
        (
            await session.execute(
                select(incubators.c.device_id).where(
                    incubators.c.farm_id == farm_id,
                    incubators.c.public_id == incubator_id,
                )
            )
        )
        .mappings()
        .one_or_none()
    )
    if unit is None:
        raise AppError("not_found", "Incubator not found.")
    if window == "full":
        started = await session.scalar(
            select(cycles.c.started_on)
            .join(
                incubator_runtime,
                (incubator_runtime.c.farm_id == cycles.c.farm_id)
                & (incubator_runtime.c.cycle_id == cycles.c.id),
            )
            .where(
                incubator_runtime.c.farm_id == farm_id,
                incubator_runtime.c.incubator_id == incubator_id,
                incubator_runtime.c.day_of_incubation > 0,
            )
        )
        if started is None:
            return []
        # Existing cycle identity records a date, not an exact start instant.
        start = datetime.fromisoformat(started).replace(tzinfo=UTC)
    else:
        start = now - timedelta(days=1 if window == "24h" else 7)
    if start >= now:
        return []
    return await query_readings(session, farm_id, unit["device_id"], start, now)
