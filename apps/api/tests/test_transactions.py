"""Prove rollback and same-key concurrency at the actual request boundary."""

from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from threading import Barrier

import pytest
from fastapi.testclient import TestClient

from eggcelerate_api import services
from eggcelerate_api.config import Settings
from eggcelerate_api.main import create_app


@pytest.mark.parametrize("operation", ["complete", "stop"])
def test_failed_terminal_response_rolls_back_state_and_replay(monkeypatch, operation):
    app = create_app(Settings(app_env="test"))
    client = TestClient(app, raise_server_exceptions=False)
    store = app.state.store
    before_unit = deepcopy(store.incubators["chamber-12"])
    before_hatch, before_aborted = deepcopy(store.hatch), deepcopy(store.aborted)
    original = services.idempotent

    def fail_after_mutation(*args, **kwargs):
        original(*args, **kwargs)
        raise RuntimeError("Injected after mutation and replay cache update")

    with monkeypatch.context() as patch:
        patch.setattr(services, "idempotent", fail_after_mutation)
        response = client.post(
            f"/api/v1/incubators/chamber-12/cycles/current/{operation}",
            json={"hatched_eggs": 28} if operation == "complete" else {},
            headers={"Idempotency-Key": "rollback"},
        )
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "unknown_error"
    assert store.incubators["chamber-12"] == before_unit
    assert store.hatch == before_hatch
    assert store.aborted == before_aborted
    assert store.idempotency == {}
    # Dependency cleanup released the lock; a new request can succeed.
    assert client.get("/api/v1/incubators/chamber-12").status_code == 200


def test_concurrent_same_key_completion_commits_once():
    app = create_app(Settings(app_env="test"))
    before = len(app.state.store.hatch)
    barrier = Barrier(2)

    def complete():
        with TestClient(app) as client:
            barrier.wait(timeout=5)
            return client.post(
                "/api/v1/incubators/chamber-12/cycles/current/complete",
                json={"hatched_eggs": 28},
                headers={"Idempotency-Key": "concurrent-complete"},
            )

    with ThreadPoolExecutor(max_workers=2) as executor:
        first, second = list(executor.map(lambda _: complete(), range(2)))
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert len(app.state.store.hatch) == before + 1
