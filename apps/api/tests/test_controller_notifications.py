"""Database-backed controller fault notification lifecycle coverage."""

import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import insert, select, update

from eggcelerate_api.database.alert_episodes import evaluate_farm
from eggcelerate_api.database.climate_control import ClimateReport, record_report
from eggcelerate_api.database.schema import (
    alerts,
    benchmark_runs,
    climate_report_history,
    climate_tests,
    farms,
    incubators,
)
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.main import create_app

FAULT_TITLES = {
    1: "Sensor failure",
    2: "Stale sensor readings",
    3: "Overheating",
    4: "Continuous heating safety timeout",
    5: "Controller settings storage failure",
    6: "Controller restarted after a crash",
    7: "Fan PWM output failure",
}
TEST_BOOTED_AT = datetime(2020, 1, 1, tzinfo=UTC)


def make_report(**changes):
    values = {
        "halted": True,
        "resuming": False,
        "lifecycle": 1,
        "phase": 0,
        "stop_all": True,
        "sensor_valid": True,
        "running": False,
        "mode": 0,
        "heater": False,
        "mist": False,
        "upper": False,
        "exhaust": False,
        "fault": 0,
        "command_id": "",
        "accepted": False,
    }
    values.update(changes)
    return ClimateReport.model_validate(values)


def benchmark_report(run_id, *, kind=1, outcome=1):
    result = {
        "windows": 0,
        "samples": 0,
        "mean_t": 0,
        "mean_rh": 0,
        "min_t": 0,
        "max_t": 0,
        "min_rh": 0,
        "max_rh": 0,
        "dew_point": 0,
    }
    return {
        "version": 1,
        "run_id": run_id,
        "kind": kind,
        "outcome": outcome,
        "stage": 0,
        "elapsed_ms": 5000,
        "stage_elapsed_ms": 5000,
        "invalidated": 0,
        "samples": 2,
        "min_t": 33,
        "max_t": 33,
        "min_rh": 75,
        "max_rh": 75,
        "ceiling_c": 38.5,
        "limit_ms": 3600000,
        "results": [result, result, result],
    }


async def device_for(db, unit="chamber-1"):
    async with db.sessions() as session:
        return await session.scalar(
            select(incubators.c.device_id).where(
                incubators.c.farm_id == db.farm_id,
                incubators.c.public_id == unit,
            )
        )


async def record_and_evaluate(
    db,
    device_id,
    report,
    at,
    *,
    seq=1,
    boot_id="controller-test-boot",
    booted_at=None,
    unit="chamber-1",
):
    booted_at = booted_at or TEST_BOOTED_AT
    async with db.sessions.begin() as session:
        await session.scalar(
            select(farms.c.id)
            .where(farms.c.id == db.farm_id)
            .with_for_update()
        )
        advanced = await record_report(
            session,
            db.farm_id,
            unit,
            device_id,
            boot_id,
            booted_at,
            seq,
            report,
            at,
            observed_at=at,
        )
        await evaluate_farm(session, db.farm_id, now=at, farm_locked=True)
    return advanced


async def evaluate_at(db, at):
    async with db.sessions.begin() as session:
        await session.scalar(
            select(farms.c.id)
            .where(farms.c.id == db.farm_id)
            .with_for_update()
        )
        await evaluate_farm(session, db.farm_id, now=at, farm_locked=True)


async def alert_rows(db, code=None):
    async with db.sessions() as session:
        query = select(alerts).where(alerts.c.farm_id == db.farm_id)
        if code is not None:
            query = query.where(alerts.c.code == code)
        return [dict(row) for row in (await session.execute(query)).mappings()]


