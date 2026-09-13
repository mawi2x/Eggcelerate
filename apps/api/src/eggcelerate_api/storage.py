"""Request-scoped state and transaction contracts shared by storage adapters.

The collection surface preserves existing service behavior during B3 migration.
It is a transitional unit-of-work boundary, not a SQL repository implementation.
"""

from __future__ import annotations

from contextlib import AbstractContextManager
from typing import Any, Protocol

from .models import (
    AbortedCycleDTO,
    AlertDTO,
    HatchHistoryDTO,
    IncubatorDTO,
    ModeDTO,
    PreferencesDTO,
)


class StoreState(Protocol):
    modes: dict[str, ModeDTO]
    incubators: dict[str, IncubatorDTO]
    alerts: dict[str, AlertDTO]
    hatch: list[HatchHistoryDTO]
    aborted: list[AbortedCycleDTO]
    preferences: PreferencesDTO
    idempotency: dict[str, Any]


class UnitOfWork(Protocol):
    def transaction(self) -> AbstractContextManager[StoreState]: ...
