"""Exercise real transactions, durable candidates and independent operator actions."""

import asyncio
import json
from dataclasses import replace
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select, update

from eggcelerate_api.database.alert_episodes import (
    evaluate_farm,
    outside,
)
from eggcelerate_api.database.schema import (
    alerts,
    device_telemetry_state,
    farm_preferences,
    incubator_runtime,
    incubators,
)
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.main import create_app
from eggcelerate_api.mqtt.telemetry import ingest_telemetry


def test_recovery_hysteresis():
    assert outside(37.55, 37.5, 37.8, 0.2, True)
    assert not outside(37.65, 37.5, 37.8, 0.2, True)
    assert not outside(37.5, 37.5, 37.8, 0.2, False)


async def setup(db):
    async with db.sessions.begin() as session:
        await session.execute(
            update(incubator_runtime)
            .where(
                incubator_runtime.c.farm_id == db.farm_id,
                incubator_runtime.c.incubator_id == "chamber-1",
            )
            .values(cycle_phase="incubating")
        )
        now = datetime.now(UTC)
        payload = dict(
            schema_v=1,
            device_id="EGG-1003",
            incubator_id="chamber-1",
            boot_id="episode-test",
            booted_at=(now - timedelta(minutes=5)).isoformat(),
            seq=1,
            observed_at=now.isoformat(),
            temperature_c=50,
            humidity_pct=1,
            water_ok=False,
            battery_pct=100,
            power_source="grid",
        )
        raw = json.dumps(payload).encode()
        topic = "eggcelerate/v1/devices/EGG-1003/telemetry"
        assert await ingest_telemetry(session, db.farm_id, topic, raw)
        assert not await ingest_telemetry(session, db.farm_id, topic, raw)
    return now


async def tick(db, at, **values):
    async with db.sessions.begin() as session:
        if values:
            await session.execute(
                update(device_telemetry_state)
                .where(device_telemetry_state.c.farm_id == db.farm_id)
                .values(last_seen_at=at, **values)
            )
        await evaluate_farm(session, db.farm_id, now=at)


async def episodes(db):
    async with db.sessions() as session:
        return [
            dict(r)
            for r in (
                await session.execute(
                    select(alerts)
                    .where(
                        alerts.c.farm_id == db.farm_id,
                        alerts.c.device_id.is_not(None),
                        alerts.c.incubator_id == "chamber-1",
                    )
                    .order_by(alerts.c.position)
                )
            ).mappings()
        ]


def test_candidates_restart_actions_recovery_recurrence(settings):
    async def prepare():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            now = await setup(db)
            assert await episodes(db) == []
            await tick(db, now + timedelta(seconds=31), temperature_c=50)
            assert [r["code"] for r in await episodes(db)] == ["water-low"]
        finally:
            await db.close()
        # A fresh store retains the original candidate timing across restart.
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            await tick(db, now + timedelta(seconds=61), temperature_c=50)
            rows = await episodes(db)
            assert len(rows) == 3 and all(
                r["condition_state"] == "active" for r in rows
            )
            await tick(db, now + timedelta(seconds=62), temperature_c=50)
            assert len(await episodes(db)) == 3
            return now, rows
        finally:
            await db.close()

    now, rows = asyncio.run(prepare())
    with TestClient(create_app(settings)) as client:
        first_id = rows[0]["public_id"]
        ack = client.post(f"/api/v1/alerts/{first_id}/acknowledge")
        assert (
            ack.status_code == 200 and ack.json()["data"]["condition_state"] == "active"
        )
        assert (
            client.delete(
                f"/api/v1/alerts/{first_id}",
                headers={"Idempotency-Key": "episode-dismiss"},
            ).status_code
            == 200
        )
        assert (
            client.delete(
                f"/api/v1/alerts/{first_id}",
                headers={"Idempotency-Key": "episode-dismiss"},
            ).status_code
            == 200
        )

    async def finish():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            await db.seed()  # Does not resurrect a dismissed episode.
            await tick(db, now + timedelta(seconds=63), temperature_c=50)
            assert len(await episodes(db)) == 3
            assert (await episodes(db))[0]["dismissed"]
            # Unknown stale values are not evidence of recovery.
            await tick(db, now + timedelta(seconds=120))
            assert all(r["condition_state"] == "active" for r in await episodes(db))
            async with db.sessions() as session:
                target = (
                    await session.execute(
                        select(incubators.c.mode_id).where(
                            incubators.c.farm_id == db.farm_id,
                            incubators.c.public_id == "chamber-1",
                        )
                    )
                ).scalar_one()
                from eggcelerate_api.database.schema import modes

                mode = (
                    (await session.execute(select(modes).where(modes.c.id == target)))
                    .mappings()
                    .one()
                )
            await tick(
                db,
                now + timedelta(seconds=121),
                temperature_c=(mode["temp_min"] + mode["temp_max"]) / 2,
                humidity_pct=(mode["humidity_min"] + mode["humidity_max"]) / 2,
                water_ok=True,
            )
            assert all(
                r["condition_state"] == "resolved"
                and r["resolution_reason"] == "recovered"
                for r in await episodes(db)
            )
            await tick(
                db,
                now + timedelta(seconds=122),
                temperature_c=50,
                humidity_pct=1,
                water_ok=False,
            )
            await tick(db, now + timedelta(seconds=153), temperature_c=50)
            await tick(db, now + timedelta(seconds=183), temperature_c=50)
            final = await episodes(db)
            assert len(final) == 6
            assert len({r["public_id"] for r in final}) == 6
            assert all(r["condition_state"] == "active" for r in final[3:])
        finally:
            await db.close()

    asyncio.run(finish())


