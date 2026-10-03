"""Alert persistence, tombstones, action replay and atomic bulk updates."""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from threading import Barrier
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event

from eggcelerate_api.main import create_app

from .conftest import seed

PATH = "/api/v1/alerts"


def test_alert_actions_restart_seed_and_old_replay(settings):
    with TestClient(create_app(settings)) as client:
        original = client.get(PATH).json()["data"]
        unread = [a for a in original if a["acknowledged_at"] is None]
        alert_id = unread[0]["id"]
        other_id = unread[1]["id"]
        ack_path = f"{PATH}/{alert_id}/acknowledge"
        acknowledged = client.post(ack_path, headers={"Idempotency-Key": "ack"})
        assert acknowledged.status_code == 200
        assert acknowledged.json()["data"]["acknowledged_at"] is not None
        dismissed = client.delete(
            f"{PATH}/{other_id}", headers={"Idempotency-Key": "dismiss"}
        )
        assert dismissed.status_code == 200
        all_read = client.post(
            f"{PATH}/actions/acknowledge-all", headers={"Idempotency-Key": "all"}
        )
        assert all_read.status_code == 200
        assert all(a["acknowledged_at"] for a in all_read.json()["data"])
        cleared = client.post(
            f"{PATH}/actions/clear-acknowledged", headers={"Idempotency-Key": "clear"}
        )
        assert cleared.json()["data"] == []
    seed(settings)
    with TestClient(create_app(settings)) as client:
        assert client.get("/readyz").status_code == 200
        assert client.get(PATH).json()["data"] == []
        assert (
            client.post(ack_path, headers={"Idempotency-Key": "ack"}).json()
            == acknowledged.json()
        )
        assert (
            client.delete(
                f"{PATH}/{other_id}", headers={"Idempotency-Key": "dismiss"}
            ).json()
            == dismissed.json()
        )
        assert (
            client.post(
                f"{PATH}/actions/acknowledge-all", headers={"Idempotency-Key": "all"}
            ).json()
            == all_read.json()
        )
        assert (
            client.post(
                f"{PATH}/actions/clear-acknowledged",
                headers={"Idempotency-Key": "clear"},
            ).json()
            == cleared.json()
        )
        assert client.get(PATH).json()["data"] == []
        assert client.delete(f"{PATH}/{other_id}").status_code == 404


@pytest.mark.parametrize("action", ["acknowledge-all", "clear-acknowledged"])
def test_bulk_failure_rolls_back_alerts_and_receipt(settings, action):
    app = create_app(settings)

    def fail_receipt(_conn, _cursor, statement, _parameters, _context, _many):
        if statement.startswith("INSERT INTO alert_idempotency"):
            raise RuntimeError("Injected receipt failure after alert writes")

    with TestClient(app, raise_server_exceptions=False) as client:
        if action == "clear-acknowledged":
            assert client.post(f"{PATH}/actions/acknowledge-all").status_code == 200
        before = client.get(PATH).json()
        memory_before = [
            a.model_dump(mode="json") for a in app.state.store.alerts.values()
        ]
        engine = app.state.database.engine.sync_engine
        event.listen(engine, "before_cursor_execute", fail_receipt)
        try:
            assert (
                client.post(
                    f"{PATH}/actions/{action}", headers={"Idempotency-Key": "rollback"}
                ).status_code
                == 500
            )
        finally:
            event.remove(engine, "before_cursor_execute", fail_receipt)
        assert [
            a.model_dump(mode="json") for a in app.state.store.alerts.values()
        ] == memory_before
        assert client.get(PATH).json() == before
        assert (
            client.post(
                f"{PATH}/actions/{action}", headers={"Idempotency-Key": "rollback"}
            ).status_code
            == 200
        )


