"""Cycle history projections over terminal cycles."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter

from ... import services
from ...errors import ok_envelope, validation_error
from ...models import AbortedCycleDTO, HatchHistoryDTO
from .dependencies import Store

router = APIRouter(prefix="/cycles", tags=["history"])


@router.get("")
def list_cycles(
    store: Store, status: Literal["completed", "stopped_early"] = "completed"
) -> dict:
    records: list[HatchHistoryDTO] | list[AbortedCycleDTO]
    if status == "completed":
        records = services.completed_cycles(store)
    elif status == "stopped_early":
        records = services.stopped_cycles(store)
    else:
        raise validation_error("Status must be completed or stopped_early.")
    return ok_envelope([record.model_dump(mode="json") for record in records])
