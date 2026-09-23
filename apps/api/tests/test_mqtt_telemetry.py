"""Simulator-shaped MQTT messages enter persistence only after scope validation."""

import asyncio
import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import insert, select, update

from eggcelerate_api.database.readings import telemetry_freshness
from eggcelerate_api.database.schema import (
    device_telemetry_state,
    devices,
    incubators,
    telemetry_samples,
)
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.errors import AppError
from eggcelerate_api.main import create_app
from eggcelerate_api.mqtt.telemetry import ingest_telemetry


def test_telemetry_freshness_uses_server_receipt_age():
    now = datetime(2026, 9, 23, 0, 0, tzinfo=UTC)
    assert telemetry_freshness(now - timedelta(seconds=45), now) == "fresh"
    assert telemetry_freshness(now - timedelta(seconds=46), now) == "stale"
    assert telemetry_freshness(now - timedelta(seconds=181), now) == "offline"
    assert telemetry_freshness(None, now) == "offline"


def test_telemetry_boundary(settings):
    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with db.sessions.begin() as session:
                public_id = await session.scalar(
                    select(devices.c.public_id)
                    .join(incubators, incubators.c.device_id == devices.c.id)
                    .where(
                        incubators.c.farm_id == db.farm_id,
                        incubators.c.public_id == "chamber-1",
                    )
                )
                topic = f"eggcelerate/v1/devices/{public_id}/telemetry"
                message = {
                    "schema_v": 1,
                    "device_id": public_id,
                    "incubator_id": "chamber-1",
                    "boot_id": "boot-a",
                    "booted_at": "2026-09-11T09:00:00Z",
                    "seq": 412,
                    "observed_at": "2026-09-11T10:00:10Z",
                    "temperature_c": 37.62,
                    "humidity_pct": 57.3,
                    "water_ok": True,
                    "battery_pct": 100,
                    "power_source": "grid",
                }
                raw = json.dumps(message).encode()
                assert await ingest_telemetry(session, db.farm_id, topic, raw)
                assert not await ingest_telemetry(session, db.farm_id, topic, raw)
                for patch in (
                    {"humidity_pct": 142},
                    {"schema_v": 2},
                    {"seq": -1},
                    {"water_ok": "yes"},
                    {"observed_at": "2026-09-11T10:00:10"},
                    {"battery_pct": 101},
                    {"extra": 1},
                ):
                    with pytest.raises(AppError) as error:
                        await ingest_telemetry(
                            session,
                            db.farm_id,
                            topic,
                            json.dumps({**message, **patch}).encode(),
                        )
                    assert error.value.code == "validation_error"
                for bad_topic in (topic + "/extra", topic.replace(public_id, "other")):
                    with pytest.raises(AppError):
                        await ingest_telemetry(session, db.farm_id, bad_topic, raw)
                with pytest.raises(AppError) as error:
                    await ingest_telemetry(session, uuid4(), topic, raw)
                assert error.value.code == "not_found"
                with pytest.raises(AppError):
                    await ingest_telemetry(
                        session,
                        db.farm_id,
                        topic,
                        json.dumps({**message, "incubator_id": "chamber-2"}).encode(),
                    )
                with pytest.raises(AppError):
                    await ingest_telemetry(session, db.farm_id, topic, b"x" * 16385)
                rows = (
                    (
                        await session.execute(
                            select(telemetry_samples).where(
                                telemetry_samples.c.farm_id == db.farm_id
                            )
                        )
                    )
                    .mappings()
                    .all()
                )
                assert len(rows) == 1
                assert rows[0]["temperature_c"] == 37.62
                projection = (
                    (
                        await session.execute(
                            select(device_telemetry_state).where(
                                device_telemetry_state.c.farm_id == db.farm_id
                            )
                        )
                    )
                    .mappings()
                    .one()
                )
                assert projection["battery_pct"] == 100
                assert projection["boot_id"] == "boot-a"
                assert projection["seq"] == 412
        finally:
            await db.close()

    asyncio.run(run())
    with TestClient(create_app(settings)) as client:
        data = client.get("/api/v1/incubators/chamber-1").json()["data"]
        assert data["temperature_c"] == 37.62
        assert data["battery_pct"] == 100
        assert data["telemetry_status"] == "fresh"
        assert data["telemetry_last_seen_at"] is not None


