"""Use cases. Routers validate and delegate here; this module owns
validation beyond shapes, derivation, atomicity, and idempotency."""

from __future__ import annotations

import hashlib
import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any, TypeVar

from . import domain
from .errors import AppError
from .models import (
    AbortedCycleDTO,
    AlertDTO,
    CandlingEntryCreate,
    CandlingEntryDTO,
    CompleteCycleRequest,
    CreateIncubatorRequest,
    HatchHistoryDTO,
    IncubatorDTO,
    ModeDTO,
    ModePatch,
    PreferencesDTO,
    ReadingDTO,
    StartCycleRequest,
    TurnAccepted,
    UpdateConfigurationRequest,
    UpdateProfileRequest,
)
from .storage import StoreState

T = TypeVar("T")

# Mirrors the frontend unreachable-device simulation so B2 behavior parity holds.
UNREACHABLE_DEVICE_IDS = frozenset({"EGG-0000", "EGG-9999", "EGG-1005", "EGG-1010"})


def utcnow() -> datetime:
    return datetime.now(UTC)


def idempotent(
    store: StoreState, scope: str, key: str | None, thunk: Callable[[], T]
) -> T:
    """Replay the stored response when a retried Idempotency-Key arrives."""
    if not key:
        return thunk()
    cache_key = f"{scope}:{key}"
    if cache_key in store.idempotency:
        return store.idempotency[cache_key]
    result = thunk()
    store.idempotency[cache_key] = result
    return result


def require_incubator(store: StoreState, incubator_id: str) -> IncubatorDTO:
    try:
        return store.incubators[incubator_id]
    except KeyError:
        raise AppError(
            "not_found", f"Incubator {incubator_id} was not found."
        ) from None


def require_mode(store: StoreState, mode_id: str) -> ModeDTO:
    try:
        return store.modes[mode_id]
    except KeyError:
        raise AppError(
            "validation_error", f"Mode {mode_id} is not available for this incubator."
        ) from None


def derive(store: StoreState, unit: IncubatorDTO, now: datetime) -> IncubatorDTO:
    return domain.derive(unit, require_mode(store, unit.mode_id), now)


def save(store: StoreState, unit: IncubatorDTO, now: datetime) -> IncubatorDTO:
    derived = derive(store, unit, now)
    store.incubators[derived.id] = derived
    return derived


def list_incubators(store: StoreState) -> list[IncubatorDTO]:
    return list(store.incubators.values())


def create_incubator(
    store: StoreState, body: CreateIncubatorRequest, now: datetime
) -> IncubatorDTO:
    mode = require_mode(store, body.mode_id)
    if any(
        unit.device_id.upper() == body.device_id.upper()
        for unit in store.incubators.values()
    ):
        raise AppError("conflict", "Device is already assigned to a chamber.")
    unit = new_incubator(f"chamber-{uuid.uuid4().hex[:8]}", body, mode, now)
    return save(store, unit, now)


def new_incubator(
    incubator_id: str, body: CreateIncubatorRequest, mode: ModeDTO, now: datetime
) -> IncubatorDTO:
    """Initial simulation projection shared by creation and DB hydration."""
    unit = IncubatorDTO(
        id=incubator_id,
        name=body.name,
        device_id=body.device_id,
        mode_id=mode.id,
        day_of_incubation=0,
        total_eggs_loaded=None,
        fertile_eggs=None,
        temperature_c=(mode.target_temp_c.min + mode.target_temp_c.max) / 2,
        humidity_pct=(mode.target_humidity_pct.min + mode.target_humidity_pct.max) / 2,
        water_ok=True,
        temperature_trend_c=0.0,
        humidity_trend_pct=0.0,
        power_source="grid",
        battery_pct=100,
        status="optimal",
        last_turned_at=now,
        next_turn_at=now + timedelta(minutes=mode.default_turn_interval_min),
        turn_interval_min=mode.default_turn_interval_min,
        auto_turn=True,
        paired=True,
        cycle_phase="ready",
        condition_severity="info",
        connection_state="offline",
        candled_days=[],
        candling_entries=[],
    )
    return domain.derive(unit, mode, now)


