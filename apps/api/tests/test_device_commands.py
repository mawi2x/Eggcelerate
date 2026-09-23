"""Command acceptance, durable dispatch, ACK correlation and terminal precedence."""

import asyncio
import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from eggcelerate_api.database.schema import device_commands
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.errors import AppError
from eggcelerate_api.main import create_app
from eggcelerate_api.mqtt.commands import apply_ack, claim_commands

BASE = "/api/v1/incubators/chamber-1"


@pytest.mark.parametrize("outcome", ["acked", "rejected", "timed_out"])
def test_durable_outcomes_and_terminal_precedence(settings, outcome):
    with TestClient(create_app(settings)) as client:
        before = client.get(BASE).json()["data"]
        accepted = client.post(
            BASE + "/commands/turn", headers={"Idempotency-Key": "original"}
        ).json()
        assert (
            client.get(BASE).json()["data"]["last_turned_at"]
            == before["last_turned_at"]
        )
        assert (
            client.get(BASE + "/commands/original").json()["data"]["status"]
            == "pending"
        )

    async def verify():
        database = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with database.sessions.begin() as session:
                messages = await claim_commands(
                    session, database.farm_id, datetime.now(UTC)
                )
            assert len(messages) == 1
            message = messages[0]
            assert message["command_id"] != "original"
            ack = {
                "schema_v": 1,
                "command_id": message["command_id"],
                "device_id": message["device_id"],
                "seq": 1,
                "observed_at": datetime.now(UTC).isoformat(),
                "status": "acked" if outcome != "rejected" else "rejected",
                "error_code": None if outcome != "rejected" else "rejected_by_state",
            }
            topic = f"eggcelerate/v1/devices/{ack['device_id']}/ack"
            async with database.sessions.begin() as session:
                if outcome == "timed_out":
                    await session.execute(
                        update(device_commands)
                        .where(device_commands.c.farm_id == database.farm_id)
                        .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
                    )
                applied = await apply_ack(
                    session, database.farm_id, topic, json.dumps(ack).encode()
                )
                assert applied is (outcome != "timed_out")
            async with database.sessions.begin() as session:
                # A delayed conflicting terminal ACK cannot replace the outcome.
                ack["status"] = "rejected" if outcome == "acked" else "acked"
                ack["error_code"] = None
                assert not await apply_ack(
                    session, database.farm_id, topic, json.dumps(ack).encode()
                )
                row = (
                    (
                        await session.execute(
                            select(device_commands).where(
                                device_commands.c.farm_id == database.farm_id
                            )
                        )
                    )
                    .mappings()
                    .one()
                )
                assert row["status"] == outcome
                assert row["attempts"] == 1
            async with database.sessions.begin() as session:
                with pytest.raises(AppError):
                    await apply_ack(session, uuid4(), topic, json.dumps(ack).encode())
        finally:
            await database.close()

    asyncio.run(verify())
    with TestClient(create_app(settings)) as client:
        assert (
            client.post(
                BASE + "/commands/turn", headers={"Idempotency-Key": "original"}
            ).json()
            == accepted
        )
        after = client.get(BASE).json()["data"]
        assert after["turn_command_status"] == outcome
        assert (after["last_turned_at"] != before["last_turned_at"]) is (
            outcome == "acked"
        )
        assert (
            client.get(BASE + "/commands/original").json()["data"]["status"] == outcome
        )
        assert (
            client.get("/api/v1/incubators/chamber-2/commands/original").status_code
            == 404
        )
