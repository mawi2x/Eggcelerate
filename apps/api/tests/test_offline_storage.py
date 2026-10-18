"""Offline ingestion is idempotent and cannot update live control/freshness."""

import asyncio
import hashlib
import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import func, select, update

from eggcelerate_api.database.device_registry import provision_device
from eggcelerate_api.database.readings import query_readings
from eggcelerate_api.database.schema import (
    climate_report_history,
    device_telemetry_state,
    devices,
    incubators,
    offline_conflicts,
    offline_records,
    telemetry_samples,
)
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.errors import AppError
from eggcelerate_api.mqtt.offline import assignment, compact, ingest_batch, parse_batch
from eggcelerate_api.mqtt.telemetry import ingest_telemetry
from eggcelerate_api.mqtt.worker import InboundMqttMessage, MqttInputQueues


def packet(device="EGG-OFFLINE", records=None, queue=None):
    if records is None:
        records = [record()]
    value = dict(
        schema_v=1,
        kind="offline_batch",
        device_id=device,
        queue=queue or uuid4().hex,
        batch=hashlib.sha256(compact(records)).hexdigest(),
        records=records,
    )
    return compact(value)


def record(n="1", **changes):
    return dict(
        n=n,
        s="0123456789abcdef",
        m=15000,
        t=int((datetime.now(UTC) - timedelta(hours=2)).timestamp() * 1000),
        g=uuid4().hex,
        a=100,
        c=3760,
        h=5700,
        v=True,
        **changes,
    )


def test_batch_validation():
    topic = "eggcelerate/v1/devices/EGG-OFFLINE/telemetry"
    raw = packet()
    assert parse_batch(topic, raw).kind == "offline_batch"
    for bad in [
        b"{}",
        b"[]",
        raw.replace(b'"c":3760', b'"c":3761'),
        raw.replace(b'"schema_v":1', b'"schema_v":1,"schema_v":1'),
        packet(records=[record("2"), record("1")]),
        packet(records=[record("18446744073709551616")]),
        b"x" * 2049,
    ]:
        with pytest.raises(AppError):
            parse_batch(topic, bad)
    with pytest.raises(AppError):
        parse_batch(topic.replace("EGG-OFFLINE", "OTHER"), raw)


def test_live_messages_have_priority_over_history():
    async def run():
        q = MqttInputQueues(telemetry_capacity=1)
        history = InboundMqttMessage("a/telemetry", packet(), 1, 0)
        live = InboundMqttMessage("a/telemetry", b"{}", 2, 0)
        ack = InboundMqttMessage("a/ack", b"{}", 3, 1)
        for msg in [history, live, ack]:
            assert q.enqueue(msg)
        assert await q.get() == ack
        assert await q.get() == live
        assert await q.get() == history

    asyncio.run(run())


