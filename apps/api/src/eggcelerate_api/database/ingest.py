"""Explicit local JSON telemetry import; never generates samples automatically."""

import argparse
import asyncio
import json
from pathlib import Path

from sqlalchemy import select

from ..config import load_settings
from .readings import TelemetrySample, ingest_sample
from .schema import incubators
from .store import PostgresStore


async def import_samples(incubator_id: str, path: Path) -> None:
    settings = load_settings()
    if settings.app_env not in ("development", "test"):
        raise RuntimeError("Development ingestion is not allowed in production.")
    if not settings.database_url:
        raise ValueError("DATABASE_URL is required.")
    payload = json.loads(path.read_text())
    if not isinstance(payload, list):
        raise TypeError("Input must be a JSON array of telemetry samples.")
    samples = [TelemetrySample.model_validate(value) for value in payload]
    database = PostgresStore(settings.database_url, settings.default_farm_id)
    try:
        async with database.sessions.begin() as session:
            device = await session.scalar(
                select(incubators.c.device_id).where(
                    incubators.c.farm_id == database.farm_id,
                    incubators.c.public_id == incubator_id,
                )
            )
            if device is None:
                raise ValueError("Incubator not found in the configured farm.")
            inserted = 0
            for sample in samples:
                inserted += await ingest_sample(
                    session, database.farm_id, device, sample
                )
        print(f"Imported {inserted} samples; {len(samples) - inserted} exact retries.")
    finally:
        await database.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("incubator_id")
    parser.add_argument("json_file", type=Path)
    args = parser.parse_args()
    asyncio.run(import_samples(args.incubator_id, args.json_file))


if __name__ == "__main__":
    main()
