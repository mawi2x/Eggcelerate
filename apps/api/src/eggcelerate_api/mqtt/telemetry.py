"""Validate device telemetry and update the durable latest-device projection."""

from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictInt,
    ValidationError,
)
from sqlalchemy import and_, delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.alert_episodes import evaluate_farm
from ..database.climate_control import ClimateReport, record_report
from ..database.readings import TelemetrySample, ingest_sample
from ..database.schema import device_telemetry_state, devices, farms, incubators
from ..errors import AppError
from .clock import DEVICE_CLOCK_TOLERANCE
from .offline import StorageStatus, record_status


class DeviceTelemetry(TelemetrySample):
    storage: StorageStatus | None = None
    climate_test: ClimateReport | None = None
    schema_v: Literal[1]
    device_id: Annotated[str, Field(min_length=1, pattern=r"^[A-Za-z0-9_-]+$")]
    incubator_id: Annotated[str, Field(min_length=1)] | None = None
    boot_id: Annotated[
        str, Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9._-]+$")
    ]
    booted_at: AwareDatetime
    seq: Annotated[StrictInt, Field(ge=0, le=2147483647)]
    battery_pct: Annotated[float, Field(ge=0, le=100)]
    power_source: Literal["grid", "battery"]
    # Legacy storage compatibility only; water is a manual reminder.
    water_ok: StrictBool = True


class DeviceClimateStatus(BaseModel):
    """No fabricated environmental sample when the DHT cannot be read."""

    model_config = ConfigDict(extra="forbid")
    climate_only: Literal[True]
    storage: StorageStatus | None = None
    schema_v: Literal[1]
    device_id: Annotated[str, Field(min_length=1, pattern=r"^[A-Za-z0-9_-]+$")]
    incubator_id: str | None = None
    boot_id: Annotated[
        str, Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9._-]+$")
    ]
    booted_at: AwareDatetime
    observed_at: AwareDatetime
    seq: Annotated[StrictInt, Field(ge=0, le=2147483647)]
    climate_test: ClimateReport


