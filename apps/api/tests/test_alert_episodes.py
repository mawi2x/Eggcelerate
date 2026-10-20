"""Exercise real transactions, durable candidates and independent operator actions."""

import asyncio
import json
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import uuid4

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
    modes,
)
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.main import create_app
from eggcelerate_api.mqtt.telemetry import ingest_telemetry


def stable_test_time() -> datetime:
    now = datetime.now(UTC) + timedelta(hours=1)
    if now.hour >= 23:
        now = (now + timedelta(days=1)).replace(
            hour=12, minute=0, second=0, microsecond=0
        )
    return now


def test_recovery_hysteresis():
    assert outside(37.55, 37.5, 37.8, 0.2, True)
    assert not outside(37.65, 37.5, 37.8, 0.2, True)
    assert not outside(37.5, 37.5, 37.8, 0.2, False)


async def setup(db, *, at=None, notification_enabled=None):
    now = at if at is not None else datetime.now(UTC)
    async with db.sessions.begin() as session:
        await session.execute(
            update(incubator_runtime)
            .where(
                incubator_runtime.c.farm_id == db.farm_id,
                incubator_runtime.c.incubator_id == "chamber-1",
            )
            .values(cycle_phase="incubating")
        )
        if notification_enabled is not None:
            await session.execute(
                update(farm_preferences)
                .where(farm_preferences.c.farm_id == db.farm_id)
                .values(notification_enabled=notification_enabled)
            )
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

    telemetry_datetime = None
    if at is not None:
        from eggcelerate_api.mqtt import telemetry

        telemetry_datetime = telemetry.datetime

        class Clock(datetime):
            @classmethod
            def now(cls, tz=None):
                return now if tz is None else now.astimezone(tz)

        telemetry.datetime = Clock
    try:
        async with db.sessions.begin() as session:
            assert await ingest_telemetry(session, db.farm_id, topic, raw)
            assert not await ingest_telemetry(session, db.farm_id, topic, raw)
    finally:
        if telemetry_datetime is not None:
            telemetry.datetime = telemetry_datetime
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


async def in_band_readings(db):
    async with db.sessions() as session:
        mode_id = await session.scalar(
            select(incubators.c.mode_id).where(
                incubators.c.farm_id == db.farm_id,
                incubators.c.public_id == "chamber-1",
            )
        )
        mode = (
            (await session.execute(select(modes).where(modes.c.id == mode_id)))
            .mappings()
            .one()
        )
    return {
        "temperature_c": (mode["temp_min"] + mode["temp_max"]) / 2,
        "humidity_pct": (mode["humidity_min"] + mode["humidity_max"]) / 2,
    }


def test_candidates_restart_actions_recovery_recurrence(settings):
    async def prepare():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            now = await setup(db, at=stable_test_time())
            rows = await episodes(db)
            assert [r["code"] for r in rows] == ["water-check"]
            await tick(
                db,
                now + timedelta(seconds=89.9),
                temperature_c=50,
                humidity_pct=1,
            )
            assert [r["code"] for r in await episodes(db)] == ["water-check"]
        finally:
            await db.close()
        # A fresh store retains the original candidate timing across restart.
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            await tick(
                db,
                now + timedelta(seconds=90),
                temperature_c=50,
                humidity_pct=1,
            )
            rows = await episodes(db)
            assert [r["code"] for r in rows] == [
                "water-check",
                "temperature-out-of-range",
                "humidity-out-of-range",
            ]
            assert all(r["condition_state"] == "active" for r in rows)
            await tick(
                db,
                now + timedelta(seconds=90.1),
                temperature_c=50,
                humidity_pct=1,
            )
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
            await tick(
                db,
                now + timedelta(seconds=91),
                temperature_c=50,
                humidity_pct=1,
            )
            rows = await episodes(db)
            assert len(rows) == 3
            assert rows[0]["dismissed"]

            # A stale reading is unknown; it must not resolve an active alert.
            await tick(db, now + timedelta(seconds=136.1))
            assert all(r["condition_state"] == "active" for r in await episodes(db))

            in_band = await in_band_readings(db)
            await tick(
                db,
                now + timedelta(seconds=137),
                **in_band,
                water_ok=True,
            )
            rows = await episodes(db)
            assert rows[0]["code"] == "water-check"
            assert rows[0]["condition_state"] == "active"
            assert rows[0]["dismissed"]
            assert [r["condition_state"] for r in rows[1:]] == [
                "resolved",
                "resolved",
            ]
            assert {r["resolution_reason"] for r in rows[1:]} == {"recovered"}

            # A later sustained excursion creates new durable episode IDs.
            await tick(
                db,
                now + timedelta(seconds=138),
                temperature_c=50,
                humidity_pct=1,
            )
            await tick(
                db,
                now + timedelta(seconds=227.9),
                temperature_c=50,
                humidity_pct=1,
            )
            assert len(await episodes(db)) == 3
            await tick(
                db,
                now + timedelta(seconds=228),
                temperature_c=50,
                humidity_pct=1,
            )
            final = await episodes(db)
            assert len(final) == 5
            assert len({r["public_id"] for r in final}) == 5
            assert [r["code"] for r in final[3:]] == [
                "temperature-out-of-range",
                "humidity-out-of-range",
            ]
            assert all(r["condition_state"] == "active" for r in final[3:])
        finally:
            await db.close()

    asyncio.run(finish())


