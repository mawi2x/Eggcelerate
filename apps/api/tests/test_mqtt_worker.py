"""The worker keeps QoS1 command outcomes ahead of lossy sensor traffic."""

import asyncio

import pytest

from eggcelerate_api.mqtt.worker import InboundMqttMessage, MqttInputQueues, run


def test_ack_lane_is_not_blocked_or_dropped_by_full_telemetry_queue():
    async def run():
        queues = MqttInputQueues(telemetry_capacity=1)
        assert queues.enqueue(
            InboundMqttMessage("eggcelerate/v1/devices/EGG-1/telemetry", b"t1", 1, 0)
        )
        assert not queues.enqueue(
            InboundMqttMessage("eggcelerate/v1/devices/EGG-1/telemetry", b"t2", 2, 0)
        )
        for mid in range(3, 6):
            assert queues.enqueue(
                InboundMqttMessage("eggcelerate/v1/devices/EGG-1/ack", b"ack", mid, 1)
            )

        for expected_mid in range(3, 6):
            message = await queues.get()
            assert message.is_ack
            assert message.mid == expected_mid
        assert (await queues.get()).payload == b"t1"
        assert queues.dropped_ack_count == 0
        assert queues.dropped_telemetry_count == 1

    asyncio.run(run())


def test_worker_counts_acknowledgements_it_discards():
    queues = MqttInputQueues()
    queues.drop(InboundMqttMessage("eggcelerate/v1/devices/EGG-1/ack", b"bad", 1, 1))
    assert queues.dropped_ack_count == 1


def test_production_cannot_start_the_simulator_mqtt_worker(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("AUTH_MODE", "sessions")
    monkeypatch.setenv("STORAGE_BACKEND", "postgres_incubators")
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://user:pass@db/eggcelerate")
    monkeypatch.setenv("CORS_ORIGINS", "https://farm.example.com")
    monkeypatch.setenv("AUTH_RATE_LIMIT_KEY", "x" * 32)
    monkeypatch.delenv("PUBLIC_REGISTRATION_ENABLED", raising=False)
    with pytest.raises(RuntimeError, match="simulator-only"):
        asyncio.run(run())
