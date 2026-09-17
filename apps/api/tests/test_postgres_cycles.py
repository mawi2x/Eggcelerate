"""Cycle lifecycle persistence and competing terminal outcomes."""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from threading import Barrier
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, insert, select, update
from sqlalchemy.exc import IntegrityError

from eggcelerate_api.database.schema import cycle_history, cycles, incubator_runtime
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.main import create_app

from .conftest import seed

BASE = "/api/v1/incubators/chamber-9"
START = {"mode_id": "quail", "total_eggs": 20}


def test_start_stop_reset_complete_and_old_replay_survive_restart(settings):
    with TestClient(create_app(settings)) as client:
        started = client.post(
            BASE + "/cycles", json=START, headers={"Idempotency-Key": "start"}
        )
        assert started.status_code == 200
        started_unit = started.json()["data"]
    seed(settings)
    with TestClient(create_app(settings)) as client:
        unit = client.get(BASE).json()["data"]
        for key in (
            "day_of_incubation",
            "total_eggs_loaded",
            "fertile_eggs",
            "cycle_phase",
            "last_turned_at",
            "next_turn_at",
        ):
            assert unit[key] == started_unit[key]
        assert unit["candling_entries"] == []
        stopped = client.post(
            BASE + "/cycles/current/stop", headers={"Idempotency-Key": "stop"}
        )
        assert stopped.status_code == 200
        assert (
            client.post(
                BASE + "/cycles/current/complete", json={"hatched_eggs": 10}
            ).status_code
            == 409
        )
        assert client.post(BASE + "/cycles/current/stop").status_code == 409
        client.patch(BASE, json={"name": "Stopped chamber"})
        client.patch(BASE, json={"auto_turn": False})
        assert client.get(BASE).json()["data"]["cycle_phase"] == "stopped_early"
    seed(settings)
    with TestClient(create_app(settings)) as client:
        assert client.get(BASE).json()["data"]["cycle_phase"] == "stopped_early"
        assert (
            stopped.json()["data"]
            in client.get("/api/v1/cycles?status=stopped_early").json()["data"]
        )
        reset = client.post(
            BASE + "/cycles/current/reset", headers={"Idempotency-Key": "reset"}
        )
        assert reset.json()["data"]["cycle_phase"] == "ready"
    with TestClient(create_app(settings)) as client:
        assert client.get(BASE).json()["data"]["day_of_incubation"] == 0
        assert client.post(BASE + "/cycles", json=START).status_code == 200
        completed = client.post(
            BASE + "/cycles/current/complete",
            json={"hatched_eggs": 12},
            headers={"Idempotency-Key": "complete"},
        )
        assert completed.status_code == 200
        assert (
            completed.json()["data"]["cycle_id"] != stopped.json()["data"]["cycle_id"]
        )
    seed(settings)
    with TestClient(create_app(settings)) as client:
        assert client.get(BASE).json()["data"]["day_of_incubation"] == 0
        assert (
            completed.json()["data"]
            in client.get("/api/v1/cycles?status=completed").json()["data"]
        )
        for suffix, body, key, expected in [
            ("/cycles", START, "start", started),
            ("/cycles/current/stop", {}, "stop", stopped),
            ("/cycles/current/reset", {}, "reset", reset),
            ("/cycles/current/complete", {"hatched_eggs": 12}, "complete", completed),
        ]:
            assert (
                client.post(
                    BASE + suffix, json=body, headers={"Idempotency-Key": key}
                ).json()
                == expected.json()
            )
        assert client.get(BASE).json()["data"]["day_of_incubation"] == 0
        assert (
            client.post(
                BASE + "/cycles/current/complete",
                json={"hatched_eggs": 11},
                headers={"Idempotency-Key": "complete"},
            ).status_code
            == 409
        )


