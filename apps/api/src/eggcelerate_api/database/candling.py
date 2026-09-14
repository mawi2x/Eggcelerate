"""Cycle-scoped journals. Tombstones prevent seed from reviving deleted entries."""

from typing import Any
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import CandlingEntryDTO
from ..store import MemoryStore
from .schema import candling_entries as entries
from .schema import candling_photos as photos
from .schema import cycles


def entry_values(farm: UUID, cycle_id: str, entry: CandlingEntryDTO) -> dict[str, Any]:
    values = entry.model_dump()
    values.pop("photo_keys")
    values["public_id"] = values.pop("id")
    # Explicit NULL clears optional fields when replacing an existing entry.
    values.setdefault("developing_eggs", None)
    values.setdefault("stopped_developing_eggs", None)
    return {"farm_id": farm, "cycle_id": cycle_id, "deleted": False, **values}


async def replace_photos(
    session: AsyncSession, farm: UUID, cycle_id: str, entry: CandlingEntryDTO
) -> None:
    await session.execute(
        delete(photos).where(
            photos.c.farm_id == farm,
            photos.c.cycle_id == cycle_id,
            photos.c.entry_id == entry.id,
        )
    )
    for position, key in enumerate(entry.photo_keys):
        await session.execute(
            photos.insert().values(
                farm_id=farm,
                cycle_id=cycle_id,
                entry_id=entry.id,
                position=position,
                photo_key=key,
            )
        )


async def seed_candling(session: AsyncSession, farm: UUID, state: MemoryStore) -> None:
    existing_cycles = set(
        (
            await session.scalars(select(cycles.c.id).where(cycles.c.farm_id == farm))
        ).all()
    )
    for unit in state.incubators.values():
        # Seed only the original fixture cycle, never the current replacement cycle.
        cycle_id = f"seed-cycle-{unit.id}"
        if cycle_id not in existing_cycles:
            continue
        for entry in unit.candling_entries:
            inserted = await session.scalar(
                pg_insert(entries)
                .values(**entry_values(farm, cycle_id, entry))
                .on_conflict_do_nothing()
                .returning(entries.c.public_id)
            )
            if inserted is not None:
                await replace_photos(session, farm, cycle_id, entry)


async def load_candling(session: AsyncSession, farm: UUID, state: MemoryStore) -> None:
    rows = (
        (
            await session.execute(
                select(entries)
                .where(entries.c.farm_id == farm, entries.c.deleted.is_(False))
                .order_by(entries.c.day, entries.c.public_id)
            )
        )
        .mappings()
        .all()
    )
    photo_rows = (
        (
            await session.execute(
                select(photos)
                .where(photos.c.farm_id == farm)
                .order_by(photos.c.position)
            )
        )
        .mappings()
        .all()
    )
    photo_keys: dict[tuple[str, str], list[str]] = {}
    for row in photo_rows:
        photo_keys.setdefault((row["cycle_id"], row["entry_id"]), []).append(
            row["photo_key"]
        )
    journals: dict[str, list[CandlingEntryDTO]] = {}
    for row in rows:
        values = {
            key: value
            for key, value in row.items()
            if key not in ("farm_id", "cycle_id", "public_id", "deleted")
            and value is not None
        }
        values["id"] = row["public_id"]
        values["photo_keys"] = photo_keys.get((row["cycle_id"], row["public_id"]), [])
        journals.setdefault(row["cycle_id"], []).append(
            CandlingEntryDTO.model_validate(values)
        )
    for unit in state.incubators.values():
        journal = (
            journals.get(state.current_cycles.get(unit.id, ""), [])
            if unit.day_of_incubation > 0
            else []
        )
        state.incubators[unit.id] = unit.model_copy(
            update={
                "candling_entries": journal,
                "candled_days": sorted({e.day for e in journal}),
            }
        )


async def save_candling(
    session: AsyncSession,
    farm: UUID,
    state: MemoryStore,
    before: dict[str, tuple[str | None, list[CandlingEntryDTO]]],
) -> None:
    for unit in state.incubators.values():
        cycle_id = state.current_cycles.get(unit.id)
        old_cycle, old_entries = before.get(unit.id, (None, []))
        # Lifecycle clears the visible projection while archived journals remain intact.
        if not cycle_id or cycle_id != old_cycle or unit.day_of_incubation == 0:
            continue
        old = {e.id: e for e in old_entries}
        current = {e.id: e for e in unit.candling_entries}
        removed = set(old) - set(current)
        if removed:
            await session.execute(
                update(entries)
                .where(
                    entries.c.farm_id == farm,
                    entries.c.cycle_id == cycle_id,
                    entries.c.public_id.in_(removed),
                )
                .values(deleted=True)
            )
        for entry in current.values():
            if entry == old.get(entry.id):
                continue
            previous = (
                (
                    await session.execute(
                        select(entries).where(
                            entries.c.farm_id == farm,
                            entries.c.cycle_id == cycle_id,
                            entries.c.day == entry.day,
                        )
                    )
                )
                .mappings()
                .first()
            )
            if previous and previous["deleted"] and previous["public_id"] != entry.id:
                # Explicit recreation can replace a seeded identity. Remove only
                # its tombstone and children; the new day row still blocks reseeding.
                await session.execute(
                    delete(photos).where(
                        photos.c.farm_id == farm,
                        photos.c.cycle_id == cycle_id,
                        photos.c.entry_id == previous["public_id"],
                    )
                )
                await session.execute(
                    delete(entries).where(
                        entries.c.farm_id == farm,
                        entries.c.cycle_id == cycle_id,
                        entries.c.public_id == previous["public_id"],
                    )
                )
            values = entry_values(farm, cycle_id, entry)
            await session.execute(
                pg_insert(entries)
                .values(**values)
                .on_conflict_do_update(
                    index_elements=[
                        entries.c.farm_id,
                        entries.c.cycle_id,
                        entries.c.public_id,
                    ],
                    set_=values,
                )
            )
            await replace_photos(session, farm, cycle_id, entry)
