# Fault ventilation phase 2

Local candidate `climate-fault-ventilation-v4`, 19 October 2026. Includes phase 1
sensor recovery. Not flashed or deployed by this change.

## Fault output policy

Heater and mist stay off in every latched fault. Faults remain latched until the
existing reset checks pass. Changing fan output never authorizes heating or starts
preparation/incubation. Explicit Stop suppresses every actuator, including fans.
Upper circulation stays on during an active fault unless explicitly stopped.

| Evidence / fault | Exhaust request |
| --- | --- |
| Two fresh valid readings, temperature at/above selected mode's upper target | 100% cooling |
| Cooling active, fresh temperature between midpoint and upper target | Keep cooling (hysteresis) |
| Two fresh valid readings, temperature at/below midpoint | Off; fault stays latched |
| Sensor unavailable, last valid temperature hot or cooling previously active | 100% only while last valid reading is at most 60 seconds old |
| Sensor unavailable, cold/unknown last valid temperature, or ordinary hot evidence older than 60 seconds | Off; circulation continues |
| Confirmed temperature >=39°C, including an overheat observed after another fault latched | Emergency 100% until two fresh readings confirm temperature at/below midpoint |
| PWM output unavailable | No exhaust request; PWM fault remains and circulation continues |

The first recovered reading cannot release emergency/hot cooling: two consecutive
valid readings are required. Ordinary blind cooling is bounded by the acquisition
time of the last valid reading, not the time at which a fault was latched. The
60-second limit is an initial engineering value, not a measured chamber cooldown.
Confirmed overheat deliberately overrides that blind timeout because actual
cooling has not been established. A restored Overheat fault initializes the same
emergency policy when outputs are not explicitly stopped.

Mode midpoints are Chicken 37.65°C, Duck 37.50°C, Quail 37.65°C. Selected mode
upper targets remain 37.8°C, 37.6°C and 37.8°C respectively. There is no humidity
ventilation while a fault is latched: temperature safety controls those fan
requests; normal moisture regulation resumes only after reset and authorized start.

## Implementation and observability

`ClimateControl.h::faultVentilation()` replaces unconditional full exhaust in the
latched-fault branch. It uses last-good evidence retained by phase 1, two-reading
freshness checks and an independent confirmed-overheat latch. PWM startup, duty
conversion, GPIO assignment, explicit Stop and normal regulation are unchanged.
The status message no longer claims both fans are always on during faults.
Diagnostic reasons are `fault_hot`, `fault_cold`, `fault_wait` and `fan_fault`,
within the existing 12-byte journal field and API string limit. No record-layout,
NVS format, database, web UI or VPS changes are needed. Fan percentages remain
commands, not measured RPM or airflow.

## Checks

New `apps/firmware/tests/fault-ventilation-test.cpp` covers all three modes,
invalid/cold/hot sensors, midpoint hysteresis, one-versus-two recovered readings,
blind timeout boundaries, stale data, overheat precedence after another fault,
long unknown periods after confirmed overheating, continued faults after cooling,
manual reset remaining stopped, explicit Stop, PWM failure and millis rollover.

```sh
g++ -std=c++20 -Wall -Wextra -Werror -O2 apps/firmware/tests/fault-ventilation-test.cpp -o /tmp/egg-fault-ventilation-test
/tmp/egg-fault-ventilation-test
```

Phase 1 sensor-recovery checks, the 21 adaptive control scenarios and four journal
decoder tests must also pass. Build sizes and artifact/source hashes are recorded
in `output/firmware/fault-ventilation-v4-local-20261019/build-manifest.json`.

No hardware trial was performed here. This phase prevents unnecessary sustained
fault cooling; it does not prove that normal control can reach 55–60% RH or fix the
physical source of intermittent DHT22 failures. Next: sensor-health diagnostics and
an uninterrupted empty-chamber run to measure joint temperature/humidity behavior.
