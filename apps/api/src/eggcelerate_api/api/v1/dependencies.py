"""Request transactions shared by all dashboard routes."""

import hashlib
import json
import uuid
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from fastapi.concurrency import contextmanager_in_threadpool
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from ...context import RequestContext, disabled_context
from ...database.device_registry import DEVICE_ID_PATTERN
from ...database.queries import read_state
from ...database.schema import device_registry
from ...database.store import PostgresStore
from ...errors import AppError
from ...session_auth import SESSION_COOKIE_NAME, require_csrf, resolve_session
from ...storage import StoreState


async def get_request_context(request: Request) -> RequestContext:
    settings = request.app.state.settings
    if settings.auth_mode == "disabled":
        return disabled_context(settings.default_farm_id)
    database: PostgresStore | None = request.app.state.database
    if database is None:
        raise AppError("unauthorized", "Session authentication is unavailable.")
    try:
        identity = await resolve_session(
            database, request.cookies.get(SESSION_COOKIE_NAME)
        )
    except (SQLAlchemyError, OSError, TimeoutError) as exc:
        raise AppError("offline", "The account service is unavailable.") from exc
    if identity is None:
        raise AppError("unauthorized", "Sign in to access farm data.")
    return identity.context


async def require_api_session(
    request: Request, context: RequestContext = Depends(get_request_context)
) -> RequestContext:
    if request.app.state.settings.auth_mode == "sessions" and not context.authenticated:
        raise AppError("unauthorized", "Sign in to access farm data.")
    return context


async def require_api_csrf(
    request: Request, context: RequestContext = Depends(require_api_session)
) -> None:
    if request.app.state.settings.auth_mode == "sessions":
        require_csrf(request, context)


async def get_store(
    request: Request,
    context: RequestContext = Depends(get_request_context),
) -> AsyncIterator[StoreState]:
    memory = request.app.state.store
    database: PostgresStore | None = request.app.state.database
    if database is None:
        async with contextmanager_in_threadpool(memory.transaction()) as state:
            yield state
        return
    database = database.for_farm(context.farm_id)
    if request.app.state.settings.auth_mode == "sessions" and request.method in (
        "POST",
        "PATCH",
    ):
        try:
            body = await request.json()
        except ValueError, TypeError:
            body = None
        device_id = body.get("device_id") if isinstance(body, dict) else None
        if isinstance(device_id, str):
            if not DEVICE_ID_PATTERN.fullmatch(device_id):
                raise AppError("validation_error", "Device ID has an invalid format.")
            try:
                async with database.sessions() as session:
                    provision = (
                        await session.execute(
                            select(device_registry).where(
                                device_registry.c.identity_key == device_id.upper(),
                                device_registry.c.public_id == device_id,
                                device_registry.c.farm_id == database.farm_id,
                                device_registry.c.disabled_at.is_(None),
                            )
                        )
                    ).first()
            except (SQLAlchemyError, OSError, TimeoutError) as exc:
                raise AppError("offline", "Device registry is unavailable.") from exc
            if provision is None:
                raise AppError(
                    "rejected",
                    "This device is not provisioned for this farm. Contact the operator with its device ID.",
                )
    if request.method == "GET":
        resource = request.url.path.removeprefix("/api/v1/").split("/")[0]
        public_id = request.path_params.get("incubator_id") or request.path_params.get(
            "mode_id"
        )
        try:
            state = await read_state(database, resource, public_id)
        except (SQLAlchemyError, OSError, TimeoutError) as exc:
            raise AppError("offline", "Database is unavailable.") from exc
        yield state
        return
    replay = None
    kind: str
    scope: str | None = None
    key = request.headers.get("Idempotency-Key")
    route_path = request.url.path.rstrip("/")
    if request.method == "POST" and route_path.endswith("/commands/turn"):
        key = key or f"cmd-{uuid.uuid4().hex}"
        request.state.turn_command_id = key
        replay = (
            f"turn-{request.path_params['incubator_id']}",
            key,
            "turn-empty-body-v1",
            "turn",
        )
    if key and request.method == "DELETE" and route_path.startswith("/api/v1/modes/"):
        replay = (
            f"delete-mode-{request.path_params['mode_id']}",
            key,
            "delete-mode-v1",
            "mode_delete",
        )
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
    if key and route_path.startswith("/api/v1/alerts/"):
        scope = None
        alert_id = request.path_params.get("alert_id")
        if (
            request.method == "POST"
            and route_path == "/api/v1/alerts/actions/acknowledge-all"
        ):
            scope = "alert-acknowledge-all"
        elif (
            request.method == "POST"
            and route_path == "/api/v1/alerts/actions/clear-acknowledged"
        ):
            scope = "alert-clear-acknowledged"
        elif (
            alert_id
            and request.method == "POST"
            and route_path == f"/api/v1/alerts/{alert_id}/acknowledge"
        ):
            scope = f"alert-acknowledge-one-{alert_id}"
        elif (
            alert_id
            and request.method == "DELETE"
            and route_path == f"/api/v1/alerts/{alert_id}"
        ):
            scope = f"alert-dismiss-{alert_id}"
        if scope:
            # These actions have no request payload; identity is method + target.
            fingerprint = hashlib.sha256(
                f"{request.method}:{route_path}".encode()
            ).hexdigest()
            replay = (scope, key, fingerprint, "alerts")
    unit_id = request.path_params.get("incubator_id")
    if key and unit_id and request.method == "POST":
        actions = {
            f"/api/v1/incubators/{unit_id}/cycles": ("start", "cycle"),
            **{
                f"/api/v1/incubators/{unit_id}/cycles/current/{action}": (
                    action,
                    action if action in ("complete", "stop") else "cycle",
                )
                for action in ("reset", "complete", "stop")
            },
        }
        if route_path in actions:
            action, kind = actions[route_path]
            raw = await request.body()
            fingerprint = hashlib.sha256(
                json.dumps(
                    json.loads(raw) if raw else {},
                    sort_keys=True,
                    separators=(",", ":"),
                ).encode()
            ).hexdigest()
            replay = (f"{action}-{unit_id}", key, fingerprint, kind)
    if key and unit_id:
        base = f"/api/v1/incubators/{unit_id}/cycles/current/candling-entries"
        entry_id = request.path_params.get("entry_id")
        scope = None
        kind = "candling"
        if request.method == "POST" and route_path == base:
            scope = f"candling-{unit_id}"
        elif entry_id and route_path == f"{base}/{entry_id}":
            if request.method == "PATCH":
                scope = f"candling-{unit_id}-{entry_id}"
            elif request.method == "DELETE":
                scope = f"candling-delete-{unit_id}-{entry_id}"
                kind = "candling_delete"
        if scope:
            raw = await request.body()
            fingerprint = hashlib.sha256(
                json.dumps(
                    {
                        "method": request.method,
                        "path": route_path,
                        "body": json.loads(raw) if raw else {},
                    },
                    sort_keys=True,
                    separators=(",", ":"),
                ).encode()
            ).hexdigest()
            replay = (scope, key, fingerprint, kind)
    async with database.transaction(memory, replay) as state:
        yield state


Store = Annotated[StoreState, Depends(get_store, scope="function")]
