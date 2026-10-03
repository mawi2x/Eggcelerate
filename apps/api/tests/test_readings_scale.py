"""Dense/sparse charts and complete immutable export scopes against Timescale."""

import asyncio
import csv
import io
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select, text, update

from eggcelerate_api.database.readings import TelemetrySample, ingest_sample
from eggcelerate_api.database.readings_scale import CHART_POINTS, chart
from eggcelerate_api.database.schema import devices, incubators
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.main import create_app


async def populate(settings):
    db = PostgresStore(settings.database_url, settings.default_farm_id)
    end = datetime.now(UTC).replace(microsecond=0) - timedelta(seconds=2)
    try:
        async with db.sessions.begin() as session:
            await session.execute(
                text("""INSERT INTO telemetry_samples(farm_id,device_id,observed_at,received_at,temperature_c,humidity_pct,water_ok)
                SELECT i.farm_id,i.device_id,t,t,CASE WHEN t=CAST(:end AS timestamptz)-interval '1 hour' THEN 50 ELSE 37.5 END,CASE WHEN t=CAST(:end AS timestamptz)-interval '1 hour' THEN 10 ELSE 57 END,true
                FROM incubators i CROSS JOIN generate_series(CAST(:end AS timestamptz)-interval '24 hours',CAST(:end AS timestamptz)-interval '1 second',interval '1 second') t
                WHERE i.farm_id=CAST(:farm AS uuid) AND i.public_id IN ('chamber-1','chamber-2')
                AND NOT (t>=CAST(:end AS timestamptz)-interval '12 hours' AND t<CAST(:end AS timestamptz)-interval '11 hours')"""),
                {"end": end, "farm": str(db.farm_id)},
            )
            device = await session.scalar(
                select(incubators.c.device_id).where(
                    incubators.c.farm_id == db.farm_id,
                    incubators.c.public_id == "chamber-1",
                )
            )
        return end, device
    finally:
        await db.close()


def test_chart_bound_extrema_sparse_edges_and_late_arrivals(settings):
    end, device = asyncio.run(populate(settings))

    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with db.sessions.begin() as session:
                rows = await chart(session, db.farm_id, "chamber-1", "24h", end)
                assert len(rows) <= CHART_POINTS
                assert sum(r["sample_count"] for r in rows) == 82800
                assert max(r["temperature_max"] for r in rows) == 50
                assert min(r["humidity_min"] for r in rows) == 10
                assert any(
                    (b["observed_at"] - a["observed_at"]).total_seconds()
                    > a["bucket_seconds"]
                    for a, b in zip(rows, rows[1:])
                )
                late = end - timedelta(hours=11, minutes=30)
                await ingest_sample(
                    session,
                    db.farm_id,
                    device,
                    TelemetrySample(
                        observed_at=late,
                        temperature_c=60,
                        humidity_pct=5,
                        water_ok=False,
                    ),
                    received_at=end + timedelta(seconds=1),
                )
                after = await chart(session, db.farm_id, "chamber-1", "24h", end)
                assert sum(r["sample_count"] for r in after) == 82801
                assert max(r["temperature_max"] for r in after) == 60
                assert sum(r["water_not_ok_count"] for r in after) == 1
                # Both UTC edges are exact, including timezone-offset inputs.
                from eggcelerate_api.database.readings import query_readings

                raw = await query_readings(
                    session, db.farm_id, device, end - timedelta(seconds=2), end
                )
                assert len(raw) == 2
                offset = end.astimezone(
                    __import__("datetime").timezone(timedelta(hours=8))
                )
                assert (
                    await chart(session, db.farm_id, "chamber-1", "24h", offset)
                    == after
                )
        finally:
            await db.close()

    asyncio.run(run())
    with TestClient(create_app(settings)) as client:
        response = client.get("/api/v1/incubators/chamber-1/readings/chart?window=24h")
        assert response.status_code == 200 and len(response.json()["data"]) <= 600
        assert (
            client.get("/api/v1/incubators/missing/readings/chart").status_code == 404
        )
        assert (
            client.get(
                "/api/v1/incubators/chamber-1/readings/chart?window=invalid"
            ).status_code
            == 422
        )


