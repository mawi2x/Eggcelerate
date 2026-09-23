"""Prove a logical PostgreSQL backup restores into a clean disposable database.

Requires TEST_DATABASE_URL targeting loopback eggcelerate_test on port 55432 and
a running disposable database-test container with PostgreSQL client tools. This
script creates and drops only two uniquely named databases on that test server;
it never backs up or drops the supplied database or the development database.
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

from sqlalchemy import func, select, text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import create_async_engine

from eggcelerate_api.auth_security import hash_password
from eggcelerate_api.database.accounts import create_farm_owner
from eggcelerate_api.database.device_registry import provision_device
from eggcelerate_api.database.schema import (
    auth_sessions,
    device_registry,
    farm_memberships,
    farms,
    incubators,
    telemetry_samples,
    users,
)
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.mqtt.telemetry import ingest_telemetry

API = Path(__file__).resolve().parents[1]
CONTAINER = os.environ.get("PGTOOLS_CONTAINER", "eggcelerate-db-test-1")
DEVICE_ID = "EGG-1003"
FARM_ID = uuid4()


def migrate(url: str) -> None:
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=API,
        env={**os.environ, "DATABASE_URL": url},
        check=True,
        capture_output=True,
        text=True,
    )


def _tool_env(source: URL) -> list[str]:
    if not source.password or not source.username:
        raise ValueError("TEST_DATABASE_URL must include a disposable role/password")
    return ["-e", f"PGPASSWORD={source.password}"]


def _pg_args(source: URL, database_name: str) -> list[str]:
    if not source.username:
        raise ValueError("TEST_DATABASE_URL must include a disposable role")
    return [
        "-h",
        "127.0.0.1",
        "-U",
        source.username,
        "--dbname",
        database_name,
    ]


def run_pg_sql(source: URL, database_name: str, statement: str) -> None:
    subprocess.run(
        [
            "docker",
            "exec",
            *_tool_env(source),
            CONTAINER,
            "psql",
            *_pg_args(source, database_name),
            "--set",
            "ON_ERROR_STOP=1",
            "--command",
            statement,
        ],
        check=True,
        capture_output=True,
        text=True,
    )


async def seed_source(url: str) -> None:
    database = PostgresStore(url, str(FARM_ID))
    try:
        await database.seed()
        now = datetime.now(UTC)
        message = {
            "schema_v": 1,
            "device_id": DEVICE_ID,
            "incubator_id": "chamber-1",
            "boot_id": "backup-restore-boot",
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
            await create_farm_owner(
                session,
                user_id=uuid4(),
                farm_id=uuid4(),
                email="restore-owner@example.test",
                password_hash=hash_password("disposable restore fixture password"),
                display_name="Restore Owner",
                farm_name="Restore Owner Farm",
            )
    finally:
        await database.close()


async def verify_restored(url: str) -> None:
    engine = create_async_engine(url)
    try:
        async with engine.connect() as connection:
            revision = await connection.scalar(
                text("SELECT version_num FROM alembic_version")
            )
            extension = await connection.scalar(
                text("SELECT extversion FROM pg_extension WHERE extname='timescaledb'")
            )
            seeded_farm = await connection.scalar(
                select(func.count()).select_from(farms).where(farms.c.id == FARM_ID)
            )
            chamber_count = await connection.scalar(
                select(func.count())
                .select_from(incubators)
                .where(incubators.c.farm_id == FARM_ID)
            )
            telemetry_count = await connection.scalar(
                select(func.count())
                .select_from(telemetry_samples)
                .where(telemetry_samples.c.farm_id == FARM_ID)
            )
            registered = await connection.scalar(
                select(func.count())
                .select_from(device_registry)
                .where(
                    device_registry.c.identity_key == DEVICE_ID,
                    device_registry.c.farm_id == FARM_ID,
                )
            )
            owner_count = await connection.scalar(
                select(func.count())
                .select_from(users)
                .where(users.c.email == "restore-owner@example.test")
            )
            membership_count = await connection.scalar(
                select(func.count())
                .select_from(farm_memberships)
                .join(users, users.c.id == farm_memberships.c.user_id)
                .where(users.c.email == "restore-owner@example.test")
            )
            session_count = await connection.scalar(
                select(func.count()).select_from(auth_sessions)
            )
            assert revision == "0014", revision
            assert extension is not None
            assert seeded_farm == 1
            assert chamber_count > 0
            assert telemetry_count == 1
            assert registered == 1
            assert owner_count == membership_count == 1
            assert session_count == 0
    finally:
        await engine.dispose()


async def run() -> None:
    source = make_url(os.environ["TEST_DATABASE_URL"])
    if (
        source.database != "eggcelerate_test"
        or source.host not in {"localhost", "127.0.0.1", "::1"}
        or source.port != 55432
    ):
        raise ValueError("Only loopback eggcelerate_test on port 55432 is allowed")
    if not CONTAINER:
        raise ValueError("PGTOOLS_CONTAINER must identify the disposable test database")
    admin = create_async_engine(source, isolation_level="AUTOCOMMIT")
    suffix = uuid4().hex
    source_name = f"eggcelerate_backup_src_{suffix}"
    target_name = f"eggcelerate_backup_dst_{suffix}"
    created: list[str] = []
    try:
        async with admin.connect() as connection:
            for name in (source_name, target_name):
                await connection.execute(text(f'CREATE DATABASE "{name}"'))
                created.append(name)
        source_url = source.set(database=source_name)
        target_url = source.set(database=target_name)
        migrate(source_url.render_as_string(hide_password=False))
        await seed_source(source_url.render_as_string(hide_password=False))

        started = time.perf_counter()
        dump = subprocess.run(
            [
                "docker",
                "exec",
                *_tool_env(source),
                CONTAINER,
                "pg_dump",
                *_pg_args(source, source_name),
                "--format=custom",
                "--no-owner",
                "--no-acl",
            ],
            check=True,
            capture_output=True,
        )
        # Timescale requires its extension to be enabled and its restore hooks
        # to bracket pg_restore so hypertable chunks and catalogs load safely.
        run_pg_sql(
            source,
            target_name,
            "CREATE EXTENSION IF NOT EXISTS timescaledb",
        )
        run_pg_sql(source, target_name, "SELECT timescaledb_pre_restore()")
        restore = subprocess.run(
            [
                "docker",
                "exec",
                "-i",
                *_tool_env(source),
                CONTAINER,
                "pg_restore",
                *_pg_args(source, target_name),
                "--format=custom",
                "--exit-on-error",
                "--no-owner",
                "--no-acl",
            ],
            input=dump.stdout,
            check=False,
            capture_output=True,
        )
        if restore.returncode != 0:
            run_pg_sql(source, target_name, "SELECT timescaledb_post_restore()")
            raise RuntimeError(
                "pg_restore failed: "
                + restore.stderr.decode("utf-8", errors="replace").strip()
            )
        del restore
        run_pg_sql(source, target_name, "SELECT timescaledb_post_restore()")
        elapsed = time.perf_counter() - started
        await verify_restored(target_url.render_as_string(hide_password=False))
        print(
            "PASS: restored revision 0014, farm configuration, one Timescale sample, "
            "operator device routing, and owner membership into a clean database. "
            f"archive_bytes={len(dump.stdout)} restore_seconds={elapsed:.2f}"
        )
    finally:
        async with admin.connect() as connection:
            for name in reversed(created):
                await connection.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        await admin.dispose()


if __name__ == "__main__":
    asyncio.run(run())
