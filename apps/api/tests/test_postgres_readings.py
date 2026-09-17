"""Real Timescale ingestion, sparse research buckets, and durable retry tests."""

import asyncio
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from eggcelerate_api.database.readings import (
    TelemetrySample,
    ingest_sample,
    query_readings,
)
from eggcelerate_api.database.schema import devices
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.errors import AppError


def test_sample_validation():
    for patch in (
        {"observed_at": datetime(2026, 9, 14)},  # noqa: DTZ001 -- reject naive telemetry
        {"temperature_c": float("nan")},
        {"humidity_pct": 101},
    ):
        with pytest.raises(ValidationError):
            TelemetrySample.model_validate(
                {
                    "observed_at": datetime.now(UTC),
                    "temperature_c": 37,
                    "humidity_pct": 50,
                    "water_ok": True,
                    **patch,
                }
            )


def test_durable_readings_and_research(settings):
    async def run():
        farm = UUID(settings.default_farm_id)
        store = PostgresStore(settings.database_url, str(farm))
        start = datetime(2026, 9, 14, tzinfo=UTC)
        async with store.sessions() as session:
            device = await session.scalar(
                select(devices.c.id).where(devices.c.farm_id == farm).limit(1)
            )

        def sample(seconds, temperature=37, water=True):
            return TelemetrySample(
                observed_at=start + timedelta(seconds=seconds),
                temperature_c=temperature,
                humidity_pct=50,
                water_ok=water,
            )

        try:
            async with store.sessions.begin() as session:
                for point in (
                    sample(300),
                    sample(299, 39, False),
                    sample(0, 35),
                    sample(900),
                ):
                    assert await ingest_sample(session, farm, device, point)
                before = await query_readings(
                    session, farm, device, start, start + timedelta(minutes=20)
                )
                assert not await ingest_sample(session, farm, device, sample(0, 35))
            async with store.sessions.begin() as session:
                with pytest.raises(AppError, match="different sample"):
                    await ingest_sample(session, farm, device, sample(0, 36))
            await store.close()
            store = PostgresStore(settings.database_url, str(farm))
            await store.seed()
            async with store.sessions.begin() as session:
                assert (
                    await query_readings(
                        session, farm, device, start, start + timedelta(minutes=20)
                    )
                    == before
                )
                rows = await query_readings(
                    session,
                    farm,
                    device,
                    start,
                    start + timedelta(minutes=15),
                    research=True,
                )
                assert [row["count"] for row in rows] == [2, 1]
                assert rows[0]["bucket_start"] == start
                assert rows[1]["bucket_start"] == start + timedelta(minutes=5)
                assert (
                    rows[0]["temperature_c_avg"],
                    rows[0]["temperature_c_min"],
                    rows[0]["temperature_c_max"],
                    rows[0]["water_not_ok_count"],
                ) == (37, 35, 39, 1)
                assert (
                    await query_readings(
                        session, uuid4(), device, start, start + timedelta(days=1)
                    )
                    == []
                )
                # An out-of-order arrival updates its old bucket immediately.
                assert await ingest_sample(session, farm, device, sample(120, 40))
                rows = await query_readings(
                    session,
                    farm,
                    device,
                    start,
                    start + timedelta(minutes=5),
                    research=True,
                )
                assert rows[0]["count"] == 3
                assert rows[0]["temperature_c_max"] == 40
            with pytest.raises(IntegrityError):
                async with store.sessions.begin() as session:
                    await ingest_sample(session, uuid4(), device, sample(60))
        finally:
            await store.close()

    asyncio.run(run())


def test_http_stored_windows_and_empty_farm(settings, monkeypatch):
    from fastapi.testclient import TestClient

    from eggcelerate_api import services
    from eggcelerate_api.main import create_app

    now = datetime.now(UTC).replace(microsecond=0)
    monkeypatch.setattr(services, "utcnow", lambda: now)

    async def populate():
        store = PostgresStore(settings.database_url, settings.default_farm_id)
        from eggcelerate_api.database.schema import incubators

        try:
            async with store.sessions.begin() as session:
                device = await session.scalar(
                    select(incubators.c.device_id).where(
                        incubators.c.farm_id == store.farm_id,
                        incubators.c.public_id == "chamber-1",
                    )
                )
                for age in (
                    timedelta(days=10),
                    timedelta(days=7),
                    timedelta(days=1),
                    timedelta(hours=1),
                    timedelta(0),
                ):
                    await ingest_sample(
                        session,
                        store.farm_id,
                        device,
                        TelemetrySample(
                            observed_at=now - age,
                            temperature_c=37,
                            humidity_pct=50,
                            water_ok=True,
                        ),
                    )
        finally:
            await store.close()

    with TestClient(create_app(settings)) as client:
        base = "/api/v1/incubators/chamber-1/readings"
        assert client.get(base).json() == {"ok": True, "data": []}
        asyncio.run(populate())
        for window, count in (("24h", 2), ("7d", 3), ("full", 3)):
            response = client.get(base, params={"window": window})
            assert response.status_code == 200
            rows = response.json()["data"]
            assert len(rows) == count
            assert rows == client.get(base, params={"window": window}).json()["data"]
        assert client.get(base, params={"window": "bad"}).status_code == 422
        assert client.get("/api/v1/incubators/missing/readings").status_code == 404
        assert client.get("/api/v1/incubators/chamber-2/readings").json()["data"] == []
        assert (
            client.post("/api/v1/incubators/chamber-1/cycles/current/reset").status_code
            == 200
        )
        assert client.get(base, params={"window": "full"}).json()["data"] == []
        assert len(client.get(base).json()["data"]) == 2


def test_import_atomic_retry(settings, monkeypatch, tmp_path):
    import json

    from eggcelerate_api.database import ingest
    from eggcelerate_api.database.schema import telemetry_samples

    monkeypatch.setattr(ingest, "load_settings", lambda: settings)
    path = tmp_path / "samples.json"
    point = {
        "observed_at": "2026-09-14T00:00:00Z",
        "temperature_c": 37,
        "humidity_pct": 50,
        "water_ok": True,
    }
    path.write_text(json.dumps([point]))
    asyncio.run(ingest.import_samples("chamber-1", path))
    asyncio.run(ingest.import_samples("chamber-1", path))
    path.write_text(
        json.dumps(
            [
                {**point, "observed_at": "2026-09-14T00:01:00Z"},
                {**point, "temperature_c": 38},
            ]
        )
    )
    with pytest.raises(AppError):
        asyncio.run(ingest.import_samples("chamber-1", path))

    async def verify():
        store = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with store.sessions() as session:
                rows = (
                    await session.execute(
                        select(telemetry_samples).where(
                            telemetry_samples.c.farm_id == store.farm_id
                        )
                    )
                ).all()
                assert len(rows) == 1
        finally:
            await store.close()

    asyncio.run(verify())


def test_concurrent_sample_retries(settings):
    async def run():
        store = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with store.sessions() as session:
                device = await session.scalar(
                    select(devices.c.id)
                    .where(devices.c.farm_id == store.farm_id)
                    .limit(1)
                )
            point = TelemetrySample(
                observed_at=datetime.now(UTC),
                temperature_c=37,
                humidity_pct=50,
                water_ok=True,
            )

            async def write():
                async with store.sessions.begin() as session:
                    return await ingest_sample(session, store.farm_id, device, point)

            assert sorted(await asyncio.gather(write(), write())) == [False, True]
        finally:
            await store.close()

    asyncio.run(run())