async def ingest_telemetry(
    session: AsyncSession,
    farm_id: UUID,
    topic: str,
    payload: bytes,
) -> bool:
    """Caller owns transaction; farm scope comes from trusted configuration.

    Raw samples remain keyed by device and observed instant. The latest projection
    orders new boots by their start time, regardless of observation-clock skew;
    within one boot, both sequence and observation time must advance. Liveness
    uses ``last_seen_at`` assigned by this server only when a projection advances.
    """
    if len(payload) > 16384:
        raise AppError("validation_error", "Telemetry payload exceeds 16 KiB.")
    try:
        message: DeviceTelemetry | DeviceClimateStatus
        try:
            message = DeviceTelemetry.model_validate_json(payload)
        except ValidationError:
            message = DeviceClimateStatus.model_validate_json(payload)
    except ValidationError as exc:
        raise AppError("validation_error", "Invalid telemetry payload.") from exc
    expected = f"eggcelerate/v1/devices/{message.device_id}/telemetry"
    if topic != expected:
        raise AppError(
            "validation_error", "Telemetry topic and device identity differ."
        )
    received_at = datetime.now(UTC)
    if message.booted_at > message.observed_at:
        raise AppError(
            "validation_error", "Telemetry boot time is after observation time."
        )
    if message.booted_at > received_at + DEVICE_CLOCK_TOLERANCE:
        raise AppError(
            "validation_error", "Telemetry boot time is too far in the future."
        )
    if message.observed_at > received_at + DEVICE_CLOCK_TOLERANCE:
        raise AppError(
            "validation_error", "Telemetry observation is too far in the future."
        )
    # Same lock order as API mutations and periodic evaluation.
    await session.scalar(
        select(farms.c.id).where(farms.c.id == farm_id).with_for_update()
    )
    assignment_query = (
        select(devices.c.id, incubators.c.public_id)
        .join(
            incubators,
            (incubators.c.farm_id == devices.c.farm_id)
            & (incubators.c.device_id == devices.c.id),
        )
        .where(devices.c.farm_id == farm_id, devices.c.public_id == message.device_id)
        .with_for_update(of=[devices, incubators])
    )
    if message.incubator_id is not None:
        assignment_query = assignment_query.where(
            incubators.c.public_id == message.incubator_id
        )
    assignment = (await session.execute(assignment_query)).one_or_none()
    if assignment is None:
        raise AppError(
            "not_found", "Telemetry device/chamber is not assigned in this farm."
        )
    device, message.incubator_id = assignment
    report_advanced = False
    if message.climate_test is not None:
        report_advanced = await record_report(
            session,
            farm_id,
            message.incubator_id,
            device,
            message.boot_id,
            message.booted_at,
            message.seq,
            message.climate_test,
            received_at,
            observed_at=message.observed_at,
            temperature_c=getattr(message, "temperature_c", None),
            humidity_pct=getattr(message, "humidity_pct", None),
        )
    if isinstance(message, DeviceClimateStatus):
        if report_advanced and message.storage is not None:
            await record_status(session, farm_id, device, message.storage)
        return False
    # A chamber has exactly one latest projection. On reassignment, discard its
    # old device projection; if a device itself moved chambers, discard its old
    # chamber projection too. Raw telemetry history remains intact.
    await session.execute(
        delete(device_telemetry_state).where(
            device_telemetry_state.c.farm_id == farm_id,
            or_(
                and_(
                    device_telemetry_state.c.incubator_id == message.incubator_id,
                    device_telemetry_state.c.device_id != device,
                ),
                and_(
                    device_telemetry_state.c.device_id == device,
                    device_telemetry_state.c.incubator_id != message.incubator_id,
                ),
            ),
        )
    )
    sample = TelemetrySample.model_validate(
        message.model_dump(include=set(TelemetrySample.model_fields))
    )
    inserted = await ingest_sample(
        session, farm_id, device, sample, received_at=received_at
    )
    current = (
        (
            await session.execute(
                select(device_telemetry_state)
                .where(
                    device_telemetry_state.c.farm_id == farm_id,
                    device_telemetry_state.c.device_id == device,
                )
                .with_for_update()
            )
        )
        .mappings()
        .first()
    )
    projection = {
        "incubator_id": message.incubator_id,
        "boot_id": message.boot_id,
        "booted_at": message.booted_at,
        "seq": message.seq,
        "observed_at": message.observed_at,
        "received_at": received_at,
        "last_seen_at": received_at,
        "temperature_c": message.temperature_c,
        "humidity_pct": message.humidity_pct,
        "water_ok": message.water_ok,
        "battery_pct": message.battery_pct,
        "power_source": message.power_source,
    }
    if current is not None and message.boot_id == current["boot_id"]:
        if message.booted_at != current["booted_at"]:
            raise AppError("validation_error", "Boot identity changed its start time.")
        if message.seq == current["seq"] and any(
            projection[key] != current[key]
            for key in (
                "observed_at",
                "temperature_c",
                "humidity_pct",
                "water_ok",
                "battery_pct",
                "power_source",
            )
        ):
            raise AppError("conflict", "Sequence reused with different telemetry.")
    same_boot = (
        (
            message.boot_id == current["boot_id"]
            and message.booted_at == current["booted_at"]
        )
        if current is not None
        else False
    )
    newer = current is None or (
        (not same_boot and message.booted_at > current["booted_at"])
        or (
            same_boot
            and message.seq > current["seq"]
            and message.observed_at > current["observed_at"]
        )
    )
    # A gap cannot count as sustained bad readings, even after a restart where
    # the periodic evaluator was absent. Evaluate stale evidence before replacing it.
    if (
        newer
        and current is not None
        and (received_at - current["last_seen_at"]).total_seconds() > 45
    ):
        await evaluate_farm(session, farm_id, now=received_at, farm_locked=True)
    if current is None:
        await session.execute(
            device_telemetry_state.insert().values(
                farm_id=farm_id, device_id=device, **projection
            )
        )
    elif newer:
        await session.execute(
            update(device_telemetry_state)
            .where(
                device_telemetry_state.c.farm_id == farm_id,
                device_telemetry_state.c.device_id == device,
            )
            .values(**projection)
        )
    if newer:
        if message.storage is not None:
            await record_status(session, farm_id, device, message.storage)
        await evaluate_farm(session, farm_id, now=received_at, farm_locked=True)
    return inserted