@pytest.mark.parametrize("same_key", [False, True])
def test_separate_instances_allow_only_one_terminal_outcome(settings, same_key):
    barrier = Barrier(2)
    apps = [create_app(settings), create_app(settings)]

    def terminate(index):
        with TestClient(apps[index]) as client:
            barrier.wait(timeout=5)
            action = "complete" if same_key or index == 0 else "stop"
            return client.post(
                BASE + f"/cycles/current/{action}",
                json={"hatched_eggs": 10} if action == "complete" else {},
                headers={"Idempotency-Key": "same" if same_key else str(index)},
            )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(terminate, range(2)))
    assert sorted(r.status_code for r in results) == (
        [200, 200] if same_key else [200, 409]
    )
    if same_key:
        assert results[0].json() == results[1].json()

    async def verify():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with db.sessions() as session:
                rows = (
                    await session.execute(
                        select(cycle_history).where(
                            cycle_history.c.farm_id == db.farm_id,
                            cycle_history.c.incubator_id == "chamber-9",
                        )
                    )
                ).all()
                assert len(rows) == 1
        finally:
            await db.close()

    asyncio.run(verify())


@pytest.mark.parametrize("target", ["cycle_history", "cycle_idempotency"])
def test_failure_after_runtime_change_rolls_back_all_state(settings, target):
    app = create_app(settings)

    def fail(_conn, _cursor, statement, _parameters, _context, _many):
        if statement.startswith(f"INSERT INTO {target}"):
            raise RuntimeError("Injected partial terminal write failure")

    with TestClient(app, raise_server_exceptions=False) as client:
        before = client.get(BASE).json()["data"]
        before_cycles = dict(app.state.store.cycles)
        engine = app.state.database.engine.sync_engine
        event.listen(engine, "before_cursor_execute", fail)
        try:
            assert (
                client.post(
                    BASE + "/cycles/current/complete",
                    json={"hatched_eggs": 10},
                    headers={"Idempotency-Key": "retry"},
                ).status_code
                == 500
            )
        finally:
            event.remove(engine, "before_cursor_execute", fail)
        assert app.state.store.cycles == before_cycles
        assert (
            client.get(BASE).json()["data"]["total_eggs_loaded"]
            == before["total_eggs_loaded"]
        )
        assert (
            client.post(
                BASE + "/cycles/current/complete",
                json={"hatched_eggs": 10},
                headers={"Idempotency-Key": "retry"},
            ).status_code
            == 200
        )


def test_farm_isolation_and_database_constraints(settings):
    other = replace(settings, default_farm_id=str(uuid4()))
    seed(other)
    with TestClient(create_app(settings)) as client:
        completed = client.post(
            BASE + "/cycles/current/complete", json={"hatched_eggs": 10}
        ).json()["data"]
    with TestClient(create_app(other)) as client:
        assert (
            completed
            not in client.get("/api/v1/cycles?status=completed").json()["data"]
        )
        assert client.get(BASE).json()["data"]["day_of_incubation"] > 0

    async def verify():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            with pytest.raises(IntegrityError):
                async with db.sessions.begin() as session:
                    await session.execute(
                        insert(cycles).values(
                            farm_id=db.farm_id,
                            id="duplicate-active",
                            incubator_id="chamber-1",
                            status="active",
                            started_on="2026-09-13",
                        )
                    )
            with pytest.raises(IntegrityError):
                async with db.sessions.begin() as session:
                    await session.execute(
                        update(incubator_runtime)
                        .where(
                            incubator_runtime.c.farm_id == db.farm_id,
                            incubator_runtime.c.incubator_id == "chamber-1",
                        )
                        .values(cycle_id=completed["cycle_id"])
                    )
            with pytest.raises(IntegrityError):
                async with db.sessions.begin() as session:
                    row = (
                        (
                            await session.execute(
                                select(cycle_history).where(
                                    cycle_history.c.farm_id == db.farm_id,
                                    cycle_history.c.cycle_id == completed["cycle_id"],
                                )
                            )
                        )
                        .mappings()
                        .one()
                    )
                    await session.execute(
                        insert(cycle_history).values(
                            **{**dict(row), "public_id": "another-outcome"}
                        )
                    )
        finally:
            await db.close()

    asyncio.run(verify())


