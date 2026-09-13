"""Health, readiness, and envelope discipline."""

from fastapi.testclient import TestClient

from .conftest import make_client

client: TestClient = make_client()


def test_healthz_reports_liveness_without_database():
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readyz_reports_configured_adapters():
    response = client.get("/readyz")
    assert response.status_code == 200
    body = response.json()
    assert body["ready"] is True
    assert body["checks"]["store"] == "memory"


def test_unknown_route_uses_the_error_envelope():
    response = client.get("/api/v1/nope")
    assert response.status_code == 404
    body = response.json()
    assert body["ok"] is False
    assert body["error"]["code"] == "not_found"
