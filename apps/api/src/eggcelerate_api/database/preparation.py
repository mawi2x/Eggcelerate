"""Preparation readiness from real, continuous sensor samples.

Five minutes is the initial product setting, not a sensor calibration or a
species-specific husbandry recommendation. No demo projection can qualify.
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..store import MemoryStore
from .schema import devices, incubators, telemetry_samples

STABILITY_SECONDS = 300
MAX_SAMPLE_GAP_SECONDS = 45


async def load_preparation(
    session: AsyncSession, farm_id: UUID, state: MemoryStore
) -> None:
    now = datetime.now(UTC)
    for unit in list(state.incubators.values()):
        stable_since = None
        ready = False
        if unit.preparation_started_at and unit.cycle_phase == "ready":
            mode = state.modes[unit.mode_id]
            start = max(
                unit.preparation_started_at,
                now - timedelta(seconds=STABILITY_SECONDS + MAX_SAMPLE_GAP_SECONDS * 2),
            )
            rows = (
                await session.execute(
                    select(telemetry_samples)
                    .join(devices, devices.c.id == telemetry_samples.c.device_id)
                    .join(incubators, incubators.c.device_id == devices.c.id)
                    .where(
                        telemetry_samples.c.farm_id == farm_id,
                        incubators.c.farm_id == farm_id,
                        incubators.c.public_id == unit.id,
                        telemetry_samples.c.received_at >= start,
                        telemetry_samples.c.received_at <= now,
                        telemetry_samples.c.observed_at
                        >= start - timedelta(seconds=MAX_SAMPLE_GAP_SECONDS),
                    )
                    .order_by(telemetry_samples.c.received_at.desc())
                )
            ).mappings()
            previous = now
            for row in rows:
                received = row["received_at"]
                observed = row["observed_at"]
                if (
                    (previous - received).total_seconds() > MAX_SAMPLE_GAP_SECONDS
                    or abs((received - observed).total_seconds())
                    > MAX_SAMPLE_GAP_SECONDS
                    or observed < unit.preparation_started_at
                    or not mode.target_temp_c.min
                    <= row["temperature_c"]
                    <= mode.target_temp_c.max
                    or not mode.target_humidity_pct.min
                    <= row["humidity_pct"]
                    <= mode.target_humidity_pct.max
                ):
                    break
                stable_since = received
                previous = received
            # Count actual measured coverage, not time elapsed after the last sample.
            if stable_since and unit.telemetry_received_at:
                ready = (
                    unit.telemetry_status == "fresh"
                    and (unit.telemetry_received_at - stable_since).total_seconds()
                    >= STABILITY_SECONDS
                )
        state.incubators[unit.id] = unit.model_copy(
            update={
                "preparation_stable_since": stable_since,
                "preparation_ready": ready,
            }
        )