def test_all_seven_controller_fault_codes_create_immediate_critical_alerts(settings):
    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            device_id = await device_for(db)
            now = datetime.now(UTC)
            boot_id = "controller-faults-boot-1"
            booted_at = now - timedelta(minutes=5)

            for seq, (fault, title) in enumerate(FAULT_TITLES.items(), start=1):
                at = now + timedelta(seconds=seq)
                if fault == 6:
                    boot_id = "controller-faults-restarted"
                    booted_at = at - timedelta(seconds=30)
                report = make_report(
                    fault=fault,
                    sensor_valid=fault not in {1, 2},
                )
                assert await record_and_evaluate(
                    db,
                    device_id,
                    report,
                    at,
                    seq=seq,
                    boot_id=boot_id,
                    booted_at=booted_at,
                )

                rows = await alert_rows(db, f"controller-fault-{fault}")
                assert len(rows) == 1
                episode = rows[0]
                assert episode["condition_state"] == "active"
                assert episode["severity"] == "critical"
                assert episode["title"] == title
                assert episode["incubator_id"] == "chamber-1"
                assert episode["device_id"] == device_id
                assert episode["unit_name"]
                assert episode["occurred_at"] == at
                assert "Regulation stopped" in episode["message"]
                assert "Resolve the cause before resetting" in episode["message"]

                history = await alert_rows(db)
                active_faults = [
                    row
                    for row in history
                    if row["code"].startswith("controller-fault-")
                    and row["condition_state"] == "active"
                ]
                assert [row["code"] for row in active_faults] == [
                    f"controller-fault-{fault}"
                ]

            history = await alert_rows(db)
            assert len(
                [row for row in history if row["code"].startswith("controller-fault-")]
            ) == 7
        finally:
            await db.close()

    asyncio.run(run())


def test_controller_fault_dedup_restart_dismiss_stale_recovery_and_recurrence(settings):
    async def start():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            device_id = await device_for(db)
            now = datetime.now(UTC) - timedelta(seconds=5)
            first = make_report(fault=4)
            assert await record_and_evaluate(db, device_id, first, now)
            original = (await alert_rows(db, "controller-fault-4"))[0]

            # Duplicate telemetry and repeated evaluators preserve one active ID.
            assert not await record_and_evaluate(
                db, device_id, first, now + timedelta(seconds=1)
            )
            await evaluate_at(db, now + timedelta(seconds=2))
            await evaluate_at(db, now + timedelta(seconds=10))
            assert len(await alert_rows(db, "controller-fault-4")) == 1
            return now, device_id, original["public_id"]
        finally:
            await db.close()

    now, device_id, original_id = asyncio.run(start())
    path = f"/api/v1/alerts/{original_id}"
    with TestClient(create_app(settings)) as client:
        acknowledged = client.post(f"{path}/acknowledge")
        assert acknowledged.status_code == 200
        assert acknowledged.json()["data"]["condition_state"] == "active"
        assert acknowledged.json()["data"]["acknowledged_at"] is not None
        dismissed = client.delete(
            path, headers={"Idempotency-Key": "controller-fault-dismiss"}
        )
        assert dismissed.status_code == 200

    async def finish():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            # A fresh store and seed simulate a backend restart.
            await db.seed()
            await evaluate_at(db, now + timedelta(seconds=11))
            rows = await alert_rows(db, "controller-fault-4")
            assert len(rows) == 1
            assert rows[0]["public_id"] == original_id
            assert rows[0]["condition_state"] == "active"
            assert rows[0]["dismissed"]
            assert rows[0]["acknowledged_at"] is not None

            # No fresh report is not recovery; the fault survives stale status.
            await evaluate_at(db, now + timedelta(seconds=46))
            await evaluate_at(db, now + timedelta(seconds=47))
            rows = await alert_rows(db, "controller-fault-4")
            assert len(rows) == 1
            assert rows[0]["public_id"] == original_id
            assert rows[0]["condition_state"] == "active"
            assert rows[0]["dismissed"]
            stale = await alert_rows(db, "controller-status-stale")
            assert len(stale) == 1 and stale[0]["condition_state"] == "active"

            recovered_at = now + timedelta(seconds=48)
            assert await record_and_evaluate(
                db,
                device_id,
                make_report(fault=0),
                recovered_at,
                seq=2,
            )
            rows = await alert_rows(db, "controller-fault-4")
            assert len(rows) == 1
            assert rows[0]["condition_state"] == "resolved"
            assert rows[0]["resolution_reason"] == "recovered"
            assert rows[0]["dismissed"]
            assert rows[0]["acknowledged_at"] is not None

            recurrence_at = now + timedelta(seconds=49)
            assert await record_and_evaluate(
                db,
                device_id,
                make_report(fault=4),
                recurrence_at,
                seq=3,
            )
            rows = await alert_rows(db, "controller-fault-4")
            assert len(rows) == 2
            active = [row for row in rows if row["condition_state"] == "active"]
            assert len(active) == 1
            assert active[0]["public_id"] != original_id
            assert active[0]["occurred_at"] == recurrence_at
            history = {row["public_id"]: row for row in rows}
            assert history[original_id]["condition_state"] == "resolved"

            await evaluate_at(db, recurrence_at + timedelta(seconds=1))
            rows = await alert_rows(db, "controller-fault-4")
            assert len(rows) == 2
            assert sum(row["condition_state"] == "active" for row in rows) == 1
        finally:
            await db.close()

    asyncio.run(finish())


