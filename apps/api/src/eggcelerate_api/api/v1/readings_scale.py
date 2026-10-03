"""Chart and raw export contracts: authorization applies before streaming starts."""

import base64
import hashlib
import hmac
import json
import math
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import AwareDatetime, BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError

from ... import services
from ...context import RequestContext
from ...database import readings_scale as storage
from ...errors import AppError, ok_envelope
from .dependencies import get_request_context

router = APIRouter(prefix="/incubators", tags=["readings"])


def checked_end(end: datetime | None) -> datetime:
    now = services.utcnow()
    if end and end > now:
        raise AppError("validation_error", "end must not be in the future.")
    return end or now


def sign_scope(payload: dict[str, Any], key: str) -> str:
    data = base64.urlsafe_b64encode(
        json.dumps(payload, default=str, separators=(",", ":")).encode()
    ).decode()
    signature = hmac.new(
        key.encode(), ("raw-export:" + data).encode(), hashlib.sha256
    ).hexdigest()
    return data + "." + signature


def read_scope(token: str, farm: str, key: str) -> dict[str, Any]:
    try:
        data, signature = token.rsplit(".", 1)
        expected = hmac.new(
            key.encode(), ("raw-export:" + data).encode(), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError("signature")
        payload = json.loads(base64.urlsafe_b64decode(data))
        if (
            payload["farm"] != str(farm)
            or datetime.fromisoformat(payload["expires"]) < services.utcnow()
        ):
            raise ValueError("scope")
        payload["end"] = datetime.fromisoformat(payload["end"])
        for s in payload.get("scope", []):
            s["device_id"] = UUID(s["device_id"])
            s["start"] = datetime.fromisoformat(s["start"])
        return payload
    except (ValueError, KeyError, TypeError) as exc:
        raise AppError(
            "validation_error",
            "Export scope is invalid or expired; reopen the preview.",
        ) from exc


def demo_rows(
    request: Request, ids: list[str], window: str, end: datetime
) -> list[dict[str, Any]]:
    if not ids or len(ids) > 100 or len(set(ids)) != len(ids):
        raise AppError("validation_error", "Select 1–100 distinct chambers.")
    store = request.app.state.store
    rows: list[dict[str, Any]] = []
    for chamber_id in ids:
        unit = services.require_incubator(store, chamber_id)
        if window == "full" and unit.day_of_incubation < 1:
            continue
        rows.extend(
            {"incubator_id": chamber_id, "chamber": unit.name, **p.model_dump()}
            for p in services.readings(store, chamber_id, window, end)
            if p.observed_at < end
        )
    return sorted(rows, key=lambda r: (r["observed_at"], r["incubator_id"]))


def aggregate_demo(
    rows: list[dict[str, Any]], window: str, end: datetime
) -> list[dict[str, Any]]:
    start = (
        end - timedelta(days=1 if window == "24h" else 7)
        if window != "full"
        else min((r["observed_at"] for r in rows), default=end)
    )
    seconds = max(
        1, math.ceil((end - start).total_seconds() / (storage.CHART_POINTS - 1))
    )
    buckets: dict[int, list[dict[str, Any]]] = {}
    for row in rows:
        buckets.setdefault(
            math.floor(row["observed_at"].timestamp() / seconds), []
        ).append(row)
    return [
        {
            "observed_at": datetime.fromtimestamp(b * seconds, UTC),
            "temperature_c": sum(r["temperature_c"] for r in group) / len(group),
            "humidity_pct": sum(r["humidity_pct"] for r in group) / len(group),
            "temperature_min": min(r["temperature_c"] for r in group),
            "temperature_max": max(r["temperature_c"] for r in group),
            "humidity_min": min(r["humidity_pct"] for r in group),
            "humidity_max": max(r["humidity_pct"] for r in group),
            "sample_count": len(group),
            "bucket_seconds": seconds,
            "water_not_ok_count": sum(not r["water_ok"] for r in group),
        }
        for b, group in sorted(buckets.items())
    ]


@router.get("/{incubator_id}/readings/chart")
async def chart(
    incubator_id: str,
    request: Request,
    window: str = "24h",
    context: RequestContext = Depends(get_request_context),
) -> dict:
    end = services.utcnow()
    database = request.app.state.database
    try:
        if database is not None:
            database = database.for_farm(context.farm_id)
            async with database.sessions() as session:
                return ok_envelope(
                    await storage.chart(
                        session, database.farm_id, incubator_id, window, end
                    )
                )
        return ok_envelope(
            aggregate_demo(demo_rows(request, [incubator_id], window, end), window, end)
        )
    except (SQLAlchemyError, OSError, TimeoutError) as exc:
        raise AppError("offline", "Reading storage is unavailable.") from exc


@router.get("/readings/raw-preview")
async def raw_preview(
    request: Request,
    ids: Annotated[list[str], Query()],
    window: str = "24h",
    end: AwareDatetime | None = None,
    context: RequestContext = Depends(get_request_context),
) -> dict:
    end = checked_end(end)
    database = request.app.state.database
    payload: dict[str, Any] = {
        "farm": str(context.farm_id),
        "end": end,
        "expires": services.utcnow() + timedelta(hours=1),
    }
    try:
        if database is not None:
            database = database.for_farm(context.farm_id)
            async with database.sessions() as session, session.begin():
                scope = await storage.scopes(
                    session, database.farm_id, ids, window, end
                )
                # Keep only immutable export scope fields in the signed snapshot.
                payload["scope"] = [
                    {k: s[k] for k in ("device_id", "public_id", "name", "start")}
                    for s in scope
                ]
                data = await storage.preview(session, database.farm_id, scope, end)
        else:
            rows = demo_rows(request, ids, window, end)
            payload["demo_rows"] = rows
            data = {
                "rows": rows[: storage.PREVIEW_ROWS],
                "total": len(rows),
                "end": end,
            }
        data["scope_token"] = sign_scope(
            payload, request.app.state.settings.auth_rate_limit_key
        )
        return ok_envelope(data)
    except (SQLAlchemyError, OSError, TimeoutError) as exc:
        raise AppError("offline", "Reading storage is unavailable.") from exc


class ExportRequest(BaseModel):
    scope_token: str = Field(max_length=4_000_000)


@router.post("/readings/export")
async def export_raw(
    body: ExportRequest,
    request: Request,
    context: RequestContext = Depends(get_request_context),
) -> StreamingResponse:
    payload = read_scope(
        body.scope_token,
        context.farm_id,
        request.app.state.settings.auth_rate_limit_key,
    )
    database = request.app.state.database
    if database is not None:
        database = database.for_farm(context.farm_id)
        content = storage.stream_csv(database, payload["scope"], payload["end"])
    else:
        rows = payload["demo_rows"]
        for r in rows:
            for field in ("observed_at", "received_at"):
                r[field] = datetime.fromisoformat(r[field])

        async def demo():
            yield storage.csv_chunk([], header=True)
            for offset in range(0, len(rows), 1000):
                yield storage.csv_chunk(rows[offset : offset + 1000])

        content = demo()
    return StreamingResponse(
        content,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="raw-readings.csv"',
            "Cache-Control": "no-store",
        },
    )
