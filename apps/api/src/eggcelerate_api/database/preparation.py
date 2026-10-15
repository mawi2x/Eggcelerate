"""One minute of real stable samples after acknowledged automatic preparation."""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid5

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..store import MemoryStore
from .schema import (
    alerts,
    climate_tests,
    devices,
    incubator_runtime,
    incubators,
    modes,
    telemetry_samples,
)

STABILITY_SECONDS = 60
MAX_SAMPLE_GAP_SECONDS = 45


async def readiness(session, farm_id, unit_id, started, bounds, now):
    if not started:
        return None, False
    control = (
        (
            await session.execute(
                select(climate_tests).where(
                    climate_tests.c.farm_id == farm_id,
                    climate_tests.c.incubator_id == unit_id,
                )
            )
        )
        .mappings()
        .first()
    )
    # Existing manual-only deployments remain readable until control is enabled.
    if control and control["intent"]:
        report, intent, req = (
            control["report"] or {},
            control["intent"],
            control["request"] or {},
        )
        if not (
            not intent.get("suspended")
            and intent.get("phase") == 1
            and report.get("phase") == 1
            and report.get("running")
            and not report.get("fault")
            and report.get("sensor_valid")
            and report.get("mode") == intent.get("mode")
            and req.get("status") == "acked"
            and req.get("action") == "prepare"
            and req.get("boot_id") == control["boot_id"]
            and control["reported_at"]
            and (now - control["reported_at"]).total_seconds() <= 45
            and req.get("accepted_at")
        ):
            return None, False
        started = max(started, datetime.fromisoformat(req["accepted_at"]))
    start = max(
        started, now - timedelta(seconds=STABILITY_SECONDS + MAX_SAMPLE_GAP_SECONDS * 2)
    )
    rows = (
        (
            await session.execute(
                select(telemetry_samples)
                .join(devices, devices.c.id == telemetry_samples.c.device_id)
                .join(incubators, incubators.c.device_id == devices.c.id)
                .where(
                    telemetry_samples.c.farm_id == farm_id,
                    incubators.c.farm_id == farm_id,
                    incubators.c.public_id == unit_id,
                    telemetry_samples.c.received_at >= start,
                    telemetry_samples.c.received_at <= now,
                    telemetry_samples.c.observed_at
                    >= start - timedelta(seconds=MAX_SAMPLE_GAP_SECONDS),
                )
                .order_by(telemetry_samples.c.received_at.desc())
            )
        )
        .mappings()
        .all()
    )
    previous = now
    stable_since = None
    latest = rows[0]["received_at"] if rows else None
    for row in rows:
        received, observed = row["received_at"], row["observed_at"]
        if (
            (previous - received).total_seconds() > MAX_SAMPLE_GAP_SECONDS
            or abs((received - observed).total_seconds()) > MAX_SAMPLE_GAP_SECONDS
            or observed < started
            or not bounds[0] <= row["temperature_c"] <= bounds[1]
            or not bounds[2] <= row["humidity_pct"] <= bounds[3]
        ):
            break
        stable_since, previous = received, received
    ready = bool(
        stable_since
        and latest
        and (now - latest).total_seconds() <= MAX_SAMPLE_GAP_SECONDS
        and (latest - stable_since).total_seconds() >= STABILITY_SECONDS
    )
    return stable_since, ready


async def load_preparation(
    session: AsyncSession, farm_id: UUID, state: MemoryStore
) -> None:
    now = datetime.now(UTC)
    for unit in list(state.incubators.values()):
        stable_since, ready = None, False
        if unit.preparation_started_at and unit.cycle_phase == "ready":
            mode = state.modes[unit.mode_id]
            stable_since, ready = await readiness(
                session,
                farm_id,
                unit.id,
                unit.preparation_started_at,
                (
                    mode.target_temp_c.min,
                    mode.target_temp_c.max,
                    mode.target_humidity_pct.min,
                    mode.target_humidity_pct.max,
                ),
                now,
            )
        state.incubators[unit.id] = unit.model_copy(
            update={
                "preparation_stable_since": stable_since,
                "preparation_ready": ready,
            }
        )


async def notify_ready(session, farm_id, now):
    """Caller owns farm lock. One durable notification per preparation generation."""
    rows = (
        (
            await session.execute(
                select(
                    incubators.c.public_id,
                    incubators.c.name,
                    incubators.c.device_id,
                    incubator_runtime.c.preparation_started_at,
                    modes.c.temp_min,
                    modes.c.temp_max,
                    modes.c.humidity_min,
                    modes.c.humidity_max,
                    modes.c.name.label("mode_name"),
                    climate_tests.c.intent,
                )
                .select_from(incubators)
                .join(
                    incubator_runtime,
                    (incubator_runtime.c.farm_id == incubators.c.farm_id)
                    & (incubator_runtime.c.incubator_id == incubators.c.public_id),
                )
                .join(
                    modes,
                    (modes.c.farm_id == incubators.c.farm_id)
                    & (modes.c.id == incubators.c.mode_id),
                )
                .join(
                    climate_tests,
                    (climate_tests.c.farm_id == incubators.c.farm_id)
                    & (climate_tests.c.incubator_id == incubators.c.public_id),
                )
                .where(
                    incubators.c.farm_id == farm_id,
                    incubator_runtime.c.cycle_phase == "ready",
                    incubator_runtime.c.preparation_started_at.is_not(None),
                )
            )
        )
        .mappings()
        .all()
    )
    for row in rows:
        intent = row["intent"] or {}
        if intent.get("phase") != 1:
            continue
        _, ready = await readiness(
            session,
            farm_id,
            row["public_id"],
            row["preparation_started_at"],
            (
                row["temp_min"],
                row["temp_max"],
                row["humidity_min"],
                row["humidity_max"],
            ),
            now,
        )
        if not ready:
            continue
        public_id = "prepared-" + str(
            uuid5(farm_id, f"{row['public_id']}:{intent['generation']}")
        )
        position = (
            await session.scalar(
                select(func.max(alerts.c.position)).where(alerts.c.farm_id == farm_id)
            )
            or 0
        ) + 1
        await session.execute(
            insert(alerts)
            .values(
                farm_id=farm_id,
                public_id=public_id,
                position=position,
                incubator_id=row["public_id"],
                device_id=row["device_id"],
                unit_name=row["name"],
                severity="info",
                code="preparation-ready",
                title="Ready to load eggs",
                message=f"{row['name']} has maintained the {row['mode_name']} temperature and humidity targets for one minute. Load 1–38 eggs, confirm the count and start incubation. Readiness is checked again before starting.",
                occurred_at=now,
                dismissed=False,
            )
            .on_conflict_do_nothing(
                index_elements=[alerts.c.farm_id, alerts.c.public_id]
            )
        )
