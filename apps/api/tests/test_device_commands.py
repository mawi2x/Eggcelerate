"""Command acceptance, durable dispatch, ACK correlation and terminal precedence."""

import asyncio
import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from eggcelerate_api.database.schema import device_commands, incubator_runtime
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.errors import AppError
from eggcelerate_api.main import create_app
from eggcelerate_api.mqtt.commands import apply_ack, claim_commands, expire_commands
from eggcelerate_api.mqtt.telemetry import ingest_telemetry

BASE = "/api/v1/incubators/chamber-1"


def seed_current_boot(settings):
    async def seed():
        database = PostgresStore(settings.database_url, settings.default_farm_id)
        now = datetime.now(UTC)
        message = {
            "schema_v": 1,
            "device_id": "EGG-1003",
            "incubator_id": "chamber-1",
            "boot_id": "command-test-boot",
            "booted_at": (now - timedelta(minutes=5)).isoformat(),
            "seq": 10,
            "observed_at": (now - timedelta(seconds=1)).isoformat(),
            "temperature_c": 37.6,
            "humidity_pct": 57,
            "water_ok": True,
            "battery_pct": 100,
            "power_source": "grid",
        }
        try:
            async with database.sessions.begin() as session:
                await ingest_telemetry(
                    session,
                    database.farm_id,
                    "eggcelerate/v1/devices/EGG-1003/telemetry",
                    json.dumps(message).encode(),
                )
        finally:
            await database.close()

    asyncio.run(seed())


def create_dispatched_command(settings, key: str) -> dict:
    seed_current_boot(settings)
    with TestClient(create_app(settings)) as client:
        response = client.post(
            BASE + "/commands/turn", headers={"Idempotency-Key": key}
        )
        response.raise_for_status()

    async def claim():
        database = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with database.sessions.begin() as session:
                messages = await claim_commands(
                    session, database.farm_id, datetime.now(UTC)
                )
            assert len(messages) == 1
            return messages[0]
        finally:
            await database.close()

    return asyncio.run(claim())