def update_profile(
    store: StoreState, incubator_id: str, body: UpdateProfileRequest, now: datetime
) -> IncubatorDTO:
    unit = require_incubator(store, incubator_id)
    return save(store, unit.model_copy(update={"name": body.name}), now)


def update_configuration(
    store: StoreState,
    incubator_id: str,
    body: UpdateConfigurationRequest,
    now: datetime,
) -> IncubatorDTO:
    unit = require_incubator(store, incubator_id)
    patch: dict[str, Any] = {}
    if body.mode_id is not None:
        require_mode(store, body.mode_id)
        patch["mode_id"] = body.mode_id
    if body.auto_turn is not None:
        patch["auto_turn"] = body.auto_turn
    if body.turn_interval_min is not None:
        patch["turn_interval_min"] = body.turn_interval_min
    return save(store, unit.model_copy(update=patch), now)


def start_cycle(
    store: StoreState, incubator_id: str, body: StartCycleRequest, now: datetime
) -> IncubatorDTO:
    unit = require_incubator(store, incubator_id)
    mode = require_mode(store, body.mode_id)
    return save(
        store,
        unit.model_copy(
            update={
                "mode_id": mode.id,
                "day_of_incubation": 1,
                "total_eggs_loaded": body.total_eggs,
                "fertile_eggs": None,
                "cycle_phase": "incubating",
                "turn_interval_min": mode.default_turn_interval_min,
                "candled_days": [],
                "candling_entries": [],
                "last_turned_at": now,
                "next_turn_at": now + timedelta(minutes=mode.default_turn_interval_min),
            }
        ),
        now,
    )


def reset_chamber(store: StoreState, unit: IncubatorDTO, now: datetime) -> IncubatorDTO:
    return save(
        store,
        unit.model_copy(
            update={
                "day_of_incubation": 0,
                "total_eggs_loaded": 0,
                "fertile_eggs": None,
                "candled_days": [],
                "candling_entries": [],
                "auto_turn": False,
                "last_turned_at": now,
                "next_turn_at": now + timedelta(hours=24),
            }
        ),
        now,
    )


def reset_stopped_cycle(
    store: StoreState, incubator_id: str, now: datetime
) -> IncubatorDTO:
    return reset_chamber(store, require_incubator(store, incubator_id), now)


def request_turn(
    store: StoreState, incubator_id: str, command_id: str, now: datetime
) -> TurnAccepted:
    unit = require_incubator(store, incubator_id)
    save(
        store,
        unit.model_copy(
            update={
                "last_turned_at": now,
                "next_turn_at": now + timedelta(minutes=unit.turn_interval_min),
            }
        ),
        now,
    )
    return TurnAccepted(command_id=command_id, status="accepted")


def reconnect(store: StoreState, incubator_id: str, now: datetime) -> IncubatorDTO:
    unit = require_incubator(store, incubator_id)
    if unit.device_id.upper() in UNREACHABLE_DEVICE_IDS:
        raise AppError(
            "offline",
            f"Device {unit.device_id} is offline. Check its power and network connection.",
        )
    return save(store, unit.model_copy(update={"paired": True}), now)


def readings(
    store: StoreState, incubator_id: str, window: str, now: datetime
) -> list[ReadingDTO]:
    unit = require_incubator(store, incubator_id)
    mode = require_mode(store, unit.mode_id)
    if window not in ("24h", "7d", "full"):
        raise AppError("validation_error", "Window must be 24h, 7d, or full.")
    # Mirror the mock generator: N total slots for the chamber age, windows
    # keep slots within their hours, boundaries inclusive on both ends.
    total_slots = round(max(1, unit.day_of_incubation) * 12)
    keep = {"24h": 12, "7d": 84}[window] if window != "full" else total_slots
    count = min(total_slots, keep) + 1
    base_temp = (mode.target_temp_c.min + mode.target_temp_c.max) / 2
    base_hum = (mode.target_humidity_pct.min + mode.target_humidity_pct.max) / 2
    points: list[ReadingDTO] = []
    for slot in range(count):
        ago_hours = (count - 1 - slot) * 2
        digest = hashlib.sha256(f"{unit.device_id}:{ago_hours}".encode()).digest()
        noise = (int.from_bytes(digest[:2], "big") % 1000) / 1000 - 0.5
        observed = now - timedelta(hours=ago_hours)
        points.append(
            ReadingDTO(
                observed_at=observed,
                received_at=now,
                temperature_c=round(base_temp + noise * 0.3, 2),
                humidity_pct=round(min(100, max(0, base_hum + noise * 2.4)), 1),
                water_ok=unit.water_ok,
            )
        )
    return points


