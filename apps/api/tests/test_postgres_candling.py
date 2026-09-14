"""Durable cycle journals, ordered references, tombstones and atomic replay."""

import asyncio
from dataclasses import replace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, select

from eggcelerate_api.database.schema import candling_entries, candling_photos
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.main import create_app

from .conftest import seed

BASE = "/api/v1/incubators/chamber-10"
PATH = BASE + "/cycles/current/candling-entries"
ENTRY = {
    "day": 2,
    "label": "Journal proof",
    "observed_on": "2026-09-14",
    "fertile_eggs": 20,
    "clear_eggs": 2,
    "uncertain_eggs": 1,
    "note": "Keep",
    "photo_keys": ["photos/second", "photos/first"],
    "checks": ["veining", "air_cell"],
    "checkpoint_type": "first",
}


def test_restart_edit_delete_seed_recreate_and_replay(settings):
    with TestClient(create_app(settings)) as client:
        created = client.post(PATH, json=ENTRY, headers={"Idempotency-Key": "create"})
        assert created.status_code == 201
        path = PATH + "/" + created.json()["data"]["id"]
        patch = {
            "note": "Edited",
            "photo_keys": ["photos/replacement"],
            "checks": ["movement"],
        }
        edited = client.patch(path, json=patch, headers={"Idempotency-Key": "edit"})
        assert edited.status_code == 200
    seed(settings)
    with TestClient(create_app(settings)) as client:
        assert client.get(PATH).json()["data"] == [edited.json()["data"]]
        assert (
            client.post(PATH, json=ENTRY, headers={"Idempotency-Key": "create"}).json()
            == created.json()
        )
        assert client.get(PATH).json()["data"] == [edited.json()["data"]]
        assert (
            client.patch(
                path, json={"note": "Different"}, headers={"Idempotency-Key": "edit"}
            ).status_code
            == 409
        )
        assert client.patch(path, json={"fertile_eggs": None}).status_code == 422
        assert client.patch(path, json={"fertile_eggs": 99}).status_code == 422
        removed = client.delete(path, headers={"Idempotency-Key": "delete"})
        assert removed.status_code == 200
        # Also remove an actual seeded entry, then prove seed cannot revive it.
        seeded_path = "/api/v1/incubators/chamber-1/cycles/current/candling-entries"
        for entry in client.get(seeded_path).json()["data"]:
            assert client.delete(seeded_path + "/" + entry["id"]).status_code == 200
    seed(settings)
    with TestClient(create_app(settings)) as client:
        assert client.get(PATH).json()["data"] == []
        assert (
            client.get(
                "/api/v1/incubators/chamber-1/cycles/current/candling-entries"
            ).json()["data"]
            == []
        )
        assert (
            client.delete(path, headers={"Idempotency-Key": "delete"}).json()
            == removed.json()
        )
        assert client.delete(path).status_code == 404
        assert client.post(PATH, json=ENTRY).status_code == 201
        assert client.get(PATH).json()["data"][0]["photo_keys"] == ENTRY["photo_keys"]
        recreated = client.post(
            "/api/v1/incubators/chamber-1/cycles/current/candling-entries",
            json={**ENTRY, "day": 6},
        )
        assert recreated.status_code == 201
    seed(settings)
    with TestClient(create_app(settings)) as client:
        journal = client.get(
            "/api/v1/incubators/chamber-1/cycles/current/candling-entries"
        ).json()["data"]
        assert journal == [recreated.json()["data"]]


