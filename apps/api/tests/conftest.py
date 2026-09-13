"""Pytest bootstrap: import the package from src/, fresh app per test."""

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


def make_client() -> TestClient:
    settings = Settings(app_env="test")
    return TestClient(create_app(settings))


@pytest.fixture(scope="module")
def database_url():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL for PostgreSQL integration tests")
    if make_url(url).database != "eggcelerate_test":
        pytest.fail(
            "Integration tests require the disposable eggcelerate_test database"
        )
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
        storage_backend="postgres_modes",
        database_url=database_url,
        default_farm_id=str(uuid4()),
    )
    seed(settings)
    return settings
