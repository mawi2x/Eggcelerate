"""Historical uploads: durable quarantine/receipts, never live control ingestion.

Wire records use integer hundredths and UTC milliseconds. The batch digest is
SHA256 of compact JSON records, retaining the transmitted field order. Identity
is device + queue generation + decimal sequence, independent of UTC corrections.
"""

import hashlib
import json
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal
from uuid import UUID, uuid4

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictInt,
    ValidationError,
)
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.readings import TelemetrySample, ingest_sample
from ..database.schema import (
    device_registry,
    devices,
    farms,
    incubators,
    offline_assignments,
    offline_conflicts,
    offline_device_status,
    offline_records,
)
from ..errors import AppError

Hex32 = Annotated[str, Field(pattern=r"^[0-9a-f]{32}$")]
UInt = Annotated[StrictInt, Field(ge=0, le=9223372036854775807)]


class StorageStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")
    state: Literal["ready", "unavailable", "needs_init", "disabled"]
    queued: Annotated[StrictInt, Field(ge=0, le=20000)]
    bytes: Annotated[StrictInt, Field(ge=0, le=2097152)]
    pending: Annotated[StrictInt, Field(ge=0, le=32)]
    untimed: Annotated[StrictInt, Field(ge=0, le=20000)]
    dropped: UInt
    corrupt: UInt
    lost_first: Annotated[str, Field(pattern=r"^[0-9]{1,20}$")] = "0"
    lost_last: Annotated[str, Field(pattern=r"^[0-9]{1,20}$")] = "0"
    oldest_ms: UInt | None = None
    error: Annotated[str, Field(max_length=64)] = ""


class Record(BaseModel):
    model_config = ConfigDict(extra="forbid")
    n: Annotated[str, Field(pattern=r"^[1-9][0-9]{0,19}$")]
    s: Annotated[str, Field(pattern=r"^[0-9a-f]{16}$")]
    m: UInt
    t: UInt | None
    g: Hex32 | None
    a: Annotated[StrictInt, Field(ge=0, le=4294967295)]
    c: Annotated[StrictInt, Field(ge=-4000, le=8000)] | None
    h: Annotated[StrictInt, Field(ge=0, le=10000)] | None
    v: StrictBool


class Batch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_v: Literal[1]
    kind: Literal["offline_batch"]
    device_id: Annotated[str, Field(pattern=r"^[A-Za-z0-9_-]{1,128}$")]
    queue: Hex32
    batch: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    records: Annotated[
        list[Annotated[Record | dict, Field(union_mode="left_to_right")]],
        Field(min_length=1, max_length=8),
    ]


def compact(value) -> bytes:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=True).encode()


