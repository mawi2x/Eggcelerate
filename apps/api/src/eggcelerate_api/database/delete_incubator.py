"""Farm-scoped removal with an explicit force override for activity guards."""

from datetime import UTC, datetime

from sqlalchemy import delete, select

from ..errors import AppError
from .schema import (
    alert_monitors,
    alerts,
    candling_entries,
    candling_photos,
    climate_tests,
    cycle_history,
    cycles,
    device_commands,
    device_telemetry_state,
    devices,
    farms,
    incubator_runtime,
    incubators,
    telemetry_samples,
)


async def remove(session, farm_id, incubator_id, confirmation, *, force=False):
    await session.execute(
        select(farms.c.id).where(farms.c.id == farm_id).with_for_update()
    )
    row = (
        (
            await session.execute(
                select(incubators).where(
                    incubators.c.farm_id == farm_id,
                    incubators.c.public_id == incubator_id,
                )
            )
        )
        .mappings()
        .first()
    )
    if row is None:
        raise AppError("not_found", "Incubator was not found.")
    if confirmation != row["name"]:
        raise AppError(
            "validation_error", "Enter the incubator name to confirm deletion."
        )
    if not force:
        runtime = (
            (
                await session.execute(
                    select(incubator_runtime).where(
                        incubator_runtime.c.farm_id == farm_id,
                        incubator_runtime.c.incubator_id == incubator_id,
                    )
                )
            )
            .mappings()
            .first()
        )
        active = await session.scalar(
            select(cycles.c.id).where(
                cycles.c.farm_id == farm_id,
                cycles.c.incubator_id == incubator_id,
                cycles.c.status == "active",
            )
        )
        if active or (runtime and runtime["preparation_started_at"]):
            raise AppError(
                "conflict",
                "Stop the cycle or cancel preparation before deleting this incubator.",
            )
        control = (
            (
                await session.execute(
                    select(climate_tests).where(
                        climate_tests.c.farm_id == farm_id,
                        climate_tests.c.incubator_id == incubator_id,
                    )
                )
            )
            .mappings()
            .first()
        )
        if control:
            report = control["report"] or {}
            pending = (control["request"] or {}).get("status") == "pending" or (
                (control["tray"] or {}).get("request") or {}
            ).get("status") == "pending"
            if pending or (control["intent"] or {}).get("phase", 0):
                raise AppError(
                    "conflict",
                    "Stop equipment and wait for device confirmation before deleting.",
                )
            if report.get("lifecycle") == 1:
                fresh = (
                    control["reported_at"]
                    and (datetime.now(UTC) - control["reported_at"]).total_seconds()
                    <= 45
                )
                if not fresh or any(
                    report.get(k)
                    for k in (
                        "running",
                        "heater",
                        "mist",
                        "upper",
                        "exhaust",
                        "tray_running",
                    )
                ):
                    raise AppError(
                        "conflict",
                        "Confirm all equipment is off in Live Monitor before deleting. Reconnect the device if its report is delayed.",
                    )
        pending_turn = await session.scalar(
            select(device_commands.c.id)
            .where(
                device_commands.c.farm_id == farm_id,
                device_commands.c.incubator_id == incubator_id,
                device_commands.c.status.in_(["pending", "dispatched"]),
            )
            .limit(1)
        )
        if pending_turn:
            raise AppError(
                "conflict",
                "Wait for the pending turn command to finish before deleting.",
            )

    cycle_ids = select(cycles.c.id).where(
        cycles.c.farm_id == farm_id, cycles.c.incubator_id == incubator_id
    )
    for table in (candling_photos, candling_entries):
        await session.execute(
            delete(table).where(
                table.c.farm_id == farm_id, table.c.cycle_id.in_(cycle_ids)
            )
        )
    for table in (
        alert_monitors,
        alerts,
        cycle_history,
        incubator_runtime,
        device_commands,
        climate_tests,
        device_telemetry_state,
        cycles,
    ):
        await session.execute(
            delete(table).where(
                table.c.farm_id == farm_id, table.c.incubator_id == incubator_id
            )
        )
    await session.execute(
        delete(telemetry_samples).where(
            telemetry_samples.c.farm_id == farm_id,
            telemetry_samples.c.device_id == row["device_id"],
        )
    )
    await session.execute(
        delete(incubators).where(
            incubators.c.farm_id == farm_id, incubators.c.public_id == incubator_id
        )
    )
    await session.execute(
        delete(devices).where(
            devices.c.farm_id == farm_id, devices.c.id == row["device_id"]
        )
    )
