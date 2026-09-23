"""Opt-in local simulator worker; broker credentials/ACLs are a deployment concern."""

import asyncio
import json
import logging
import os
import time
from datetime import UTC, datetime

import paho.mqtt.client as mqtt
from sqlalchemy.exc import SQLAlchemyError

from ..config import load_settings
from ..database.store import PostgresStore
from ..errors import AppError
from .commands import apply_ack, claim_commands, expire_commands
from .telemetry import ingest_telemetry

log = logging.getLogger(__name__)


async def run() -> None:
    settings = load_settings()
    if settings.storage_backend != "postgres_incubators":
        raise ValueError("MQTT worker requires PostgreSQL")
    database = PostgresStore(settings.database_url, settings.default_farm_id)
    queue: asyncio.Queue[tuple[str, bytes]] = asyncio.Queue(maxsize=1000)
    last_rejection_log: dict[str, float] = {}
    loop = asyncio.get_running_loop()
    dispatch = os.environ.get("SIMULATOR_DISPATCH_ENABLED") == "true"
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    if os.environ.get("MQTT_USERNAME"):
        client.username_pw_set(
            os.environ["MQTT_USERNAME"], os.environ.get("MQTT_PASSWORD")
        )

    def enqueue(topic, payload):
        if not queue.full():
            queue.put_nowait((topic, payload))
        else:
            log.warning("MQTT input queue full; message discarded")

    def connected(client, userdata, flags, reason_code, properties):
        if not reason_code.is_failure:
            client.subscribe("eggcelerate/v1/devices/+/telemetry", qos=0)
            client.subscribe("eggcelerate/v1/devices/+/ack", qos=1)

    def message(client, userdata, message):
        if len(message.payload) <= 16384:
            loop.call_soon_threadsafe(enqueue, message.topic, message.payload)

    client.on_connect = connected
    client.on_message = message
    client.connect_async(
        os.environ.get("MQTT_HOST", "127.0.0.1"),
        int(os.environ.get("MQTT_PORT", "1883")),
    )
    client.reconnect_delay_set(1, 30)
    client.loop_start()
    try:
        while True:
            try:
                async with database.sessions.begin() as session:
                    await expire_commands(session, database.farm_id, datetime.now(UTC))
                if client.is_connected() and dispatch:
                    async with database.sessions.begin() as session:
                        messages = await claim_commands(
                            session, database.farm_id, datetime.now(UTC)
                        )
                    for body in messages:
                        # Non-retained QoS1 + durable retry avoids stale retained
                        # delivery. Simulator replay journal prevents re-execution.
                        client.publish(
                            f"eggcelerate/v1/devices/{body['device_id']}/commands",
                            json.dumps(body),
                            qos=1,
                            retain=False,
                        )
                try:
                    topic, payload = await asyncio.wait_for(queue.get(), timeout=1)
                except TimeoutError:
                    continue
                try:
                    async with database.sessions.begin() as session:
                        if topic.endswith("/ack"):
                            await apply_ack(session, database.farm_id, topic, payload)
                        else:
                            await ingest_telemetry(
                                session, database.farm_id, topic, payload
                            )
                except AppError as exc:
                    key = exc.code
                    now = time.monotonic()
                    if now - last_rejection_log.get(key, float("-inf")) >= 30:
                        last_rejection_log[key] = now
                        log.warning(
                            "Rejected MQTT message topic=%s code=%s", topic, exc.code
                        )
                finally:
                    queue.task_done()
            except (SQLAlchemyError, OSError, TimeoutError):
                log.warning("MQTT database operation unavailable; retrying")
                await asyncio.sleep(1)
    finally:
        client.disconnect()
        client.loop_stop()
        await database.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run())
