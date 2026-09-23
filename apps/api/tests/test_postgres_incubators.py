"""B3 chamber/device persistence and populated migration proof."""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier
from uuid import UUID, uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import event, insert, select, text, update
from sqlalchemy.exc import IntegrityError

from eggcelerate_api.config import Settings
from eggcelerate_api.database.schema import (
    devices,
    farms,
    incubators,
    mode_idempotency,
    modes,
)
from eggcelerate_api.database.store import PostgresStore, mode_values
from eggcelerate_api.main import create_app
from eggcelerate_api.store import MemoryStore

from .conftest import seed
from .test_postgres_modes import MODE

CHAMBER = {"name": "Durable chamber", "device_id": "EGG-9001", "mode_id": "broiler"}


def seeded_chamber_count() -> int:
    return len(MemoryStore().incubators)


def test_chamber_configuration_pairing_and_replay_survive_restart(settings):
    headers = {"Idempotency-Key": "create-chamber"}
    with TestClient(create_app(settings)) as client:
        first = client.post("/api/v1/incubators", json=CHAMBER, headers=headers)
        assert first.status_code == 201
        chamber_id = first.json()["data"]["id"]
        path = f"/api/v1/incubators/{chamber_id}"
        assert client.post("/api/v1/modes", json=MODE).status_code == 201
        assert (
            client.patch(
                path,
                json={"name": "Saved profile"},
                headers={"Idempotency-Key": "profile"},
            ).status_code
            == 200
        )
        config = {"mode_id": MODE["id"], "auto_turn": False, "turn_interval_min": 360}
        configured = client.patch(
            path, json=config, headers={"Idempotency-Key": "config"}
        )
        assert configured.status_code == 200
        assert (
            client.post(
                "/api/v1/incubators/chamber-2/reconnect",
                json={},
                headers={"Idempotency-Key": "reconnect"},
            ).status_code
            == 200
        )
    seed(settings)
    with TestClient(create_app(settings)) as client:
        unit = client.get(path).json()["data"]
        assert (
            unit["name"],
            unit["mode_id"],
            unit["auto_turn"],
            unit["turn_interval_min"],
        ) == ("Saved profile", MODE["id"], False, 360)
        assert (
            client.get("/api/v1/incubators/chamber-2").json()["data"]["paired"] is True
        )
        assert len(client.get("/api/v1/incubators").json()["data"]) == (
            seeded_chamber_count() + 1
        )
        assert (
            client.post("/api/v1/incubators", json=CHAMBER, headers=headers).json()
            == first.json()
        )
        assert (
            client.patch(
                path, json=config, headers={"Idempotency-Key": "config"}
            ).json()
            == configured.json()
        )
        assert (
            client.patch(
                path, json={"name": "Changed"}, headers={"Idempotency-Key": "profile"}
            ).status_code
            == 409
        )
        assert (
            client.post(
                "/api/v1/incubators",
                json={**CHAMBER, "name": "Changed"},
                headers=headers,
            ).status_code
            == 409
        )
        assert client.delete(f"/api/v1/modes/{MODE['id']}").status_code == 409


def test_assignment_can_change_then_old_mode_can_be_deleted_after_restart(settings):
    with TestClient(create_app(settings)) as client:
        assert client.post("/api/v1/modes", json=MODE).status_code == 201
        created = client.post(
            "/api/v1/incubators", json={**CHAMBER, "mode_id": MODE["id"]}
        ).json()["data"]
        assert (
            client.patch(
                f"/api/v1/incubators/{created['id']}", json={"mode_id": "duck"}
            ).status_code
            == 200
        )
    with TestClient(create_app(settings)) as client:
        assert client.delete(f"/api/v1/modes/{MODE['id']}").status_code == 200
        assert (
            client.get(f"/api/v1/incubators/{created['id']}").json()["data"]["mode_id"]
            == "duck"
        )


@pytest.mark.parametrize("same_key", [False, True])
def test_separate_instances_cannot_double_assign_device(settings, same_key):
    barrier = Barrier(2)

    def create(index):
        with TestClient(create_app(settings)) as client:
            barrier.wait(timeout=10)
            return client.post(
                "/api/v1/incubators",
                json=CHAMBER,
                headers={"Idempotency-Key": "shared" if same_key else str(index)},
            )

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(create, range(2)))
    assert sorted(r.status_code for r in results) == (
        [201, 201] if same_key else [201, 409]
    )
    if same_key:
        assert results[0].json() == results[1].json()
    with TestClient(create_app(settings)) as client:
        assert len(client.get("/api/v1/incubators").json()["data"]) == (
            seeded_chamber_count() + 1
        )
        assert (
            client.post(
                "/api/v1/incubators", json={**CHAMBER, "device_id": "egg-9001"}
            ).status_code
            == 409
        )


