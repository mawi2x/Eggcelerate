"""Throwaway probe: compare seeded Postgres vs memory adapter status for GATE-01/GATE-02."""

from __future__ import annotations

import asyncio
import sys
from collections import Counter
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, "/home/mawi/Projects/eggcelerate/eggcelerate/apps/api/src")

from fastapi.testclient import TestClient

from eggcelerate_api.config import Settings
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.main import create_app


def seed(settings):
    async def run():
        database = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            await database.seed()
        finally:
            await database.close()

    asyncio.run(run())


def counts(client, label):
    units = client.get("/api/v1/incubators").json()["data"]
    alerts = client.get("/api/v1/alerts").json()["data"]
    print(f"{label}: units={len(units)} alerts={len(alerts)}")
    for field in ("connection_state", "telemetry_status", "status", "condition_severity"):
        print(f"  {field}: {dict(Counter(u.get(field) for u in units))}")
    one = client.get("/api/v1/incubators/" + units[0]["id"]).json()["data"]
    print(
        "  detail first unit:",
        {k: one.get(k) for k in ("id", "paired", "connection_state", "telemetry_status", "telemetry_last_seen_at")},
    )
    for path in ("/api/v1/incubators/missing", "/api/v1/modes/missing"):
        r = client.get(path)
        print(f"  GET {path} -> {r.status_code}")
    return units


def main() -> None:
    url = sys.argv[1]
    memory = Settings(app_env="test")
    with TestClient(create_app(memory)) as client:
        counts(client, "memory")

    settings = Settings(
        app_env="test",
        storage_backend="postgres_modes",
        database_url=url,
        default_farm_id=str(uuid4()),
    )
    seed(settings)
    with TestClient(create_app(settings)) as client:
        units = counts(client, "postgres")
        missing_nested = client.get(
            "/api/v1/incubators/" + units[0]["id"] + "/commands/00000000-0000-0000-0000-000000000000"
        )
        print("  GET missing command status ->", missing_nested.status_code)


if __name__ == "__main__":
    main()