def test_late_telemetry_cannot_refresh_or_regress_projection(settings):
    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with db.sessions.begin() as session:
                public_id = await session.scalar(
                    select(devices.c.public_id)
                    .join(incubators, incubators.c.device_id == devices.c.id)
                    .where(
                        incubators.c.farm_id == db.farm_id,
                        incubators.c.public_id == "chamber-1",
                    )
                )
                topic = f"eggcelerate/v1/devices/{public_id}/telemetry"

                def message(seq: int, observed: str, temperature: float) -> bytes:
                    return json.dumps(
                        {
                            "schema_v": 1,
                            "device_id": public_id,
                            "incubator_id": "chamber-1",
                            "boot_id": "boot-a",
                            "booted_at": "2026-09-11T09:00:00Z",
                            "seq": seq,
                            "observed_at": observed,
                            "temperature_c": temperature,
                            "humidity_pct": 57.3,
                            "water_ok": True,
                            "battery_pct": 100,
                            "power_source": "grid",
                        }
                    ).encode()

                assert await ingest_telemetry(
                    session,
                    db.farm_id,
                    topic,
                    message(2, "2026-09-11T10:00:20Z", 37.8),
                )
                assert await ingest_telemetry(
                    session,
                    db.farm_id,
                    topic,
                    message(1, "2026-09-11T10:00:10Z", 39.8),
                )
                projection = (
                    (
                        await session.execute(
                            select(device_telemetry_state).where(
                                device_telemetry_state.c.farm_id == db.farm_id
                            )
                        )
                    )
                    .mappings()
                    .one()
                )
                assert projection["seq"] == 2
                assert projection["temperature_c"] == 37.8
                assert projection["last_seen_at"] == projection["received_at"]
        finally:
            await db.close()

    asyncio.run(run())


def test_restart_ordering_duplicate_and_offline_recovery(settings):
    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        now = datetime.now(UTC)
        topic = "eggcelerate/v1/devices/EGG-1003/telemetry"
        body = dict(
            schema_v=1,
            device_id="EGG-1003",
            incubator_id="chamber-1",
            boot_id="first",
            booted_at=(now - timedelta(minutes=5)).isoformat(),
            seq=100,
            observed_at=(now - timedelta(seconds=20)).isoformat(),
            temperature_c=37.6,
            humidity_pct=57,
            water_ok=True,
            battery_pct=83,
            power_source="battery",
        )

        async def send(**patch):
            async with db.sessions.begin() as session:
                return await ingest_telemetry(
                    session, db.farm_id, topic, json.dumps({**body, **patch}).encode()
                )

        async def current():
            async with db.sessions() as session:
                return dict(
                    (
                        await session.execute(
                            select(device_telemetry_state).where(
                                device_telemetry_state.c.farm_id == db.farm_id
                            )
                        )
                    )
                    .mappings()
                    .one()
                )

        try:
            await send()
            first = await current()
            await send()
            assert await current() == first
            with pytest.raises(AppError):
                await send(battery_pct=1)
            assert await current() == first
            body.update(
                boot_id="second",
                booted_at=(now - timedelta(seconds=10)).isoformat(),
                seq=1,
                observed_at=now.isoformat(),
                temperature_c=38,
            )
            await send()
            second = await current()
            assert second["seq"] == 1 and second["temperature_c"] == 38
            await send(
                boot_id="first",
                booted_at=first["booted_at"].isoformat(),
                seq=200,
                observed_at=(now - timedelta(seconds=15)).isoformat(),
                temperature_c=39,
            )
            assert await current() == second
            await db.close()
            db = PostgresStore(settings.database_url, settings.default_farm_id)
            assert await current() == second
            from sqlalchemy import update

            async with db.sessions.begin() as session:
                await session.execute(
                    update(device_telemetry_state)
                    .where(device_telemetry_state.c.farm_id == db.farm_id)
                    .values(last_seen_at=now - timedelta(seconds=200))
                )
            assert (
                telemetry_freshness((await current())["last_seen_at"], now) == "offline"
            )
            await send(seq=2, observed_at=(now + timedelta(milliseconds=1)).isoformat())
            assert (
                telemetry_freshness(
                    (await current())["last_seen_at"], datetime.now(UTC)
                )
                == "fresh"
            )
        finally:
            await db.close()

    asyncio.run(run())