def complete_cycle(
    store: StoreState, incubator_id: str, body: CompleteCycleRequest, now: datetime
) -> HatchHistoryDTO:
    unit = require_incubator(store, incubator_id)
    total = unit.total_eggs_loaded or 0
    if unit.day_of_incubation < 1 or total < 1:
        raise AppError("validation_error", "There is no active cycle to complete.")
    fertile = unit.fertile_eggs
    if fertile is not None and not (0 <= body.hatched_eggs <= fertile <= total):
        raise AppError(
            "validation_error",
            "Hatched eggs must fit within fertile and total eggs.",
        )
    if fertile is None and not (0 <= body.hatched_eggs <= total):
        raise AppError("validation_error", "Hatched eggs must fit within total eggs.")
    mode = require_mode(store, unit.mode_id)
    start = now - timedelta(days=max(0, unit.day_of_incubation - 1))
    record = HatchHistoryDTO(
        id=f"hatch-{uuid.uuid4().hex[:8]}",
        cycle_id=f"cycle-{uuid.uuid4().hex[:8]}",
        incubator_id=unit.id,
        chamber_name=unit.name,
        mode_id=mode.id,
        mode_name=mode.name,
        started_on=start.date().isoformat(),
        ended_on=now.date().isoformat(),
        total_eggs=total,
        fertile_eggs=fertile,
        hatched_eggs=body.hatched_eggs,
    )
    store.hatch.append(record)
    reset_chamber(store, unit, now)
    return record


def stop_cycle(store: StoreState, incubator_id: str, now: datetime) -> AbortedCycleDTO:
    # Mirrors the mock: record the abort, then mark stopped_early/warning.
    # Unlike complete, stop does NOT reset the chamber.
    unit = require_incubator(store, incubator_id)
    mode = require_mode(store, unit.mode_id)
    record = AbortedCycleDTO(
        id=f"aborted-{uuid.uuid4().hex[:8]}",
        cycle_id=f"cycle-{uuid.uuid4().hex[:8]}",
        incubator_id=unit.id,
        chamber_name=unit.name,
        mode_id=mode.id,
        mode_name=mode.name,
        stopped_at=now,
        day_stopped=unit.day_of_incubation,
        total_eggs=unit.total_eggs_loaded or 0,
        fertile_eggs=unit.fertile_eggs,
    )
    store.aborted.append(record)
    store.incubators[unit.id] = unit.model_copy(
        update={"cycle_phase": "stopped_early", "status": "warning"}
    )
    return record


def list_candling(store: StoreState, incubator_id: str) -> list[CandlingEntryDTO]:
    return list(require_incubator(store, incubator_id).candling_entries)


def create_candling(
    store: StoreState, incubator_id: str, body: CandlingEntryCreate, now: datetime
) -> IncubatorDTO:
    unit = require_incubator(store, incubator_id)
    if any(entry.day == body.day for entry in unit.candling_entries):
        raise AppError(
            "conflict", f"A candling entry for day {body.day} already exists."
        )
    entry = CandlingEntryDTO(id=f"{incubator_id}-d{body.day}", **body.model_dump())
    days = sorted({*unit.candled_days, body.day})
    updated = unit.model_copy(
        update={
            "candling_entries": [*unit.candling_entries, entry],
            "candled_days": days,
        }
    )
    return save(store, updated, now)


