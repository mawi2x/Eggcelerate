"""Read-only, request-local projections; never enter the mutation unit of work."""

from sqlalchemy import select, text

from ..errors import AppError
from ..store import MemoryStore
from .alerts import load_alerts
from .candling import load_candling
from .cycles import load_cycles, load_history
from .incubators import load_incubators
from .preferences import preferences_from_row
from .schema import device_commands, farm_preferences, farms, incubators, modes
from .store import PostgresStore, mode_from_row


async def read_state(
    database: PostgresStore, resource: str, public_id: str | None = None
) -> MemoryStore:
    # The latest sensor projection is loaded into this request-local state. The
    # in-memory values remain an explicit development fallback when a device
    # has never sent telemetry; telemetry_status marks that fallback offline.
    state = MemoryStore()
    farm = database.farm_id
    async with database.sessions.begin() as session:
        await session.execute(
            text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
        )
        if await session.scalar(select(farms.c.id).where(farms.c.id == farm)) is None:
            raise AppError("offline", "Development farm is not seeded.")
        if resource in ("modes", "incubators"):
            query = (
                select(modes)
                .where(modes.c.farm_id == farm)
                .order_by(modes.c.position, modes.c.public_id)
            )
            if public_id is not None:
                if resource == "modes":
                    query = query.where(modes.c.public_id == public_id)
                else:
                    query = query.where(
                        modes.c.id.in_(
                            select(incubators.c.mode_id).where(
                                incubators.c.farm_id == farm,
                                incubators.c.public_id == public_id,
                            )
                        )
                    )
            previous = state.modes
            state.modes = {
                row["public_id"]: mode_from_row(dict(row))
                for row in (await session.execute(query)).mappings()
            }
            if resource == "incubators":
                await load_incubators(session, farm, state, previous, public_id)
                await load_cycles(session, farm, state, current_only=True)
                await load_candling(session, farm, state, current_only=True)
                rows = (
                    await session.execute(
                        select(device_commands)
                        .where(
                            device_commands.c.farm_id == farm,
                            device_commands.c.incubator_id.in_(state.incubators),
                        )
                        .distinct(device_commands.c.incubator_id)
                        .order_by(
                            device_commands.c.incubator_id,
                            device_commands.c.requested_at.desc(),
                            device_commands.c.id.desc(),
                        )
                    )
                ).mappings()
                for row in rows:
                    unit = state.incubators[row["incubator_id"]]
                    state.incubators[unit.id] = unit.model_copy(
                        update={"turn_command_status": row["status"]}
                    )

        elif resource == "cycles":
            await load_history(session, farm, state)
        elif resource == "alerts":
            await load_alerts(session, farm, state)
        elif resource == "preferences":
            preference_row = (
                (
                    await session.execute(
                        select(farm_preferences).where(
                            farm_preferences.c.farm_id == farm
                        )
                    )
                )
                .mappings()
                .first()
            )
            if preference_row is None:
                raise AppError("offline", "Development preferences are not seeded.")
            state.preferences = preferences_from_row(dict(preference_row))
        else:
            raise AppError("not_found", "Unknown read resource.")
    return state
