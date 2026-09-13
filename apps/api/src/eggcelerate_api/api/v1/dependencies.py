"""Request transactions shared by all dashboard routes."""

import hashlib
import json
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from fastapi.concurrency import contextmanager_in_threadpool

from ...database.store import PostgresStore
from ...storage import StoreState


async def get_store(request: Request) -> AsyncIterator[StoreState]:
    memory = request.app.state.store
    database: PostgresStore | None = request.app.state.database
    if database is None:
        async with contextmanager_in_threadpool(memory.transaction()) as state:
            yield state
        return
    replay = None
    scope: str | None = None
    key = request.headers.get("Idempotency-Key")
    route_path = request.url.path.rstrip("/")
    if key and (
        (request.method == "POST" and route_path == "/api/v1/modes")
        or (request.method == "PATCH" and route_path.startswith("/api/v1/modes/"))
    ):
        scope = (
            "create-mode"
            if request.method == "POST"
            else f"patch-mode-{request.path_params['mode_id']}"
        )
        fingerprint = hashlib.sha256(
            json.dumps(
                await request.json(), sort_keys=True, separators=(",", ":")
            ).encode()
        ).hexdigest()
        replay = (scope, key, fingerprint, "mode")
    if key and route_path.startswith("/api/v1/incubators"):
        unit_id = request.path_params.get("incubator_id")
        scope = None
        if request.method == "POST" and route_path == "/api/v1/incubators":
            scope = "create-incubator"
        elif (
            request.method == "PATCH"
            and unit_id
            and route_path == f"/api/v1/incubators/{unit_id}"
        ):
            scope = f"patch-{unit_id}"
        elif (
            request.method == "POST"
            and unit_id
            and route_path == f"/api/v1/incubators/{unit_id}/reconnect"
        ):
            scope = f"reconnect-{unit_id}"
        if scope:
            raw = await request.body()
            body = json.loads(raw) if raw else {}
            fingerprint = hashlib.sha256(
                json.dumps(body, sort_keys=True, separators=(",", ":")).encode()
            ).hexdigest()
            replay = (scope, key, fingerprint, "incubator")
    if key and request.method == "PUT" and route_path == "/api/v1/preferences":
        fingerprint = hashlib.sha256(
            json.dumps(
                await request.json(), sort_keys=True, separators=(",", ":")
            ).encode()
        ).hexdigest()
        replay = ("preferences", key, fingerprint, "preferences")
    async with database.transaction(memory, replay) as state:
        yield state


Store = Annotated[StoreState, Depends(get_store, scope="function")]
