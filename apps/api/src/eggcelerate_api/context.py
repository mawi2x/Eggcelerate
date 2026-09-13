"""Dormant request-context boundary. Local-only until B6 replaces it."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RequestContext:
    farm_id: str
    actor_id: str = "local-dashboard"
    role: str = "development"
    authenticated: bool = False


def disabled_context(default_farm_id: str) -> RequestContext:
    """AUTH_MODE=disabled resolution: the server supplies the farm.

    Never accept a caller-selected farm ID as proof of authorization;
    authenticated mode (B6) will derive it from the verified session.
    """
    return RequestContext(farm_id=default_farm_id)
