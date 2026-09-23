"""Operator provisioned, globally unique device routing identities."""

import re
from collections import defaultdict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..errors import AppError
from .schema import device_registry, devices, farms

DEVICE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,128}$")


async def provision_device(
    session: AsyncSession, farm_id: UUID, public_id: str
) -> bool:
    """Bind an operator-verified hardware ID to one farm; repeat calls are safe."""
    if not DEVICE_ID_PATTERN.fullmatch(public_id):
        raise AppError("validation_error", "Device ID has an invalid format.")
    identity_key = public_id.upper()
    if await session.scalar(select(farms.c.id).where(farms.c.id == farm_id)) is None:
        raise AppError("not_found", "Farm was not found.")

    existing = await session.execute(
        select(device_registry).where(device_registry.c.identity_key == identity_key)
    )
    existing_row = existing.mappings().first()
    if existing_row is not None:
        if (
            existing_row["farm_id"] == farm_id
            and existing_row["public_id"] == public_id
            and existing_row["disabled_at"] is None
        ):
            return False
        raise AppError("conflict", "Device identity is already provisioned.")

    assigned_farms = set(
        (
            await session.scalars(
                select(devices.c.farm_id).where(devices.c.identity_key == identity_key)
            )
        ).all()
    )
    if assigned_farms - {farm_id}:
        raise AppError(
            "conflict",
            "This device ID already appears in another farm and cannot be provisioned safely.",
        )
    await session.execute(
        device_registry.insert().values(
            identity_key=identity_key,
            public_id=public_id,
            farm_id=farm_id,
        )
    )
    return True


async def registered_device_targets(
    session: AsyncSession,
) -> dict[UUID, tuple[str, ...]]:
    rows = (
        await session.execute(
            select(device_registry.c.farm_id, device_registry.c.public_id)
            .where(device_registry.c.disabled_at.is_(None))
            .order_by(device_registry.c.farm_id, device_registry.c.public_id)
        )
    ).all()
    targets: dict[UUID, list[str]] = defaultdict(list)
    for farm_id, public_id in rows:
        targets[farm_id].append(public_id)
    return {farm_id: tuple(public_ids) for farm_id, public_ids in targets.items()}


async def resolve_registered_farm(session: AsyncSession, public_id: str) -> UUID | None:
    if not DEVICE_ID_PATTERN.fullmatch(public_id):
        return None
    return await session.scalar(
        select(device_registry.c.farm_id).where(
            device_registry.c.identity_key == public_id.upper(),
            device_registry.c.public_id == public_id,
            device_registry.c.disabled_at.is_(None),
        )
    )
