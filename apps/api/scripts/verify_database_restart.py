"""Verify application data survives a restart of an isolated PostgreSQL volume.

This script creates a uniquely named Docker volume and TimescaleDB container,
migrates and seeds that database, writes one registered device telemetry sample,
restarts only that container, and checks the persisted application state. It never
connects to or removes a developer/shared database or container. Run from
``apps/api`` with ``PYTHONPATH=src ./.venv/bin/python
scripts/verify_database_restart.py``.
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import asyncpg  # type: ignore[import-untyped]
from sqlalchemy import func, select, text
from sqlalchemy.engine import URL
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from eggcelerate_api.database.device_registry import provision_device
from eggcelerate_api.database.schema import (
    device_registry,
    telemetry_samples,
)
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.mqtt.telemetry import ingest_telemetry

API = Path(__file__).resolve().parents[1]
IMAGE = os.environ.get("PHASE9_TIMESCALE_IMAGE", "timescale/timescaledb:2.30.0-pg17")
DATABASE = "eggcelerate"
USERNAME = "eggcelerate"
DEVICE_ID = "EGG-1003"
FARM_ID = uuid4()
RUN_ID = uuid4().hex
LABEL_KEY = "io.eggcelerate.phase9-restart-drill"
LABEL_VALUE = RUN_ID
CONTAINER = f"eggcelerate-phase9-restart-{RUN_ID}"
VOLUME = f"eggcelerate-phase9-restart-{RUN_ID}"


def docker(
    *args: str, capture: bool = True, extra_env: dict[str, str] | None = None
) -> str:
    environment = {**os.environ, **(extra_env or {})}
    result = subprocess.run(
        ["docker", *args],
        check=True,
        capture_output=capture,
        text=True,
        env=environment,
    )
    return result.stdout.strip() if capture else ""


def migrate(database_url: str) -> None:
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=API,
        env={**os.environ, "DATABASE_URL": database_url},
        check=True,
        capture_output=True,
        text=True,
    )


def database_url(password: str, port: int) -> str:
    return URL.create(
        "postgresql+asyncpg",
        username=USERNAME,
        password=password,
        host="127.0.0.1",
        port=port,
        database=DATABASE,
    ).render_as_string(hide_password=False)


async def wait_for_database(url: str, timeout_s: float = 45) -> None:
    engine = create_async_engine(url, poolclass=NullPool)
    deadline = time.monotonic() + timeout_s
    last_error: Exception | None = None
    try:
        while time.monotonic() < deadline:
            try:
                async with engine.connect() as connection:
                    await connection.scalar(text("SELECT 1"))
                return
            except (SQLAlchemyError, OSError, asyncpg.PostgresError) as exc:
                last_error = exc
                await asyncio.sleep(0.25)
        error = type(last_error).__name__ if last_error else "no connection attempt"
        raise TimeoutError(
            f"Disposable PostgreSQL did not become ready ({error})"
        ) from last_error
    finally:
        await engine.dispose()


async def seed_application_data(url: str) -> None:
    database = PostgresStore(url, str(FARM_ID))
    try:
        await database.seed()
        now = datetime.now(UTC)
        message = {
            "schema_v": 1,
            "device_id": DEVICE_ID,
            "incubator_id": "chamber-1",
            "boot_id": "phase9-restart-boot",
            "booted_at": (now - timedelta(minutes=5)).isoformat(),
            "seq": 10,
            "observed_at": (now - timedelta(seconds=10)).isoformat(),
            "temperature_c": 37.61,
            "humidity_pct": 56.7,
            "water_ok": True,
            "battery_pct": 96,
            "power_source": "grid",
        }
        async with database.sessions.begin() as session:
            await provision_device(session, FARM_ID, DEVICE_ID)
            await ingest_telemetry(
                session,
                FARM_ID,
                f"eggcelerate/v1/devices/{DEVICE_ID}/telemetry",
                json.dumps(message).encode(),
            )
        if not await database.ready():
            raise AssertionError("Freshly migrated and seeded database is not ready")
    finally:
        await database.close()


async def verify_application_data(url: str) -> str:
    engine = create_async_engine(url, pool_pre_ping=True)
    try:
        async with engine.connect() as connection:
            revision = await connection.scalar(
                text("SELECT version_num FROM alembic_version")
            )
            extension = await connection.scalar(
                text("SELECT extversion FROM pg_extension WHERE extname='timescaledb'")
            )
            telemetry_count = await connection.scalar(
                select(func.count())
                .select_from(telemetry_samples)
                .where(telemetry_samples.c.farm_id == FARM_ID)
            )
            registered_count = await connection.scalar(
                select(func.count())
                .select_from(device_registry)
                .where(
                    device_registry.c.identity_key == DEVICE_ID,
                    device_registry.c.farm_id == FARM_ID,
                )
            )
            temperature = await connection.scalar(
                select(telemetry_samples.c.temperature_c)
                .where(
                    telemetry_samples.c.farm_id == FARM_ID,
                )
                .limit(1)
            )
            assert revision == "0014", revision
            assert extension is not None
            assert telemetry_count == 1, telemetry_count
            assert registered_count == 1, registered_count
            assert temperature == 37.61, temperature
            return revision
    finally:
        await engine.dispose()


def host_port() -> int:
    mapping = docker("port", CONTAINER, "5432/tcp")
    return int(mapping.rsplit(":", maxsplit=1)[1])


async def run() -> None:
    password = uuid4().hex
    volume_created = False
    container_created = False
    try:
        docker(
            "volume",
            "create",
            "--label",
            f"{LABEL_KEY}={LABEL_VALUE}",
            VOLUME,
        )
        volume_created = True
        docker(
            "run",
            "--detach",
            "--name",
            CONTAINER,
            "--label",
            f"{LABEL_KEY}={LABEL_VALUE}",
            "--publish",
            "127.0.0.1::5432",
            "--mount",
            f"type=volume,src={VOLUME},dst=/var/lib/postgresql/data",
            "--env",
            f"POSTGRES_DB={DATABASE}",
            "--env",
            f"POSTGRES_USER={USERNAME}",
            "--env",
            "POSTGRES_PASSWORD",
            IMAGE,
            extra_env={"POSTGRES_PASSWORD": password},
        )
        container_created = True
        url = database_url(password, host_port())
        await wait_for_database(url)
        migrate(url)
        await seed_application_data(url)
        revision_before = await verify_application_data(url)

        restarted_at = time.monotonic()
        docker("restart", CONTAINER)
        # Docker may reassign a random host port when a container is restarted.
        url = database_url(password, host_port())
        await wait_for_database(url)
        restart_ready_s = time.monotonic() - restarted_at
        revision_after = await verify_application_data(url)
        if revision_after != revision_before:
            raise AssertionError("Migration revision changed across container restart")
        print(
            "Isolated database restart drill passed: "
            f"revision={revision_after}, telemetry_samples=1, "
            f"registered_devices=1, restart_ready_seconds={restart_ready_s:.2f}."
        )
    finally:
        # These random names and labels are unique to this invocation; only the
        # resources successfully created above are removed.
        if container_created:
            docker("rm", "--force", CONTAINER, capture=True)
        if volume_created:
            docker("volume", "rm", VOLUME, capture=True)


if __name__ == "__main__":
    asyncio.run(run())
