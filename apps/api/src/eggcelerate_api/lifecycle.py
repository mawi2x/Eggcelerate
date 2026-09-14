"""Internal cycle identity; intentionally absent from the chamber wire DTO."""

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class CycleState:
    id: str
    incubator_id: str
    status: Literal["active", "completed", "stopped", "reset"]
    started_on: str
