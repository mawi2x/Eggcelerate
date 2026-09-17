"""Simulator-shaped MQTT messages enter persistence only after scope validation."""

import asyncio
import json
from uuid import uuid4

import pytest
from sqlalchemy import select

from eggcelerate_api.database.schema import devices, incubators, telemetry_samples
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.errors import AppError
from eggcelerate_api.mqtt.telemetry import ingest_telemetry


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
        finally:
            await db.close()

    asyncio.run(run())