def test_populated_0004_upgrade_and_downgrade_preserve_prior_slices(database_url):
    from pathlib import Path

    from alembic import command
    from alembic.config import Config
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import AsyncSession

    from eggcelerate_api.database.alerts import seed_alerts
    from eggcelerate_api.database.cycles import seed_cycles
    from eggcelerate_api.database.incubators import seed_incubators
    from eggcelerate_api.database.preferences import preference_values
    from eggcelerate_api.database.schema import (
        alert_idempotency,
        alerts,
        devices,
        farm_preferences,
        farms,
        incubators,
        modes,
    )
    from eggcelerate_api.database.store import mode_values
    from eggcelerate_api.store import MemoryStore

    async def verify():
        db = PostgresStore(database_url, str(uuid4()))
        schema = "b3_cycle_upgrade_" + uuid4().hex
        try:
            async with db.engine.begin() as conn:
                await conn.execute(text(f'CREATE SCHEMA "{schema}"'))
                await conn.execute(text(f'SET LOCAL search_path TO "{schema}"'))

                def migrate(sync_conn, revision, downgrade=False):
                    config = Config(
                        str(Path(__file__).resolve().parents[1] / "alembic.ini")
                    )
                    config.attributes["connection"] = sync_conn
                    config.attributes["version_table_schema"] = schema
                    (command.downgrade if downgrade else command.upgrade)(
                        config, revision
                    )

                await conn.run_sync(migrate, "0004")
                state = MemoryStore()
                await conn.execute(
                    insert(farms).values(id=db.farm_id, name="Preserved farm")
                )
                for position, mode in enumerate(state.modes.values()):
                    await conn.execute(
                        insert(modes).values(**mode_values(db.farm_id, mode, position))
                    )
                async with AsyncSession(bind=conn) as session:
                    await seed_incubators(session, db.farm_id, state)
                    await seed_alerts(session, db.farm_id, state)
                    await session.commit()
                await conn.execute(
                    insert(farm_preferences).values(
                        **preference_values(
                            db.farm_id,
                            state.preferences.model_copy(
                                update={"farm_name": "Preserve me"}
                            ),
                        )
                    )
                )
                await conn.execute(update(alerts).values(dismissed=True))
                await conn.execute(
                    insert(alert_idempotency).values(
                        farm_id=db.farm_id,
                        scope="alert-dismiss-a1",
                        key="keep",
                        fingerprint="keep",
                        response={"id": "a1"},
                    )
                )
                tables = [
                    farms,
                    modes,
                    devices,
                    incubators,
                    alerts,
                    farm_preferences,
                    alert_idempotency,
                ]
                snapshots = {
                    t.name: (await conn.execute(select(t))).all() for t in tables
                }
                await conn.run_sync(migrate, "0005")
                async with AsyncSession(bind=conn) as session:
                    await seed_cycles(session, db.farm_id, state)
                    await seed_cycles(session, db.farm_id, state)
                    await session.commit()
                assert len((await conn.execute(select(incubator_runtime))).all()) == 12
                assert len((await conn.execute(select(cycle_history))).all()) == 2
                from eggcelerate_api.database.candling import seed_candling
                from eggcelerate_api.database.schema import candling_entries

                cycle_tables = [cycles, cycle_history, incubator_runtime]
                cycle_snapshots = {
                    t.name: (await conn.execute(select(t))).all() for t in cycle_tables
                }
                await conn.run_sync(migrate, "0006")
                async with AsyncSession(bind=conn) as session:
                    await seed_candling(session, db.farm_id, state)
                    await seed_candling(session, db.farm_id, state)
                    await session.commit()
                assert len((await conn.execute(select(candling_entries))).all()) == 3
                journal_snapshot = (await conn.execute(select(candling_entries))).all()
                await conn.execute(text(f'SET LOCAL search_path TO "{schema}", public'))
                await conn.run_sync(migrate, "0007")
                assert (
                    await conn.scalar(text("SELECT count(*) FROM telemetry_samples"))
                    == 0
                )
                await conn.run_sync(migrate, "0006", True)
                assert (
                    await conn.execute(select(candling_entries))
                ).all() == journal_snapshot
                await conn.execute(text(f'SET LOCAL search_path TO "{schema}"'))
                await conn.run_sync(migrate, "0005", True)
                for table in cycle_tables:
                    assert (await conn.execute(select(table))).all() == cycle_snapshots[
                        table.name
                    ]
                await conn.run_sync(migrate, "0004", True)
                for table in tables:
                    assert (await conn.execute(select(table))).all() == snapshots[
                        table.name
                    ]
                await conn.run_sync(migrate, "0005")
                await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        finally:
            await db.close()

    asyncio.run(verify())