def update_candling(
    store: StoreState,
    incubator_id: str,
    entry_id: str,
    patch: dict[str, Any],
    now: datetime,
) -> IncubatorDTO:
    unit = require_incubator(store, incubator_id)
    position = next(
        (i for i, e in enumerate(unit.candling_entries) if e.id == entry_id), None
    )
    if position is None:
        raise AppError("not_found", f"Candling entry {entry_id} was not found.")
    merged = unit.candling_entries[position].model_copy(update=patch)
    entries = list(unit.candling_entries)
    entries[position] = merged
    return save(store, unit.model_copy(update={"candling_entries": entries}), now)


def delete_candling(
    store: StoreState, incubator_id: str, entry_id: str, now: datetime
) -> str:
    unit = require_incubator(store, incubator_id)
    remaining = [e for e in unit.candling_entries if e.id != entry_id]
    if len(remaining) == len(unit.candling_entries):
        raise AppError("not_found", f"Candling entry {entry_id} was not found.")
    days = sorted({e.day for e in remaining})
    save(
        store,
        unit.model_copy(update={"candling_entries": remaining, "candled_days": days}),
        now,
    )
    return entry_id


def list_modes(store: StoreState) -> list[ModeDTO]:
    return list(store.modes.values())


def create_mode(store: StoreState, body: ModeDTO) -> ModeDTO:
    if body.id in store.modes:
        raise AppError("conflict", f"Mode {body.id} already exists.")
    store.modes[body.id] = body
    return body


def update_mode(
    store: StoreState, mode_id: str, patch: ModePatch, now: datetime
) -> ModeDTO:
    try:
        mode = store.modes[mode_id]
    except KeyError:
        raise AppError("not_found", f"Mode {mode_id} was not found.") from None
    updated = mode.model_copy(
        update={k: v for k, v in patch.model_dump().items() if v is not None}
    )
    store.modes[mode_id] = updated
    for unit in store.incubators.values():
        if unit.mode_id == mode_id:
            save(store, unit, now)
    return updated


def delete_mode(store: StoreState, mode_id: str) -> str:
    if mode_id not in store.modes:
        raise AppError("not_found", f"Mode {mode_id} was not found.")
    if any(unit.mode_id == mode_id for unit in store.incubators.values()):
        raise AppError("conflict", f"Mode {mode_id} is still assigned to a chamber.")
    del store.modes[mode_id]
    return mode_id


def list_alerts(store: StoreState) -> list[AlertDTO]:
    return list(store.alerts.values())


def acknowledge_alert(store: StoreState, alert_id: str, now: datetime) -> AlertDTO:
    try:
        alert = store.alerts[alert_id]
    except KeyError:
        raise AppError("not_found", f"Alert {alert_id} was not found.") from None
    updated = alert.model_copy(update={"acknowledged_at": alert.acknowledged_at or now})
    store.alerts[alert_id] = updated
    return updated


def dismiss_alert(store: StoreState, alert_id: str) -> str:
    try:
        del store.alerts[alert_id]
    except KeyError:
        raise AppError("not_found", f"Alert {alert_id} was not found.") from None
    return alert_id


def acknowledge_all_alerts(store: StoreState, now: datetime) -> list[AlertDTO]:
    for alert_id, alert in store.alerts.items():
        if alert.acknowledged_at is None:
            store.alerts[alert_id] = alert.model_copy(update={"acknowledged_at": now})
    return list_alerts(store)


def clear_acknowledged_alerts(store: StoreState) -> list[AlertDTO]:
    store.alerts = {
        alert_id: alert
        for alert_id, alert in store.alerts.items()
        if alert.acknowledged_at is None
    }
    return list_alerts(store)


def completed_cycles(store: StoreState) -> list[HatchHistoryDTO]:
    return list(store.hatch)


def stopped_cycles(store: StoreState) -> list[AbortedCycleDTO]:
    return list(store.aborted)


def get_preferences(store: StoreState) -> PreferencesDTO:
    return store.preferences


def replace_preferences(store: StoreState, body: PreferencesDTO) -> PreferencesDTO:
    store.preferences = body
    return body
