"""Deletion guards and relational cleanup against an isolated test farm."""

import asyncio
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import insert, select

from eggcelerate_api.database.schema import (
    candling_entries,
    candling_photos,
    climate_tests,
    cycle_history,
    cycles,
    incubators,
)
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.main import create_app


def create(client):
    response = client.post(
        "/api/v1/incubators",
        json={
            "name": "Delete test chamber",
            "device_id": "EGG-DELETE1",
            "mode_id": "broiler",
        },
    )
    response.raise_for_status()
    return response.json()["data"]["id"]


def test_delete_confirmation_cleanup_repair_and_farm_isolation(settings):
    with TestClient(create_app(settings)) as client:
        unit = create(client)
        path = f"/api/v1/incubators/{unit}"
        assert (
            client.request("DELETE", path, json={"confirmation": "wrong"}).status_code
            == 422
        )
        assert client.get(path).status_code == 200

        async def history():
            database = PostgresStore(settings.database_url, settings.default_farm_id)
            try:
                async with database.sessions.begin() as session:
                    await session.execute(
                        insert(cycles).values(
                            farm_id=database.farm_id,
                            id="old-cycle",
                            incubator_id=unit,
                            status="stopped",
                            started_on="2026-10-01",
                        )
                    )
                    await session.execute(
                        insert(cycle_history).values(
                            farm_id=database.farm_id,
                            cycle_id="old-cycle",
                            public_id="old-record",
                            kind="stopped",
                            incubator_id=unit,
                            chamber_name="Delete test chamber",
                            mode_id="broiler",
                            mode_name="Chicken",
                            stopped_at=datetime.now(UTC),
                            day_stopped=2,
                            total_eggs=10,
                            position=0,
                        )
                    )
                    await session.execute(
                        insert(candling_entries).values(
                            farm_id=database.farm_id,
                            cycle_id="old-cycle",
                            public_id="old-entry",
                            day=1,
                            label="Check",
                            observed_on="2026-10-01",
                            fertile_eggs=10,
                            clear_eggs=0,
                            uncertain_eggs=0,
                            note="",
                            checks=[],
                            checkpoint_type="first",
                        )
                    )
                    await session.execute(
                        insert(candling_photos).values(
                            farm_id=database.farm_id,
                            cycle_id="old-cycle",
                            entry_id="old-entry",
                            position=0,
                            photo_key="test-photo",
                        )
                    )
            finally:
                await database.close()

        asyncio.run(history())
        other = replace(settings, default_farm_id=str(uuid4()))
        with TestClient(create_app(other)) as other_client:
            assert (
                other_client.request(
                    "DELETE", path, json={"confirmation": "Delete test chamber"}
                ).status_code
                == 404
            )
        assert (
            client.request(
                "DELETE", path, json={"confirmation": "Delete test chamber"}
            ).status_code
            == 200
        )
        assert client.get(path).status_code == 404
        assert create(client) != unit


@pytest.mark.parametrize("force", [False, True])
@pytest.mark.parametrize("preparing", [True, False])
def test_delete_blocks_preparation_and_active_cycle(settings, preparing, force):
    with TestClient(create_app(settings)) as client:
        unit = create(client)
        path = f"/api/v1/incubators/{unit}"
        if preparing:
            response = client.patch(
                path, json={"preparing": True, "mode_id": "broiler"}
            )
        else:

            async def active_cycle():
                database = PostgresStore(
                    settings.database_url, settings.default_farm_id
                )
                try:
                    async with database.sessions.begin() as session:
                        await session.execute(
                            insert(cycles).values(
                                farm_id=database.farm_id,
                                id=str(uuid4()),
                                incubator_id=unit,
                                status="active",
                                started_on="2026-10-16",
                            )
                        )
                finally:
                    await database.close()

            asyncio.run(active_cycle())
        if preparing:
            response.raise_for_status()
        assert client.request(
            "DELETE", path, json={"confirmation": "Delete test chamber", "force": force}
        ).status_code == (200 if force else 409)
        assert client.get(path).status_code == (404 if force else 200)


@pytest.mark.parametrize("force", [False, True])
@pytest.mark.parametrize("fresh,running", [(False, False), (True, True), (True, False)])
def test_delete_requires_fresh_equipment_off_confirmation(
    settings, fresh, running, force
):
    with TestClient(create_app(settings)) as client:
        unit = create(client)
        path = f"/api/v1/incubators/{unit}"

        async def report():
            database = PostgresStore(settings.database_url, settings.default_farm_id)
            try:
                async with database.sessions.begin() as session:
                    device = await session.scalar(
                        select(incubators.c.device_id).where(
                            incubators.c.farm_id == database.farm_id,
                            incubators.c.public_id == unit,
                        )
                    )
                    await session.execute(
                        insert(climate_tests).values(
                            farm_id=database.farm_id,
                            incubator_id=unit,
                            device_id=device,
                            report={"lifecycle": 1, "running": running},
                            reported_at=datetime.now(UTC)
                            - timedelta(seconds=0 if fresh else 90),
                        )
                    )
            finally:
                await database.close()

        asyncio.run(report())
        response = client.request(
            "DELETE", path, json={"confirmation": "Delete test chamber", "force": force}
        )
        assert response.status_code == (
            200 if force or (fresh and not running) else 409
        ), response.text
