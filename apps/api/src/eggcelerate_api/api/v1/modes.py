"""Mode endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Header

from ... import services
from ...errors import not_found, ok_envelope
from ...models import ModeDTO, ModePatch
from .dependencies import Store

router = APIRouter(prefix="/modes", tags=["modes"])


@router.get("")
def list_modes(store: Store) -> dict:
    return ok_envelope(
        [mode.model_dump(mode="json") for mode in services.list_modes(store)]
    )


@router.post("", status_code=201)
def create_mode(
    body: ModeDTO,
    store: Store,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    created = services.idempotent(
        store,
        "create-mode",
        idempotency_key,
        lambda: services.create_mode(store, body),
    )
    return ok_envelope(created.model_dump(mode="json"))


@router.get("/{mode_id}")
def get_mode(mode_id: str, store: Store) -> dict:
    try:
        mode = store.modes[mode_id]
    except KeyError:
        raise not_found(f"Mode {mode_id} was not found.") from None
    return ok_envelope(mode.model_dump(mode="json"))


@router.patch("/{mode_id}")
def patch_mode(
    mode_id: str,
    body: ModePatch,
    store: Store,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    updated = services.idempotent(
        store,
        f"patch-mode-{mode_id}",
        idempotency_key,
        lambda: services.update_mode(store, mode_id, body, services.utcnow()),
    )
    return ok_envelope(updated.model_dump(mode="json"))


@router.delete("/{mode_id}")
def delete_mode(
    mode_id: str,
    store: Store,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    result = services.idempotent(
        store,
        f"delete-mode-{mode_id}",
        idempotency_key,
        lambda: {"id": services.delete_mode(store, mode_id)},
    )
    return ok_envelope(result)
