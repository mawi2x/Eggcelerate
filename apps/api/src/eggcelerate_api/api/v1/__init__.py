"""API v1 router aggregate."""

from fastapi import APIRouter, Depends

from . import alerts, auth, history, incubators, modes, preferences
from .dependencies import require_api_csrf, require_api_session

router = APIRouter()
auth_routes = APIRouter(prefix="/api/v1")
auth_routes.include_router(auth.router)
router.include_router(auth_routes)

farm_routes = APIRouter(
    prefix="/api/v1",
    dependencies=[Depends(require_api_session), Depends(require_api_csrf)],
)
farm_routes.include_router(incubators.router)
farm_routes.include_router(modes.router)
farm_routes.include_router(alerts.router)
farm_routes.include_router(history.router)
farm_routes.include_router(preferences.router)
router.include_router(farm_routes)
