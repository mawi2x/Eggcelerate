# Climate optimization v2 — local candidate

Built on 19 October 2026 as `climate-adaptive-chicken-v2`. This candidate is
**not flashed or deployed**. The installed v1, VPS and hardware were not changed
in this optimization step. Chicken's displayed targets remain 37.5–37.8°C and
55–60% RH. Duck/Quail retain their existing regulator decisions.

## What changed

### Temperature and heater

Replaced the forecast-latched heater demand with bounded predictive proportional /
integral heat demand. The integral adapts to sustained heating load and is clamped
with conditional integration to avoid saturation windup. A short temperature trend
anticipates rising/falling conditions; raw readings still enforce safety limits.

Heat is delivered through **20-second relay windows**, with at most one new heater
pulse per window, minimum normal ON/OFF times of 5 seconds, and continuous full
heat available during warm-up. Safety/upper-bound stops override minimum ON time.
This is slow relay time proportioning, not high-frequency GPIO PWM. A cold request
cannot be replayed later in a window after it has been cancelled by warming.

The normal internal target is 37.65°C. During humidity drying it shifts to 37.70°C
(clamped below the upper target) to retain thermal headroom for air exchange.
Requested heat power is not an analog measured power; actual relay timing is
recorded by existing actuator diagnostics. Learning resets at a new preparation.

### Humidity and exhaust

Humidity decisions use estimated **equivalent RH at 37.65°C**, derived from the
measured vapor pressure. This helps distinguish moisture change from RH change
caused by warming or cooling. It is an approximate control calculation, not a
second humidity measurement or a sensor calibration. The saturation-pressure
formula is from the [US National Weather Service](https://www.weather.gov/media/epz/wxcalc/vaporPressure.pdf).

Drying responds to forecast moisture error relative to the midpoint, with bounded
accumulated demand and anti-windup. It can sustain airflow while humidity remains
high, rather than repeating the original fixed 10-second ON / 20-second OFF cycle.
Thermal headroom derates normal humidity fan requests to 50–70%, independently of
humidity duration demand. Startup still uses 100% for one second and the existing
ramp. Temperature/fault cooling can still command full output. The 50% floor,
frequency and electrical fan compatibility have not been requalified here.

Drying pauses when the temperature forecast becomes too low. When at least two
minutes of exhaust operation and five minutes of observation produce less than
0.5 point improvement while moisture remains above range, `dry_limit` records a
bounded backoff: lower demand, roughly 20–28-second ventilation pulses separated
by 60 seconds, then a fresh attempt after two minutes. This is not a diagnosis of
ambient humidity or a new latched safety fault. It avoids indefinitely increasing
output after ineffective drying. Incoming-air moisture is not measured.

### Mist maker

Pulse duration is calculated from forecast deficit and an observed response-gain
estimate. Until a useful response has been observed, pulse length is capped at one
second. All pulses remain between 0.5 and 3 seconds, with 20–60 seconds rest.

Gain updates require a 15-second settling period, no intervening exhaust, a small
temperature change (at most 0.2°C), and a positive measured moisture response. Gain
is smoothed and bounded; the estimate can be biased by other moisture sources.
Forecast low humidity can trigger a small pulse before the reading crosses the
lower bound. Raw upper-humidity and temperature gates still stop misting; mist
never runs against drying or cooling. Reliable mist-maker startup for these short
pulses remains a hardware qualification item.

### Preserved protections

Upper circulation stays on during regulation. Explicit Stop, startup authorization,
crash/manual-reset behavior, invalid/stale-sensor protection, 39°C overheat trip,
30-minute continuous-heater timeout, circulation lead, PWM failure handling and
offline environmental storage remain in place. No sensor fault is bypassed.
The earlier networking-stack fix remains in this build.

## Checks and comparisons

- NodeMCU-32S / ESP32 core 3.3.11 compilation passed: **1,221,100 bytes flash (93%)**,
  **67,428 bytes static RAM (20%)**. Runtime heap/stack margins are not measured here.
- **21 controller scenarios passed**, including raw safety gates, Stop/reset,
  relay minimum timing, one pulse per window, mist limits, thermal drying holds,
  warm-up humidity handling and failure-to-recover backoff.
- **Four diagnostic decoder tests passed**. Record layout/cloud schema are unchanged.
- Ten paired synthetic chamber scenarios were run against the frozen v1 source.
  Each simulates three hours; statistics use the final two hours after warm-up.
  They include heater/sensor lag, quantized readings, heat loss, ventilation,
  passive moisture and mist response. **Parameters are hypotheses, not measurements
  of this incubator.** No physical run was performed.

See `output/audits/climate-optimization-v2-20261019.json` for all results, source
hashes, baseline hashes, parameters and build evidence. Some simulated excursions
remain outside the requested band. The deliberately humid-intake case cannot
reach humidity target with ventilation alone and still fails. Slower sensors and
stronger heaters reduce target coverage; do not read these results as a physical
accuracy guarantee or a universal controller qualification.

## Material tradeoff: relay switching

The narrower regulation can require more heater switching than v1. The synthetic
moist-room case reaches about **180 heater cycles/hour** (20-second windows),
versus a lower switching rate for v1 while v1 misses humidity target. The one-pulse
limit prevents repeated restarts inside a window, but it does not establish that
the installed relay has an acceptable service life at this rate. Confirm relay
rating and actual switching frequency, then tune the window against real heater
response before installing v2 for egg use. Do not use high-frequency PWM on the
heater relay or assume that software minimum timing establishes contact life.

## Locations and reproduction

- Regulator: `apps/firmware/Eggcelerate/ClimateControl.h`
- Provisional tuning: `apps/firmware/Eggcelerate/AdaptiveConfig.h`
- Controller checks: `apps/firmware/tests/adaptive-control-test.cpp`
- Synthetic model: `apps/firmware/tests/coupled-climate-simulation.cpp`
- Frozen v1 model headers: `output/audits/climate-v1-baseline-20261019/`
- Private compiled image: `output/firmware/adaptive-chicken-v2-local-20261019/`

```sh
g++ -std=c++20 -Wall -Wextra -Werror -O2 apps/firmware/tests/adaptive-control-test.cpp -o /tmp/egg-control-check
/tmp/egg-control-check
g++ -std=c++20 -Wall -Wextra -Werror -O2 apps/firmware/tests/coupled-climate-simulation.cpp -o /tmp/egg-climate-model
/tmp/egg-climate-model
```

Model columns: scenario, actual-model temperature min/max, actual-model RH min/max,
joint time in target (%), heater transitions and exhaust starts in final two hours,
final fault code, total mist pulses over three hours. These are model outputs,
not uploaded ESP32 readings. Private binaries contain device configuration and
must not be published.
