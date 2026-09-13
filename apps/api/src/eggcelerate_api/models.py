"""Wire DTOs mirroring apps/web/.../transport/contracts.ts field-for-field.

Snake_case wire names, explicit units (_c, _pct, _min), UTC datetimes.
Every model forbids extras so the API can never silently accept a field
the dashboard does not know.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    model_serializer,
    model_validator,
)

Strict = ConfigDict(extra="forbid")
NonEmpty = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
PowerSource = Literal["grid", "battery"]
UnitStatus = Literal["optimal", "warning", "alert"]
CyclePhase = Literal[
    "ready",
    "incubating",
    "lockdown",
    "hatching",
    "awaiting_finish",
    "completed",
    "stopped_early",
]
ConditionSeverity = Literal["critical", "warning", "info"]
ConnectionState = Literal["offline", "connecting", "connected", "connection_failed"]
AlertSeverity = Literal["critical", "warning", "info"]
TemperatureUnit = Literal["c", "f"]
TimeZone = Literal["gmt8", "gmt0", "est", "pst"]
DevelopmentCheck = Literal["veining", "air_cell", "movement"]
CheckpointType = Literal["first", "later"]


class RangeModel(BaseModel):
    model_config = Strict

    min: float
    max: float

    @model_validator(mode="after")
    def _ordered(self) -> RangeModel:
        if not self.min < self.max:
            raise ValueError("min must be < max")
        return self


class ModeDTO(BaseModel):
    model_config = Strict

    id: NonEmpty
    name: NonEmpty
    built_in: bool = False
    target_temp_c: RangeModel
    target_humidity_pct: RangeModel
    incubation_days: Annotated[int, Field(ge=7, le=45)]
    default_turn_interval_min: Annotated[int, Field(ge=60, le=1440)]
    version: int | None = None
    created_at: str | None = None
    updated_at: str | None = None
    temp_hysteresis_c: float = 0.2
    humidity_hysteresis_pct: float = 3.0

    @model_serializer(mode="plain")
    def _dump(self) -> dict:
        return {key: value for key, value in self.__dict__.items() if value is not None}


class ModePatch(BaseModel):
    model_config = Strict

    name: (
        Annotated[
            str,
            StringConstraints(strip_whitespace=True, min_length=1),
            Field(max_length=60),
        ]
        | None
    ) = None
    target_temp_c: RangeModel | None = None
    target_humidity_pct: RangeModel | None = None
    incubation_days: Annotated[int, Field(ge=7, le=45)] | None = None
    default_turn_interval_min: Annotated[int, Field(ge=60, le=1440)] | None = None

    @model_validator(mode="after")
    def _non_empty(self) -> ModePatch:
        if all(
            value is None
            for value in (
                self.name,
                self.target_temp_c,
                self.target_humidity_pct,
                self.incubation_days,
                self.default_turn_interval_min,
            )
        ):
            raise ValueError("At least one mode field is required.")
        return self


class CandlingEntryDTO(BaseModel):
    model_config = Strict

    id: NonEmpty
    day: Annotated[int, Field(gt=0)]
    label: NonEmpty
    observed_on: Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$")]
    fertile_eggs: Annotated[int, Field(ge=0)]
    clear_eggs: Annotated[int, Field(ge=0)]
    uncertain_eggs: Annotated[int, Field(ge=0)]
    developing_eggs: Annotated[int, Field(ge=0)] | None = None
    stopped_developing_eggs: Annotated[int, Field(ge=0)] | None = None
    note: str = ""
    photo_keys: list[NonEmpty] = Field(default_factory=list)
    checks: list[DevelopmentCheck] = Field(default_factory=list)
    checkpoint_type: CheckpointType = "later"

    @model_serializer(mode="plain")
    def _dump(self) -> dict:
        # Optional-but-not-nullable fields must be absent, not null: the
        # frontend schema rejects explicit nulls for them.
        return {key: value for key, value in self.__dict__.items() if value is not None}


class CandlingEntryCreate(BaseModel):
    model_config = Strict

    day: Annotated[int, Field(gt=0)]
    label: NonEmpty
    observed_on: Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$")]
    fertile_eggs: Annotated[int, Field(ge=0)]
    clear_eggs: Annotated[int, Field(ge=0)]
    uncertain_eggs: Annotated[int, Field(ge=0)]
    developing_eggs: Annotated[int, Field(ge=0)] | None = None
    stopped_developing_eggs: Annotated[int, Field(ge=0)] | None = None
    note: str = ""
    photo_keys: list[NonEmpty] = Field(default_factory=list)
    checks: list[DevelopmentCheck] = Field(default_factory=list)
    checkpoint_type: CheckpointType = "later"


class CandlingEntryPatch(BaseModel):
    model_config = Strict

    label: NonEmpty | None = None
    observed_on: Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$")] | None = None
    fertile_eggs: Annotated[int, Field(ge=0)] | None = None
    clear_eggs: Annotated[int, Field(ge=0)] | None = None
    uncertain_eggs: Annotated[int, Field(ge=0)] | None = None
    developing_eggs: Annotated[int, Field(ge=0)] | None = None
    stopped_developing_eggs: Annotated[int, Field(ge=0)] | None = None
    note: str | None = None
    photo_keys: list[NonEmpty] | None = None
    checks: list[DevelopmentCheck] | None = None
    checkpoint_type: CheckpointType | None = None

    @model_validator(mode="after")
    def _non_empty(self) -> CandlingEntryPatch:
        if all(value is None for value in self.__dict__.values()):
            raise ValueError("At least one candling field is required.")
        return self


class IncubatorDTO(BaseModel):
    model_config = Strict

    id: NonEmpty
    name: NonEmpty
    device_id: NonEmpty
    mode_id: NonEmpty
    day_of_incubation: Annotated[int, Field(ge=0)]
    total_eggs_loaded: Annotated[int, Field(ge=0)] | None = None
    fertile_eggs: Annotated[int, Field(ge=0)] | None = None
    temperature_c: float
    humidity_pct: Annotated[float, Field(ge=0, le=100)]
    water_ok: bool
    temperature_trend_c: float
    humidity_trend_pct: float
    power_source: PowerSource
    battery_pct: Annotated[float, Field(ge=0, le=100)]
    status: UnitStatus
    last_turned_at: datetime
    next_turn_at: datetime
    turn_interval_min: Annotated[int, Field(ge=1)]
    auto_turn: bool
    paired: bool
    cycle_phase: CyclePhase
    condition_severity: ConditionSeverity
    connection_state: ConnectionState
    candled_days: list[Annotated[int, Field(gt=0)]]
    candling_entries: list[CandlingEntryDTO]


class ReadingDTO(BaseModel):
    model_config = Strict

    observed_at: datetime
    received_at: datetime
    temperature_c: float
    humidity_pct: Annotated[float, Field(ge=0, le=100)]
    water_ok: bool


class AlertDTO(BaseModel):
    model_config = Strict

    id: NonEmpty
    incubator_id: NonEmpty | None = None
    unit_name: NonEmpty | None = None
    severity: AlertSeverity
    code: NonEmpty
    title: NonEmpty
    message: str
    occurred_at: datetime
    acknowledged_at: datetime | None = None


class HatchHistoryDTO(BaseModel):
    model_config = Strict

    id: NonEmpty
    cycle_id: NonEmpty
    incubator_id: NonEmpty
    chamber_name: NonEmpty
    mode_id: NonEmpty
    mode_name: NonEmpty
    started_on: Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$")]
    ended_on: Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$")]
    total_eggs: Annotated[int, Field(ge=0)]
    fertile_eggs: Annotated[int, Field(ge=0)] | None = None
    hatched_eggs: Annotated[int, Field(ge=0)]


class AbortedCycleDTO(BaseModel):
    model_config = Strict

    id: NonEmpty
    cycle_id: NonEmpty
    incubator_id: NonEmpty
    chamber_name: NonEmpty
    mode_id: NonEmpty
    mode_name: NonEmpty
    stopped_at: datetime
    day_stopped: Annotated[int, Field(ge=0)]
    total_eggs: Annotated[int, Field(ge=0)]
    fertile_eggs: Annotated[int, Field(ge=0)] | None = None


class NotificationsModel(BaseModel):
    model_config = Strict

    enabled: dict[str, bool]
    sms: bool
    email: bool
    phone: str = ""
    email_address: str = ""


class PreferencesDTO(BaseModel):
    model_config = Strict

    farm_name: NonEmpty
    account_holder: NonEmpty
    display_name: str = ""
    notifications: NotificationsModel
    temperature_unit: TemperatureUnit
    time_zone: TimeZone


class CreateIncubatorRequest(BaseModel):
    model_config = Strict

    name: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1),
        Field(max_length=30),
    ]
    device_id: NonEmpty
    mode_id: NonEmpty


class UpdateProfileRequest(BaseModel):
    model_config = Strict

    name: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1),
        Field(max_length=30),
    ]


class UpdateConfigurationRequest(BaseModel):
    model_config = Strict

    mode_id: NonEmpty | None = None
    auto_turn: bool | None = None
    turn_interval_min: Annotated[int, Field(ge=1)] | None = None

    @model_validator(mode="after")
    def _non_empty(self) -> UpdateConfigurationRequest:
        if (
            self.mode_id is None
            and self.auto_turn is None
            and self.turn_interval_min is None
        ):
            raise ValueError("At least one configuration field is required.")
        return self


class StartCycleRequest(BaseModel):
    model_config = Strict

    mode_id: NonEmpty
    total_eggs: Annotated[int, Field(ge=1, le=38)]


class CompleteCycleRequest(BaseModel):
    model_config = Strict

    hatched_eggs: Annotated[int, Field(ge=0)]


class EmptyBody(BaseModel):
    model_config = Strict


class TurnAccepted(BaseModel):
    model_config = Strict

    command_id: NonEmpty
    status: Literal["accepted"]


class IdResponse(BaseModel):
    model_config = Strict

    id: NonEmpty


class HealthResponse(BaseModel):
    model_config = Strict

    status: Literal["ok"]


class ReadyResponse(BaseModel):
    model_config = Strict

    ready: bool
    checks: dict[str, str]
