"""Relational chamber configuration; cycle runtime is hydrated separately."""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid5

from sqlalchemy import insert, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .. import domain, services
from ..models import CreateIncubatorRequest, IncubatorDTO, ModeDTO
from ..store import MemoryStore
from .readings import telemetry_freshness
from .schema import device_telemetry_state, devices, incubators, modes


def device_values(farm_id: UUID, unit: IncubatorDTO) -> dict[str, Any]:
    return {
        "id": uuid5(farm_id, f"device:{unit.device_id.upper()}"),
        "farm_id": farm_id,
        "public_id": unit.device_id,
        "paired": unit.paired,
    }


def incubator_values(
    farm_id: UUID, unit: IncubatorDTO, position: int
) -> dict[str, Any]:
    return {
        "id": uuid5(farm_id, f"incubator:{unit.id}"),
        "farm_id": farm_id,
        "public_id": unit.id,
        "position": position,
        "name": unit.name,
        "mode_id": uuid5(farm_id, f"mode:{unit.mode_id}"),
        "device_id": device_values(farm_id, unit)["id"],
        "turn_interval_min": unit.turn_interval_min,
        "auto_turn": unit.auto_turn,
    }


async def seed_incubators(
    session: AsyncSession, farm_id: UUID, seed: MemoryStore
) -> None:
    for position, unit in enumerate(seed.incubators.values()):
        await session.execute(
            pg_insert(devices)
            .values(**device_values(farm_id, unit))
            .on_conflict_do_nothing(constraint="uq_devices_farm_identity")
        )
        await session.execute(
            pg_insert(incubators)
            .values(**incubator_values(farm_id, unit, position))
            .on_conflict_do_nothing(constraint="uq_incubators_farm_public_id")
        )


async def load_incubators(
    session: AsyncSession,
    farm_id: UUID,
    state: MemoryStore,
    previous_modes: dict[str, ModeDTO],
    incubator_id: str | None = None,
) -> list[dict[str, Any]]:
    query = (
        select(
            incubators.c.public_id,
            incubators.c.position,
            incubators.c.name,
            incubators.c.turn_interval_min,
            incubators.c.auto_turn,
            devices.c.public_id.label("device_public_id"),
            devices.c.paired,
            modes.c.public_id.label("mode_public_id"),
            device_telemetry_state.c.temperature_c.label("telemetry_temperature_c"),
            device_telemetry_state.c.humidity_pct.label("telemetry_humidity_pct"),
            device_telemetry_state.c.water_ok.label("telemetry_water_ok"),
            device_telemetry_state.c.battery_pct.label("telemetry_battery_pct"),
            device_telemetry_state.c.power_source.label("telemetry_power_source"),
            device_telemetry_state.c.observed_at.label("telemetry_observed_at"),
            device_telemetry_state.c.received_at.label("telemetry_received_at"),
            device_telemetry_state.c.last_seen_at.label("telemetry_last_seen_at"),
        )
        .select_from(
            incubators.join(devices, incubators.c.device_id == devices.c.id)
            .join(modes, incubators.c.mode_id == modes.c.id)
            .outerjoin(
                device_telemetry_state,
                (device_telemetry_state.c.farm_id == incubators.c.farm_id)
                & (device_telemetry_state.c.device_id == devices.c.id),
            )
        )
        .where(
            incubators.c.farm_id == farm_id,
            devices.c.farm_id == farm_id,
            modes.c.farm_id == farm_id,
        )
        .order_by(incubators.c.position, incubators.c.public_id)
    )
    if incubator_id is not None:
        query = query.where(incubators.c.public_id == incubator_id)
    rows = [dict(row) for row in (await session.execute(query)).mappings()]
    hydrated = {}
    now = datetime.now(UTC)
    for row in rows:
        public_id = row["public_id"]
        mode = state.modes[row["mode_public_id"]]
        existing = state.incubators.get(public_id)
        base = existing or services.new_incubator(
            public_id,
            CreateIncubatorRequest(
                name=row["name"],
                device_id=row["device_public_id"],
                mode_id=mode.id,
            ),
            mode,
            datetime.now(UTC),
        )
        unit = base.model_copy(
            update={
                "name": row["name"],
                "device_id": row["device_public_id"],
                "mode_id": mode.id,
                "turn_interval_min": row["turn_interval_min"],
                "auto_turn": row["auto_turn"],
                "paired": row["paired"],
                "temperature_c": row["telemetry_temperature_c"]
                if row["telemetry_temperature_c"] is not None
                else base.temperature_c,
                "humidity_pct": row["telemetry_humidity_pct"]
                if row["telemetry_humidity_pct"] is not None
                else base.humidity_pct,
                "water_ok": row["telemetry_water_ok"]
                if row["telemetry_water_ok"] is not None
                else base.water_ok,
                "battery_pct": row["telemetry_battery_pct"]
                if row["telemetry_battery_pct"] is not None
                else base.battery_pct,
                "power_source": row["telemetry_power_source"]
                if row["telemetry_power_source"] is not None
                else base.power_source,
                "telemetry_status": telemetry_freshness(
                    row["telemetry_last_seen_at"], now
                ),
                "telemetry_observed_at": row["telemetry_observed_at"],
                "telemetry_received_at": row["telemetry_received_at"],
                "telemetry_last_seen_at": row["telemetry_last_seen_at"],
            }
        )
        if unit != base or previous_modes.get(mode.id) != mode:
            unit = domain.derive(unit, mode, now)
        hydrated[public_id] = unit
    state.incubators = hydrated
    return rows


async def save_incubators(
    session: AsyncSession,
    farm_id: UUID,
    state: MemoryStore,
    before: dict[str, IncubatorDTO],
    rows: list[dict[str, Any]],
) -> None:
    positions = {row["public_id"]: row["position"] for row in rows}
    next_position = max(positions.values(), default=-1) + 1
    for public_id, unit in state.incubators.items():
        position = positions.get(public_id, next_position)
        values = incubator_values(farm_id, unit, position)
        device = device_values(farm_id, unit)
        old = before.get(public_id)
        if old is None:
            await session.execute(insert(devices).values(**device))
            await session.execute(insert(incubators).values(**values))
            next_position += 1
        else:
            if device != device_values(farm_id, old):
                await session.execute(
                    update(devices)
                    .where(
                        devices.c.farm_id == farm_id,
                        devices.c.id == device["id"],
                    )
                    .values(**device)
                )
            if values != incubator_values(farm_id, old, position):
                await session.execute(
                    update(incubators)
                    .where(
                        incubators.c.farm_id == farm_id,
                        incubators.c.public_id == public_id,
                    )
                    .values(**values)
                )
