"""Envelope discipline, idempotent retries, and startup guards."""

import pytest
from fastapi.testclient import TestClient

from eggcelerate_api.config import Settings, load_settings

from .conftest import make_client

client: TestClient = make_client()


def test_create_retries_with_same_key_create_once():
    before = len(client.get("/api/v1/incubators").json()["data"])
    first = client.post(
        "/api/v1/incubators",
        json={"name": "Retry", "device_id": "EGG-9001", "mode_id": "broiler"},
        headers={"Idempotency-Key": "retry-1"},
    )
    second = client.post(
        "/api/v1/incubators",
        json={"name": "Retry", "device_id": "EGG-9001", "mode_id": "broiler"},
        headers={"Idempotency-Key": "retry-1"},
    )
    assert first.json()["data"]["id"] == second.json()["data"]["id"]
    after = client.get("/api/v1/incubators").json()["data"]
    assert len(after) == before + 1


def test_validation_errors_share_one_envelope_shape():
    response = client.post(
        "/api/v1/incubators/chamber-1/cycles",
        json={"mode_id": "broiler", "total_eggs": "many"},
    )
    assert response.status_code == 422
    body = response.json()
    assert body["ok"] is False
    assert body["error"]["code"] == "validation_error"
    assert isinstance(body["error"]["details"], list)


def test_production_refuses_disabled_auth():
    with pytest.raises(RuntimeError):
        load_settings({"APP_ENV": "production", "AUTH_MODE": "disabled"})


def test_unknown_auth_mode_is_rejected():
    with pytest.raises(ValueError):
        load_settings({"APP_ENV": "development", "AUTH_MODE": "token"})


def test_production_sessions_require_https_cors_origin():
    with pytest.raises(ValueError, match="HTTPS web origin"):
        load_settings(
            {
                "APP_ENV": "production",
                "AUTH_MODE": "sessions",
                "STORAGE_BACKEND": "postgres_incubators",
                "DATABASE_URL": "postgresql+asyncpg://user:pass@db/eggcelerate",
                "CORS_ORIGINS": "",
            }
        )


def test_production_defaults_registration_closed_and_requires_rate_limit_secret():
    settings = load_settings(
        {
            "APP_ENV": "production",
            "AUTH_MODE": "sessions",
            "STORAGE_BACKEND": "postgres_incubators",
            "DATABASE_URL": "postgresql+asyncpg://user:pass@db/eggcelerate",
            "CORS_ORIGINS": "https://farm.example.com",
            "AUTH_RATE_LIMIT_KEY": "a" * 32,
        }
    )
    assert settings.public_registration_enabled is False

    with pytest.raises(ValueError, match="AUTH_RATE_LIMIT_KEY"):
        load_settings(
            {
                "APP_ENV": "production",
                "AUTH_MODE": "sessions",
                "STORAGE_BACKEND": "postgres_incubators",
                "DATABASE_URL": "postgresql+asyncpg://user:pass@db/eggcelerate",
                "CORS_ORIGINS": "https://farm.example.com",
            }
        )

    with pytest.raises(ValueError, match="Public registration"):
        load_settings(
            {
                "APP_ENV": "production",
                "AUTH_MODE": "sessions",
                "STORAGE_BACKEND": "postgres_incubators",
                "DATABASE_URL": "postgresql+asyncpg://user:pass@db/eggcelerate",
                "CORS_ORIGINS": "https://farm.example.com",
                "AUTH_RATE_LIMIT_KEY": "a" * 32,
                "PUBLIC_REGISTRATION_ENABLED": "true",
            }
        )


def test_test_settings_resolve_cleanly():
    settings = Settings(app_env="test")
    assert settings.api_port == 8000
    assert "http://localhost:5173" in settings.cors_origins
