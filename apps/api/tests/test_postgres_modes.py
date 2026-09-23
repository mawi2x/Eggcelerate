"""Opt-in integration proof against the disposable database, never development.

TEST_DATABASE_URL must name eggcelerate_test. Each test uses an isolated farm.
"""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, text

from eggcelerate_api.config import Settings
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.main import create_app

from .conftest import seed

MODE = {
    "id": "persistent-mode",
    "name": "Persistent mode",
    "target_temp_c": {"min": 37, "max": 38},
    "target_humidity_pct": {"min": 50, "max": 60},
    "incubation_days": 21,
    "default_turn_interval_min": 240,
}


@pytest.mark.parametrize("backend", ["memory", "postgres"])
def test_modes_observable_contract(settings, backend):
    selected = Settings(app_env="test") if backend == "memory" else settings
    with TestClient(create_app(selected)) as client:
        assert len(client.get("/api/v1/modes").json()["data"]) == 10
        assert client.post("/api/v1/modes", json=MODE).status_code == 201
        assert client.post("/api/v1/modes", json=MODE).status_code == 409
        response = client.patch(
            "/api/v1/modes/persistent-mode", json={"incubation_days": 22}
        )
        assert response.json()["data"]["incubation_days"] == 22
        assert (
            client.patch(
                "/api/v1/modes/persistent-mode", json={"incubation_days": 46}
            ).status_code
            == 422
        )
        assert client.delete("/api/v1/modes/broiler").status_code == 409
        assert client.delete("/api/v1/modes/persistent-mode").json()["data"] == {
            "id": "persistent-mode"
        }
        assert client.get("/api/v1/modes/persistent-mode").status_code == 404


def test_seed_preserves_edits_and_does_not_duplicate(settings):
    with TestClient(create_app(settings)) as client:
        assert (
            client.patch("/api/v1/modes/broiler", json={"name": "Edited"}).status_code
            == 200
        )
    seed(settings)
    seed(settings)
    with TestClient(create_app(settings)) as client:
        assert len(client.get("/api/v1/modes").json()["data"]) == 10
        assert client.get("/api/v1/modes/broiler").json()["data"]["name"] == "Edited"
        assert client.get("/readyz").json()["checks"]["store"] == "postgres_incubators"


def test_restart_preserves_create_update_delete_and_replay(settings):
    headers = {"Idempotency-Key": "durable-create"}
    with TestClient(create_app(settings)) as client:
        first = client.post("/api/v1/modes", json=MODE, headers=headers)
        assert first.status_code == 201
        assert (
            client.patch(
                "/api/v1/modes/persistent-mode", json={"name": "Saved"}
            ).status_code
            == 200
        )
        assert (
            client.post("/api/v1/modes", json={**MODE, "id": "deleted"}).status_code
            == 201
        )
        assert client.delete("/api/v1/modes/deleted").status_code == 200
    with TestClient(create_app(settings)) as client:
        assert (
            client.get("/api/v1/modes/persistent-mode").json()["data"]["name"]
            == "Saved"
        )
        assert client.get("/api/v1/modes/deleted").status_code == 404
        # Replay the original result without overwriting the later edit.
        assert (
            client.post("/api/v1/modes", json=MODE, headers=headers).json()
            == first.json()
        )
        assert (
            client.get("/api/v1/modes/persistent-mode").json()["data"]["name"]
            == "Saved"
        )
        changed = client.post(
            "/api/v1/modes", json={**MODE, "name": "Different"}, headers=headers
        )
        assert changed.status_code == 409


def test_farms_do_not_share_modes_or_replay_keys(settings):
    other = Settings(
        app_env="test",
        storage_backend="postgres_modes",
        database_url=settings.database_url,
        default_farm_id=str(uuid4()),
    )
    seed(other)
    for selected, name in [(settings, "Farm A"), (other, "Farm B")]:
        with TestClient(create_app(selected)) as client:
            response = client.post(
                "/api/v1/modes",
                json={**MODE, "name": name},
                headers={"Idempotency-Key": "same-key"},
            )
            assert response.status_code == 201
            assert response.json()["data"]["name"] == name


def test_failed_receipt_insert_rolls_back_mode_and_memory(settings):
    app = create_app(settings)
    database = app.state.database

    def fail_receipt(_conn, _cursor, statement, _parameters, _context, _many):
        if statement.startswith("INSERT INTO mode_idempotency"):
            raise RuntimeError("Injected after mode insert, before transaction commit")

    with TestClient(app, raise_server_exceptions=False) as client:
        event.listen(database.engine.sync_engine, "before_cursor_execute", fail_receipt)
        response = client.post(
            "/api/v1/modes", json=MODE, headers={"Idempotency-Key": "rollback"}
        )
        event.remove(database.engine.sync_engine, "before_cursor_execute", fail_receipt)
        assert response.status_code == 500
        assert "persistent-mode" not in app.state.store.modes
        assert client.get("/api/v1/modes/persistent-mode").status_code == 404
        assert (
            client.post(
                "/api/v1/modes", json=MODE, headers={"Idempotency-Key": "rollback"}
            ).status_code
            == 201
        )


