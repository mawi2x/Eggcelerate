"""Domain derivation, ported from apps/web/src/app/domain/cycle.ts.

Thresholds are the contract: any change here must land in the frontend
helper and the simulator physics together, or the three disagree.
"""

from __future__ import annotations

from datetime import datetime

from .models import IncubatorDTO, ModeDTO

TRAY_CAPACITY = 38


def lockdown_day(incubation_days: int) -> int:
    return max(1, round(18 / 21 * incubation_days))


def cycle_phase(day_of_incubation: int, incubation_days: int) -> str:
    if day_of_incubation <= 0:
        return "ready"
    if day_of_incubation > incubation_days:
        return "awaiting_finish"
    if day_of_incubation == incubation_days:
        return "hatching"
    if day_of_incubation >= lockdown_day(incubation_days):
        return "lockdown"
    return "incubating"


def connection_state(paired: bool) -> str:
    return "connected" if paired else "offline"


def condition_severity(
    *,
    paired: bool,
    temp: float,
    temp_min: float,
    temp_max: float,
    humidity: float,
    humidity_min: float,
    humidity_max: float,
    water_ok: bool,
    battery_pct: float,
    power_source: str,
    next_turn: datetime,
    now: datetime,
    telemetry_status: str = "fresh",
) -> str:
    temp_critical = temp < temp_min - 0.5 or temp > temp_max + 0.5
    humidity_critical = humidity < humidity_min - 5 or humidity > humidity_max + 5
    battery_critical = power_source == "battery" and battery_pct <= 15
    telemetry_critical = telemetry_status == "offline"
    turning_overdue = next_turn < now
    if (
        not paired
        or telemetry_critical
        or not water_ok
        or temp_critical
        or humidity_critical
        or battery_critical
    ):
        return "critical"
    temp_warning = temp < temp_min or temp > temp_max
    humidity_warning = humidity < humidity_min or humidity > humidity_max
    battery_warning = power_source == "battery" and battery_pct <= 25
    telemetry_warning = telemetry_status == "stale"
    if (
        telemetry_warning
        or temp_warning
        or humidity_warning
        or battery_warning
        or turning_overdue
    ):
        return "warning"
    return "info"


def severity_to_status(severity: str) -> str:
    return {"critical": "alert", "warning": "warning"}.get(severity, "optimal")


def derive(unit: IncubatorDTO, mode: ModeDTO, now: datetime) -> IncubatorDTO:
    """Recompute read-only state. Call after every mutation that touches inputs."""
    severity = condition_severity(
        paired=unit.paired,
        temp=unit.temperature_c,
        temp_min=mode.target_temp_c.min,
        temp_max=mode.target_temp_c.max,
        humidity=unit.humidity_pct,
        humidity_min=mode.target_humidity_pct.min,
        humidity_max=mode.target_humidity_pct.max,
        water_ok=unit.water_ok,
        battery_pct=unit.battery_pct,
        power_source=unit.power_source,
        telemetry_status=unit.telemetry_status,
        next_turn=unit.next_turn_at,
        now=now,
    )
    return unit.model_copy(
        update={
            "condition_severity": severity,
            "status": (
                "warning"
                if unit.cycle_phase == "stopped_early" and unit.day_of_incubation > 0
                else severity_to_status(severity)
            ),
            "connection_state": connection_state(
                unit.paired and unit.telemetry_status == "fresh"
            ),
            "cycle_phase": (
                "stopped_early"
                if unit.cycle_phase == "stopped_early" and unit.day_of_incubation > 0
                else cycle_phase(unit.day_of_incubation, mode.incubation_days)
            ),
        }
    )
