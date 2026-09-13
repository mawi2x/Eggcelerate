"""Cycle lifecycle atomicity and candling entry commands."""

from fastapi.testclient import TestClient

from .conftest import make_client

client: TestClient = make_client()


def test_start_validates_then_derives_cycle_state():
    assert (
        client.post(
            "/api/v1/incubators/chamber-1/cycles",
            json={"mode_id": "broiler", "total_eggs": 0},
        ).status_code
        == 422
    )
    started = client.post(
        "/api/v1/incubators/chamber-1/cycles",
        json={"mode_id": "broiler", "total_eggs": 24},
    ).json()["data"]
    assert started["day_of_incubation"] == 1
    assert started["cycle_phase"] == "incubating"
    assert started["total_eggs_loaded"] == 24
    assert started["turn_interval_min"] == 240
    assert started["candling_entries"] == []


def test_reset_returns_chamber_to_ready():
    reset = client.post(
        "/api/v1/incubators/chamber-2/cycles/current/reset", json={}
    ).json()["data"]
    assert reset["day_of_incubation"] == 0
    assert reset["cycle_phase"] == "ready"
    assert reset["total_eggs_loaded"] == 0


def test_complete_is_atomic_and_validated():
    bad_counts = client.post(
        "/api/v1/incubators/chamber-1/cycles/current/complete",
        json={"hatched_eggs": 99},
    )
    assert bad_counts.status_code == 422
    before = client.get("/api/v1/cycles?status=completed").json()["data"]
    record = client.post(
        "/api/v1/incubators/chamber-12/cycles/current/complete",
        json={"hatched_eggs": 28},
        headers={"Idempotency-Key": "complete-1"},
    ).json()["data"]
    assert record["hatched_eggs"] == 28
    assert record["chamber_name"] == "Chamber Twelve"
    again = client.post(
        "/api/v1/incubators/chamber-12/cycles/current/complete",
        json={"hatched_eggs": 28},
        headers={"Idempotency-Key": "complete-1"},
    ).json()["data"]
    assert again["id"] == record["id"]
    latest = client.get("/api/v1/cycles?status=completed").json()["data"]
    assert len(latest) == len(before) + 1
    chamber = client.get("/api/v1/incubators/chamber-12").json()["data"]
    assert chamber["day_of_incubation"] == 0
    assert chamber["cycle_phase"] == "ready"


def test_stop_archives_and_marks_stopped_early():
    record = client.post(
        "/api/v1/incubators/chamber-4/cycles/current/stop", json={}
    ).json()["data"]
    assert record["day_stopped"] == 22
    assert record["chamber_name"] == "Chamber Four"
    chamber = client.get("/api/v1/incubators/chamber-4").json()["data"]
    assert chamber["cycle_phase"] == "stopped_early"
    assert chamber["status"] == "warning"
    assert chamber["day_of_incubation"] == 22


def test_candling_crud_by_entry_id():
    created = client.post(
        "/api/v1/incubators/chamber-2/cycles/current/candling-entries",
        json={
            "day": 7,
            "label": "First candling",
            "observed_on": "2026-09-02",
            "fertile_eggs": 20,
            "clear_eggs": 2,
            "uncertain_eggs": 0,
            "note": "",
            "photo_keys": [],
            "checks": ["veining"],
            "checkpoint_type": "first",
        },
    )
    assert created.status_code == 201
    entry_id = created.json()["data"]["id"]
    duplicate = client.post(
        "/api/v1/incubators/chamber-2/cycles/current/candling-entries",
        json={
            "day": 7,
            "label": "Again",
            "observed_on": "2026-09-02",
            "fertile_eggs": 1,
            "clear_eggs": 0,
            "uncertain_eggs": 0,
            "note": "",
            "photo_keys": [],
            "checks": [],
            "checkpoint_type": "first",
        },
    )
    assert duplicate.status_code == 409
    patched = client.patch(
        f"/api/v1/incubators/chamber-2/cycles/current/candling-entries/{entry_id}",
        json={"note": "Recheck"},
    ).json()["data"]
    assert patched["note"] == "Recheck"
    missing_patch = client.patch(
        "/api/v1/incubators/chamber-2/cycles/current/candling-entries/nope",
        json={"note": "x"},
    )
    assert missing_patch.status_code == 404
    deleted = client.delete(
        f"/api/v1/incubators/chamber-2/cycles/current/candling-entries/{entry_id}"
    ).json()["data"]
    assert deleted == {"id": entry_id}
    assert (
        client.delete(
            f"/api/v1/incubators/chamber-2/cycles/current/candling-entries/{entry_id}"
        ).status_code
        == 404
    )
