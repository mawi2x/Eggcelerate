"""Validate simulator v1 telemetry before writing trusted farm/device scope."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, StrictBool, StrictInt, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.readings import TelemetrySample, ingest_sample
from ..database.schema import devices, incubators
from ..errors import AppError


class DeviceTelemetry(TelemetrySample):
    schema_v: Literal[1]
    device_id: Annotated[str, Field(min_length=1, pattern=r"^[A-Za-z0-9_-]+$")]
    incubator_id: Annotated[str, Field(min_length=1)]
    seq: Annotated[StrictInt, Field(ge=0)]
    battery_pct: Annotated[float, Field(ge=0, le=100)]
    power_source: Literal["grid", "battery"]
    water_ok: StrictBool


async def ingest_telemetry(
    session: AsyncSession,
    farm_id: UUID,
    topic: str,
    payload: bytes,
) -> bool:
    """Caller owns transaction; farm scope must come from trusted configuration.

    Device sequence resets on simulator boot, so it is not a durable identity.
    Raw sample deduplication uses device + observed instant, as in B3.
    """
    if len(payload) > 16384:
        raise AppError("validation_error", "Telemetry payload exceeds 16 KiB.")
    try:
        message = DeviceTelemetry.model_validate_json(payload)
    except ValidationError as exc:
        raise AppError("validation_error", "Invalid telemetry payload.") from exc
    expected = f"eggcelerate/v1/devices/{message.device_id}/telemetry"
    if topic != expected:
        raise AppError(
            "validation_error", "Telemetry topic and device identity differ."
        )
    device = await session.scalar(
        select(devices.c.id)
        .join(
            incubators,
            (incubators.c.farm_id == devices.c.farm_id)
            & (incubators.c.device_id == devices.c.id),
        )
        .where(
            devices.c.farm_id == farm_id,
            devices.c.public_id == message.device_id,
            incubators.c.public_id == message.incubator_id,
        )
    )
    if device is None:
        raise AppError(
            "not_found", "Telemetry device/chamber is not assigned in this farm."
        )
    sample = TelemetrySample.model_validate(
        message.model_dump(include=set(TelemetrySample.model_fields))
    )
    return await ingest_sample(session, farm_id, device, sample)