@pytest.mark.parametrize("output", ["running", "heater", "mist"])
def test_each_unexpected_equipment_output_creates_critical_alert(settings, output):
    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            device_id = await device_for(db)
            at = datetime.now(UTC)
            assert await record_and_evaluate(
                db,
                device_id,
                make_report(**{output: True}),
                at,
            )
            rows = await alert_rows(db, "controller-unexpected-output")
            assert len(rows) == 1
            assert rows[0]["condition_state"] == "active"
            assert rows[0]["severity"] == "critical"
            assert rows[0]["incubator_id"] == "chamber-1"
        finally:
            await db.close()

    asyncio.run(run())


@pytest.mark.parametrize("output", ["upper", "exhaust"])
def test_circulation_fans_during_idle_cooldown_are_not_unexpected_output(
    settings, output
):
    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            device_id = await device_for(db)
            at = datetime.now(UTC)
            assert await record_and_evaluate(
                db,
                device_id,
                make_report(**{output: True, "exhaust_reason": "cooldown"}),
                at,
            )
            assert await alert_rows(db, "controller-unexpected-output") == []
        finally:
            await db.close()

    asyncio.run(run())


@pytest.mark.parametrize(
    "case,run_matches,device_matches,db_kind,report_kind,outcome,expected_alert",
    [
        ("authorized-htm", True, True, "htm", 1, 1, False),
        ("authorized-ltm", True, True, "ltm", 2, 1, False),
        ("authorized-lhm", True, True, "lhm", 3, 1, False),
        ("wrong-run", False, True, "htm", 1, 1, True),
        ("wrong-device", True, False, "htm", 1, 1, True),
        ("wrong-kind", True, True, "htm", 2, 1, True),
        ("not-running", True, True, "htm", 1, 0, True),
    ],
)
def test_benchmark_authorization_requires_a_matching_active_run(
    settings,
    case,
    run_matches,
    device_matches,
    db_kind,
    report_kind,
    outcome,
    expected_alert,
):
    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            unit = "chamber-1"
            device_id = await device_for(db, unit)
            at = datetime.now(UTC)
            run_id = uuid4()
            report_run_id = str(run_id if run_matches else uuid4())
            benchmark_device = device_id if device_matches else uuid4()
            async with db.sessions.begin() as session:
                await session.execute(
                    insert(benchmark_runs).values(
                        id=run_id,
                        farm_id=db.farm_id,
                        incubator_id=unit,
                        device_id=benchmark_device,
                        chamber_name="Chamber One",
                        kind=db_kind,
                        status="running",
                        boot_id="controller-test-boot",
                        started_at=at - timedelta(seconds=1),
                        conditions={},
                        settings={},
                    )
                )

            report = make_report(
                running=True,
                heater=True,
                benchmark=benchmark_report(
                    report_run_id,
                    kind=report_kind,
                    outcome=outcome,
                ),
            )
            assert await record_and_evaluate(db, device_id, report, at)
            rows = await alert_rows(db, "controller-unexpected-output")
            active = [row for row in rows if row["condition_state"] == "active"]
            assert bool(active) is expected_alert, case
            if active:
                assert active[0]["severity"] == "critical"
        finally:
            await db.close()

    asyncio.run(run())


