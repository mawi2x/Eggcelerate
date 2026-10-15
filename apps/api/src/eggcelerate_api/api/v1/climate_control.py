"""Local hardware climate test controls, protected by the normal session/CSRF."""

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from ...context import RequestContext
from ...database import climate_control
from ...database.schema import farms
from ...errors import AppError, ok_envelope
from .dependencies import get_request_context

router = APIRouter(prefix="/incubators", tags=["climate-control"])


class ClimateAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["stop", "reset", "resume"]


async def perform(request, context, unit_id, action=None):
    settings = request.app.state.settings
    if not settings.climate_control_enabled:
        if action:
            raise AppError(
                "rejected", "Automatic climate control is disabled on this server."
            )
        return ok_envelope(
            {"enabled": False, "fresh": False, "report": None, "request": None}
        )
    database = request.app.state.database
    if not context.authenticated or database is None:
        raise AppError("unauthorized", "Sign in to the local hardware dashboard.")
    farm_id = UUID(context.farm_id)
    try:
        async with database.sessions.begin() as session:
            if action:
                await session.scalar(
                    select(farms.c.id).where(farms.c.id == farm_id).with_for_update()
                )
                if action == "resume":
                    from ...database.schema import incubator_runtime

                    phase = await session.scalar(
                        select(incubator_runtime.c.cycle_phase).where(
                            incubator_runtime.c.farm_id == farm_id,
                            incubator_runtime.c.incubator_id == unit_id,
                        )
                    )
                    action = "prepare" if phase == "ready" else "incubate"
                result = await climate_control.set_intent(
                    session, farm_id, unit_id, action
                )
            else:
                result = await climate_control.status(session, farm_id, unit_id)
    except (SQLAlchemyError, OSError, TimeoutError) as exc:
        raise AppError("offline", "Climate control service is unavailable.") from exc
    return ok_envelope(result)


@router.get("/{incubator_id}/climate-control")
async def read_test(
    incubator_id: str,
    request: Request,
    context: RequestContext = Depends(get_request_context),
):
    return await perform(request, context, incubator_id)


@router.post("/{incubator_id}/climate-control")
async def change_test(
    incubator_id: str,
    body: ClimateAction,
    request: Request,
    context: RequestContext = Depends(get_request_context),
):
    return await perform(request, context, incubator_id, body.action)