def test_water_check_is_manual_daily_and_preference_gated(settings):
    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            now = await setup(
                db,
                at=stable_test_time(),
                notification_enabled={
                    "temp": False,
                    "humidity": False,
                    "water": True,
                    "offline": False,
                },
            )
            first = await episodes(db)
            assert len(first) == 1
            assert first[0]["code"] == "water-check"
            assert first[0]["severity"] == "info"
            assert first[0]["title"] == "Check water reservoir"
            assert "manually" in first[0]["message"].lower()
            assert "water level" not in first[0]["message"].lower()
            assert "water is low" not in first[0]["message"].lower()

            await tick(db, now + timedelta(seconds=60))
            same_day = await episodes(db)
            assert len(same_day) == 1
            assert same_day[0]["public_id"] == first[0]["public_id"]

            next_day = datetime.combine(
                now.date() + timedelta(days=1), datetime.min.time(), UTC
            )
            await tick(db, next_day)
            daily = await episodes(db)
            assert len(daily) == 2
            assert all(row["code"] == "water-check" for row in daily)
            assert daily[0]["condition_state"] == "resolved"
            assert daily[0]["resolution_reason"] == "configuration_changed"
            assert daily[1]["condition_state"] == "active"

            await tick(db, next_day + timedelta(hours=1))
            repeated_same_day = await episodes(db)
            assert len(repeated_same_day) == 2
            assert repeated_same_day[1]["public_id"] == daily[1]["public_id"]
        finally:
            await db.close()

        disabled = PostgresStore(settings.database_url, str(uuid4()))
        try:
            await disabled.seed()
            disabled_at = stable_test_time()
            await setup(
                disabled,
                at=disabled_at,
                notification_enabled={
                    "temp": False,
                    "humidity": False,
                    "water": False,
                    "offline": False,
                },
            )
            assert await episodes(disabled) == []
            await tick(disabled, disabled_at + timedelta(days=1))
            assert await episodes(disabled) == []
        finally:
            await disabled.close()

    asyncio.run(run())


def test_offline_without_messages_concurrent_evaluators_and_preferences(settings):
    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            now = await setup(
                db,
                at=stable_test_time(),
                notification_enabled={
                    "temp": False,
                    "humidity": False,
                    "water": False,
                    "offline": True,
                },
            )
            assert await episodes(db) == []

            await tick(db, now + timedelta(seconds=180))
            assert await episodes(db) == []
            await tick(db, now + timedelta(seconds=180.001))
            rows = await episodes(db)
            assert len(rows) == 1 and rows[0]["code"] == "device-offline"
            first_id = rows[0]["public_id"]

            await asyncio.gather(
                *(tick(db, now + timedelta(seconds=242)) for _ in range(3))
            )
            rows = await episodes(db)
            assert len(rows) == 1 and rows[0]["public_id"] == first_id
            await tick(db, now + timedelta(seconds=243), temperature_c=50)
            rows = await episodes(db)
            assert rows[0]["condition_state"] == "resolved"
            assert rows[0]["resolution_reason"] == "recovered"
            await tick(db, now + timedelta(seconds=424))
            rows = await episodes(db)
            assert len(rows) == 2
            assert rows[0]["condition_state"] == "resolved"
            assert rows[1]["code"] == "device-offline"
            assert rows[1]["condition_state"] == "active"
            assert rows[1]["public_id"] != first_id
        finally:
            await db.close()

    asyncio.run(run())


