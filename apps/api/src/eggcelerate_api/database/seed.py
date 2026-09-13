"""Explicit development seed: python -m eggcelerate_api.database.seed."""

import asyncio

from ..config import load_settings
from .store import PostgresStore


async def main() -> None:
    settings = load_settings()
    if settings.app_env not in ("development", "test"):
        raise RuntimeError("Development seed is not allowed in production.")
    if not settings.database_url:
        raise ValueError("DATABASE_URL is required for seeding.")
    database = PostgresStore(settings.database_url, settings.default_farm_id)
    try:
        await database.seed()
        print(
            "Development farm and missing modes, chambers, devices, and preferences seeded."
        )
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(main())
