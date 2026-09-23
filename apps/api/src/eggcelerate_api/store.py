"""In-memory state with deterministic dev seed.

Seed values mirror apps/web/src/app/data/fixtures (modes, chambers, alerts).
Relative timestamps anchor at store creation, like the frontend fixtures
anchor at repository construction. Request transactions serialize access and
restore state on failure; persistence will implement the storage contract.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from threading import Lock
from typing import Any, cast

from . import domain
from .lifecycle import CycleState
from .models import (
    AbortedCycleDTO,
    AlertDTO,
    AlertSeverity,
    CandlingEntryDTO,
    HatchHistoryDTO,
    IncubatorDTO,
    ModeDTO,
    NotificationsModel,
    PowerSource,
    PreferencesDTO,
    RangeModel,
)

FARM_MODES = [
    ("broiler", "Broiler", True, 37.5, 37.8, 55, 60, 21, 240),
    ("duck", "Duck", True, 37.4, 37.6, 62, 68, 28, 360),
    ("quail", "Quail", True, 37.5, 37.8, 55, 60, 18, 240),
    ("goose", "Goose", True, 37.3, 37.6, 60, 65, 30, 360),
    ("turkey", "Turkey", True, 37.5, 37.8, 55, 60, 28, 240),
    ("pheasant", "Pheasant", True, 37.5, 37.8, 55, 60, 24, 360),
    ("peafowl", "Peafowl", True, 37.2, 37.5, 60, 65, 28, 360),
    ("swan", "Swan", True, 37.2, 37.5, 65, 72, 36, 480),
    ("broiler-hh", "Broiler High-Humidity", False, 37.5, 37.8, 62, 68, 21, 240),
    ("rapid-quail", "Rapid Quail Experimental", False, 37.8, 38.2, 50, 55, 17, 180),
]

# id, name, device, mode, day, eggs, fertile, temp, hum, water, ttrend, htrend,
# power, battery, last-ago-min, next-in-min, interval-h, auto, paired
FARM_CHAMBERS = [
    (
        "chamber-1",
        "Chamber One",
        "EGG-1003",
        "broiler",
        9,
        24,
        22,
        37.6,
        57,
        True,
        0.1,
        0.3,
        "grid",
        100,
        95,
        145,
        4,
        True,
        True,
    ),
    (
        "chamber-2",
        "Chamber Two",
        "EGG-1004",
        "duck",
        14,
        32,
        None,
        37.5,
        51,
        True,
        -0.1,
        -1.4,
        "grid",
        82,
        50,
        190,
        6,
        True,
        True,
    ),
    (
        "chamber-3",
        "Chamber Three",
        "EGG-1005",
        "quail",
        15,
        38,
        None,
        39.2,
        64,
        False,
        1.3,
        0.2,
        "battery",
        23,
        220,
        -40,
        4,
        False,
        False,
    ),
    (
        "chamber-4",
        "Chamber Four",
        "EGG-1006",
        "goose",
        22,
        24,
        None,
        37.4,
        62,
        True,
        -0.1,
        0.4,
        "grid",
        100,
        40,
        320,
        6,
        True,
        True,
    ),
    (
        "chamber-5",
        "Chamber Five",
        "EGG-1007",
        "turkey",
        5,
        30,
        None,
        37.7,
        58,
        True,
        0.2,
        -0.2,
        "grid",
        91,
        70,
        170,
        4,
        True,
        True,
    ),
    (
        "chamber-6",
        "Chamber Six",
        "EGG-1008",
        "pheasant",
        11,
        38,
        None,
        38.1,
        49,
        False,
        0.5,
        -1.1,
        "grid",
        100,
        120,
        240,
        6,
        True,
        True,
    ),
    (
        "chamber-7",
        "Chamber Seven",
        "EGG-1009",
        "broiler",
        1,
        38,
        None,
        37.6,
        56,
        True,
        0.0,
        0.0,
        "grid",
        100,
        20,
        220,
        4,
        True,
        True,
    ),
    (
        "chamber-8",
        "Chamber Eight",
        "EGG-1010",
        "peafowl",
        18,
        24,
        None,
        39.8,
        42,
        False,
        1.8,
        -2.2,
        "battery",
        15,
        300,
        -90,
        6,
        False,
        False,
    ),
    (
        "chamber-9",
        "Chamber Nine",
        "EGG-1011",
        "quail",
        17,
        38,
        None,
        37.5,
        68,
        True,
        0.0,
        0.6,
        "battery",
        82,
        35,
        205,
        4,
        True,
        True,
    ),
    (
        "chamber-10",
        "Chamber Ten",
        "EGG-1012",
        "duck",
        3,
        32,
        None,
        37.6,
        55,
        True,
        0.1,
        -0.1,
        "grid",
        100,
        60,
        300,
        6,
        True,
        True,
    ),
    (
        "chamber-11",
        "Chamber Eleven",
        "EGG-1013",
        "swan",
        29,
        16,
        None,
        36.9,
        71,
        False,
        -0.4,
        0.3,
        "battery",
        64,
        90,
        390,
        8,
        True,
        True,
    ),
    (
        "chamber-12",
        "Chamber Twelve",
        "EGG-1014",
        "broiler-hh",
        22,
        37,
        31,
        37.5,
        65,
        True,
        0.0,
        0.2,
        "grid",
        100,
        25,
        215,
        4,
        True,
        True,
    ),
]

# id, severity, code, chamber-id, title, message, minutes-ago, acknowledged
FARM_ALERTS = [
    (
        "a1",
        "critical",
        "temperature-too-high",
        "chamber-3",
        "Temperature Too High",
        "Temperature is 39.2°C, above the safe range. Check the heater and ventilation.",
        12,
        False,
    ),
    (
        "a2",
        "warning",
        "water-low",
        "chamber-3",
        "Water Reservoir Low",
        "Water reservoir low (12%). Refill the mist maker to keep humidity stable.",
        25,
        False,
    ),
    (
        "a3",
        "critical",
        "turning-overdue",
        "chamber-3",
        "Egg Turning Overdue",
        "Egg turning overdue by 40 minutes. Turn eggs to prevent sticking.",
        40,
        False,
    ),
    (
        "a4",
        "warning",
        "on-battery",
        "chamber-3",
        "Running on Battery",
        "Running on battery with 23% remaining. Restore power soon.",
        65,
        False,
    ),
    (
        "a5",
        "warning",
        "humidity-out-of-range",
        "chamber-2",
        "Humidity Out of Range",
        "Humidity is 51%, below the target. Add water to the reservoir.",
        88,
        False,
    ),
    (
        "a6",
        "warning",
        "water-low",
        "chamber-2",
        "Water Reservoir Low",
        "Water reservoir is low. Top it up soon.",
        1500,
        True,
    ),
    (
        "a7",
        "info",
        "candling-due",
        "chamber-2",
        "Candling Due",
        "Candling reminder: second candling due today.",
        1560,
        True,
    ),
    (
        "a8",
        "info",
        "eggs-turned",
        "chamber-1",
        "Eggs Turned",
        "Eggs turned successfully.",
        1605,
        True,
    ),
    (
        "a9",
        "warning",
        "grid-lost",
        "chamber-3",
        "Grid Power Lost",
        "Grid power was lost. The incubator switched to battery backup.",
        10240,
        True,
    ),
    (
        "a10",
        "info",
        "daily-summary",
        "chamber-1",
        "Daily Summary",
        "Daily summary: all readings within safe range.",
        10545,
        True,
    ),
    (
        "a11",
        "info",
        "reservoir-refilled",
        "chamber-1",
        "Reservoir Refilled",
        "Water reservoir refilled to 100%.",
        10590,
        True,
    ),
    (
        "a12",
        "info",
        "hatch-approaching",
        "chamber-3",
        "Hatch Day Approaching",
        "Hatch day is approaching. Expected hatch is in 3 days.",
        10715,
        True,
    ),
]

UNIT_NAMES = {
    "chamber-1": "Chamber One",
    "chamber-2": "Chamber Two",
    "chamber-3": "Chamber Three",
}


class MemoryStore:
    def __init__(self, now: datetime | None = None):
        boot = now or datetime.now(UTC)
        self.modes: dict[str, ModeDTO] = {}
        for entry in FARM_MODES:
            (mid, name, built_in, tmin, tmax, hmin, hmax, days, turn_min) = entry
            self.modes[mid] = ModeDTO(
                id=mid,
                name=name,
                built_in=built_in,
                target_temp_c=RangeModel(min=tmin, max=tmax),
                target_humidity_pct=RangeModel(min=hmin, max=hmax),
                incubation_days=days,
                default_turn_interval_min=turn_min,
            )
        self.incubators: dict[str, IncubatorDTO] = {}
        for row in FARM_CHAMBERS:
            (
                cid,
                name,
                device,
                mode_id,
                day,
                eggs,
                fertile,
                temp,
                hum,
                water,
                ttrend,
                htrend,
                power,
                battery,
                ago,
                ahead,
                interval_h,
                auto,
                paired,
            ) = row
            unit = IncubatorDTO(
                id=cid,
                name=name,
                device_id=device,
                mode_id=mode_id,
                day_of_incubation=day,
                total_eggs_loaded=eggs,
                fertile_eggs=fertile,
                temperature_c=temp,
                humidity_pct=hum,
                water_ok=water,
                temperature_trend_c=ttrend,
                humidity_trend_pct=htrend,
                power_source=cast(PowerSource, power),
                battery_pct=battery,
                status="optimal",
                last_turned_at=boot - timedelta(minutes=ago),
                next_turn_at=boot + timedelta(minutes=ahead),
                turn_interval_min=interval_h * 60,
                auto_turn=auto,
                paired=paired,
                cycle_phase="incubating",
                condition_severity="info",
                connection_state="offline",
                candled_days=[],
                candling_entries=[],
                telemetry_status="offline",
            )
            self.incubators[cid] = domain.derive(unit, self.modes[mode_id], boot)
        self.incubators["chamber-1"] = self.incubators["chamber-1"].model_copy(
            update={
                "candled_days": [6, 9],
                "candling_entries": [
                    CandlingEntryDTO(
                        id="candling-1-6",
                        day=6,
                        label="First candling",
                        observed_on="2026-08-27",
                        fertile_eggs=22,
                        clear_eggs=2,
                        uncertain_eggs=0,
                        note="Strong spider veining across 22 eggs.",
                        photo_keys=[],
                        checks=["veining", "air_cell"],
                        checkpoint_type="first",
                    ),
                    CandlingEntryDTO(
                        id="candling-1-9",
                        day=9,
                        label="Development check",
                        observed_on="2026-08-30",
                        fertile_eggs=22,
                        clear_eggs=2,
                        uncertain_eggs=1,
                        developing_eggs=21,
                        note="Movement observed in several eggs.",
                        photo_keys=[],
                        checks=["veining", "air_cell", "movement"],
                        checkpoint_type="later",
                    ),
                ],
            }
        )
        self.incubators["chamber-12"] = self.incubators["chamber-12"].model_copy(
            update={
                "candled_days": [6, 13, 18],
                "candling_entries": [
                    CandlingEntryDTO(
                        id="candling-12-18",
                        day=18,
                        label="Lockdown check",
                        observed_on="2026-08-31",
                        fertile_eggs=31,
                        developing_eggs=28,
                        clear_eggs=5,
                        uncertain_eggs=2,
                        stopped_developing_eggs=2,
                        note="Air cells tilted for hatch position.",
                        photo_keys=[],
                        checks=["veining", "air_cell", "movement"],
                        checkpoint_type="later",
                    ),
                ],
            }
        )
        self.alerts: dict[str, AlertDTO] = {}
        for aid, severity, code, chamber, title, message, ago_min, acked in FARM_ALERTS:
            occurred = boot - timedelta(minutes=ago_min)
            self.alerts[aid] = AlertDTO(
                id=aid,
                incubator_id=chamber,
                unit_name=UNIT_NAMES.get(chamber),
                severity=cast(AlertSeverity, severity),
                code=code,
                title=title,
                message=message,
                occurred_at=occurred,
                acknowledged_at=occurred if acked else None,
            )
        self.hatch: list[HatchHistoryDTO] = [
            HatchHistoryDTO(
                id="hatch-1",
                cycle_id="cycle-1",
                incubator_id="chamber-1",
                chamber_name="Chamber One",
                mode_id="broiler",
                mode_name="Broiler",
                started_on="2026-08-13",
                ended_on="2026-09-03",
                total_eggs=24,
                fertile_eggs=22,
                hatched_eggs=20,
            )
        ]
        self.aborted: list[AbortedCycleDTO] = [
            AbortedCycleDTO(
                id="aborted-1",
                cycle_id="cycle-2",
                incubator_id="chamber-2",
                chamber_name="Chamber Two",
                mode_id="duck",
                mode_name="Duck",
                stopped_at=boot - timedelta(days=1),
                day_stopped=6,
                total_eggs=30,
                fertile_eggs=None,
            )
        ]
        self.preferences = PreferencesDTO(
            farm_name="Sunrise Poultry",
            account_holder="Farmer Juan Dela Cruz",
            display_name="Farmer Juan",
            notifications=NotificationsModel(
                enabled={"temp": True, "humidity": True, "water": True},
                sms=True,
                email=True,
                phone="",
                email_address="",
            ),
            temperature_unit="c",
            time_zone="gmt8",
        )
        self.cycles = {
            f"seed-cycle-{unit.id}": CycleState(
                f"seed-cycle-{unit.id}",
                unit.id,
                "active",
                (boot - timedelta(days=max(0, unit.day_of_incubation - 1)))
                .date()
                .isoformat(),
            )
            for unit in self.incubators.values()
            if unit.day_of_incubation > 0
        }
        self.current_cycles = {
            cycle.incubator_id: cycle.id for cycle in self.cycles.values()
        }
        for record in self.hatch:
            self.cycles[record.cycle_id] = CycleState(
                record.cycle_id, record.incubator_id, "completed", record.started_on
            )
        for stopped in self.aborted:
            self.cycles[stopped.cycle_id] = CycleState(
                stopped.cycle_id,
                stopped.incubator_id,
                "stopped",
                (stopped.stopped_at - timedelta(days=max(0, stopped.day_stopped - 1)))
                .date()
                .isoformat(),
            )
        self.idempotency: dict[str, Any] = {}
        # A primitive Lock can be released by another worker thread: FastAPI
        # may enter and exit a sync generator dependency on different workers.
        self._transaction_lock = Lock()

    @contextmanager
    def transaction(self) -> Iterator[MemoryStore]:
        """Commit on normal exit, restore every state collection on failure.

        This serializes the small development farm within one process only.
        PostgreSQL transactions/constraints must provide cross-process safety.
        """
        with self._transaction_lock:
            snapshot = deepcopy(
                {k: v for k, v in vars(self).items() if k != "_transaction_lock"}
            )
            try:
                yield self
            except BaseException:
                for key in list(vars(self)):
                    if key != "_transaction_lock":
                        delattr(self, key)
                vars(self).update(snapshot)
                raise
