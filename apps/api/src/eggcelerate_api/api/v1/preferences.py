"""Farm preferences endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Header

from ... import services
from ...errors import ok_envelope
from ...models import PreferencesDTO
from .dependencies import Store

router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.get("")
def get_preferences(store: Store) -> dict:
    return ok_envelope(services.get_preferences(store).model_dump(mode="json"))


@router.put("")
def replace_preferences(
    body: PreferencesDTO,
    store: Store,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    updated = services.idempotent(
        store,
        "preferences",
        idempotency_key,
        lambda: services.replace_preferences(store, body),
    )
    return ok_envelope(updated.model_dump(mode="json"))