def test_command_waits_for_a_telemetry_boot_before_dispatch(settings):
    with TestClient(create_app(settings)) as client:
        response = client.post(
            BASE + "/commands/turn", headers={"Idempotency-Key": "no-boot-yet"}
        )
        response.raise_for_status()

    async def verify():
        database = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with database.sessions.begin() as session:
                assert (
                    await claim_commands(session, database.farm_id, datetime.now(UTC))
                    == []
                )
            async with database.sessions() as session:
                command = (
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
                assert command["status"] == "pending"
                assert command["attempts"] == 0
        finally:
            await database.close()

    asyncio.run(verify())


def test_worker_claim_can_be_restricted_to_provisioned_device_ids(settings):
    seed_current_boot(settings)
    with TestClient(create_app(settings)) as client:
        response = client.post(
            BASE + "/commands/turn", headers={"Idempotency-Key": "registered-only"}
        )
        response.raise_for_status()

    async def verify():
        database = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with database.sessions.begin() as session:
                assert (
                    await claim_commands(
                        session,
                        database.farm_id,
                        datetime.now(UTC),
                        device_ids=("EGG-NOT-REGISTERED",),
                    )
                    == []
                )
            async with database.sessions.begin() as session:
                messages = await claim_commands(
                    session,
                    database.farm_id,
                    datetime.now(UTC),
                    device_ids=("EGG-1003",),
                )
            assert len(messages) == 1
            assert messages[0]["device_id"] == "EGG-1003"
        finally:
            await database.close()

    asyncio.run(verify())


def command_ack(
    message: dict,
    observed_at: datetime,
    *,
    boot_id: str | None = None,
    booted_at: datetime | None = None,
    seq: int | None = None,
) -> tuple[str, bytes]:
    ack = {
        "schema_v": 1,
        "command_id": message["command_id"],
        "device_id": message["device_id"],
        "boot_id": boot_id or message["boot_id"],
        "booted_at": (
            booted_at or datetime.fromisoformat(message["booted_at"])
        ).isoformat(),
        "seq": message["seq"] + 1 if seq is None else seq,
        "observed_at": observed_at.isoformat(),
        "status": "acked",
        "error_code": None,
    }
    return (
        f"eggcelerate/v1/devices/{message['device_id']}/ack",
        json.dumps(ack).encode(),
    )


@pytest.mark.parametrize("outcome", ["acked", "rejected", "timed_out"])
def test_durable_outcomes_and_terminal_precedence(settings, outcome):
    seed_current_boot(settings)
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
                "boot_id": message["boot_id"],
                "booted_at": message["booted_at"],
                "seq": message["seq"] + 1,
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


def test_ack_clock_skew_and_expiry_follow_execution_time(settings):
    message = create_dispatched_command(settings, "clock-skew")
    topic, payload = command_ack(message, datetime.now(UTC) + timedelta(seconds=10))

    async def verify():
        database = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with database.sessions.begin() as session:
                assert await apply_ack(session, database.farm_id, topic, payload)
            async with database.sessions() as session:
                command = (
                    (
                        await session.execute(
                            select(device_commands).where(
                                device_commands.c.id == message["command_id"]
                            )
                        )
                    )
                    .mappings()
                    .one()
                )
                assert command["status"] == "acked"
                assert command["executed_at"] is not None
        finally:
            await database.close()

    asyncio.run(verify())


def test_late_ack_with_pre_deadline_execution_is_accepted(settings):
    message = create_dispatched_command(settings, "late-receipt")
    receipt_time = datetime.now(UTC)
    expires_at = receipt_time - timedelta(seconds=1)
    observed_at = expires_at - timedelta(seconds=5)
    topic, payload = command_ack(message, observed_at)

    async def verify():
        database = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with database.sessions.begin() as session:
                await session.execute(
                    update(device_commands)
                    .where(device_commands.c.id == message["command_id"])
                    .values(
                        requested_at=receipt_time - timedelta(seconds=30),
                        expires_at=expires_at,
                    )
                )
                await expire_commands(session, database.farm_id, receipt_time)
                status = await session.scalar(
                    select(device_commands.c.status).where(
                        device_commands.c.id == message["command_id"]
                    )
                )
                assert status == "dispatched"
                assert await apply_ack(session, database.farm_id, topic, payload)
            async with database.sessions() as session:
                status = await session.scalar(
                    select(device_commands.c.status).where(
                        device_commands.c.id == message["command_id"]
                    )
                )
                assert status == "acked"
        finally:
            await database.close()

    asyncio.run(verify())


def test_execution_after_deadline_times_out(settings):
    message = create_dispatched_command(settings, "late-execution")
    now = datetime.now(UTC)
    topic, payload = command_ack(message, now)

    async def verify():
        database = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with database.sessions.begin() as session:
                await session.execute(
                    update(device_commands)
                    .where(device_commands.c.id == message["command_id"])
                    .values(
                        requested_at=now - timedelta(seconds=30),
                        expires_at=now - timedelta(seconds=1),
                    )
                )
                assert not await apply_ack(session, database.farm_id, topic, payload)
            async with database.sessions() as session:
                status = await session.scalar(
                    select(device_commands.c.status).where(
                        device_commands.c.id == message["command_id"]
                    )
                )
                assert status == "timed_out"
        finally:
            await database.close()

    asyncio.run(verify())


def test_ack_beyond_tolerance_is_rejected_without_status_change(settings):
    message = create_dispatched_command(settings, "invalid-ack-clock")
    topic, payload = command_ack(message, datetime.now(UTC) + timedelta(seconds=61))

    async def verify():
        database = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with database.sessions.begin() as session:
                with pytest.raises(AppError):
                    await apply_ack(session, database.farm_id, topic, payload)
            async with database.sessions() as session:
                status = await session.scalar(
                    select(device_commands.c.status).where(
                        device_commands.c.id == message["command_id"]
                    )
                )
                assert status == "dispatched"
        finally:
            await database.close()

    asyncio.run(verify())


def test_stale_boot_ack_cannot_advance_turn(settings):
    message = create_dispatched_command(settings, "stale-boot")
    topic, stale_boot_payload = command_ack(
        message,
        datetime.now(UTC),
        boot_id="previous-boot",
        booted_at=datetime.now(UTC) - timedelta(days=1),
    )
    _, stale_sequence_payload = command_ack(
        message, datetime.now(UTC), seq=message["seq"]
    )

    async def verify():
        database = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with database.sessions() as session:
                cursor_before = await session.scalar(
                    select(incubator_runtime.c.last_turned_at).where(
                        incubator_runtime.c.farm_id == database.farm_id,
                        incubator_runtime.c.incubator_id == "chamber-1",
                    )
                )
            async with database.sessions.begin() as session:
                with pytest.raises(AppError):
                    await apply_ack(
                        session, database.farm_id, topic, stale_boot_payload
                    )
            async with database.sessions.begin() as session:
                with pytest.raises(AppError):
                    await apply_ack(
                        session, database.farm_id, topic, stale_sequence_payload
                    )
            async with database.sessions() as session:
                cursor_after = await session.scalar(
                    select(incubator_runtime.c.last_turned_at).where(
                        incubator_runtime.c.farm_id == database.farm_id,
                        incubator_runtime.c.incubator_id == "chamber-1",
                    )
                )
                status = await session.scalar(
                    select(device_commands.c.status).where(
                        device_commands.c.id == message["command_id"]
                    )
                )
                assert cursor_after == cursor_before
                assert status == "dispatched"
        finally:
            await database.close()

    asyncio.run(verify())
