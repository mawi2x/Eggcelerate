"""Request identity and tenant context shared by local and authenticated APIs."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RequestContext:
    farm_id: str
    actor_id: str = "local-dashboard"
    role: str = "development"
    authenticated: bool = False
    session_hash: str | None = None
    csrf_hash: str | None = None


def disabled_context(default_farm_id: str) -> RequestContext:
    """AUTH_MODE=disabled resolution: the server supplies the local farm.

    Never accept a caller-selected farm ID as proof of authorization;
    sessions mode derives it from the verified membership.
    """
    return RequestContext(farm_id=default_farm_id)
