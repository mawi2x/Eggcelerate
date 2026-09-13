"""Incubator reads, commands, turn idempotency, and readings windows."""

from fastapi.testclient import TestClient

from .conftest import make_client

client: TestClient = make_client()


def test_list_and_get_incubators():
    body = client.get("/api/v1/incubators").json()
    assert body["ok"] is True
    assert len(body["data"]) == 12
    one = client.get("/api/v1/incubators/chamber-1").json()
    assert one["data"]["name"] == "Chamber One"
    assert one["data"]["turn_interval_min"] == 240
    missing = client.get("/api/v1/incubators/chamber-99")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "not_found"


def test_create_validates_and_assigns_server_ids():
    bad = client.post(
        "/api/v1/incubators",
        json={"name": "", "device_id": "EGG-2001", "mode_id": "broiler"},
    )
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "validation_error"
    unknown_mode = client.post(
        "/api/v1/incubators",
        json={"name": "New", "device_id": "EGG-2001", "mode_id": "nope"},
    )
    assert unknown_mode.status_code == 422
    created = client.post(
        "/api/v1/incubators",
        json={
            "name": "Chamber Thirteen",
            "device_id": "EGG-1015",
            "mode_id": "broiler",
        },
    )
    assert created.status_code == 201
    data = created.json()["data"]
    assert data["name"] == "Chamber Thirteen"
    assert data["day_of_incubation"] == 0
    assert data["cycle_phase"] == "ready"
    assert data["id"] not in ("", "Chamber Thirteen")
    assert data["paired"] is True
    assert data["connection_state"] == "connected"


def test_profile_and_configuration_patches():
    renamed = client.patch("/api/v1/incubators/chamber-2", json={"name": "Two"})
    assert renamed.json()["data"]["name"] == "Two"
    derived = client.patch("/api/v1/incubators/chamber-2", json={"status": "optimal"})
    assert derived.status_code == 422
    empty = client.patch("/api/v1/incubators/chamber-2", json={})
    assert empty.status_code == 422
    configured = client.patch(
        "/api/v1/incubators/chamber-2",
        json={"mode_id": "quail", "turn_interval_min": 180},
    )
    assert configured.json()["data"]["mode_id"] == "quail"
    assert configured.json()["data"]["turn_interval_min"] == 180


def test_reconnect_reports_unreachable_devices():
    ok = client.post("/api/v1/incubators/chamber-2/reconnect", json={})
    assert ok.json()["data"]["paired"] is True
    assert ok.json()["data"]["connection_state"] == "connected"
    stranded = client.post("/api/v1/incubators/chamber-3/reconnect", json={})
    assert stranded.status_code == 503
    assert stranded.json()["error"]["code"] == "offline"


def test_turn_accepts_and_replays_by_command_id():
    first = client.post(
        "/api/v1/incubators/chamber-1/commands/turn",
        json={},
        headers={"Idempotency-Key": "cmd-s1"},
    )
    assert first.json()["data"] == {"command_id": "cmd-s1", "status": "accepted"}
    replay = client.post(
        "/api/v1/incubators/chamber-1/commands/turn",
        json={},
        headers={"Idempotency-Key": "cmd-s1"},
    )
    assert replay.json()["data"]["command_id"] == "cmd-s1"
    missing = client.post("/api/v1/incubators/chamber-99/commands/turn", json={})
    assert missing.status_code == 404


def test_readings_windows_are_ordered_and_bounded():
    for window, count in (("24h", 13), ("7d", 85)):
        body = client.get(
            f"/api/v1/incubators/chamber-1/readings?window={window}"
        ).json()
        assert len(body["data"]) == count, window
        stamps = [point["observed_at"] for point in body["data"]]
        assert stamps == sorted(stamps)
    full = client.get("/api/v1/incubators/chamber-1/readings?window=full").json()
    assert len(full["data"]) == 9 * 12 + 1
    bad = client.get("/api/v1/incubators/chamber-1/readings?window=forever")
    assert bad.status_code == 422