def test_offline_without_messages_concurrent_evaluators_and_preferences(settings):
    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            now = await setup(db)
            async with db.sessions.begin() as session:
                await session.execute(
                    update(farm_preferences)
                    .where(farm_preferences.c.farm_id == db.farm_id)
                    .values(
                        notification_enabled={
                            "temp": False,
                            "humidity": False,
                            "water": False,
                            "offline": True,
                        }
                    )
                )
            await tick(db, now + timedelta(seconds=61), temperature_c=50)
            assert await episodes(db) == []
            await asyncio.gather(
                *(tick(db, now + timedelta(seconds=242)) for _ in range(3))
            )
            rows = await episodes(db)
            assert len(rows) == 1 and rows[0]["code"] == "device-offline"
            await tick(db, now + timedelta(seconds=243), temperature_c=50)
            assert (await episodes(db))[0]["condition_state"] == "resolved"
            await tick(db, now + timedelta(seconds=424))
            assert len(await episodes(db)) == 2
        finally:
            await db.close()

    asyncio.run(run())


def test_configuration_change_and_monitoring_end(settings):
    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            now = await setup(db)
            await tick(db, now + timedelta(seconds=31), temperature_c=50)
            await tick(db, now + timedelta(seconds=61), temperature_c=50)
            async with db.sessions.begin() as session:
                from eggcelerate_api.database.schema import modes

                mode_id = await session.scalar(
                    select(incubators.c.mode_id).where(
                        incubators.c.farm_id == db.farm_id,
                        incubators.c.public_id == "chamber-1",
                    )
                )
                await session.execute(
                    update(modes).where(modes.c.id == mode_id).values(temp_max=51)
                )
            await tick(db, now + timedelta(seconds=62), temperature_c=50)
            rows = await episodes(db)
            assert {
                r["resolution_reason"] for r in rows if r["code"] != "water-low"
            } == {"configuration_changed"}
            async with db.sessions.begin() as session:
                await session.execute(
                    update(incubator_runtime)
                    .where(incubator_runtime.c.farm_id == db.farm_id)
                    .values(cycle_phase="completed")
                )
            await tick(db, now + timedelta(seconds=63), temperature_c=50)
            assert all(r["condition_state"] == "resolved" for r in await episodes(db))
            assert (await episodes(db))[0]["resolution_reason"] == "monitoring_ended"
        finally:
            await db.close()

    asyncio.run(run())


def test_api_lifespan_periodic_offline_evaluation(settings):
    async def age():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            now = await setup(db)
            async with db.sessions.begin() as session:
                await session.execute(
                    update(device_telemetry_state)
                    .where(device_telemetry_state.c.farm_id == db.farm_id)
                    .values(last_seen_at=now - timedelta(seconds=181))
                )
        finally:
            await db.close()

    asyncio.run(age())
    import time

    with TestClient(
        create_app(replace(settings, alert_evaluation_interval=0.02))
    ) as client:
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            items = client.get("/api/v1/alerts").json()["data"]
            if any(
                a["code"] == "device-offline" and a["condition_state"] == "active"
                for a in items
            ):
                break
            time.sleep(0.02)
        else:
            raise AssertionError("API timer did not detect the silent device")


def test_ingest_gap_duplicates_rollback_and_farm_isolation(settings, monkeypatch):
    from uuid import uuid4

    import pytest

    from eggcelerate_api.mqtt import telemetry

    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        other = PostgresStore(settings.database_url, str(uuid4()))
        try:
            now = await setup(db)
            clock = now

            class Clock(datetime):
                @classmethod
                def now(cls, tz=None):
                    return clock

            monkeypatch.setattr(telemetry, "datetime", Clock)

            async def send(session, seq, **patch):
                body = dict(
                    schema_v=1,
                    device_id="EGG-1003",
                    incubator_id="chamber-1",
                    boot_id="episode-test",
                    booted_at=(now - timedelta(minutes=5)).isoformat(),
                    seq=seq,
                    observed_at=(now + timedelta(seconds=seq)).isoformat(),
                    temperature_c=50,
                    humidity_pct=1,
                    water_ok=False,
                    battery_pct=100,
                    power_source="grid",
                )
                return await ingest_telemetry(
                    session,
                    db.farm_id,
                    "eggcelerate/v1/devices/EGG-1003/telemetry",
                    json.dumps({**body, **patch}).encode(),
                )

            clock = now + timedelta(seconds=61)
            async with db.sessions.begin() as session:
                assert await send(session, 2)
            assert await episodes(db) == []  # No timer tick during the gap.
            clock = now + timedelta(seconds=92)
            async with db.sessions.begin() as session:
                assert await send(session, 3)
            assert len(await episodes(db)) == 1
            clock = now + timedelta(seconds=122)
            async with db.sessions.begin() as session:
                assert await send(session, 4)
            before = await episodes(db)
            assert len(before) == 3
            clock = now + timedelta(seconds=1000)
            async with db.sessions.begin() as session:
                assert not await send(session, 4)
            assert await episodes(db) == before
            # Episode recovery and the projection must roll back together.
            clock = now + timedelta(seconds=123)
            with pytest.raises(RuntimeError):
                async with db.sessions.begin() as session:
                    await send(session, 5, water_ok=True)
                    raise RuntimeError("Force ingest rollback")
            assert await episodes(db) == before
            await other.seed()
            await tick(other, now + timedelta(seconds=1000))
            assert await episodes(db) == before
            async with other.sessions() as session:
                assert not (
                    await session.scalars(
                        select(alerts.c.public_id).where(
                            alerts.c.farm_id == other.farm_id,
                            alerts.c.public_id.in_([r["public_id"] for r in before]),
                        )
                    )
                ).all()
        finally:
            await db.close()
            await other.close()

    asyncio.run(run())
