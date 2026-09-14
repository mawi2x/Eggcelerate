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