def test_farm_isolation_and_concurrent_dismiss_replay(settings):
    other = replace(settings, default_farm_id=str(uuid4()))
    seed(other)
    with TestClient(create_app(settings)) as client:
        alert_id = client.get(PATH).json()["data"][0]["id"]
    barrier = Barrier(2)
    # Race requests across initialized apps, not shared router construction.
    clients = [TestClient(create_app(settings)) for _ in range(2)]

    def dismiss(client):
        with client:
            barrier.wait(timeout=5)
            return client.delete(
                f"{PATH}/{alert_id}", headers={"Idempotency-Key": "same"}
            )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(dismiss, clients))
    assert [r.status_code for r in results] == [200, 200]
    assert results[0].json() == results[1].json()
    with TestClient(create_app(other)) as client:
        assert any(a["id"] == alert_id for a in client.get(PATH).json()["data"])
        assert (
            client.delete(
                f"{PATH}/{alert_id}", headers={"Idempotency-Key": "same"}
            ).status_code
            == 200
        )


def test_populated_0003_upgrade_downgrade_preserves_preferences(database_url):
    from pathlib import Path

    from alembic import command
    from alembic.config import Config
    from sqlalchemy import insert, select, text

    from eggcelerate_api.database.preferences import preference_values
    from eggcelerate_api.database.schema import (
        farm_preferences,
        farms,
        preferences_idempotency,
    )
    from eggcelerate_api.database.store import PostgresStore
    from eggcelerate_api.store import MemoryStore

    async def verify():
        db = PostgresStore(database_url, str(uuid4()))
        schema = "b3_alert_upgrade_" + uuid4().hex
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

                await conn.run_sync(migrate, "0003")
                await conn.execute(
                    insert(farms).values(id=db.farm_id, name="Preserved farm")
                )
                prefs = MemoryStore().preferences.model_copy(
                    update={"farm_name": "Preserved preference"}
                )
                await conn.execute(
                    insert(farm_preferences).values(
                        **preference_values(db.farm_id, prefs)
                    )
                )
                await conn.execute(
                    insert(preferences_idempotency).values(
                        farm_id=db.farm_id,
                        scope="preferences",
                        key="keep",
                        fingerprint="keep",
                        response=prefs.model_dump(mode="json"),
                    )
                )
                for revision, downgrade in [
                    ("0004", False),
                    ("0003", True),
                    ("0004", False),
                ]:
                    await conn.run_sync(migrate, revision, downgrade)
                    assert (
                        await conn.scalar(select(farm_preferences.c.farm_name))
                        == "Preserved preference"
                    )
                    assert await conn.scalar(
                        select(preferences_idempotency.c.response)
                    ) == prefs.model_dump(mode="json")
                await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        finally:
            await db.close()

    asyncio.run(verify())


def test_acknowledgement_and_clear_preserve_unread_alerts_across_restart(settings):
    with TestClient(create_app(settings)) as client:
        original = client.get(PATH).json()["data"]
        chosen = next(a for a in original if a["acknowledged_at"] is None)
        acknowledged = client.post(f"{PATH}/{chosen['id']}/acknowledge").json()["data"]
        expected = [acknowledged if a["id"] == chosen["id"] else a for a in original]
    seed(settings)
    with TestClient(create_app(settings)) as client:
        assert client.get(PATH).json()["data"] == expected
        remaining = client.post(f"{PATH}/actions/clear-acknowledged").json()["data"]
        assert remaining == [
            a
            for a in original
            if a["acknowledged_at"] is None and a["id"] != chosen["id"]
        ]
        assert remaining
    seed(settings)
    with TestClient(create_app(settings)) as client:
        assert client.get(PATH).json()["data"] == remaining


def test_single_alert_and_bulk_action_have_distinct_replay_scopes():
    from .conftest import make_client

    with make_client() as client:
        state = client.app.state.store
        alert = next(iter(state.alerts.values())).model_copy(update={"id": "all"})
        state.alerts["all"] = alert
        headers = {"Idempotency-Key": "shared"}
        assert (
            client.post(f"{PATH}/all/acknowledge", headers=headers).json()["data"]["id"]
            == "all"
        )
        response = client.post(f"{PATH}/actions/acknowledge-all", headers=headers)
        assert response.status_code == 200
        assert isinstance(response.json()["data"], list)
