"""Durable condition candidates and episodes; all writers take the farm lock first."""

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid5

from sqlalchemy import and_, func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .schema import (
    alert_monitors,
    alerts,
    device_telemetry_state,
    devices,
    farm_preferences,
    farms,
    incubator_runtime,
    incubators,
    modes,
)

log = logging.getLogger(__name__)
CONDITIONS = {
    "temp": (60, "critical", "temperature-out-of-range", "Temperature out of range"),
    "humidity": (60, "warning", "humidity-out-of-range", "Humidity out of range"),
    "water": (30, "warning", "water-low", "Water supply low"),
    "offline": (0, "critical", "device-offline", "Device offline"),
}
ACTIVE_PHASES = {"incubating", "lockdown", "hatching", "awaiting_finish"}


def outside(
    value: float, lower: float, upper: float, hysteresis: float, active: bool
) -> bool:
    margin = min(max(0, hysteresis), (upper - lower) / 4) if active else 0
    return value < lower + margin or value > upper - margin


async def evaluate_farm(
    session: AsyncSession,
    farm_id: UUID,
    *,
    now: datetime | None = None,
    farm_locked: bool = False,
    skip_locked: bool = False,
) -> None:
    now = now or datetime.now(UTC)
    if not farm_locked:
        if (
            await session.scalar(
                select(farms.c.id)
                .where(farms.c.id == farm_id)
                .with_for_update(skip_locked=skip_locked)
            )
            is None
        ):
            return
    preferences = await session.scalar(
        select(farm_preferences.c.notification_enabled).where(
            farm_preferences.c.farm_id == farm_id
        )
    )
    preferences = preferences or {}
    rows = (
        (
            await session.execute(
                select(
                    incubators.c.public_id,
                    incubators.c.name,
                    incubators.c.created_at.label("assigned_at"),
                    devices.c.id.label("device_id"),
                    devices.c.paired,
                    devices.c.created_at.label("device_created_at"),
                    modes.c.id.label("mode_id"),
                    modes.c.temp_min,
                    modes.c.temp_max,
                    modes.c.humidity_min,
                    modes.c.humidity_max,
                    modes.c.temp_hysteresis_c,
                    modes.c.humidity_hysteresis_pct,
                    incubator_runtime.c.cycle_phase,
                    device_telemetry_state.c.last_seen_at,
                    device_telemetry_state.c.temperature_c,
                    device_telemetry_state.c.humidity_pct,
                    device_telemetry_state.c.water_ok,
                )
                .select_from(incubators)
                .join(
                    devices,
                    and_(
                        devices.c.id == incubators.c.device_id,
                        devices.c.farm_id == farm_id,
                    ),
                )
                .join(
                    modes,
                    and_(
                        modes.c.id == incubators.c.mode_id, modes.c.farm_id == farm_id
                    ),
                )
                .outerjoin(
                    incubator_runtime,
                    and_(
                        incubator_runtime.c.farm_id == farm_id,
                        incubator_runtime.c.incubator_id == incubators.c.public_id,
                    ),
                )
                .outerjoin(
                    device_telemetry_state,
                    and_(
                        device_telemetry_state.c.farm_id == farm_id,
                        device_telemetry_state.c.device_id == devices.c.id,
                        device_telemetry_state.c.incubator_id == incubators.c.public_id,
                    ),
                )
                .where(incubators.c.farm_id == farm_id)
            )
        )
        .mappings()
        .all()
    )
    current = {
        (r["device_id"], r["condition"]): dict(r)
        for r in (
            await session.execute(
                select(alert_monitors).where(alert_monitors.c.farm_id == farm_id)
            )
        ).mappings()
    }
    seen = set()
    position = (
        int(
            (
                await session.scalar(
                    select(func.coalesce(func.max(alerts.c.position), -1)).where(
                        alerts.c.farm_id == farm_id
                    )
                )
            )
            or 0
        )
        + 1
    )
    for row in rows:
        for condition, (delay, severity, code, title) in CONDITIONS.items():
            key = (row["device_id"], condition)
            seen.add(key)
            previous = current.get(key)
            monitor: dict[str, Any] = (
                previous.copy()
                if previous
                else {
                    "farm_id": farm_id,
                    "device_id": row["device_id"],
                    "condition": condition,
                    "incubator_id": row["public_id"],
                    "candidate_since": None,
                    "active_alert_id": None,
                    "generation": 0,
                    "source_signature": "",
                }
            )
            signature = (
                str(
                    (
                        row["public_id"],
                        row["mode_id"],
                        row["temp_min"],
                        row["temp_max"],
                        row["humidity_min"],
                        row["humidity_max"],
                        row["temp_hysteresis_c"],
                        row["humidity_hysteresis_pct"],
                    )
                )
                if condition in {"temp", "humidity"}
                else row["public_id"]
            )
            if monitor["source_signature"] != signature:
                await resolve(session, monitor, now, "configuration_changed")
                monitor["candidate_since"] = None
                monitor["source_signature"] = signature
                monitor["incubator_id"] = row["public_id"]
            paired = row["paired"]
            running = row["cycle_phase"] in ACTIVE_PHASES
            last_seen = row["last_seen_at"]
            age = (now - last_seen).total_seconds() if last_seen else None
            fresh = age is not None and age <= 45
            truth: bool | None
            if not paired or (condition != "offline" and not running):
                truth = False
                reason = "monitoring_ended"
            elif condition == "offline":
                anchor = last_seen or max(row["assigned_at"], row["device_created_at"])
                truth = now - anchor > timedelta(seconds=180)
                reason = "recovered"
            elif not fresh:
                truth = None  # Unknown is never evidence of recovery.
                reason = "recovered"
            elif condition == "water":
                truth = not row["water_ok"]
                reason = "recovered"
            else:
                temperature = condition == "temp"
                truth = outside(
                    row["temperature_c"] if temperature else row["humidity_pct"],
                    row["temp_min"] if temperature else row["humidity_min"],
                    row["temp_max"] if temperature else row["humidity_max"],
                    row["temp_hysteresis_c"]
                    if temperature
                    else row["humidity_hysteresis_pct"],
                    monitor["active_alert_id"] is not None,
                )
                reason = "recovered"
            if truth is False:
                await resolve(session, monitor, now, reason)
                monitor["candidate_since"] = None
            elif truth is None:
                monitor["candidate_since"] = None
            elif not monitor["active_alert_id"]:
                if not preferences.get(condition, True):
                    monitor["candidate_since"] = None
                else:
                    monitor["candidate_since"] = monitor["candidate_since"] or now
                    if now - monitor["candidate_since"] >= timedelta(seconds=delay):
                        monitor["generation"] += 1
                        public_id = "episode-" + str(
                            uuid5(
                                farm_id,
                                f"{row['device_id']}:{condition}:{monitor['generation']}",
                            )
                        )
                        message = f"{row['name']}: {title.lower()}."
                        if condition == "temp":
                            message += f" {row['temperature_c']:g}°C; mode target {row['temp_min']:g}–{row['temp_max']:g}°C."
                        elif condition == "humidity":
                            message += f" {row['humidity_pct']:g}%; mode target {row['humidity_min']:g}–{row['humidity_max']:g}%."
                        elif condition == "offline":
                            message += " No advancing telemetry received for more than 180 seconds."
                        else:
                            message += " The device reports insufficient water; check the supply."
                        await session.execute(
                            insert(alerts).values(
                                farm_id=farm_id,
                                public_id=public_id,
                                position=position,
                                incubator_id=row["public_id"],
                                device_id=row["device_id"],
                                unit_name=row["name"],
                                severity=severity,
                                code=code,
                                title=title,
                                message=message,
                                occurred_at=now,
                                condition_state="active",
                                dismissed=False,
                            )
                        )
                        position += 1
                        monitor["active_alert_id"] = public_id
            if previous and monitor != previous:
                await session.execute(
                    update(alert_monitors)
                    .where(
                        alert_monitors.c.farm_id == farm_id,
                        alert_monitors.c.device_id == row["device_id"],
                        alert_monitors.c.condition == condition,
                    )
                    .values(
                        **{
                            k: v
                            for k, v in monitor.items()
                            if k not in {"farm_id", "device_id", "condition"}
                        }
                    )
                )
            elif previous is None:
                await session.execute(insert(alert_monitors).values(**monitor))
    for key, monitor in current.items():
        if key not in seen and (
            monitor["active_alert_id"] or monitor["candidate_since"]
        ):
            await resolve(session, monitor, now, "monitoring_ended")
            await session.execute(
                update(alert_monitors)
                .where(
                    alert_monitors.c.farm_id == farm_id,
                    alert_monitors.c.device_id == key[0],
                    alert_monitors.c.condition == key[1],
                )
                .values(active_alert_id=None, candidate_since=None)
            )


async def resolve(
    session: AsyncSession, monitor: dict[str, Any], now: datetime, reason: str
) -> None:
    if monitor["active_alert_id"]:
        await session.execute(
            update(alerts)
            .where(
                alerts.c.farm_id == monitor["farm_id"],
                alerts.c.public_id == monitor["active_alert_id"],
            )
            .values(
                condition_state="resolved", resolved_at=now, resolution_reason=reason
            )
        )
        monitor["active_alert_id"] = None


async def evaluate_all(database: Any) -> None:
    async with database.sessions() as session:
        farm_ids = (await session.scalars(select(farms.c.id))).all()
    for farm_id in farm_ids:
        try:
            async with database.sessions() as session, session.begin():
                await evaluate_farm(session, farm_id, skip_locked=True)
        except Exception:
            log.exception(
                "Alert evaluation failed for farm %s; continuing other farms", farm_id
            )


async def run_evaluator(database: Any, interval: float) -> None:
    while True:
        await asyncio.sleep(interval)
        try:
            await evaluate_all(database)
        except Exception:
            log.exception("Periodic alert evaluation failed; retrying next interval")
