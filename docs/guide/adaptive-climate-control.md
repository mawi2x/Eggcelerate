# Adaptive Chicken control — local implementation, 19 October 2026

Status: installed on 19 October 2026 with regulation stopped; VPS API/worker
updated. Boot/cloud/journal verified; invalid DHT22 readings currently prevent
clearing the reset fault and beginning an empty-chamber trial. Firmware marker:
`climate-adaptive-chicken-v1`. Chicken targets remain 37.5–37.8°C and 55–60% RH.
Duck and Quail retain their existing control decisions. No new lockdown profile
or claim of verified egg-level accuracy is introduced.

## Decisions

- **Trend:** valid successive samples produce bounded derivatives, exponentially
  smoothed with a 30-second time constant. Temperature input steps are limited to
  ±3°C/min and humidity steps to ±30 percentage points/min before smoothing.
  Invalid/stale intervals reset trend state. Raw readings remain unchanged for
  limits and hard safety decisions. Logged rate fields now represent this smoothed
  derivative; the earlier diagnostics-only build logged successive differences.
- **Heating:** uses the target midpoint (37.65°C), a 0.05°C internal deadband and
  a 20-second trend projection limited to ±0.15°C. Heating stops when projected
  temperature reaches the midpoint, or immediately at the raw upper bound or
  during temperature cooling. It restarts on low/predicted-low temperature after
  the existing minimum relay-off time. The heater remains relay-switched; no fast
  heater PWM or new minimum relay-on guarantee is introduced.
- **Temperature exhaust:** starts for a measured upper-bound excursion or a
  rising forecast above the upper bound when already above midpoint +0.05°C.
  Releases earlier as the measured/10-second projected temperature approaches the
  midpoint, instead of continuing deep into a falling-temperature cycle.
- **Humidity exhaust:** retains the high-RH demand latch, but speed and on/rest
  duration respond to humidity excess, smoothed trend and bounded accumulated
  drying effort. Pulse duration is 20–60 seconds; rest is 0–20 seconds. A severe
  demand can sustain exhaust. Effort accumulates only while thermal conditions
  permit humidity drying, is capped at 0.4 normalized demand, decays once RH is
  at/below its upper target, and resets when drying demand clears. This is bounded
  error adaptation, not automatic identification of chamber dynamics.
- **Coordination:** predicted/measured low temperature pauses humidity exhaust;
  it resumes after warming back to the midpoint with sufficient predicted margin.
  Temperature cooling takes priority; simultaneous high humidity can increase its
  requested duty. Heating can support humidity drying while temperature permits.
  Mist and drying/cooling remain mutually exclusive.
- **Mist:** adapts pulse length (0.5–3 seconds) and rest (20–60 seconds) to predicted
  humidity deficit. A pulse length is fixed at its start; safety/target gates can
  end it early. Misting requires temperature inside the selected band. It can be
  withheld if humidity is already rising toward the midpoint.
- **Circulation:** remains continuously commanded on during regulation. Normal
  exhaust keeps the 1-second startup boost, 50% provisional floor, 5-point/500-ms
  ramp, 1 kHz and 8-bit PWM. Longer adaptive vent periods give more operating time
  after boost/ramp. Fan RPM and minimum reliable duty remain physically unverified.

Tuning constants live in `apps/firmware/Eggcelerate/AdaptiveConfig.h` and are
provisional engineering values, not measured thermal response parameters. There
is no persistent learned state: drying effort resets on a new preparation/start.
The normal preparation-to-incubation handoff preserves continuous control.

## Preserved safety and storage

Explicit all-equipment Stop, fault latching/manual reset, invalid/stale sensor
handling, 39°C overheat trip, 30-minute continuous-heater timeout, circulation
lead time, minimum relay-off interval, startup/restart authorization, watchdog,
and PWM-failure behavior are retained. Safety checks use raw readings.

Existing environmental offline recording and its ACK/replay protocol are unchanged.
The bounded diagnostic journal records raw readings, smoothed rates, actuator/demand
states and timing using the existing record layout. Run/reference comparisons must
retain the firmware marker and source/config hashes to distinguish rate semantics.
The diagnostic-only build evidence remains a historical artifact, not the hash of
this new build. Both API and MQTT worker need the optional diagnostics schema before
this firmware is installed; see [control diagnostics](control-diagnostics.md).

The reservoir is closed. No reservoir change or exposed-water assumption is made.
No UI or target-range changes are included.

## Outstanding verification

No automated tests, simulations, hardware tests, flashing, or VPS deployment were
performed in this step. Compilation and static review do not establish control
stability or guaranteed target compliance. Before installing for egg use, verify:

1. Empty chamber with representative thermal load: heat coast-up, cooling
   coast-down, sensor lag, relay cycling and sustained simultaneous target coverage.
2. Fixed room conditions/closed reservoir: complete humidity response and air
   exchange during adaptive vent periods, including humidity that cannot improve.
3. Minimum fan startup/airflow; verify boost/ramp and temperature permission prevent
   cold excursions while still allowing useful drying.
4. Mist pulse/rest bounds, demand exclusions, mode transitions, invalid/stale data,
   stop/fault/restart behavior and retained safety protections.
5. Reference temperature/RH near the operating point and across the egg tray.
   The DHT22 alone cannot substantiate a physical 0.3°C accuracy band.
6. Diagnostic queue/rotation/power-loss cases and accepted telemetry with the
   updated API/worker before a monitored firmware installation.

Incoming-air moisture is not measured. Ventilation cannot be assumed to dehumidify
under every room condition. No convergence guarantee or automatic recovery alarm
is claimed; ambient measurements and any failure-to-recover alert are follow-up work.

Build evidence: `output/audits/adaptive-climate-build-20261019.json`.
NodeMCU-32S / core 3.3.11 compilation passed: 1,218,652 bytes flash
and 61,540 bytes static RAM. Whitespace checks passed.

## Installation and verification update

- Sixteen controller decision scenarios passed, including raw safety gates,
  adaptive drying, mist bounds, relay off time, manual reset and Stop/restart.
- Six backend tests and four decoder tests passed. Seven database integration
  tests were skipped because no isolated test database was configured. Existing
  offline-storage host regression passed after a host-only strlcpy compatibility fix.
- First installation exposed a loopTask stack-canary crash during TLS connection.
  Moved main-loop-only payload/diagnostic and offline packet buffers to static
  storage. Corrected build: 1,218,592 bytes flash (92%), 67,428 bytes static RAM
  (20%). An interrupted serial transfer was retried at explicit 115200 baud;
  application hash verification passed. Wi-Fi/NVS/environmental files preserved.
- VPS API and telemetry worker accept diagnostic fields; /readyz healthy. Rollback
  source/wrapper/images and database dump saved at
  `/opt/eggcelerate/rollback-adaptive-climate-20261019-zxrdnoe7`.
- Corrected firmware cloud report confirmed stopped outputs, PWM ready at 1 kHz /
  8 bit, journal available, 23 records written, zero drops/write failures, and
  uptime 58 seconds. Sensor readings were invalid; the crash-reset fault remains
  latched. No thermal/humidity trial or regulation was started.
- User was asked to check normal incubator power alongside USB. Resolve invalid
  readings before clearing the reset fault. Selected mode remains Quail; select
  Chicken before any adaptive-control trial. Power-loss/physical plant qualification
  and sustained temperature/humidity compliance remain outstanding.
