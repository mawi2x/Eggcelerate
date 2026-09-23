"""Reads remain available while another process holds the farm mutation lock."""

import asyncio
from collections import Counter

from fastapi.testclient import TestClient
from sqlalchemy import event, select

from eggcelerate_api.config import Settings
from eggcelerate_api.database.schema import farms
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.main import create_app


def test_reads_do_not_wait_for_farm_write_lock(settings):
    async def verify():
        writer = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            with TestClient(create_app(settings)) as client:
                async with writer.sessions.begin() as session:
                    await session.execute(
                        select(farms)
                        .where(farms.c.id == writer.farm_id)
                        .with_for_update()
                    )
                    for path in (
                        "/modes",
                        "/modes/broiler",
                        "/incubators",
                        "/incubators/chamber-1",
                        "/cycles",
                        "/alerts",
                        "/preferences",
                        "/incubators/chamber-1/cycles/current/candling-entries",
                    ):
                        result = await asyncio.wait_for(
                            asyncio.to_thread(client.get, "/api/v1" + path), 2
                        )
                        assert result.status_code == 200, result.text
        finally:
            await writer.close()

    asyncio.run(verify())


def test_focused_reads_never_write_or_hydrate_unrelated_collections(settings):
    app = create_app(settings)
    statements = []

    @event.listens_for(app.state.database.engine.sync_engine, "before_cursor_execute")
    def capture(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement.lower())

    with TestClient(app) as client:
        for resource, forbidden in (
            ("modes", ("incubator_runtime", "cycle_history", "alerts", "candling")),
            ("cycles", ("incubator_runtime", "candling", "preferences")),
            ("preferences", ("modes", "incubators", "cycle_history")),
        ):
            statements.clear()
            assert client.get("/api/v1/" + resource).status_code == 200
            sql = "\n".join(statements)
            assert "for update" not in sql
            assert "read only" in sql
            assert not any(table in sql for table in forbidden)
            assert not any(
                s.startswith(("insert", "update", "delete")) for s in statements
            )
        missing = client.get("/api/v1/incubators/missing")
        assert missing.status_code == 404


def test_seeded_farm_without_telemetry_matches_memory_adapter(settings):
    memory_app = create_app(Settings(app_env="test"))

    with (
        TestClient(memory_app) as memory_client,
        TestClient(create_app(settings)) as postgres_client,
    ):
        memory_units = memory_client.get("/api/v1/incubators").json()["data"]
        postgres_units = postgres_client.get("/api/v1/incubators").json()["data"]

        def counts(units):
            return Counter(
                (
                    unit["connection_state"],
                    unit["telemetry_status"],
                    unit["status"],
                    unit["condition_severity"],
                )
                for unit in units
            )

        assert counts(postgres_units) == counts(memory_units)
        assert len(postgres_units) == 12
        assert all(unit["telemetry_status"] == "offline" for unit in postgres_units)
        assert all(unit["connection_state"] == "offline" for unit in postgres_units)


def test_missing_resource_and_command_status_404_parity(settings):
    memory_app = create_app(Settings(app_env="test"))
    paths = (
        "/api/v1/incubators/missing",
        "/api/v1/modes/missing",
        "/api/v1/incubators/chamber-1/commands/missing-command",
    )
    with (
        TestClient(memory_app) as memory_client,
        TestClient(create_app(settings)) as postgres_client,
    ):
        for path in paths:
            assert memory_client.get(path).status_code == 404
            assert postgres_client.get(path).status_code == 404
