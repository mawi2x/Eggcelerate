"""API v1 router aggregate."""

from fastapi import APIRouter

from . import alerts, history, incubators, modes, preferences

router = APIRouter(prefix="/api/v1")
router.include_router(incubators.router)
router.include_router(modes.router)
router.include_router(alerts.router)
router.include_router(history.router)
router.include_router(preferences.router)
