"""Modes, alerts, history, and preferences endpoints."""

from fastapi.testclient import TestClient

from .conftest import make_client

client: TestClient = make_client()


def test_mode_crud_with_assignment_guard():
    listed = client.get("/api/v1/modes").json()["data"]
    assert len(listed) == 10
    duplicate = client.post(
        "/api/v1/modes",
        json={
            "id": "broiler",
            "name": "Dup",
            "target_temp_c": {"min": 37, "max": 38},
            "target_humidity_pct": {"min": 50, "max": 60},
            "incubation_days": 21,
            "default_turn_interval_min": 240,
        },
    )
    assert duplicate.status_code == 409
    created = client.post(
        "/api/v1/modes",
        json={
            "id": "test-mode",
            "name": "Test",
            "target_temp_c": {"min": 37, "max": 38},
            "target_humidity_pct": {"min": 50, "max": 60},
            "incubation_days": 21,
            "default_turn_interval_min": 240,
        },
    )
    assert created.status_code == 201
    patched = client.patch(
        "/api/v1/modes/test-mode", json={"incubation_days": 22}
    ).json()["data"]
    assert patched["incubation_days"] == 22
    assert client.patch("/api/v1/modes/test-mode", json={}).status_code == 422
    assert client.delete("/api/v1/modes/broiler").status_code == 409
    assert client.delete("/api/v1/modes/test-mode").json()["data"] == {
        "id": "test-mode"
    }
    assert client.get("/api/v1/modes/nope").status_code == 404


def test_alert_lifecycle_is_atomic():
    listed = client.get("/api/v1/alerts").json()["data"]
    assert len(listed) == 12
    acked = client.post("/api/v1/alerts/a1/acknowledge").json()["data"]
    assert acked["acknowledged_at"] is not None
    assert client.post("/api/v1/alerts/nope/acknowledge").status_code == 404
    cleared = client.post("/api/v1/alerts/actions/clear-acknowledged").json()["data"]
    assert all(item["acknowledged_at"] is None for item in cleared)
    assert len(cleared) == 4
    all_acked = client.post("/api/v1/alerts/actions/acknowledge-all").json()["data"]
    assert len(all_acked) == 4
    assert all(item["acknowledged_at"] is not None for item in all_acked)
    assert client.delete("/api/v1/alerts/a2").json()["data"] == {"id": "a2"}
    assert client.delete("/api/v1/alerts/a2").status_code == 404


def test_history_projects_by_status():
    completed = client.get("/api/v1/cycles?status=completed").json()["data"]
    assert len(completed) == 1
    assert completed[0]["hatched_eggs"] == 20
    stopped = client.get("/api/v1/cycles?status=stopped_early").json()["data"]
    assert len(stopped) == 1
    assert stopped[0]["day_stopped"] == 6
    assert client.get("/api/v1/cycles?status=everything").status_code == 422


def test_preferences_replace_and_validate():
    current = client.get("/api/v1/preferences").json()["data"]
    assert current["farm_name"] == "Sunrise Poultry"
    updated = client.put(
        "/api/v1/preferences", json={**current, "farm_name": "New Farm"}
    ).json()["data"]
    assert updated["farm_name"] == "New Farm"
    bad = client.put("/api/v1/preferences", json={**current, "temperature_unit": "k"})
    assert bad.status_code == 422
