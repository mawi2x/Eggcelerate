"""Legacy power fields must not create conditions after monitoring is removed."""
from datetime import UTC, datetime, timedelta

import pytest

from eggcelerate_api.domain import condition_severity
from eggcelerate_api.store import MemoryStore


@pytest.mark.parametrize("battery_pct", [0, 5, 15, 20, 25, 100])
def test_battery_readings_do_not_raise_conditions(battery_pct):
    now = datetime.now(UTC)
    assert condition_severity(
        paired=True,
        temp=37.6,
        temp_min=37.5,
        temp_max=37.8,
        humidity=57,
        humidity_min=55,
        humidity_max=60,
        water_ok=True,
        battery_pct=battery_pct,
        power_source="battery",
        next_turn=now + timedelta(hours=1),
        now=now,
        telemetry_status="fresh",
    ) == "info"


def test_memory_seed_has_no_battery_or_power_alerts():
    store = MemoryStore()
    assert all(
        alert.code not in {"on-battery", "grid-lost", "battery-low", "battery-full"}
        for alert in store.alerts.values()
    )
