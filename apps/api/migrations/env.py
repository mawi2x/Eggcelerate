"""Async Alembic runner; DATABASE_URL is required and never printed."""

import asyncio
import os

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from eggcelerate_api.database.schema import metadata


def run(connection):
    context.configure(
        connection=connection,
        target_metadata=metadata,
        version_table_schema=context.config.attributes.get("version_table_schema"),
    )
    with context.begin_transaction():
        context.run_migrations()


async def online():
    engine = create_async_engine(os.environ["DATABASE_URL"], poolclass=NullPool)
    try:
        async with engine.connect() as connection:
            await connection.run_sync(run)
    finally:
        await engine.dispose()


if context.is_offline_mode():
    context.configure(
        url=os.environ["DATABASE_URL"],
        target_metadata=metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()
elif context.config.attributes.get("connection") is not None:
    run(context.config.attributes["connection"])
else:
    asyncio.run(online())
