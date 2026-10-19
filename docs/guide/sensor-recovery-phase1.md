# Sensor recovery phase 1

Local firmware candidate: `climate-sensor-recovery-v3`, 19 October 2026.
Not flashed by this change. Temperature/humidity targets, normal adaptive tuning,
GPIO allocation and fan PWM configuration are unchanged.

## Behavior

- An invalid DHT22 attempt (nonfinite or outside existing plausibility limits)
  pauses heater and mist at the next controller tick/output application. The
  controller task remains active and retains preparation/incubation phase.
- Last valid temperature, humidity and acquisition time are retained separately in
  `State.lastGoodTemperature`, `lastGoodHumidity` and `lastGoodAt`. They are not
  substituted as valid samples or used to authorize heating/misting.
- A fixed **6,000 ms** recovery deadline starts at the first failed attempt.
  Two consecutive valid attempts before that deadline allow automatic continuation.
  At the normal 2,500 ms sample interval, recovery after one failed attempt takes
  approximately five seconds. A failed recovery attempt resets the good count,
  but neither it nor the first successful attempt extends the deadline.
- At or after the deadline, Sensor failure latches and stops regulation. Later
  valid samples do not clear a latched fault. Manual reset remains required.
- A sample-stream gap longer than 6,000 ms still latches Stale sensor. Deadlines
  are checked before accepting a late sample, so a delayed read cannot hide a gap.
  Outputs never run on stale/invalid samples during recovery.
- Circulation continues during the temporary hold. Exhaust retains its previous
  requested duty; no new drying decision uses held values. Latched-fault exhaust
  behavior remains unchanged (full exhaust); temperature-aware fault ventilation
  is phase 2 and is **not implemented here**.
- Adaptive integral time accounting is suspended during the hold, and an interrupted
  mist-response observation is discarded. Existing heater/mist restart delays
  continue to apply after recovery. No change to the relay switching schedule.
- Explicit Stop prevents automatic restart. Overheat, controller reset, storage,
  heater timeout and PWM output faults remain latched. A normal boot still requires
  the existing authorization/resume checks and two valid samples.

## Observability and compatibility

The existing `sensor_valid` flag describes the latest acquisition, not completion
of the two-reading recovery check. On the first recovered reading it can be true
while heater and mist remain paused. Existing `sample_age_ms` is age of the latest
attempt; `lastGoodAt` separately tracks the valid reading. Serial status reports
"Checking sensor; heater and mist paused" and the output reason `sensor_wait`.
The existing diagnostic record/cloud schema is unchanged. Expanded sensor-health
telemetry is reserved for phase 3. No NVS/run-record format change or VPS update.

## Verification

Run from the repository root:

```sh
g++ -std=c++20 -Wall -Wextra -Werror -O2 apps/firmware/tests/sensor-recovery-test.cpp -o /tmp/egg-sensor-recovery-test
/tmp/egg-sensor-recovery-test
g++ -std=c++20 -Wall -Wextra -Werror -O2 apps/firmware/tests/adaptive-control-test.cpp -o /tmp/egg-adaptive-control-phase1
/tmp/egg-adaptive-control-phase1
```

The sensor suite covers all species, two-good recovery, invalid/out-of-range
samples, fixed timeout boundaries, partial recovery, late valid samples, missing
samples, active mist interruption, explicit Stop, serious fault preservation,
startup refusal with one good reading and the 32-bit millisecond rollover. The
existing 21 adaptive control scenarios also pass with the new transient-failure
expectation. Build evidence and firmware hashes are in the local release manifest.

These are software checks. They do not diagnose the physical cause of the DHT22
failure, qualify electrical noise immunity, or prove incubation performance.
A controlled empty-chamber trial is still needed after installation.
