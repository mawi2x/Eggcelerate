"""Prove fresh and populated upgrades using databases owned by this invocation.

Requires TEST_DATABASE_URL pointing to loopback eggcelerate_test on port 55432
and a disposable role with CREATEDB. Never drops or alters the supplied database.
"""

import asyncio
import os
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

API = Path(__file__).resolve().parents[1]


def migrate(url: str, revision: str) -> None:
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", revision],
        cwd=API,
        env={**os.environ, "DATABASE_URL": url},
        check=True,
    )


async def verify() -> None:
    source = make_url(os.environ["TEST_DATABASE_URL"])
    if (
        source.database != "eggcelerate_test"
        or source.host not in {"localhost", "127.0.0.1", "::1"}
        or source.port != 55432
    ):
        raise ValueError("Only loopback eggcelerate_test on port 55432 is allowed")
    admin = create_async_engine(source, isolation_level="AUTOCOMMIT")
    try:
        for populated in (False, True):
            name = f"eggcelerate_migration_{uuid4().hex}"
            async with admin.connect() as conn:
                await conn.execute(text(f'CREATE DATABASE "{name}"'))
            target = source.set(database=name)
            engine = create_async_engine(target)
            url = target.render_as_string(hide_password=False)
            farm_id = uuid4()
            try:
                if populated:
                    migrate(url, "0001")
                    async with engine.begin() as conn:
                        await conn.execute(
                            text("INSERT INTO farms(id, name) VALUES (:id, :name)"),
                            {"id": farm_id, "name": "Preserve migration fixture"},
                        )
                        await conn.execute(
                            text(
                                "INSERT INTO modes (id, farm_id, public_id, position, name, "
                                "built_in, temp_min, temp_max, humidity_min, humidity_max, "
                                "incubation_days, turn_interval_min, temp_hysteresis_c, "
                                "humidity_hysteresis_pct) VALUES "
                                "(:id, :farm, 'upgrade-mode', 0, 'Preserved mode', false, "
                                "37.5, 37.8, 55, 60, 21, 240, 0.2, 2)"
                            ),
                            {"id": uuid4(), "farm": farm_id},
                        )
                migrate(url, "head")
                async with engine.connect() as conn:
                    assert (
                        await conn.scalar(
                            text(
                                "SELECT count(*) FROM timescaledb_information.hypertables"
                            )
                        )
                        > 0
                    )
                    if populated:
                        assert (
                            await conn.scalar(
                                text("SELECT name FROM farms WHERE id=:id"),
                                {"id": farm_id},
                            )
                            == "Preserve migration fixture"
                        )
                        assert (
                            await conn.scalar(
                                text("SELECT name FROM modes WHERE farm_id=:id"),
                                {"id": farm_id},
                            )
                            == "Preserved mode"
                        )
                print(f"{'Populated' if populated else 'Fresh'} upgrade passed")
            finally:
                await engine.dispose()
                async with admin.connect() as conn:
                    await conn.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
    finally:
        await admin.dispose()


if __name__ == "__main__":
    asyncio.run(verify())
