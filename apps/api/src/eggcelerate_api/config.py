"""Local settings. Real values stay in .env (gitignored); names live in .env.example."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    app_env: str = "development"
    auth_mode: str = "disabled"
    default_farm_id: str = "00000000-0000-0000-0000-000000000001"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    storage_backend: str = "memory"
    database_url: str = ""
    cors_origins: tuple[str, ...] = (
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        # Compose web on :80 reaches the API from bare-loopback origins.
        "http://localhost",
        "http://127.0.0.1",
    )

    def __post_init__(self) -> None:
        # Existing B3 mode-only configuration upgrades to the next slice.
        if self.storage_backend == "postgres_modes":
            object.__setattr__(self, "storage_backend", "postgres_incubators")
        if self.storage_backend not in ("memory", "postgres_incubators"):
            raise ValueError("STORAGE_BACKEND must be memory|postgres_incubators.")
        if self.storage_backend == "postgres_incubators":
            if not self.database_url.startswith("postgresql+asyncpg://"):
                raise ValueError(
                    "postgres_incubators requires an asyncpg DATABASE_URL."
                )
            from uuid import UUID

            UUID(self.default_farm_id)
        if self.auth_mode not in ("disabled", "sessions"):
            raise ValueError("AUTH_MODE must be disabled|sessions.")
        if (
            self.auth_mode == "sessions"
            and self.storage_backend != "postgres_incubators"
        ):
            raise ValueError(
                "AUTH_MODE=sessions requires STORAGE_BACKEND=postgres_incubators."
            )
        if self.app_env == "production" and self.auth_mode == "disabled":
            raise RuntimeError(
                "Refusing production startup with disabled auth (B6 gate)."
            )
        if self.app_env == "production" and (
            not self.cors_origins
            or any(not origin.startswith("https://") for origin in self.cors_origins)
        ):
            raise ValueError(
                "Production CORS_ORIGINS must contain the HTTPS web origin."
            )


def load_settings(environ: dict[str, str] | None = None) -> Settings:
    env = environ if environ is not None else os.environ
    app_env = env.get("APP_ENV", "development")
    if app_env not in ("development", "test", "production"):
        raise ValueError(
            f"APP_ENV must be development|test|production, got {app_env!r}."
        )
    auth_mode = env.get("AUTH_MODE", "disabled")
    if auth_mode not in ("disabled", "sessions"):
        raise ValueError("AUTH_MODE must be disabled|sessions.")
    try:
        api_port = int(env.get("API_PORT", "8000"))
    except ValueError:
        raise ValueError("API_PORT must be an integer.") from None
    cors_value = env.get(
        "CORS_ORIGINS",
        ""
        if app_env == "production"
        else "http://localhost:5173,http://127.0.0.1:5173",
    )
    cors = tuple(origin.strip() for origin in cors_value.split(",") if origin.strip())
    return Settings(
        app_env=app_env,
        auth_mode=auth_mode,
        default_farm_id=env.get(
            "DEFAULT_FARM_ID", "00000000-0000-0000-0000-000000000001"
        ),
        api_host=env.get("API_HOST", "0.0.0.0"),
        api_port=api_port,
        cors_origins=cors,
        storage_backend=env.get("STORAGE_BACKEND", "memory"),
        database_url=env.get("DATABASE_URL", ""),
    )