def test_new_boot_precedes_observation_time_but_same_boot_keeps_both_gates(settings):
    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        now = datetime.now(UTC)
        topic = "eggcelerate/v1/devices/EGG-1003/telemetry"
        common = {
            "schema_v": 1,
            "device_id": "EGG-1003",
            "incubator_id": "chamber-1",
            "temperature_c": 37.6,
            "humidity_pct": 57,
            "water_ok": True,
            "battery_pct": 83,
            "power_source": "battery",
        }

        async def send(boot_id: str, boot_offset: int, seq: int, observed_offset: int):
            message = {
                **common,
                "boot_id": boot_id,
                "booted_at": (now + timedelta(seconds=boot_offset)).isoformat(),
                "seq": seq,
                "observed_at": (now + timedelta(seconds=observed_offset)).isoformat(),
            }
            async with db.sessions.begin() as session:
                return await ingest_telemetry(
                    session, db.farm_id, topic, json.dumps(message).encode()
                )

        async def current():
            async with db.sessions() as session:
                row = (
                    (
                        await session.execute(
                            select(device_telemetry_state).where(
                                device_telemetry_state.c.farm_id == db.farm_id
                            )
                        )
                    )
                    .mappings()
                    .one()
                )
                return dict(row)

        try:
            await send("first", -90, 20, -20)
            first = await current()
            # This boot began later, although its device clock reports an
            # observation older than the previous boot's final observation.
            await send("second", -55, 1, -50)
            second = await current()
            assert second["boot_id"] == "second"
            assert second["booted_at"] > first["booted_at"]
            assert second["observed_at"] < first["observed_at"]
            assert second["last_seen_at"] > first["last_seen_at"]
            assert (
                telemetry_freshness(second["last_seen_at"], datetime.now(UTC))
                == "fresh"
            )

            # A later observation from an older boot cannot replace the new boot.
            await send("stale-new-boot", -70, 1, -5)
            assert await current() == second

            # Within a single boot, sequence alone is insufficient: observation
            # time must advance too.
            await send("second", -55, 2, -52)
            assert await current() == second
        finally:
            await db.close()

    asyncio.run(run())


