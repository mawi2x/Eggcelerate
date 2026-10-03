"""M0 raw readings baseline on one unique disposable farm.

Run from the repository root with TEST_DATABASE_URL and PYTHONPATH=apps/api/src.
Seeds one unique farm and synthetic 30-second samples; leaves that farm in the
disposable database, like the integration suite. Never targets a live farm.
Request timing includes local DB access and JSON serialization, not WAN/browser
rendering. Computed gzip size does not prove deployed HTTP compression.
"""

import asyncio
import gzip
import json
import os
import time
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from eggcelerate_api.config import Settings
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.main import create_app
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import make_url

URL = os.environ["TEST_DATABASE_URL"]
source = make_url(URL)
if (
    source.database != "eggcelerate_test"
    or source.host not in {"localhost", "127.0.0.1", "::1"}
    or source.port != 55432
):
    raise ValueError("Only loopback eggcelerate_test on port 55432 is allowed")
farm = str(uuid4())
settings = Settings(
    app_env="test",
    storage_backend="postgres_incubators",
    database_url=URL,
    default_farm_id=farm,
)
end = datetime.now(UTC).replace(microsecond=0)
start = end.replace(hour=0, minute=0, second=0) - timedelta(days=21)


async def prepare():
    db = PostgresStore(URL, farm)
    try:
        await db.seed()
        async with db.sessions.begin() as session:
            await session.execute(
                text(
                    "UPDATE cycles SET started_on=:day WHERE farm_id=CAST(:farm AS uuid) AND incubator_id='chamber-12' AND status='active'"
                ),
                {"day": start.date().isoformat(), "farm": farm},
            )
            await session.execute(
                text("""
                INSERT INTO telemetry_samples(farm_id,device_id,observed_at,received_at,temperature_c,humidity_pct,water_ok)
                SELECT i.farm_id,i.device_id,t,t,37.6,57.0,true
                FROM incubators i CROSS JOIN generate_series(CAST(:start AS timestamptz),CAST(:end AS timestamptz)-interval '30 seconds',interval '30 seconds') t
                WHERE i.farm_id=CAST(:farm AS uuid) AND i.public_id='chamber-12'
            """),
                {"farm": farm, "start": start, "end": end},
            )
    finally:
        await db.close()


asyncio.run(prepare())
results = []
with TestClient(create_app(settings)) as client:
    for window in ("24h", "7d", "full"):
        t = time.perf_counter()
        response = client.get(f"/api/v1/incubators/chamber-12/readings?window={window}")
        elapsed = time.perf_counter() - t
        assert response.status_code == 200, response.text
        results.append(
            {
                "window": window,
                "points": len(response.json()["data"]),
                "bytes": len(response.content),
                "gzip_bytes": len(gzip.compress(response.content)),
                "request_ms": round(elapsed * 1000, 2),
            }
        )
print(
    json.dumps(
        {
            "farm_id": farm,
            "cadence_seconds": 30,
            "start_utc": start.isoformat(),
            "end_utc": end.isoformat(),
            "chambers_measured": 1,
            "results": results,
        },
        indent=2,
    )
)
