"""Database primitives shared by the registration endpoint and operator CLI."""

from uuid import UUID

from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.preferences import preference_values
from ..database.schema import farm_memberships, farm_preferences, farms, modes, users
from ..database.store import mode_values
from ..store import MemoryStore


async def create_farm_owner(
    session: AsyncSession,
    *,
    user_id: UUID,
    farm_id: UUID,
    email: str,
    password_hash: str,
    display_name: str,
    farm_name: str,
) -> None:
    """Create an owner, a separate farm, and the farm's built-in defaults."""
    await session.execute(
        insert(users).values(
            id=user_id,
            email=email,
            password_hash=password_hash,
            display_name=display_name,
        )
    )
    await session.execute(insert(farms).values(id=farm_id, name=farm_name))
    await session.execute(
        insert(farm_memberships).values(
            farm_id=farm_id,
            user_id=user_id,
            role="owner",
        )
    )
    seed = MemoryStore()
    seed.preferences = seed.preferences.model_copy(
        update={
            "farm_name": farm_name,
            "account_holder": display_name,
            "display_name": display_name,
        }
    )
    for position, mode in enumerate(seed.modes.values()):
        await session.execute(
            insert(modes).values(**mode_values(farm_id, mode, position))
        )
    await session.execute(
        insert(farm_preferences).values(**preference_values(farm_id, seed.preferences))
    )