def test_telemetry_projection_survives_device_reassignment(settings):
    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        now = datetime.now(UTC)
        old_device_id = await _device_uuid(db, "chamber-1")
        new_device_id = uuid4()

        def message(
            device_public_id: str, boot_id: str, observed_at: datetime
        ) -> bytes:
            return json.dumps(
                {
                    "schema_v": 1,
                    "device_id": device_public_id,
                    "incubator_id": "chamber-1",
                    "boot_id": boot_id,
                    "booted_at": (observed_at - timedelta(minutes=1)).isoformat(),
                    "seq": 1,
                    "observed_at": observed_at.isoformat(),
                    "temperature_c": 37.6,
                    "humidity_pct": 57,
                    "water_ok": True,
                    "battery_pct": 100,
                    "power_source": "grid",
                }
            ).encode()

        try:
            async with db.sessions.begin() as session:
                old_public_id = await session.scalar(
                    select(devices.c.public_id).where(devices.c.id == old_device_id)
                )
                await ingest_telemetry(
                    session,
                    db.farm_id,
                    f"eggcelerate/v1/devices/{old_public_id}/telemetry",
                    message(
                        old_public_id, "old-device-boot", now - timedelta(seconds=30)
                    ),
                )
                await session.execute(
                    insert(devices).values(
                        id=new_device_id,
                        farm_id=db.farm_id,
                        public_id="EGG-REPLACEMENT-1",
                        paired=True,
                    )
                )
                await session.execute(
                    update(incubators)
                    .where(
                        incubators.c.farm_id == db.farm_id,
                        incubators.c.public_id == "chamber-1",
                    )
                    .values(device_id=new_device_id)
                )
                assert await ingest_telemetry(
                    session,
                    db.farm_id,
                    "eggcelerate/v1/devices/EGG-REPLACEMENT-1/telemetry",
                    message("EGG-REPLACEMENT-1", "replacement-boot", now),
                )
                projection = (
                    (
                        await session.execute(
                            select(device_telemetry_state).where(
                                device_telemetry_state.c.farm_id == db.farm_id,
                                device_telemetry_state.c.incubator_id == "chamber-1",
                            )
                        )
                    )
                    .mappings()
                    .one()
                )
                assert projection["device_id"] == new_device_id
                assert projection["boot_id"] == "replacement-boot"
                assert projection["temperature_c"] == 37.6

                old_projection = await session.scalar(
                    select(device_telemetry_state.c.device_id).where(
                        device_telemetry_state.c.farm_id == db.farm_id,
                        device_telemetry_state.c.device_id == old_device_id,
                    )
                )
                assert old_projection is None
        finally:
            await db.close()

    asyncio.run(run())


async def _device_uuid(db: PostgresStore, incubator_public_id: str):
    async with db.sessions() as session:
        return await session.scalar(
            select(devices.c.id)
            .join(incubators, incubators.c.device_id == devices.c.id)
            .where(
                incubators.c.farm_id == db.farm_id,
                incubators.c.public_id == incubator_public_id,
            )
        )


def test_device_clock_tolerance_is_shared_with_telemetry(settings):
    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        now = datetime.now(UTC)
        topic = "eggcelerate/v1/devices/EGG-1003/telemetry"
        body = {
            "schema_v": 1,
            "device_id": "EGG-1003",
            "incubator_id": "chamber-1",
            "boot_id": "clock-boundary",
            "booted_at": (now - timedelta(minutes=1)).isoformat(),
            "seq": 1,
            "observed_at": (now + timedelta(seconds=30)).isoformat(),
            "temperature_c": 37.6,
            "humidity_pct": 57,
            "water_ok": True,
            "battery_pct": 100,
            "power_source": "grid",
        }
        try:
            async with db.sessions.begin() as session:
                assert await ingest_telemetry(
                    session, db.farm_id, topic, json.dumps(body).encode()
                )
            async with db.sessions.begin() as session:
                with pytest.raises(AppError) as error:
                    await ingest_telemetry(
                        session,
                        db.farm_id,
                        topic,
                        json.dumps(
                            {
                                **body,
                                "seq": 2,
                                "observed_at": (
                                    now + timedelta(seconds=61)
                                ).isoformat(),
                            }
                        ).encode(),
                    )
                assert error.value.code == "validation_error"
            future_boot = datetime.now(UTC) + timedelta(seconds=90)
            async with db.sessions.begin() as session:
                with pytest.raises(AppError) as error:
                    await ingest_telemetry(
                        session,
                        db.farm_id,
                        topic,
                        json.dumps(
                            {
                                **body,
                                "boot_id": "future-boot",
                                "booted_at": future_boot.isoformat(),
                                "observed_at": future_boot.isoformat(),
                            }
                        ).encode(),
                    )
                assert error.value.code == "validation_error"
            async with db.sessions() as session:
                projection = (
                    (
                        await session.execute(
                            select(device_telemetry_state).where(
                                device_telemetry_state.c.farm_id == db.farm_id
                            )
                        )
                    )
                    .mappings()
                    .one()
                )
                assert projection["seq"] == 1
        finally:
            await db.close()

    asyncio.run(run())