def test_new_cycle_and_farm_cannot_reuse_an_old_journal(settings):
    other = replace(settings, default_farm_id=str(uuid4()))
    seed(other)
    with TestClient(create_app(settings)) as client:
        old = client.post(PATH, json=ENTRY, headers={"Idempotency-Key": "old"}).json()
        stopped = client.post(BASE + "/cycles/current/stop").json()["data"]
        old_cycle = stopped["cycle_id"]
        assert client.get(PATH).json()["data"] == [old["data"]]
        client.post(BASE + "/cycles/current/reset")
        assert client.get(PATH).json()["data"] == []
        assert client.post(PATH, json=ENTRY).status_code == 409
        client.post(BASE + "/cycles", json={"mode_id": "broiler", "total_eggs": 30})
        assert client.get(PATH).json()["data"] == []
        assert (
            client.post(PATH, json=ENTRY, headers={"Idempotency-Key": "old"}).json()
            == old
        )
        assert client.get(PATH).json()["data"] == []
        assert client.post(PATH, json={**ENTRY, "note": "New cycle"}).status_code == 201
        client.post(BASE + "/cycles/current/complete", json={"hatched_eggs": 20})
        assert client.get(PATH).json()["data"] == []
    seed(settings)
    with TestClient(create_app(other)) as client:
        assert client.get(PATH).json()["data"] == []
        assert (
            client.post(
                PATH, json=ENTRY, headers={"Idempotency-Key": "old"}
            ).status_code
            == 201
        )

    async def verify():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with db.sessions() as session:
                rows = (
                    (
                        await session.execute(
                            select(candling_entries).where(
                                candling_entries.c.farm_id == db.farm_id,
                                candling_entries.c.public_id == old["data"]["id"],
                            )
                        )
                    )
                    .mappings()
                    .all()
                )
                assert len(rows) == 2
                assert (
                    next(row for row in rows if row["cycle_id"] == old_cycle)["note"]
                    == "Keep"
                )
        finally:
            await db.close()

    asyncio.run(verify())


@pytest.mark.parametrize("target", ["candling_photos", "candling_idempotency"])
def test_partial_entry_photo_write_rolls_back(settings, target):
    app = create_app(settings)

    def fail(_conn, _cursor, statement, _parameters, _context, _many):
        if statement.startswith(f"INSERT INTO {target}"):
            raise RuntimeError("Injected photo/receipt failure")

    with TestClient(app, raise_server_exceptions=False) as client:
        engine = app.state.database.engine.sync_engine
        event.listen(engine, "before_cursor_execute", fail)
        try:
            assert (
                client.post(
                    PATH, json=ENTRY, headers={"Idempotency-Key": "retry"}
                ).status_code
                == 500
            )
        finally:
            event.remove(engine, "before_cursor_execute", fail)
        assert app.state.store.incubators["chamber-10"].candling_entries == []
        assert client.get(PATH).json()["data"] == []
        assert (
            client.post(
                PATH, json=ENTRY, headers={"Idempotency-Key": "retry"}
            ).status_code
            == 201
        )

    async def verify():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with db.sessions() as session:
                rows = (
                    await session.execute(
                        select(candling_photos).where(
                            candling_photos.c.farm_id == db.farm_id
                        )
                    )
                ).all()
                assert len(rows) == 2
        finally:
            await db.close()

    asyncio.run(verify())


@pytest.mark.parametrize("same_key", [False, True])
def test_competing_same_day_creates_and_scoped_constraints(settings, same_key):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from sqlalchemy import insert
    from sqlalchemy.exc import IntegrityError

    barrier = Barrier(2)
    apps = [create_app(settings), create_app(settings)]

    def create(index):
        with TestClient(apps[index]) as client:
            barrier.wait(timeout=5)
            return client.post(
                PATH,
                json=ENTRY,
                headers={"Idempotency-Key": "same" if same_key else str(index)},
            )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(create, range(2)))
    assert sorted(r.status_code for r in results) == (
        [201, 201] if same_key else [201, 409]
    )

    async def verify():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with db.sessions() as session:
                row = (
                    (
                        await session.execute(
                            select(candling_entries).where(
                                candling_entries.c.farm_id == db.farm_id,
                                candling_entries.c.public_id == "chamber-10-d2",
                            )
                        )
                    )
                    .mappings()
                    .one()
                )
            for patch in [
                {"public_id": "duplicate-day"},
                {"cycle_id": "foreign-cycle"},
            ]:
                with pytest.raises(IntegrityError):
                    async with db.sessions.begin() as session:
                        await session.execute(
                            insert(candling_entries).values(**{**dict(row), **patch})
                        )
        finally:
            await db.close()

    asyncio.run(verify())