def test_complete_export_scope_late_arrivals_rebinding_order_and_auth(settings):
    end, device = asyncio.run(populate(settings))
    with TestClient(create_app(settings)) as client:
        path = "/api/v1/incubators/readings/raw-preview"
        response = client.get(
            path,
            params=[
                ("ids", "chamber-2"),
                ("ids", "chamber-1"),
                ("window", "24h"),
                ("end", end.isoformat()),
            ],
        )
        assert response.status_code == 200, response.text
        data = response.json()["data"]
        assert data["total"] == 165600 and len(data["rows"]) == 200
        token = data["scope_token"]

        async def late_and_rename():
            db = PostgresStore(settings.database_url, settings.default_farm_id)
            try:
                async with db.sessions.begin() as session:
                    await ingest_sample(
                        session,
                        db.farm_id,
                        device,
                        TelemetrySample(
                            observed_at=end - timedelta(hours=11, minutes=30),
                            temperature_c=60,
                            humidity_pct=5,
                            water_ok=False,
                        ),
                        received_at=end + timedelta(seconds=1),
                    )
                    await session.execute(
                        update(incubators)
                        .where(
                            incubators.c.farm_id == db.farm_id,
                            incubators.c.public_id == "chamber-1",
                        )
                        .values(name="Renamed after preview")
                    )
                    replacement = uuid4()
                    await session.execute(
                        devices.insert().values(
                            id=replacement,
                            farm_id=db.farm_id,
                            public_id="EGG-EXPORT-REPLACEMENT",
                            paired=True,
                        )
                    )
                    await session.execute(
                        update(incubators)
                        .where(
                            incubators.c.farm_id == db.farm_id,
                            incubators.c.public_id == "chamber-1",
                        )
                        .values(device_id=replacement)
                    )
            finally:
                await db.close()

        asyncio.run(late_and_rename())
        exported = client.post(
            "/api/v1/incubators/readings/export", json={"scope_token": token}
        )
        assert exported.status_code == 200, exported.text[:200]
        rows = list(csv.DictReader(io.StringIO(exported.text)))
        assert len(rows) == data["total"]
        assert {r["Chamber ID"] for r in rows} == {"chamber-1", "chamber-2"}
        assert "Renamed after preview" not in {r["Chamber"] for r in rows}
        order = [
            (datetime.fromisoformat(r["Timestamp (UTC)"]), r["Chamber ID"])
            for r in rows
        ]
        assert order == sorted(order)
        assert order[0][0] == end - timedelta(days=1)
        assert order[-1][0] == end - timedelta(seconds=1)
        assert (
            client.post(
                "/api/v1/incubators/readings/export", json={"scope_token": token + "x"}
            ).status_code
            == 422
        )
        assert (
            client.get(
                path, params=[("ids", "missing"), ("end", end.isoformat())]
            ).status_code
            == 404
        )
        assert (
            client.get(
                path, params=[("ids", "chamber-1"), ("ids", "chamber-1")]
            ).status_code
            == 422
        )
    from dataclasses import replace

    from .conftest import seed

    other = replace(settings, default_farm_id=str(uuid4()))
    seed(other)
    with TestClient(create_app(other)) as client:
        assert (
            client.post(
                "/api/v1/incubators/readings/export", json={"scope_token": token}
            ).status_code
            == 422
        )


def test_memory_chart_and_raw_contracts():
    from .conftest import make_client

    with make_client() as client:
        for window in ("24h", "7d", "full"):
            response = client.get(
                f"/api/v1/incubators/chamber-12/readings/chart?window={window}"
            )
            assert response.status_code == 200 and len(response.json()["data"]) <= 600
        preview = client.get(
            "/api/v1/incubators/readings/raw-preview?ids=chamber-12&window=full"
        ).json()["data"]
        exported = client.post(
            "/api/v1/incubators/readings/export",
            json={"scope_token": preview["scope_token"]},
        )
        assert len(list(csv.DictReader(io.StringIO(exported.text)))) == preview["total"]


def test_csv_formula_protection_and_token_expiry(settings):
    from eggcelerate_api.api.v1.readings_scale import sign_scope
    from eggcelerate_api.database.readings_scale import csv_chunk

    now = datetime.now(UTC)
    assert "'=danger" in csv_chunk(
        [
            dict(
                incubator_id="chamber-1",
                chamber="=danger",
                observed_at=now,
                received_at=now,
                temperature_c=37,
                humidity_pct=50,
                water_ok=True,
            )
        ]
    )
    token = sign_scope(
        {
            "farm": settings.default_farm_id,
            "end": now,
            "expires": now - timedelta(seconds=1),
        },
        settings.auth_rate_limit_key,
    )
    with TestClient(create_app(settings)) as client:
        assert (
            client.post(
                "/api/v1/incubators/readings/export", json={"scope_token": token}
            ).status_code
            == 422
        )


def test_periodic_evaluator_defers_busy_farms(settings):
    from eggcelerate_api.database.alert_episodes import evaluate_farm
    from eggcelerate_api.database.schema import farms

    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with db.sessions.begin() as locked:
                await locked.scalar(
                    select(farms.c.id).where(farms.c.id == db.farm_id).with_for_update()
                )
                async with db.sessions.begin() as evaluator:
                    # Periodic scans must defer a long ingest transaction rather
                    # than stop offline evaluation for unrelated farms.
                    await asyncio.wait_for(
                        evaluate_farm(evaluator, db.farm_id, skip_locked=True),
                        timeout=2,
                    )
        finally:
            await db.close()

    asyncio.run(run())
