"""Alert rows retain tombstones so repeated seeding cannot resurrect removals."""

from typing import Any
from uuid import UUID

from sqlalchemy import insert, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AlertDTO
from ..storage import StoreState
from .schema import alerts


def alert_values(farm_id: UUID, alert: AlertDTO, position: int) -> dict[str, Any]:
    values = alert.model_dump()
    values["public_id"] = values.pop("id")
    return {"farm_id": farm_id, "position": position, "dismissed": False, **values}


async def seed_alerts(session: AsyncSession, farm_id: UUID, state: StoreState) -> None:
    for position, alert in enumerate(state.alerts.values()):
        await session.execute(
            pg_insert(alerts)
            .values(**alert_values(farm_id, alert, position))
            .on_conflict_do_nothing(
                index_elements=[alerts.c.farm_id, alerts.c.public_id]
            )
        )


async def load_alerts(session: AsyncSession, farm_id: UUID, state: StoreState) -> None:
    rows = (
        (
            await session.execute(
                select(alerts)
                .where(alerts.c.farm_id == farm_id, alerts.c.dismissed.is_(False))
                .order_by(alerts.c.position, alerts.c.public_id)
            )
        )
        .mappings()
        .all()
    )
    loaded = {}
    for row in rows:
        values = dict(row)
        values["id"] = values.pop("public_id")
        for key in ("farm_id", "position", "dismissed"):
            values.pop(key)
        alert = AlertDTO.model_validate(values)
        loaded[alert.id] = alert
    state.alerts = loaded


async def save_alerts(
    session: AsyncSession, farm_id: UUID, state: StoreState, before: dict[str, AlertDTO]
) -> None:
    removed = set(before) - set(state.alerts)
    if removed:
        await session.execute(
            update(alerts)
            .where(alerts.c.farm_id == farm_id, alerts.c.public_id.in_(removed))
            .values(dismissed=True)
        )
    for position, (public_id, alert) in enumerate(state.alerts.items()):
        if before.get(public_id) == alert:
            continue
        if public_id in before:
            values = alert.model_dump()
            values.pop("id")
            await session.execute(
                update(alerts)
                .where(alerts.c.farm_id == farm_id, alerts.c.public_id == public_id)
                .values(**values)
            )
        else:
            await session.execute(
                insert(alerts).values(**alert_values(farm_id, alert, position))
            )
