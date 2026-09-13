"""Durable preferences, replay ordering, isolation and transactional failures."""

import asyncio
from dataclasses import replace
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, event

from eggcelerate_api.database.schema import farm_preferences
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.main import create_app

from .conftest import seed

PATH = "/api/v1/preferences"


def test_preferences_restart_seed_replay_and_farm_isolation(settings):
    other = replace(settings, default_farm_id=str(uuid4()))
    seed(other)
    headers = {"Idempotency-Key": "save"}
    with TestClient(create_app(settings)) as client:
        original = client.get(PATH).json()["data"]
        first = {
            **original,
            "farm_name": "Saved farm",
            "account_holder": "Keeper",
            "display_name": "Display",
            "temperature_unit": "f",
            "time_zone": "est",
            "notifications": {
                "enabled": {"custom": True, "temperature": False},
                "sms": True,
                "email": False,
                "phone": "+639001234567",
                "email_address": "keeper@example.test",
            },
        }
        assert client.put(PATH, json=first, headers=headers).json()["data"] == first
        latest = {**first, "farm_name": "Later edit"}
        assert client.put(PATH, json=latest).status_code == 200
        assert (
            client.put(PATH, json={**latest, "temperature_unit": "invalid"}).status_code
            == 422
        )
    seed(settings)
    with TestClient(create_app(settings)) as client:
        assert client.get("/readyz").status_code == 200
        assert client.get(PATH).json()["data"] == latest
        assert client.put(PATH, json=first, headers=headers).json()["data"] == first
        # Old replay must not reapply an older preference snapshot.
        assert client.get(PATH).json()["data"] == latest
        assert client.put(PATH, json=latest, headers=headers).status_code == 409
    with TestClient(create_app(other)) as client:
        assert client.get(PATH).json()["data"] == original
        assert client.put(PATH, json=latest, headers=headers).status_code == 200


def test_preferences_receipt_failure_rolls_back_database_and_memory(settings):
    app = create_app(settings)

    def fail_receipt(_conn, _cursor, statement, _parameters, _context, _many):
        if statement.startswith("INSERT INTO preferences_idempotency"):
            raise RuntimeError("Injected receipt failure")

    with TestClient(app, raise_server_exceptions=False) as client:
        original = client.get(PATH).json()["data"]
        changed = {**original, "farm_name": "Must roll back"}
        engine = app.state.database.engine.sync_engine
        event.listen(engine, "before_cursor_execute", fail_receipt)
        try:
            assert (
                client.put(
                    PATH, json=changed, headers={"Idempotency-Key": "rollback"}
                ).status_code
                == 500
            )
        finally:
            event.remove(engine, "before_cursor_execute", fail_receipt)
        assert app.state.store.preferences.model_dump(mode="json") == original
        assert client.get(PATH).json()["data"] == original
        assert (
            client.put(
                PATH, json=changed, headers={"Idempotency-Key": "rollback"}
            ).status_code
            == 200
        )
    with TestClient(create_app(settings)) as client:
        assert client.get(PATH).json()["data"] == changed


def test_unseeded_preferences_fail_closed_and_seed_repairs(settings):
    async def remove():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with db.sessions.begin() as session:
                await session.execute(
                    delete(farm_preferences).where(
                        farm_preferences.c.farm_id == db.farm_id
                    )
                )
        finally:
            await db.close()

    asyncio.run(remove())
    with TestClient(create_app(settings)) as client:
        assert client.get("/readyz").status_code == 503
        assert client.get(PATH).status_code == 503
    seed(settings)
    with TestClient(create_app(settings)) as client:
        assert client.get("/readyz").status_code == 200
        assert client.get(PATH).status_code == 200


def test_populated_0002_upgrade_and_downgrade_preserve_configuration(database_url):
    from pathlib import Path

    from alembic import command
    from alembic.config import Config
    from sqlalchemy import insert, select, text
    from sqlalchemy.ext.asyncio import AsyncSession

    from eggcelerate_api.database.incubators import seed_incubators
    from eggcelerate_api.database.preferences import preference_values
    from eggcelerate_api.database.schema import (
        devices,
        farms,
        incubator_idempotency,
        incubators,
        mode_idempotency,
        modes,
        preferences_idempotency,
    )
    from eggcelerate_api.database.store import mode_values
    from eggcelerate_api.store import MemoryStore

    async def verify():
        db = PostgresStore(database_url, str(uuid4()))
        schema = "b3_preferences_upgrade_" + uuid4().hex
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

                await conn.run_sync(migrate, "0002")
                state = MemoryStore()
                await conn.execute(
                    insert(farms).values(id=db.farm_id, name="Existing farm")
                )
                for position, mode in enumerate(state.modes.values()):
                    await conn.execute(
                        insert(modes).values(**mode_values(db.farm_id, mode, position))
                    )
                async with AsyncSession(bind=conn) as session:
                    await seed_incubators(session, db.farm_id, state)
                    await session.commit()
                for table in [mode_idempotency, incubator_idempotency]:
                    await conn.execute(
                        insert(table).values(
                            farm_id=db.farm_id,
                            scope="existing",
                            key="existing",
                            fingerprint="existing",
                            response={"preserve": True},
                        )
                    )
                tables = [
                    farms,
                    modes,
                    devices,
                    incubators,
                    mode_idempotency,
                    incubator_idempotency,
                ]
                snapshots = {
                    table.name: (await conn.execute(select(table))).all()
                    for table in tables
                }
                await conn.run_sync(migrate, "0003")
                await conn.execute(
                    insert(farm_preferences).values(
                        **preference_values(db.farm_id, state.preferences)
                    )
                )
                await conn.execute(
                    insert(preferences_idempotency).values(
                        farm_id=db.farm_id,
                        scope="preferences",
                        key="new",
                        fingerprint="new",
                        response=state.preferences.model_dump(mode="json"),
                    )
                )
                assert (
                    await conn.scalar(select(farm_preferences.c.farm_name))
                    == state.preferences.farm_name
                )
                await conn.run_sync(migrate, "0002", True)
                for table in tables:
                    assert (await conn.execute(select(table))).all() == snapshots[
                        table.name
                    ]
                await conn.run_sync(migrate, "0003")
                assert await conn.scalar(select(farm_preferences.c.farm_id)) is None
                await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        finally:
            await db.close()

    asyncio.run(verify())