def parse_batch(topic: str, payload: bytes) -> Batch:
    try:
        if len(payload) > 2048:
            raise ValueError("batch exceeds device byte limit")

        def unique_pairs(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    raise ValueError("duplicate JSON key")
                result[key] = value
            return result

        raw = json.loads(payload, object_pairs_hook=unique_pairs)
        batch = Batch.model_validate(raw)
        if topic != f"eggcelerate/v1/devices/{batch.device_id}/telemetry":
            raise ValueError("topic identity differs")
        if hashlib.sha256(compact(raw["records"])).hexdigest() != batch.batch:
            raise ValueError("batch digest differs")
        identities = [
            record.n if isinstance(record, Record) else record.get("n")
            for record in batch.records
        ]
        if any(
            not isinstance(n, str)
            or not n.isdecimal()
            or n.startswith("0")
            or len(n) > 20
            for n in identities
        ):
            raise ValueError("invalid record identity")
        sequences = [int(str(n)) for n in identities]
        if any(n > 18446744073709551615 for n in sequences) or sequences != sorted(
            set(sequences)
        ):
            raise ValueError("invalid sequence range")
        return batch
    except (ValidationError, ValueError, TypeError, KeyError) as exc:
        raise AppError("validation_error", "Invalid offline batch.") from exc


async def assignment(session: AsyncSession, farm_id: UUID, public_id: str):
    """Serialize with provisioning/mutations and issue an opaque scope generation."""
    await session.scalar(
        select(farms.c.id).where(farms.c.id == farm_id).with_for_update()
    )
    current = (
        (
            await session.execute(
                select(
                    devices.c.id.label("device"),
                    incubators.c.id.label("incubator"),
                    device_registry.c.created_at,
                )
                .select_from(devices)
                .join(
                    incubators,
                    (incubators.c.farm_id == devices.c.farm_id)
                    & (incubators.c.device_id == devices.c.id),
                )
                .join(
                    device_registry,
                    (device_registry.c.public_id == devices.c.public_id)
                    & (device_registry.c.farm_id == devices.c.farm_id),
                )
                .where(
                    devices.c.farm_id == farm_id,
                    devices.c.public_id == public_id,
                    device_registry.c.disabled_at.is_(None),
                )
                .with_for_update(of=[devices, incubators, device_registry])
            )
        )
        .mappings()
        .first()
    )
    if current is None:
        raise AppError("not_found", "Offline device is not assigned.")
    previous = (
        (
            await session.execute(
                select(offline_assignments)
                .where(offline_assignments.c.public_id == public_id)
                .order_by(offline_assignments.c.created_at.desc())
                .limit(1)
            )
        )
        .mappings()
        .first()
    )
    if previous is not None and all(
        (
            previous["farm_id"] == farm_id,
            previous["device_id"] == current["device"],
            previous["incubator_id"] == current["incubator"],
            previous["registry_created_at"] == current["created_at"],
        )
    ):
        return previous
    value = dict(
        generation=uuid4(),
        public_id=public_id,
        farm_id=farm_id,
        device_id=current["device"],
        incubator_id=current["incubator"],
        registry_created_at=current["created_at"],
        created_at=datetime.now(UTC),
    )
    await session.execute(offline_assignments.insert().values(**value))
    return value


async def record_status(session, farm_id, device_id, report: StorageStatus):
    values = dict(
        farm_id=farm_id,
        device_id=device_id,
        reported_at=datetime.now(UTC),
        report=report.model_dump(),
    )
    await session.execute(
        insert(offline_device_status)
        .values(**values)
        .on_conflict_do_update(
            index_elements=["farm_id", "device_id"],
            set_={"reported_at": values["reported_at"], "report": values["report"]},
        )
    )


async def ingest_batch(
    session: AsyncSession, farm_id: UUID, topic: str, payload: bytes
) -> tuple[str, str]:
    """Caller must commit before publishing returned receipt. All quarantines persist."""
    batch = parse_batch(topic, payload)
    scope = await assignment(session, farm_id, batch.device_id)
    now = datetime.now(UTC)
    for record in batch.records:
        valid_schema = isinstance(record, Record)
        value = record.model_dump() if isinstance(record, Record) else record
        sequence = value["n"]
        digest = hashlib.sha256(compact(value)).hexdigest()
        key = (
            offline_records.c.public_id == batch.device_id,
            offline_records.c.queue == batch.queue,
            offline_records.c.sequence == sequence,
        )
        previous = (
            (await session.execute(select(offline_records).where(*key)))
            .mappings()
            .first()
        )
        if previous is not None:
            if previous["digest"] != digest:
                # Persist the rejected payload before issuing the batch receipt.
                # The original immutable identity/sample is never replaced.
                await session.execute(
                    insert(offline_conflicts)
                    .values(
                        public_id=batch.device_id,
                        queue=batch.queue,
                        sequence=sequence,
                        digest=digest,
                        received_at=now,
                        record=value,
                    )
                    .on_conflict_do_nothing()
                )
            continue
        utc_ms = value.get("t")
        observed = (
            datetime.fromtimestamp(utc_ms / 1000, UTC)
            if valid_schema
            and utc_ms is not None
            and 1704067200000 <= utc_ms <= 4102444800000
            else None
        )
        authorized = value.get("g") == scope["generation"].hex
        outcome = "imported"
        if not authorized:
            outcome = "quarantined_assignment"
        elif not isinstance(record, Record):
            outcome = "quarantined_record_schema"
        elif observed is None:
            outcome = (
                "quarantined_time_unknown"
                if utc_ms is None
                else "quarantined_time_range"
            )
        elif observed > now + timedelta(seconds=60):
            outcome = "quarantined_future"
        elif not record.v or record.a > 5000 or record.c is None or record.h is None:
            outcome = "sensor_invalid"
        else:
            try:
                # A conflicting timestamp quarantines only this record, not its neighbours.
                async with session.begin_nested():
                    inserted = await ingest_sample(
                        session,
                        farm_id,
                        scope["device_id"],
                        TelemetrySample(
                            observed_at=observed,
                            temperature_c=record.c / 100,
                            humidity_pct=record.h / 100,
                        ),
                        received_at=now,
                    )
                outcome = "imported" if inserted else "duplicate_sample"
            except AppError as exc:
                if exc.code != "conflict":
                    raise
                outcome = "quarantined_timestamp_conflict"
        await session.execute(
            offline_records.insert().values(
                public_id=batch.device_id,
                queue=batch.queue,
                sequence=sequence,
                farm_id=farm_id if authorized else None,
                device_id=scope["device_id"] if authorized else None,
                observed_at=observed,
                received_at=now,
                digest=digest,
                record=value,
                outcome=outcome,
            )
        )
    await session.execute(
        insert(offline_device_status)
        .values(
            farm_id=farm_id,
            device_id=scope["device_id"],
            last_replay_at=now,
        )
        .on_conflict_do_update(
            index_elements=["farm_id", "device_id"], set_={"last_replay_at": now}
        )
    )
    return batch.device_id, f"offline|{batch.queue}|{batch.batch}"


async def status(session, farm_id: UUID, incubator_id: str):
    device = await session.scalar(
        select(incubators.c.device_id).where(
            incubators.c.farm_id == farm_id,
            incubators.c.public_id == incubator_id,
        )
    )
    if device is None:
        raise AppError("not_found", "Incubator not found.")
    row = (
        (
            await session.execute(
                select(offline_device_status).where(
                    offline_device_status.c.farm_id == farm_id,
                    offline_device_status.c.device_id == device,
                )
            )
        )
        .mappings()
        .first()
    )
    counts = (
        await session.execute(
            select(offline_records.c.outcome, func.count())
            .where(
                offline_records.c.farm_id == farm_id,
                offline_records.c.device_id == device,
            )
            .group_by(offline_records.c.outcome)
        )
    ).all()
    return {
        "reported_at": row["reported_at"] if row else None,
        "report": row["report"] if row else None,
        "last_replay_at": row["last_replay_at"] if row else None,
        "outcomes": dict(counts),
    }
