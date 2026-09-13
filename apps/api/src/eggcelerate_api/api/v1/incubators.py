"""Incubator, cycle, turn, reading, and candling endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Header

from ... import services
from ...errors import ok_envelope, validated, validation_error
from ...models import (
    CandlingEntryCreate,
    CandlingEntryPatch,
    CompleteCycleRequest,
    CreateIncubatorRequest,
    EmptyBody,
    StartCycleRequest,
    UpdateConfigurationRequest,
    UpdateProfileRequest,
)
from .dependencies import Store

router = APIRouter(prefix="/incubators", tags=["incubators"])


@router.get("")
def list_incubators(store: Store) -> dict:
    return ok_envelope(
        [i.model_dump(mode="json") for i in services.list_incubators(store)]
    )


@router.post("", status_code=201)
def create_incubator(
    body: CreateIncubatorRequest,
    store: Store,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    created = services.idempotent(
        store,
        "create-incubator",
        idempotency_key,
        lambda: services.create_incubator(store, body, services.utcnow()),
    )
    return ok_envelope(created.model_dump(mode="json"))


@router.get("/{incubator_id}")
def get_incubator(incubator_id: str, store: Store) -> dict:
    return ok_envelope(
        services.require_incubator(store, incubator_id).model_dump(mode="json")
    )


@router.patch("/{incubator_id}")
def patch_incubator(
    incubator_id: str,
    body: dict,
    store: Store,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    if set(body) == {"name"}:
        parsed = validated(UpdateProfileRequest, body)
        updated = services.idempotent(
            store,
            f"patch-{incubator_id}",
            idempotency_key,
            lambda: services.update_profile(
                store, incubator_id, parsed, services.utcnow()
            ),
        )
    else:
        parsed_config = validated(UpdateConfigurationRequest, body)
        updated = services.idempotent(
            store,
            f"patch-{incubator_id}",
            idempotency_key,
            lambda: services.update_configuration(
                store, incubator_id, parsed_config, services.utcnow()
            ),
        )
    return ok_envelope(updated.model_dump(mode="json"))


@router.post("/{incubator_id}/reconnect")
def reconnect_incubator(
    incubator_id: str,
    store: Store,
    body: EmptyBody | None = None,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    updated = services.idempotent(
        store,
        f"reconnect-{incubator_id}",
        idempotency_key,
        lambda: services.reconnect(store, incubator_id, services.utcnow()),
    )
    return ok_envelope(updated.model_dump(mode="json"))


@router.post("/{incubator_id}/cycles")
def start_cycle(
    incubator_id: str,
    body: StartCycleRequest,
    store: Store,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    started = services.idempotent(
        store,
        f"start-{incubator_id}",
        idempotency_key,
        lambda: services.start_cycle(store, incubator_id, body, services.utcnow()),
    )
    return ok_envelope(started.model_dump(mode="json"))


@router.post("/{incubator_id}/cycles/current/reset")
def reset_cycle(
    incubator_id: str,
    store: Store,
    body: EmptyBody | None = None,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    reset = services.idempotent(
        store,
        f"reset-{incubator_id}",
        idempotency_key,
        lambda: services.reset_stopped_cycle(store, incubator_id, services.utcnow()),
    )
    return ok_envelope(reset.model_dump(mode="json"))


@router.post("/{incubator_id}/cycles/current/complete")
def complete_cycle(
    incubator_id: str,
    body: CompleteCycleRequest,
    store: Store,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    record = services.idempotent(
        store,
        f"complete-{incubator_id}",
        idempotency_key,
        lambda: services.complete_cycle(store, incubator_id, body, services.utcnow()),
    )
    return ok_envelope(record.model_dump(mode="json"))


@router.post("/{incubator_id}/cycles/current/stop")
def stop_cycle(
    incubator_id: str,
    store: Store,
    body: EmptyBody | None = None,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    record = services.idempotent(
        store,
        f"stop-{incubator_id}",
        idempotency_key,
        lambda: services.stop_cycle(store, incubator_id, services.utcnow()),
    )
    return ok_envelope(record.model_dump(mode="json"))


@router.post("/{incubator_id}/commands/turn")
def manual_turn(
    incubator_id: str,
    store: Store,
    body: EmptyBody | None = None,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    command_id = idempotency_key or f"cmd-{uuid.uuid4().hex[:12]}"
    accepted = services.idempotent(
        store,
        f"turn-{incubator_id}",
        command_id,
        lambda: services.request_turn(
            store, incubator_id, command_id, services.utcnow()
        ),
    )
    return ok_envelope(accepted.model_dump(mode="json"))


@router.get("/{incubator_id}/readings")
def list_readings(incubator_id: str, store: Store, window: str = "24h") -> dict:
    points = services.readings(store, incubator_id, window, services.utcnow())
    return ok_envelope([point.model_dump(mode="json") for point in points])


@router.get("/{incubator_id}/cycles/current/candling-entries")
def list_candling(incubator_id: str, store: Store) -> dict:
    entries = services.list_candling(store, incubator_id)
    return ok_envelope([entry.model_dump(mode="json") for entry in entries])


@router.post("/{incubator_id}/cycles/current/candling-entries", status_code=201)
def create_candling(
    incubator_id: str,
    body: CandlingEntryCreate,
    store: Store,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    updated = services.idempotent(
        store,
        f"candling-{incubator_id}",
        idempotency_key,
        lambda: services.create_candling(store, incubator_id, body, services.utcnow()),
    )
    entry = next(e for e in updated.candling_entries if e.day == body.day)
    return ok_envelope(entry.model_dump(mode="json"))


@router.patch("/{incubator_id}/cycles/current/candling-entries/{entry_id}")
def patch_candling(
    incubator_id: str,
    entry_id: str,
    body: CandlingEntryPatch,
    store: Store,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    if not body.model_fields_set:
        raise validation_error("At least one candling field is required.")
    updated = services.idempotent(
        store,
        f"candling-{incubator_id}-{entry_id}",
        idempotency_key,
        lambda: services.update_candling(
            store,
            incubator_id,
            entry_id,
            body.model_dump(exclude_unset=True),
            services.utcnow(),
        ),
    )
    entry = next(e for e in updated.candling_entries if e.id == entry_id)
    return ok_envelope(entry.model_dump(mode="json"))


@router.delete("/{incubator_id}/cycles/current/candling-entries/{entry_id}")
def delete_candling(incubator_id: str, entry_id: str, store: Store) -> dict:
    removed = services.delete_candling(store, incubator_id, entry_id, services.utcnow())
    return ok_envelope({"id": removed})