def test_concurrent_separate_api_instances_replay_once(settings):
    barrier = Barrier(2)

    def create():
        with TestClient(create_app(settings)) as client:
            barrier.wait(timeout=10)
            return client.post(
                "/api/v1/modes", json=MODE, headers={"Idempotency-Key": "concurrent"}
            )

    with ThreadPoolExecutor(max_workers=2) as executor:
        first, second = list(executor.map(lambda _: create(), range(2)))
    assert first.status_code == second.status_code == 201
    assert first.json() == second.json()
    with TestClient(create_app(settings)) as client:
        assert len(client.get("/api/v1/modes").json()["data"]) == 11


def test_unseeded_farm_fails_closed(database_url):
    settings = Settings(
        app_env="test",
        storage_backend="postgres_modes",
        database_url=database_url,
        default_farm_id=str(uuid4()),
    )
    with TestClient(create_app(settings)) as client:
        assert client.get("/healthz").status_code == 200
        assert client.get("/readyz").status_code == 503
        assert client.get("/api/v1/modes").status_code == 503


def test_unavailable_database_fails_closed():
    settings = Settings(
        app_env="test",
        storage_backend="postgres_modes",
        database_url="postgresql+asyncpg://unused:unused@127.0.0.1:1/eggcelerate_test",
    )
    with TestClient(create_app(settings)) as client:
        assert client.get("/healthz").status_code == 200
        assert client.get("/readyz").status_code == 503
        response = client.post("/api/v1/modes", json=MODE)
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "offline"
        for method, path in (
            ("GET", "/api/v1/incubators/chamber-1/readings"),
            ("POST", "/api/v1/incubators/chamber-1/commands/turn"),
            ("DELETE", "/api/v1/modes/custom-mode"),
        ):
            response = client.request(
                method, path, headers={"Idempotency-Key": "outage"}
            )
            assert response.status_code == 503
            assert response.json()["error"]["code"] == "offline"


def test_patch_replay_survives_restart_without_reapplying(settings):
    headers = {"Idempotency-Key": "durable-patch"}
    with TestClient(create_app(settings)) as client:
        original = client.patch(
            "/api/v1/modes/broiler", json={"name": "First"}, headers=headers
        )
        assert original.status_code == 200
        assert (
            client.patch("/api/v1/modes/broiler", json={"name": "Second"}).status_code
            == 200
        )
    with TestClient(create_app(settings)) as client:
        replay = client.patch(
            "/api/v1/modes/broiler", json={"name": "First"}, headers=headers
        )
        assert replay.json() == original.json()
        assert client.get("/api/v1/modes/broiler").json()["data"]["name"] == "Second"
        assert (
            client.patch(
                "/api/v1/modes/broiler", json={"name": "Changed"}, headers=headers
            ).status_code
            == 409
        )


def test_restart_uses_persisted_mode_for_chamber_projection(settings):
    with TestClient(create_app(settings)) as client:
        assert (
            client.patch(
                "/api/v1/modes/broiler", json={"incubation_days": 7}
            ).status_code
            == 200
        )
        before = client.get("/api/v1/incubators/chamber-1").json()["data"]
    with TestClient(create_app(settings)) as client:
        after = client.get("/api/v1/incubators/chamber-1").json()["data"]
        assert before["cycle_phase"] == after["cycle_phase"] == "awaiting_finish"


def test_migration_has_extension_and_relational_tables(settings):
    async def run():
        database = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with database.sessions() as session:
                assert (
                    await session.scalar(
                        text("SELECT version_num FROM alembic_version")
                    )
                    == "0009"
                )
                assert await session.scalar(
                    text(
                        "SELECT extversion FROM pg_extension WHERE extname='timescaledb'"
                    )
                )
                assert (
                    await session.scalar(
                        text(
                            "SELECT count(*) FROM timescaledb_information.hypertables "
                            "WHERE hypertable_schema = 'public' AND hypertable_name = 'telemetry_samples'"
                        )
                    )
                    == 1
                )
                for table in ("farms", "modes", "mode_idempotency"):
                    assert await session.scalar(
                        text("SELECT to_regclass(:table)"), {"table": table}
                    )
        finally:
            await database.close()

    asyncio.run(run())
