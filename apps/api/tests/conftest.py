"""Pytest bootstrap: import from src/ and restrict DB tests to loopback test data."""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import make_url

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from eggcelerate_api.config import Settings
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.main import create_app


def pytest_addoption(parser):
    parser.addoption(
        "--require-database",
        action="store_true",
        help="Require disposable PostgreSQL and fail if any test is skipped.",
    )


def pytest_sessionstart(session):
    if session.config.getoption("--require-database"):
        url = os.environ.get("TEST_DATABASE_URL", "")
        if not _is_disposable_test_url(url):
            raise pytest.UsageError(
                "--require-database requires TEST_DATABASE_URL targeting loopback "
                "eggcelerate_test on port 55432"
            )


def pytest_sessionfinish(session, exitstatus):
    if session.config.getoption("--require-database"):
        reporter = session.config.pluginmanager.get_plugin("terminalreporter")
        if reporter and reporter.stats.get("skipped"):
            session.exitstatus = pytest.ExitCode.TESTS_FAILED


def _is_disposable_test_url(url: str) -> bool:
    if not url:
        return False
    parsed = make_url(url)
    return (
        parsed.database == "eggcelerate_test"
        and parsed.host in {"localhost", "127.0.0.1", "::1"}
        and parsed.port == 55432
    )


def make_client() -> TestClient:
    settings = Settings(app_env="test")
    return TestClient(create_app(settings))


@pytest.fixture(scope="module")
def database_url():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL for PostgreSQL integration tests")
    if not _is_disposable_test_url(url):
        pytest.fail("Integration tests require loopback eggcelerate_test on port 55432")
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=Path(__file__).resolve().parents[1],
        env={**os.environ, "DATABASE_URL": url},
        check=True,
    )
    return url


def seed(settings):
    async def run():
        database = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            await database.seed()
        finally:
            await database.close()

    asyncio.run(run())


@pytest.fixture
def settings(database_url):
    settings = Settings(
        app_env="test",
        alert_evaluation_interval=0,
        storage_backend="postgres_modes",
        database_url=database_url,
        default_farm_id=str(uuid4()),
    )
    seed(settings)
    return settings
