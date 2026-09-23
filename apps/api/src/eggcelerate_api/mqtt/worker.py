"""Opt-in local simulator worker; broker credentials/ACLs are a deployment concern."""

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass
from datetime import UTC, datetime

import paho.mqtt.client as mqtt
from sqlalchemy.exc import SQLAlchemyError

from ..config import load_settings
from ..database.store import PostgresStore
from ..errors import AppError
from .commands import apply_ack, claim_commands, expire_commands
from .telemetry import ingest_telemetry

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class InboundMqttMessage:
    topic: str
    payload: bytes
    mid: int
    qos: int
    received_at: datetime | None = None

    @property
    def is_ack(self) -> bool:
        return self.topic.endswith("/ack")


class MqttInputQueues:
    """Reserve an unbounded QoS1 lane for ACKs; bound and shed QoS0 telemetry."""

    def __init__(self, telemetry_capacity: int = 1000):
        self.acknowledgements: asyncio.Queue[InboundMqttMessage] = asyncio.Queue()
        self.telemetry: asyncio.Queue[InboundMqttMessage] = asyncio.Queue(
            maxsize=telemetry_capacity
        )
        self.available = asyncio.Event()
        self.dropped_ack_count = 0
        self.dropped_telemetry_count = 0

    def enqueue(self, message: InboundMqttMessage) -> bool:
        if message.is_ack:
            self.acknowledgements.put_nowait(message)
        elif self.telemetry.full():
            self.dropped_telemetry_count += 1
            if (
                self.dropped_telemetry_count == 1
                or self.dropped_telemetry_count % 100 == 0
            ):
                log.warning(
                    "MQTT telemetry queue full; message discarded (total=%d)",
                    self.dropped_telemetry_count,
                )
            return False
        else:
            self.telemetry.put_nowait(message)
        self.available.set()
        return True

    def drop(self, message: InboundMqttMessage) -> None:
        if message.is_ack:
            self.dropped_ack_count += 1
            log.warning(
                "MQTT ACK discarded before processing (total=%d)",
                self.dropped_ack_count,
            )
        else:
            self.dropped_telemetry_count += 1

    async def get(self) -> InboundMqttMessage:
        while True:
            try:
                return self.acknowledgements.get_nowait()
            except asyncio.QueueEmpty:
                pass
            try:
                return self.telemetry.get_nowait()
            except asyncio.QueueEmpty:
                pass
            self.available.clear()
            if not self.acknowledgements.empty() or not self.telemetry.empty():
                continue
            await self.available.wait()


async def run() -> None:
    settings = load_settings()
    if settings.storage_backend != "postgres_incubators":
        raise ValueError("MQTT worker requires PostgreSQL")
    database = PostgresStore(settings.database_url, settings.default_farm_id)
    queues = MqttInputQueues()
    last_rejection_log: dict[str, float] = {}
    loop = asyncio.get_running_loop()
    dispatch = os.environ.get("SIMULATOR_DISPATCH_ENABLED") == "true"
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, manual_ack=True)
    if os.environ.get("MQTT_USERNAME"):
        client.username_pw_set(
            os.environ["MQTT_USERNAME"], os.environ.get("MQTT_PASSWORD")
        )

    def connected(client, userdata, flags, reason_code, properties):
        if not reason_code.is_failure:
            client.subscribe("eggcelerate/v1/devices/+/telemetry", qos=0)
            client.subscribe("eggcelerate/v1/devices/+/ack", qos=1)

    def acknowledge(inbound: InboundMqttMessage):
        if inbound.qos > 0:
            result = client.ack(inbound.mid, inbound.qos)
            if result != mqtt.MQTTErrorCode.MQTT_ERR_SUCCESS:
                log.warning(
                    "Could not acknowledge MQTT message mid=%d qos=%d",
                    inbound.mid,
                    inbound.qos,
                )

    def message(client, userdata, message):
        inbound = InboundMqttMessage(
            message.topic,
            bytes(message.payload),
            message.mid,
            message.qos,
            datetime.now(UTC),
        )
        if len(inbound.payload) > 16384:

            def discard_oversized():
                queues.drop(inbound)
                acknowledge(inbound)

            try:
                loop.call_soon_threadsafe(discard_oversized)
            except RuntimeError:
                if inbound.is_ack:
                    queues.dropped_ack_count += 1
                    log.error(
                        "Oversized MQTT ACK arrived after worker shutdown; dropped_ack_count=%d",
                        queues.dropped_ack_count,
                    )
            return
        try:
            loop.call_soon_threadsafe(queues.enqueue, inbound)
        except RuntimeError:
            if inbound.is_ack:
                queues.drop(inbound)
                log.error(
                    "MQTT ACK arrived after worker shutdown; dropped_ack_count=%d",
                    queues.dropped_ack_count,
                )

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
            inbound = None
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
                    inbound = await asyncio.wait_for(queues.get(), timeout=1)
                except TimeoutError:
                    continue
                try:
                    async with database.sessions.begin() as session:
                        if inbound.is_ack:
                            await apply_ack(
                                session,
                                database.farm_id,
                                inbound.topic,
                                inbound.payload,
                                received_at=inbound.received_at,
                            )
                        else:
                            await ingest_telemetry(
                                session,
                                database.farm_id,
                                inbound.topic,
                                inbound.payload,
                            )
                except AppError as exc:
                    key = exc.code
                    now = time.monotonic()
                    if now - last_rejection_log.get(key, float("-inf")) >= 30:
                        last_rejection_log[key] = now
                        log.warning(
                            "Rejected MQTT message topic=%s code=%s",
                            inbound.topic,
                            exc.code,
                        )
                    if inbound.is_ack:
                        queues.drop(inbound)
                        log.warning(
                            "MQTT ACK discarded after validation; total=%d",
                            queues.dropped_ack_count,
                        )
                acknowledge(inbound)
            except SQLAlchemyError, OSError, TimeoutError:
                log.warning("MQTT database operation unavailable; retrying")
                if inbound is not None and inbound.is_ack:
                    queues.enqueue(inbound)
                elif inbound is not None:
                    queues.dropped_telemetry_count += 1
                await asyncio.sleep(1)
    finally:
        client.disconnect()
        client.loop_stop()
        await database.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run())
