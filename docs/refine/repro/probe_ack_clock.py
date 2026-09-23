"""Throwaway probe: ACK clock tolerance / receipt-vs-execution deadline behaviour."""

from __future__ import annotations

import asyncio
import json
import sys
from datetime import UTC, datetime, timedelta
from uuid import uuid4

sys.path.insert(0, "/home/mawi/Projects/eggcelerate/eggcelerate/apps/api/src")

from fastapi.testclient import TestClient
from sqlalchemy import update

from eggcelerate_api.config import Settings
from eggcelerate_api.database.schema import device_commands
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.errors import AppError
from eggcelerate_api.main import create_app
from eggcelerate_api.mqtt.commands import apply_ack, claim_commands

URL = sys.argv[1]
BASE = "/api/v1/incubators/chamber-1"


def setup_farm():
    settings = Settings(
        app_env="test",
        storage_backend="postgres_modes",
        database_url=URL,
        default_farm_id=str(uuid4()),
    )

    async def seed():
        database = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            await database.seed()
        finally:
            await database.close()

    asyncio.run(seed())
    return settings


def run_case(label, *, observed_offset_s, expire_before_s=None):
    settings = setup_farm()
    with TestClient(create_app(settings)) as client:
        client.post(BASE + "/commands/turn", headers={"Idempotency-Key": "k1"})

    async def verify():
        database = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with database.sessions.begin() as session:
                messages = await claim_commands(
                    session, database.farm_id, datetime.now(UTC)
                )
            message = messages[0]
            ack = {
                "schema_v": 1,
                "command_id": message["command_id"],
                "device_id": message["device_id"],
                "seq": 1,
                "observed_at": (
                    datetime.now(UTC) + timedelta(seconds=observed_offset_s)
                ).isoformat(),
                "status": "acked",
                "error_code": None,
            }
            topic = f"eggcelerate/v1/devices/{ack['device_id']}/ack"
            async with database.sessions.begin() as session:
                if expire_before_s is not None:
                    await session.execute(
                        update(device_commands)
                        .where(device_commands.c.farm_id == database.farm_id)
                        .values(
                            expires_at=datetime.now(UTC)
                            - timedelta(seconds=expire_before_s)
                        )
                    )
                try:
                    applied = await apply_ack(
                        session, database.farm_id, topic, json.dumps(ack).encode()
                    )
                    outcome = f"applied={applied}"
                except AppError as exc:
                    outcome = f"AppError code={exc.code}"
            return outcome
        finally:
            await database.close()

    outcome = asyncio.run(verify())
    with TestClient(create_app(settings)) as client:
        status = client.get(BASE).json()["data"]["turn_command_status"]
    print(f"{label}: {outcome}; turn_command_status={status}")


if __name__ == "__main__":
    run_case("device clock +1s   (within skew, correct turn) ", observed_offset_s=1)
    run_case("device clock +10s  (within skew, correct turn) ", observed_offset_s=10)
    run_case("device clock +60s  (at tolerance boundary)      ", observed_offset_s=60)
    run_case("device clock +600s (far future, should reject)  ", observed_offset_s=600)
    run_case(
        "received 1s after expiry, executed 5s before it    ",
        observed_offset_s=-5,
        expire_before_s=1,
    )
    run_case(
        "observed_at before requested_at (clock behind dispatch) ",
        observed_offset_s=-5,
        expire_before_s=-4,
    )
