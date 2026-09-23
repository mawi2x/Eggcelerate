"""Alert endpoints. Each action and its replay receipt commit atomically."""

from fastapi import APIRouter, Header

from ... import services
from ...errors import ok_envelope
from .dependencies import Store

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
def list_alerts(store: Store) -> dict:
    return ok_envelope([a.model_dump(mode="json") for a in services.list_alerts(store)])


@router.post("/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: str,
    store: Store,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    result = services.idempotent(
        store,
        f"alert-acknowledge-one-{alert_id}",
        idempotency_key,
        lambda: services.acknowledge_alert(
            store, alert_id, services.utcnow()
        ).model_dump(mode="json"),
    )
    return ok_envelope(result)


@router.delete("/{alert_id}")
def dismiss_alert(
    alert_id: str,
    store: Store,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    result = services.idempotent(
        store,
        f"alert-dismiss-{alert_id}",
        idempotency_key,
        lambda: {"id": services.dismiss_alert(store, alert_id)},
    )
    return ok_envelope(result)


@router.post("/actions/acknowledge-all")
def acknowledge_all(
    store: Store,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    result = services.idempotent(
        store,
        "alert-acknowledge-all",
        idempotency_key,
        lambda: [
            a.model_dump(mode="json")
            for a in services.acknowledge_all_alerts(store, services.utcnow())
        ],
    )
    return ok_envelope(result)


@router.post("/actions/clear-acknowledged")
def clear_acknowledged(
    store: Store,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    result = services.idempotent(
        store,
        "alert-clear-acknowledged",
        idempotency_key,
        lambda: [
            a.model_dump(mode="json") for a in services.clear_acknowledged_alerts(store)
        ],
    )
    return ok_envelope(result)
