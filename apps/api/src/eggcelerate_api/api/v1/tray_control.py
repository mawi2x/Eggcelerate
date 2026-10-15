"""Farm-scoped real tray controls on the existing session and CSRF boundary."""

from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from ...database import tray_control
from ...database.schema import farms
from ...errors import AppError, ok_envelope
from .dependencies import get_request_context

router = APIRouter(prefix="/incubators", tags=["tray-control"])


class TrayAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal[
        "turn", "home", "stop", "confirm_plus", "confirm_minus", "confirm_level"
    ]


async def perform(request, context, unit_id, action=None):
    settings = request.app.state.settings
    if not settings.tray_control_enabled or not settings.climate_control_enabled:
        if action:
            raise AppError("rejected", "Tray control is disabled on this server.")
        return ok_envelope({"enabled": False})
    database = request.app.state.database
    if not context.authenticated or database is None:
        raise AppError("unauthorized", "Sign in to control the tray.")
    farm_id = UUID(context.farm_id)
    try:
        async with database.sessions.begin() as session:
            if action:
                await session.scalar(
                    select(farms.c.id).where(farms.c.id == farm_id).with_for_update()
                )
                await tray_control.reconcile_one(
                    session, farm_id, unit_id, datetime.now(UTC)
                )
                await tray_control.queue(
                    session,
                    farm_id,
                    unit_id,
                    action,
                    key=request.headers.get("Idempotency-Key")
                    if action == "turn"
                    else None,
                )
            result = await tray_control.view(session, farm_id, unit_id)
    except (SQLAlchemyError, OSError, TimeoutError) as exc:
        raise AppError("offline", "Tray control is unavailable.") from exc
    return ok_envelope(result)


@router.get("/{incubator_id}/tray-control")
async def read_tray(
    incubator_id: str, request: Request, context=Depends(get_request_context)
):
    return await perform(request, context, incubator_id)


@router.post("/{incubator_id}/tray-control")
async def change_tray(
    incubator_id: str,
    body: TrayAction,
    request: Request,
    context=Depends(get_request_context),
):
    return await perform(request, context, incubator_id, body.action)
