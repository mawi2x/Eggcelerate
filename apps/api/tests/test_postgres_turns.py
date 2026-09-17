"""Turn acceptance and mode deletion replay persist atomically."""

import asyncio
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient
from sqlalchemy import event, select

from eggcelerate_api.database.schema import cycle_idempotency
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.main import create_app

from .conftest import seed

BASE = "/api/v1/incubators/chamber-1"
TURN = BASE + "/commands/turn"


def test_turn_restart_replay_and_unkeyed_acceptance(settings):
    with TestClient(create_app(settings)) as client:
        first = client.post(TURN, headers={"Idempotency-Key": "one"})
        assert first.status_code == 200
        second = client.post(TURN, headers={"Idempotency-Key": "two"})
        assert second.status_code == 200
        latest = client.get(BASE).json()["data"]
    seed(settings)
    with TestClient(create_app(settings)) as client:
        assert (
            client.post(TURN, json={}, headers={"Idempotency-Key": "one"}).json()
            == first.json()
        )
        current = client.get(BASE).json()["data"]
        assert current["last_turned_at"] == latest["last_turned_at"]
        assert current["next_turn_at"] == latest["next_turn_at"]
        unkeyed = client.post(TURN).json()["data"]
        assert unkeyed["command_id"] not in ("one", "two")

    async def verify():
        db = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with db.sessions() as session:
                rows = (
                    (
                        await session.execute(
                            select(cycle_idempotency).where(
                                cycle_idempotency.c.farm_id == db.farm_id
                            )
                        )
                    )
                    .mappings()
                    .all()
                )
                assert len(rows) == 3
                assert any(row["key"] == unkeyed["command_id"] for row in rows)
        finally:
            await db.close()

    asyncio.run(verify())


def test_turn_receipt_failure_rolls_back_runtime(settings):
    app = create_app(settings)

    def fail(conn, cursor, statement, parameters, context, executemany):
        if statement.startswith("INSERT INTO cycle_idempotency"):
            raise RuntimeError("Injected receipt failure")

    with TestClient(app, raise_server_exceptions=False) as client:
        before = client.get(BASE).json()["data"]
        event.listen(
            app.state.database.engine.sync_engine, "before_cursor_execute", fail
        )
        try:
            assert (
                client.post(TURN, headers={"Idempotency-Key": "retry"}).status_code
                == 500
            )
        finally:
            event.remove(
                app.state.database.engine.sync_engine, "before_cursor_execute", fail
            )
        after = client.get(BASE).json()["data"]
        assert after["last_turned_at"] == before["last_turned_at"]
        assert after["next_turn_at"] == before["next_turn_at"]
        assert (
            client.post(TURN, headers={"Idempotency-Key": "retry"}).status_code == 200
        )


def test_concurrent_turn_replay(settings):
    def send():
        with TestClient(create_app(settings)) as client:
            response = client.post(TURN, headers={"Idempotency-Key": "same"})
            assert response.status_code == 200
            return response.json()

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(lambda _: send(), range(2)))
    assert responses[0] == responses[1]


def test_mode_delete_replay_after_restart(settings):
    with TestClient(create_app(settings)) as client:
        mode = client.get("/api/v1/modes/broiler").json()["data"]
        mode.update(id="disposable-mode", built_in=False, name="Delete proof")
        assert client.post("/api/v1/modes", json=mode).status_code == 201
        deleted = client.delete(
            "/api/v1/modes/disposable-mode", headers={"Idempotency-Key": "delete"}
        )
        assert deleted.status_code == 200
    seed(settings)
    with TestClient(create_app(settings)) as client:
        assert (
            client.delete(
                "/api/v1/modes/disposable-mode", headers={"Idempotency-Key": "delete"}
            ).json()
            == deleted.json()
        )
        assert client.get("/api/v1/modes/disposable-mode").status_code == 404
