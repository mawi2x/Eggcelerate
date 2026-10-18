"""One-time additive history import; never starts or stops equipment."""

import asyncio

from sqlalchemy import select, update

from .config import load_settings
from .database.cycles import load_cycles, runtime_values
from .database.incubators import load_incubators
from .database.run_history import import_legacy, synchronize
from .database.schema import farms, incubation_runs, modes
from .database.store import PostgresStore, mode_from_row
from .store import MemoryStore


async def main():
    settings = load_settings()
    database = PostgresStore(settings.database_url, settings.default_farm_id)
    imported = 0
    try:
        async with database.sessions.begin() as session:
            farm_ids = list(
                (
                    await session.scalars(
                        select(farms.c.id).order_by(farms.c.id).with_for_update()
                    )
                ).all()
            )
            for farm_id in farm_ids:
                imported += await import_legacy(session, farm_id)
                state = MemoryStore()
                mode_rows = (
                    (
                        await session.execute(
                            select(modes).where(modes.c.farm_id == farm_id)
                        )
                    )
                    .mappings()
                    .all()
                )
                state.modes = {r["public_id"]: mode_from_row(r) for r in mode_rows}
                await load_incubators(session, farm_id, state, {})
                await load_cycles(session, farm_id, state)
                before = {
                    u.id: runtime_values(farm_id, u, state.current_cycles.get(u.id))
                    for u in state.incubators.values()
                }
                prior = set(
                    (
                        await session.scalars(
                            select(incubation_runs.c.id).where(
                                incubation_runs.c.farm_id == farm_id
                            )
                        )
                    ).all()
                )
                await synchronize(session, farm_id, state, before)
                # Preparation times are known, but targets were not captured
                # until now. Never claim their historical values are exact.
                await session.execute(
                    update(incubation_runs)
                    .where(
                        incubation_runs.c.farm_id == farm_id,
                        incubation_runs.c.id.not_in(prior),
                    )
                    .values(approximate=True)
                )
        print(
            f"Imported {imported} earlier cycles; existing preparation captured without changing equipment."
        )
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(main())
