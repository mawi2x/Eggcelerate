"""Operator provisioning gives each live wire identity exactly one farm."""

import asyncio
from uuid import uuid4

import pytest
from sqlalchemy import insert

from eggcelerate_api.database.device_registry import (
    provision_device,
    registered_device_targets,
    resolve_registered_farm,
)
from eggcelerate_api.database.schema import devices, farms
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.errors import AppError


def test_device_provisioning_is_idempotent_and_global(settings):
    farm_a, farm_b = uuid4(), uuid4()
    device_id = f"EGG-{uuid4().hex[:16].upper()}"
    database = PostgresStore(settings.database_url, settings.default_farm_id)

    async def run():
        try:
            async with database.sessions.begin() as session:
                await session.execute(
                    insert(farms),
                    [
                        {"id": farm_a, "name": "Registry Farm A"},
                        {"id": farm_b, "name": "Registry Farm B"},
                    ],
                )
                assert await provision_device(session, farm_a, device_id)
                assert not await provision_device(session, farm_a, device_id)
                with pytest.raises(AppError) as error:
                    await provision_device(session, farm_b, device_id)
                assert error.value.code == "conflict"
                assert await resolve_registered_farm(session, device_id) == farm_a
                assert await resolve_registered_farm(session, device_id.lower()) is None
                targets = await registered_device_targets(session)
                assert device_id in targets[farm_a]
                assert device_id not in targets.get(farm_b, ())
        finally:
            await database.close()

    asyncio.run(run())


def test_legacy_device_id_assigned_to_multiple_farms_cannot_be_provisioned(settings):
    farm_a, farm_b = uuid4(), uuid4()
    device_id = f"LEGACY-{uuid4().hex[:12].upper()}"
    database = PostgresStore(settings.database_url, settings.default_farm_id)

    async def run():
        try:
            async with database.sessions.begin() as session:
                await session.execute(
                    insert(farms),
                    [
                        {"id": farm_a, "name": "Legacy Farm A"},
                        {"id": farm_b, "name": "Legacy Farm B"},
                    ],
                )
                await session.execute(
                    insert(devices),
                    [
                        {
                            "id": uuid4(),
                            "farm_id": farm_a,
                            "public_id": device_id,
                            "paired": True,
                        },
                        {
                            "id": uuid4(),
                            "farm_id": farm_b,
                            "public_id": device_id.lower(),
                            "paired": True,
                        },
                    ],
                )
                with pytest.raises(AppError) as error:
                    await provision_device(session, farm_a, device_id)
                assert error.value.code == "conflict"
                assert await resolve_registered_farm(session, device_id) is None
        finally:
            await database.close()

    asyncio.run(run())
