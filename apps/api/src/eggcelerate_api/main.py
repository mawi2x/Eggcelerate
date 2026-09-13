"""Application factory. Route handlers validate and delegate;
services own use cases; B3 persists configuration while other state is staged."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from .api.v1 import router as v1_router
from .config import Settings, load_settings
from .context import disabled_context
from .database.store import PostgresStore
from .errors import register_error_handlers
from .store import MemoryStore


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    database = (
        PostgresStore(settings.database_url, settings.default_farm_id)
        if settings.storage_backend == "postgres_incubators"
        else None
    )

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        try:
            yield
        finally:
            if database is not None:
                await database.close()

    app = FastAPI(title="EGGCELERATE API", version="0.1.0", lifespan=lifespan)
    app.state.database = database
    app.state.settings = settings
    app.state.store = MemoryStore()
    app.state.context = disabled_context(settings.default_farm_id)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
        allow_headers=["*"],
    )
    register_error_handlers(app)
    app.include_router(v1_router)

    @app.get("/healthz", tags=["ops"])
    def healthz() -> dict:
        return {"status": "ok"}

    @app.get("/readyz", tags=["ops"], response_model=None)
    async def readyz() -> dict | JSONResponse:
        if database is not None:
            try:
                ready = await database.ready()
            except (SQLAlchemyError, OSError, TimeoutError):
                ready = False
            return JSONResponse(
                status_code=200 if ready else 503,
                content={
                    "ready": ready,
                    "checks": {
                        "store": "postgres_incubators",
                        "database": "up" if ready else "unavailable_or_uninitialized",
                        "remaining_state": "cycles_candling_alerts_readings_memory",
                    },
                },
            )
        store: MemoryStore = app.state.store
        return {
            "ready": True,
            "checks": {"store": "memory", "incubators": str(len(store.incubators))},
        }

    return app


app = create_app()