def test_durable_replay_and_quarantine(settings):
    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with db.sessions.begin() as session:
                unit = (
                    await session.execute(
                        select(devices.c.id, devices.c.public_id)
                        .join(incubators, incubators.c.device_id == devices.c.id)
                        .where(
                            incubators.c.farm_id == db.farm_id,
                            incubators.c.public_id == "chamber-1",
                        )
                    )
                ).one()
                public_id = f"EGG-OFFLINE-{uuid4().hex[:12]}"
                await session.execute(
                    update(devices)
                    .where(devices.c.id == unit.id)
                    .values(public_id=public_id)
                )
                await provision_device(session, db.farm_id, public_id)
                scope = await assignment(session, db.farm_id, public_id)
                generation = scope["generation"].hex
            topic = f"eggcelerate/v1/devices/{public_id}/telemetry"
            queue = uuid4().hex
            r = record()
            r["g"] = generation
            raw = packet(public_id, [r], queue)
            # A receipt returned inside an aborted transaction must not be sent.
            with pytest.raises(RuntimeError):
                async with db.sessions.begin() as session:
                    await ingest_batch(session, db.farm_id, topic, raw)
                    raise RuntimeError("simulated crash before commit")
            async with db.sessions() as session:
                assert (
                    await session.scalar(
                        select(func.count())
                        .select_from(offline_records)
                        .where(offline_records.c.queue == queue)
                    )
                    == 0
                )
            for _ in range(2):
                async with db.sessions.begin() as session:
                    device, receipt = await ingest_batch(
                        session, db.farm_id, topic, raw
                    )
                    assert device == public_id and receipt.startswith(
                        f"offline|{queue}|"
                    )
            async with db.sessions.begin() as session:
                assert (
                    await session.scalar(
                        select(func.count())
                        .select_from(telemetry_samples)
                        .where(telemetry_samples.c.farm_id == db.farm_id)
                    )
                    == 1
                )
                assert (
                    await session.scalar(
                        select(func.count())
                        .select_from(device_telemetry_state)
                        .where(device_telemetry_state.c.farm_id == db.farm_id)
                    )
                    == 0
                )
                assert (
                    await session.scalar(
                        select(func.count())
                        .select_from(climate_report_history)
                        .where(climate_report_history.c.farm_id == db.farm_id)
                    )
                    == 0
                )
                # Timestamp conflict, unknown time, wrong assignment and invalid sensor
                # are retained with explicit outcomes; no invented raw measurements.
                records = []
                for n, patch in [
                    ("2", {"c": 3750}),
                    ("3", {"t": None}),
                    ("4", {"g": uuid4().hex}),
                    ("5", {"v": False, "c": None, "h": None}),
                    (
                        "6",
                        {
                            "t": int(
                                (datetime.now(UTC) + timedelta(hours=1)).timestamp()
                                * 1000
                            )
                        },
                    ),
                ]:
                    records.append({**r, "n": n, **patch})
                await ingest_batch(
                    session, db.farm_id, topic, packet(public_id, records, queue)
                )
                outcomes = (
                    (
                        await session.execute(
                            select(offline_records.c.outcome).where(
                                offline_records.c.queue == queue
                            )
                        )
                    )
                    .scalars()
                    .all()
                )
                assert set(outcomes) == {
                    "imported",
                    "quarantined_timestamp_conflict",
                    "quarantined_time_unknown",
                    "quarantined_assignment",
                    "sensor_invalid",
                    "quarantined_future",
                }
                # Reused IDs with changed content are durably quarantined too.
                await ingest_batch(
                    session,
                    db.farm_id,
                    topic,
                    packet(public_id, [{**r, "h": 5800}], queue),
                )
                assert (
                    await session.scalar(
                        select(func.count())
                        .select_from(offline_conflicts)
                        .where(offline_conflicts.c.queue == queue)
                    )
                    == 1
                )
                assert (
                    await session.scalar(
                        select(func.count())
                        .select_from(telemetry_samples)
                        .where(telemetry_samples.c.farm_id == db.farm_id)
                    )
                    == 1
                )
            async with db.sessions.begin() as session:
                malformed = {**r, "n": "8", "h": 10001}
                out_of_range = {**r, "n": "9", "t": 0}
                await ingest_batch(
                    session,
                    db.farm_id,
                    topic,
                    packet(public_id, [malformed, out_of_range], queue),
                )
                outcomes = (
                    (
                        await session.execute(
                            select(offline_records.c.outcome).where(
                                offline_records.c.queue == queue,
                                offline_records.c.sequence.in_(["8", "9"]),
                            )
                        )
                    )
                    .scalars()
                    .all()
                )
                assert set(outcomes) == {
                    "quarantined_record_schema",
                    "quarantined_time_range",
                }
            # Replaying into an already-live chamber preserves the exact latest
            # projection, including server freshness timestamps and sequence.
            async with db.sessions.begin() as session:
                now = datetime.now(UTC)
                await ingest_telemetry(
                    session,
                    db.farm_id,
                    topic,
                    json.dumps(
                        dict(
                            schema_v=1,
                            device_id=public_id,
                            boot_id="live-boot",
                            seq=20,
                            booted_at=(now - timedelta(minutes=10)).isoformat(),
                            observed_at=now.isoformat(),
                            temperature_c=37.7,
                            humidity_pct=58,
                            battery_pct=100,
                            power_source="grid",
                        )
                    ).encode(),
                )
                before = dict(
                    (
                        await session.execute(
                            select(device_telemetry_state).where(
                                device_telemetry_state.c.farm_id == db.farm_id,
                            )
                        )
                    )
                    .mappings()
                    .one()
                )
                later = {
                    **r,
                    "n": "7",
                    "t": int((now - timedelta(hours=1)).timestamp() * 1000),
                }
                await ingest_batch(
                    session, db.farm_id, topic, packet(public_id, [later], queue)
                )
                after = dict(
                    (
                        await session.execute(
                            select(device_telemetry_state).where(
                                device_telemetry_state.c.farm_id == db.farm_id,
                            )
                        )
                    )
                    .mappings()
                    .one()
                )
                assert after == before
                readings = await query_readings(
                    session,
                    db.farm_id,
                    unit.id,
                    now - timedelta(hours=3),
                    now + timedelta(seconds=1),
                )
                assert (
                    len(readings) == 3
                    and sum(row["backfilled"] for row in readings) == 2
                )
                buckets = await query_readings(
                    session,
                    db.farm_id,
                    unit.id,
                    now - timedelta(hours=3),
                    now + timedelta(seconds=1),
                    research=True,
                )
                assert sum(row["backfilled_count"] for row in buckets) == 2
            async with db.sessions.begin() as session:
                with pytest.raises(AppError):
                    await ingest_batch(session, uuid4(), topic, raw)
        finally:
            await db.close()

    asyncio.run(run())