def test_status_commands_and_tray_alerts_follow_controller_state(settings):
    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            device_id = await device_for(db)
            at = datetime.now(UTC)
            assert await record_and_evaluate(db, device_id, make_report(), at)

            await evaluate_at(db, at + timedelta(seconds=46))
            stale = await alert_rows(db, "controller-status-stale")
            assert len(stale) == 1
            assert stale[0]["severity"] == "warning"
            assert stale[0]["title"] == "Equipment status unavailable"

            fresh_at = at + timedelta(seconds=47)
            assert await record_and_evaluate(
                db, device_id, make_report(), fresh_at, seq=2
            )
            stale = await alert_rows(db, "controller-status-stale")
            assert stale[0]["condition_state"] == "resolved"

            async with db.sessions.begin() as session:
                await session.scalar(
                    select(farms.c.id)
                    .where(farms.c.id == db.farm_id)
                    .with_for_update()
                )
                await session.execute(
                    update(climate_tests)
                    .where(
                        climate_tests.c.farm_id == db.farm_id,
                        climate_tests.c.incubator_id == "chamber-1",
                    )
                    .values(request={"id": "command-1", "status": "rejected"})
                )
                await evaluate_farm(
                    session, db.farm_id, now=fresh_at + timedelta(seconds=1), farm_locked=True
                )
            command = await alert_rows(db, "controller-command")
            assert len(command) == 1 and command[0]["condition_state"] == "active"
            command_id = command[0]["public_id"]

            async with db.sessions.begin() as session:
                await session.scalar(
                    select(farms.c.id)
                    .where(farms.c.id == db.farm_id)
                    .with_for_update()
                )
                await session.execute(
                    update(climate_tests)
                    .where(
                        climate_tests.c.farm_id == db.farm_id,
                        climate_tests.c.incubator_id == "chamber-1",
                    )
                    .values(
                        request={"id": "command-1", "status": "timed_out"},
                        tray={
                            "request": {"id": "tray-1", "status": "interrupted"},
                            "home_status": "moving_home",
                            "home_confirmed": False,
                        },
                    )
                )
                await evaluate_farm(
                    session, db.farm_id, now=fresh_at + timedelta(seconds=2), farm_locked=True
                )
            command = await alert_rows(db, "controller-command")
            assert len(command) == 1 and command[0]["public_id"] == command_id
            tray_command = await alert_rows(db, "controller-tray-command")
            assert len(tray_command) == 1
            tray_level = await alert_rows(db, "controller-tray-level")
            assert len(tray_level) == 1
            assert tray_command[0]["condition_state"] == "active"
            assert tray_level[0]["condition_state"] == "active"

            await evaluate_at(db, fresh_at + timedelta(seconds=3))
            assert len(await alert_rows(db, "controller-command")) == 1
            assert len(await alert_rows(db, "controller-tray-command")) == 1
            assert len(await alert_rows(db, "controller-tray-level")) == 1
        finally:
            await db.close()

    asyncio.run(run())


def test_controller_fault_report_and_alert_persist_atomically_and_by_owner(settings):
    async def run():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        other = PostgresStore(settings.database_url, str(uuid4()))
        try:
            await other.seed()
            owner_device = await device_for(db)
            foreign_device = await device_for(other)
            at = datetime.now(UTC)

            # The report and its resulting notification share one transaction.
            with pytest.raises(RuntimeError, match="rollback controller report"):
                async with db.sessions.begin() as session:
                    await session.scalar(
                        select(farms.c.id)
                        .where(farms.c.id == db.farm_id)
                        .with_for_update()
                    )
                    await record_report(
                        session,
                        db.farm_id,
                        "chamber-1",
                        owner_device,
                        "atomic-controller-boot",
                        at - timedelta(minutes=5),
                        1,
                        make_report(fault=1),
                        at,
                        observed_at=at,
                    )
                    await evaluate_farm(
                        session, db.farm_id, now=at, farm_locked=True
                    )
                    raise RuntimeError("rollback controller report")

            assert await alert_rows(db, "controller-fault-1") == []
            async with db.sessions() as session:
                report_row = await session.scalar(
                    select(climate_tests.c.incubator_id).where(
                        climate_tests.c.farm_id == db.farm_id,
                        climate_tests.c.incubator_id == "chamber-1",
                    )
                )
                history_count = await session.scalar(
                    select(climate_report_history.c.seq).where(
                        climate_report_history.c.farm_id == db.farm_id,
                        climate_report_history.c.incubator_id == "chamber-1",
                    )
                )
            assert report_row is None
            assert history_count is None

            # A fault report from another farm's device cannot claim this chamber.
            await record_and_evaluate(
                db,
                foreign_device,
                make_report(fault=1),
                at,
            )
            assert await alert_rows(db, "controller-fault-1") == []

            assert await record_and_evaluate(
                db,
                owner_device,
                make_report(fault=1),
                at + timedelta(seconds=1),
            )
            owned = await alert_rows(db, "controller-fault-1")
            assert len(owned) == 1
            assert owned[0]["farm_id"] == db.farm_id
            assert owned[0]["device_id"] == owner_device

            await evaluate_at(other, at + timedelta(seconds=2))
            assert await alert_rows(other, "controller-fault-1") == []
        finally:
            await db.close()
            await other.close()

    asyncio.run(run())