def test_configuration_change_and_monitoring_end(settings):
    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            now = await setup(db, at=stable_test_time())
            await tick(
                db,
                now + timedelta(seconds=89.9),
                temperature_c=50,
                humidity_pct=1,
            )
            assert [r["code"] for r in await episodes(db)] == ["water-check"]
            await tick(
                db,
                now + timedelta(seconds=90),
                temperature_c=50,
                humidity_pct=1,
            )
            assert [r["code"] for r in await episodes(db)] == [
                "water-check",
                "temperature-out-of-range",
                "humidity-out-of-range",
            ]
            async with db.sessions.begin() as session:
                mode_id = await session.scalar(
                    select(incubators.c.mode_id).where(
                        incubators.c.farm_id == db.farm_id,
                        incubators.c.public_id == "chamber-1",
                    )
                )
                await session.execute(
                    update(modes).where(modes.c.id == mode_id).values(temp_max=51)
                )
            await tick(
                db,
                now + timedelta(seconds=90.1),
                temperature_c=50,
                humidity_pct=1,
            )
            rows = await episodes(db)
            by_code = {row["code"]: row for row in rows}
            assert by_code["water-check"]["condition_state"] == "active"
            assert by_code["temperature-out-of-range"]["resolution_reason"] == (
                "configuration_changed"
            )
            assert by_code["humidity-out-of-range"]["resolution_reason"] == (
                "configuration_changed"
            )
            async with db.sessions.begin() as session:
                await session.execute(
                    update(incubator_runtime)
                    .where(incubator_runtime.c.farm_id == db.farm_id)
                    .values(cycle_phase="completed")
                )
            await tick(
                db,
                now + timedelta(seconds=90.2),
                temperature_c=50,
                humidity_pct=1,
            )
            rows = await episodes(db)
            assert all(r["condition_state"] == "resolved" for r in rows)
            assert next(r for r in rows if r["code"] == "water-check")[
                "resolution_reason"
            ] == "monitoring_ended"
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
    import pytest

    from eggcelerate_api.mqtt import telemetry

    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        other = PostgresStore(settings.database_url, str(uuid4()))
        try:
            now = await setup(db, at=stable_test_time())
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
            assert [r["code"] for r in await episodes(db)] == [
                "water-check"
            ]  # The gap resets environmental candidates, not manual reminders.
            clock = now + timedelta(seconds=92)
            async with db.sessions.begin() as session:
                assert await send(session, 3)
            assert [r["code"] for r in await episodes(db)] == ["water-check"]
            clock = now + timedelta(seconds=122)
            async with db.sessions.begin() as session:
                assert await send(session, 4)
            assert [r["code"] for r in await episodes(db)] == ["water-check"]

            clock = now + timedelta(seconds=150.9)
            async with db.sessions.begin() as session:
                assert await send(session, 5)
            assert [r["code"] for r in await episodes(db)] == ["water-check"]
            clock = now + timedelta(seconds=151)
            async with db.sessions.begin() as session:
                assert await send(session, 6)
            before = await episodes(db)
            assert [r["code"] for r in before] == [
                "water-check",
                "temperature-out-of-range",
                "humidity-out-of-range",
            ]
            clock = now + timedelta(seconds=1000)
            async with db.sessions.begin() as session:
                assert not await send(session, 6)
            assert await episodes(db) == before
            clock = now + timedelta(seconds=1001)
            async with db.sessions.begin() as session:
                assert not await send(session, 5)
            assert await episodes(db) == before

            # Episode recovery and the projection must roll back together.
            in_band = await in_band_readings(db)
            clock = now + timedelta(seconds=152)
            with pytest.raises(RuntimeError):
                async with db.sessions.begin() as session:
                    await send(session, 7, **in_band, water_ok=True)
                    raise RuntimeError("Force ingest rollback")
            assert await episodes(db) == before
            async with db.sessions() as session:
                projection = (
                    await session.execute(
                        select(
                            device_telemetry_state.c.seq,
                            device_telemetry_state.c.temperature_c,
                            device_telemetry_state.c.humidity_pct,
                            device_telemetry_state.c.water_ok,
                        ).where(device_telemetry_state.c.farm_id == db.farm_id)
                    )
                ).mappings().one()
            assert projection["seq"] == 6
            assert projection["temperature_c"] == 50
            assert projection["humidity_pct"] == 1
            assert projection["water_ok"] is False

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