def test_failed_replay_insert_rolls_back_device_chamber_and_memory(settings):
    app = create_app(settings)

    def fail_receipt(_conn, _cursor, statement, _parameters, _context, _many):
        if statement.startswith("INSERT INTO incubator_idempotency"):
            raise RuntimeError("Injected after chamber/device insertion")

    with TestClient(app, raise_server_exceptions=False) as client:
        event.listen(
            app.state.database.engine.sync_engine, "before_cursor_execute", fail_receipt
        )
        result = client.post(
            "/api/v1/incubators", json=CHAMBER, headers={"Idempotency-Key": "rollback"}
        )
        event.remove(
            app.state.database.engine.sync_engine, "before_cursor_execute", fail_receipt
        )
        assert result.status_code == 500
        assert len(app.state.store.incubators) == 12
        assert len(client.get("/api/v1/incubators").json()["data"]) == 12
        # Same device and key can be used after rollback, including the device row.
        assert (
            client.post(
                "/api/v1/incubators",
                json=CHAMBER,
                headers={"Idempotency-Key": "rollback"},
            ).status_code
            == 201
        )


def test_farm_isolation_and_database_foreign_keys(settings):
    other = Settings(
        app_env="test",
        storage_backend="postgres_incubators",
        database_url=settings.database_url,
        default_farm_id=str(uuid4()),
    )
    seed(other)
    with TestClient(create_app(settings)) as client:
        created = client.post("/api/v1/incubators", json=CHAMBER).json()["data"]
    with TestClient(create_app(other)) as client:
        assert client.get(f"/api/v1/incubators/{created['id']}").status_code == 404
        assert client.post("/api/v1/incubators", json=CHAMBER).status_code == 201

    async def verify():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            for parent, column in [(modes, "mode_id"), (devices, "device_id")]:
                async with db.sessions() as session:
                    foreign_id = await session.scalar(
                        select(parent.c.id)
                        .where(parent.c.farm_id == UUID(other.default_farm_id))
                        .limit(1)
                    )
                with pytest.raises(IntegrityError):
                    async with db.sessions.begin() as session:
                        await session.execute(
                            update(incubators)
                            .where(incubators.c.farm_id == db.farm_id)
                            .values(**{column: foreign_id})
                        )
        finally:
            await db.close()

    asyncio.run(verify())


def test_populated_0001_upgrade_preserves_modes_and_receipts(database_url):
    async def verify():
        db = PostgresStore(database_url, str(uuid4()))
        schema = "b3_upgrade_" + uuid4().hex
        try:
            async with db.engine.begin() as conn:
                await conn.execute(text(f'CREATE SCHEMA "{schema}"'))
                await conn.execute(text(f'SET LOCAL search_path TO "{schema}"'))

                def migrate(sync_conn, revision):
                    config = Config(
                        str(Path(__file__).resolve().parents[1] / "alembic.ini")
                    )
                    config.attributes["connection"] = sync_conn
                    config.attributes["version_table_schema"] = schema
                    command.upgrade(config, revision)

                await conn.run_sync(migrate, "0001")
                await conn.execute(
                    insert(farms).values(id=db.farm_id, name="Upgrade farm")
                )
                mode = (
                    MemoryStore()
                    .modes["broiler"]
                    .model_copy(update={"name": "Preserve this edit"})
                )
                await conn.execute(
                    insert(modes).values(**mode_values(db.farm_id, mode, 0))
                )
                await conn.execute(
                    insert(mode_idempotency).values(
                        farm_id=db.farm_id,
                        scope="create-mode",
                        key="keep",
                        fingerprint="keep",
                        response=mode.model_dump(mode="json"),
                    )
                )
                await conn.run_sync(migrate, "0002")
                assert await conn.scalar(select(modes.c.name)) == "Preserve this edit"
                assert (await conn.scalar(select(mode_idempotency.c.response)))[
                    "name"
                ] == "Preserve this edit"
                assert (
                    await conn.scalar(text("SELECT version_num FROM alembic_version"))
                    == "0002"
                )
                await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        finally:
            await db.close()

    asyncio.run(verify())
