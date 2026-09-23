"""The worker keeps QoS1 command outcomes ahead of lossy sensor traffic."""

import asyncio
import ssl
from unittest.mock import Mock

import pytest

from eggcelerate_api.mqtt.worker import (
    InboundMqttMessage,
    MqttInputQueues,
    configure_broker_security,
    run,
)


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


def test_broker_credentials_require_verified_tls(monkeypatch):
    monkeypatch.setenv("MQTT_USERNAME", "EGG-1003")
    monkeypatch.setenv("MQTT_PASSWORD", "local-secret")
    monkeypatch.delenv("MQTT_TLS_CA_FILE", raising=False)
    with pytest.raises(ValueError, match="require MQTT_TLS_CA_FILE"):
        configure_broker_security(Mock())


def test_worker_configures_tls_client_identity_and_broker_credentials(
    monkeypatch, tmp_path
):
    ca_file = tmp_path / "ca.pem"
    cert_file = tmp_path / "worker.pem"
    key_file = tmp_path / "worker.key"
    for path in (ca_file, cert_file, key_file):
        path.write_text("test fixture", encoding="utf-8")
    monkeypatch.setenv("MQTT_USERNAME", "egg-worker")
    monkeypatch.setenv("MQTT_PASSWORD", "local-secret")
    monkeypatch.setenv("MQTT_TLS_CA_FILE", str(ca_file))
    monkeypatch.setenv("MQTT_TLS_CERT_FILE", str(cert_file))
    monkeypatch.setenv("MQTT_TLS_KEY_FILE", str(key_file))
    client = Mock()

    configure_broker_security(client)

    client.tls_set.assert_called_once_with(
        ca_certs=str(ca_file),
        certfile=str(cert_file),
        keyfile=str(key_file),
        cert_reqs=ssl.CERT_REQUIRED,
    )
    client.tls_insecure_set.assert_called_once_with(False)
    client.username_pw_set.assert_called_once_with("egg-worker", "local-secret")


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
