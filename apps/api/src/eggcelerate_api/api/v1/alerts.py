"""Alert endpoints. Bulk actions are atomic: no partial success."""

from __future__ import annotations

from fastapi import APIRouter

from ... import services
from ...errors import ok_envelope
from .dependencies import Store

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
def list_alerts(store: Store) -> dict:
    return ok_envelope([a.model_dump(mode="json") for a in services.list_alerts(store)])


@router.post("/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: str, store: Store) -> dict:
    updated = services.acknowledge_alert(store, alert_id, services.utcnow())
    return ok_envelope(updated.model_dump(mode="json"))


@router.delete("/{alert_id}")
def dismiss_alert(alert_id: str, store: Store) -> dict:
    return ok_envelope({"id": services.dismiss_alert(store, alert_id)})


@router.post("/actions/acknowledge-all")
def acknowledge_all(store: Store) -> dict:
    updated = services.acknowledge_all_alerts(store, services.utcnow())
    return ok_envelope([a.model_dump(mode="json") for a in updated])


@router.post("/actions/clear-acknowledged")
def clear_acknowledged(store: Store) -> dict:
    remaining = services.clear_acknowledged_alerts(store)
    return ok_envelope([a.model_dump(mode="json") for a in remaining])
