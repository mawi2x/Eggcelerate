"""Simulator-shaped MQTT messages enter persistence only after scope validation."""

import asyncio
import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

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
