import math

import pytest
from pydantic import ValidationError

from eggcelerate_api.database.climate_control import ClimateReport


def report():
    return dict(sensor_valid=True, running=False, mode=0, heater=False, mist=False,
                upper=False, exhaust=False, fault=0, command_id="", accepted=False)


def diagnostic():
    return dict(version=1, sample=2, evaluated_ms=5000,
                temperature_rate_c_min=0.1, humidity_rate_pct_min=-0.2,
                heat_demand=False, dry_demand=True, mist_demand=False,
                temperature_cooling=False, vent_on=False,
                heater_elapsed_ms=3000, mist_elapsed_ms=3000, vent_elapsed_ms=1000,
                journal=dict(version=1, available=True, written=2, dropped=0,
                             write_failures=0, rotations=0))


def test_old_report_and_diagnostic_round_trip():
    assert ClimateReport.model_validate(report()).diagnostics is None
    value = ClimateReport.model_validate(dict(report(), diagnostics=diagnostic()))
    assert value.diagnostics.dry_demand
    saved = value.model_dump(exclude_none=True)
    assert ClimateReport.model_validate(saved).diagnostics.journal.written == 2


def test_unknown_diagnostic_and_nonfinite_rates_rejected():
    for extra in [dict(unrecognized=True), dict(temperature_rate_c_min=math.nan)]:
        with pytest.raises(ValidationError):
            ClimateReport.model_validate(dict(report(), diagnostics=dict(diagnostic(), **extra)))


def test_null_trend_survives_history_serialization():
    d = diagnostic()
    d["temperature_rate_c_min"] = None
    d["humidity_rate_pct_min"] = None
    value = ClimateReport.model_validate(dict(report(), diagnostics=d))
    saved = value.model_dump(exclude_none=True)
    assert ClimateReport.model_validate(saved).diagnostics.temperature_rate_c_min is None


def sensor():
    return dict(successes=2, failures=1, consecutive_failures=0, consecutive_good=2,
                recovery_hold=False, recoveries=1, last_good_age_ms=100,
                last_good_temperature_c=37.5, last_good_humidity_pct=58,
                last_failure_ms=2500, last_recovery_ms=7500, fault_at_ms=0, reset_reason=3)


def test_sensor_health_and_journal_v2_round_trip():
    d = diagnostic()
    d["journal"]["version"] = 2
    d["sensor"] = sensor()
    value = ClimateReport.model_validate(dict(report(), diagnostics=d))
    assert value.diagnostics.sensor.recoveries == 1
    assert ClimateReport.model_validate(value.model_dump()).diagnostics.journal.version == 2


def test_unknown_last_good_reading_is_nullable():
    d = diagnostic()
    d["sensor"] = dict(sensor(), successes=0, last_good_age_ms=None,
                       last_good_temperature_c=None, last_good_humidity_pct=None)
    value = ClimateReport.model_validate(dict(report(), diagnostics=d))
    assert value.diagnostics.sensor.last_good_age_ms is None


@pytest.mark.parametrize("extra", [dict(consecutive_good=3), dict(failures=-1),
    dict(last_good_temperature_c=math.nan), dict(recovery_hold="yes"), dict(unrecognized=True)])
def test_invalid_sensor_health_rejected(extra):
    d = dict(diagnostic(), sensor=dict(sensor(), **extra))
    with pytest.raises(ValidationError):
        ClimateReport.model_validate(dict(report(), diagnostics=d))


def adaptive():
    return dict(equivalent_rh=64.2, moisture_rate_pct_min=-0.2, humidity_forecast=64.1,
                heat_forecast_c=37.7, cooling_forecast_c=37.7, power_forecast_c=37.7,
                thermal_target_c=37.7, heating_power=0.4, heat_integral=0.2,
                heat_feed_forward=0.12, dry_effort=0.3, dry_baseline=65,
                review_delta=None, duty_seconds=60, last_review_baseline=None,
                last_review_duty_seconds=0, last_review_eligible_ms=0,
                last_review_exhaust_ms=0, stable_ms=30000, review_elapsed_ms=10000,
                eligible_ms=10000, exhaust_ms=10000, review_count=0,
                dry_held=False, may_dry=True, dry_limited=False, thermal_ceiling=83,
                review_result=1, boost_active=False, heat_window_second=5, test_duty=60)


def test_adaptive_diagnostics_with_v3_journal():
    d = dict(diagnostic(), adaptive=adaptive())
    d["journal"]["version"] = 3
    value = ClimateReport.model_validate(dict(report(), diagnostics=d))
    assert value.diagnostics.adaptive.test_duty == 60
    assert ClimateReport.model_validate(value.model_dump()).diagnostics.adaptive.dry_baseline == 65


@pytest.mark.parametrize("extra", [dict(thermal_ceiling=101), dict(test_duty=-1),
    dict(heat_forecast_c=math.inf), dict(dry_held="yes"), dict(eligible_ms=-1), dict(unrecognized=True)])
def test_invalid_adaptive_health_rejected(extra):
    d = dict(diagnostic(), adaptive=dict(adaptive(), **extra))
    with pytest.raises(ValidationError):
        ClimateReport.model_validate(dict(report(), diagnostics=d))
