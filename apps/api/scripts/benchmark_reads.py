"""Repeatable six-client read/write workload on a unique disposable farm."""

import asyncio
import json
import os
import statistics
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.engine import make_url

from eggcelerate_api.config import Settings
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.main import create_app

URL = os.environ["TEST_DATABASE_URL"]
if make_url(URL).database != "eggcelerate_test":
    raise ValueError("Only disposable eggcelerate_test is allowed")
s = Settings(
    app_env="test",
    storage_backend="postgres_incubators",
    database_url=URL,
    default_farm_id=str(uuid4()),
)


async def seed():
    d = PostgresStore(URL, s.default_farm_id)
    await d.seed()
    await d.close()


asyncio.run(seed())
app = create_app(s)
counts = Counter()


@event.listens_for(app.state.database.engine.sync_engine, "before_cursor_execute")
def capture(conn, cursor, statement, parameters, context, executemany):
    counts["queries"] += 1
    if "FOR UPDATE" in statement:
        counts["write_locks"] += 1


with TestClient(app) as client:

    def run(i):
        t = time.perf_counter()
        if i % 6 == 0:
            r = client.patch(
                "/api/v1/incubators/chamber-5", json={"name": f"Benchmark {i}"}
            )
        else:
            r = client.get(
                [
                    "/api/v1/incubators",
                    "/api/v1/incubators/chamber-1",
                    "/api/v1/cycles",
                ][i % 3]
            )
        assert r.status_code == 200, r.text
        return (time.perf_counter() - t) * 1000

    with ThreadPoolExecutor(max_workers=6) as warmup:
        list(warmup.map(lambda _: client.get("/api/v1/modes"), range(12)))
    counts.clear()
    start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=6) as pool:
        timings = sorted(pool.map(run, range(60)))
    print(
        json.dumps(
            {
                "requests": 60,
                "clients": 6,
                "seed_chambers": 12,
                "writes": 10,
                "p50_ms": round(statistics.median(timings), 2),
                "p95_ms": round(timings[56], 2),
                "elapsed_s": round(time.perf_counter() - start, 2),
                **counts,
            }
        )
    )
