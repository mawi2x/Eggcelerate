"""Durable outbox and correlated simulator outcomes. No physical actuation."""

from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.schema import device_commands as commands
from ..database.schema import device_telemetry_state, devices, farms, incubator_runtime
from ..errors import AppError
from .clock import DEVICE_CLOCK_TOLERANCE

TERMINAL = ("acked", "rejected", "timed_out")


class CommandAck(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_v: Literal[1]
    command_id: UUID
    device_id: str = Field(min_length=1)
    # Optional for pre-migration commands; new successful dispatches require
    # these fields to match the boot snapshot persisted with the outbox row.
    boot_id: str | None = Field(default=None, min_length=1, max_length=128)
    booted_at: AwareDatetime | None = None
    seq: int = Field(ge=0, strict=True)
    observed_at: AwareDatetime
    status: Literal["acked", "rejected"]
    error_code: str | None = None


async def expire_commands(session: AsyncSession, farm_id: UUID, now: datetime) -> None:
    await session.execute(
        update(commands)
        .where(
            commands.c.farm_id == farm_id,
            commands.c.status.in_(("pending", "dispatched")),
            commands.c.expires_at <= now - DEVICE_CLOCK_TOLERANCE,
        )
        .values(status="timed_out", error_code="ack_deadline_exceeded")
    )


async def claim_commands(
    session: AsyncSession, farm_id: UUID, now: datetime
) -> list[dict]:
    await expire_commands(session, farm_id, now)
    rows = (
        await session.execute(
            select(commands)
            .where(
                commands.c.farm_id == farm_id,
                commands.c.status.in_(("pending", "dispatched")),
                commands.c.next_attempt_at <= now,
                commands.c.expires_at > now,
                commands.c.attempts < 5,
            )
            .order_by(commands.c.requested_at)
            .limit(50)
            .with_for_update(skip_locked=True)
        )
    ).mappings()
    messages = []
    for row in rows:
        dispatch_identity = {
            "boot_id": row["dispatch_boot_id"],
            "booted_at": row["dispatch_booted_at"],
            "seq": row["dispatch_seq"],
        }
        if dispatch_identity["boot_id"] is None:
            projection = (
                (
                    await session.execute(
                        select(
                            device_telemetry_state.c.boot_id,
                            device_telemetry_state.c.booted_at,
                            device_telemetry_state.c.seq,
                        )
                        .select_from(
                            device_telemetry_state.join(
                                devices,
                                (device_telemetry_state.c.farm_id == devices.c.farm_id)
                                & (device_telemetry_state.c.device_id == devices.c.id),
                            )
                        )
                        .where(
                            device_telemetry_state.c.farm_id == farm_id,
                            devices.c.public_id == row["device_id"],
                        )
                        .with_for_update(of=device_telemetry_state)
                    )
                )
                .mappings()
                .first()
            )
            if projection is None:
                # Do not dispatch a command whose ACK cannot be tied to a known boot.
                continue
            dispatch_identity = dict(projection)
        await session.execute(
            update(commands)
            .where(commands.c.id == row["id"])
            .values(
                status="dispatched",
                attempts=row["attempts"] + 1,
                next_attempt_at=now + timedelta(seconds=10),
                dispatch_boot_id=dispatch_identity["boot_id"],
                dispatch_booted_at=dispatch_identity["booted_at"],
                dispatch_seq=dispatch_identity["seq"],
            )
        )
        messages.append(
            {
                "schema_v": 1,
                "command_id": str(row["id"]),
                "device_id": row["device_id"],
                "type": "turn_now",
                "turn_interval_min": row["turn_interval_min"],
                "requested_at": row["requested_at"].isoformat(),
                "expires_at": row["expires_at"].isoformat(),
                "boot_id": dispatch_identity["boot_id"],
                "booted_at": dispatch_identity["booted_at"].isoformat(),
                "seq": dispatch_identity["seq"],
            }
        )
    return messages


async def apply_ack(
    session: AsyncSession,
    farm_id: UUID,
    topic: str,
    payload: bytes,
    received_at: datetime | None = None,
) -> bool:
    if len(payload) > 16384:
        raise AppError("validation_error", "ACK exceeds 16 KiB.")
    try:
        ack = CommandAck.model_validate_json(payload)
    except ValidationError as exc:
        raise AppError("validation_error", "Invalid command ACK.") from exc
    if topic != f"eggcelerate/v1/devices/{ack.device_id}/ack":
        raise AppError("validation_error", "ACK device/topic mismatch.")
    # Same lock order as API mutations protects runtime against concurrent reset.
    await session.execute(
        select(farms.c.id).where(farms.c.id == farm_id).with_for_update()
    )
    row = (
        (
            await session.execute(
                select(commands)
                .where(
                    commands.c.farm_id == farm_id,
                    commands.c.id == ack.command_id,
                    commands.c.device_id == ack.device_id,
                )
                .with_for_update()
            )
        )
        .mappings()
        .first()
    )
    if row is None:
        raise AppError("not_found", "ACK has no matching farm/device command.")
    if row["status"] in TERMINAL:
        return False
    now = received_at or datetime.now(UTC)
    if row["attempts"] < 1 or not (
        row["requested_at"] - DEVICE_CLOCK_TOLERANCE
        <= ack.observed_at
        <= now + DEVICE_CLOCK_TOLERANCE
    ):
        raise AppError("validation_error", "ACK execution time or dispatch is invalid.")
    if ack.status == "acked" and ack.error_code is not None:
        raise AppError("validation_error", "Successful ACK cannot contain an error.")
    if (
        ack.status == "acked"
        and row["dispatch_boot_id"] is not None
        and (
            ack.boot_id != row["dispatch_boot_id"]
            or ack.booted_at != row["dispatch_booted_at"]
            or ack.seq <= row["dispatch_seq"]
        )
    ):
        raise AppError(
            "validation_error", "Successful ACK does not match its dispatch boot."
        )
    if ack.observed_at > row["expires_at"]:
        await session.execute(
            update(commands)
            .where(commands.c.id == row["id"])
            .values(
                status="timed_out",
                error_code="ack_deadline_exceeded",
            )
        )
        return False
    await session.execute(
        update(commands)
        .where(commands.c.id == row["id"])
        .values(
            status=ack.status,
            executed_at=ack.observed_at if ack.status == "acked" else None,
            ack_received_at=now,
            error_code=ack.error_code,
        )
    )
    if ack.status == "acked":
        # A delayed older success cannot roll back a newer confirmed turn cursor.
        await session.execute(
            update(incubator_runtime)
            .where(
                incubator_runtime.c.farm_id == farm_id,
                incubator_runtime.c.incubator_id == row["incubator_id"],
                incubator_runtime.c.last_turned_at < ack.observed_at,
            )
            .values(
                last_turned_at=ack.observed_at,
                next_turn_at=ack.observed_at
                + timedelta(minutes=row["turn_interval_min"]),
            )
        )
    return True
