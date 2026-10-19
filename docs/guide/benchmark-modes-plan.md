# HTM, LTM, and LHM implementation plan

**Date:** 2026-10-20
**Status:** retired on 2026-10-20. HTM/LTM/LHM are no longer available in the
chamber preparation or device-settings selectors, and the API refuses new
starts. Benchmark run rows and readings remain available in
**Trends → Incubation History**. No database deletion is part of retirement.
The preceding release record states that `htm40-v10-20261020` was deployed to the VPS and
`climate-benchmark-v10` is flashed on the ESP32. The 40.0°C HTM measurement
ceiling and 40.5°C DHT22 software cutoff are live; the device booted with valid
sensor data, no fault, regulation stopped and all actuators off. The empty-chamber
HTM trial has not started, so no physical capacity result is established. LTM/LHM
trials and repeatability checks also remain pending. Results appear in
**Trends → Incubation History**. The sections below retain the implementation
specification; see the [deployment record](./last-minute-change.md#benchmark-implementation-and-deployment-record).

## Requested outcome

Offer three selections in the website's existing chamber mode selector:

- **Highest Temperature Mode (HTM)**
- **Lowest Temperature Mode (LTM)**
- **Lowest Humidity Mode (LHM)**

Selecting one opens a benchmark setup/summary in that same flow. An explicit
**Start benchmark** command begins it. These are equipment tests, not egg
incubation profiles: no incubation timer, hatch dates, readiness requirement to
load eggs, or automatic tray turning. No maximum-humidity benchmark is included.

## Existing constraints that implementation must address

- Firmware `ClimateControl.h` defines three incubation profiles. Normal climate
  modes use a 39.0°C software overtemperature cutoff based on the same DHT22;
  this is not an independent hardware cutoff.
- Server `database/climate_control.py` accepts reports with mode IDs 0–2 and
  starts only unchanged Chicken/Duck/Quail presets.
- `ModeDTO` requires incubation days and a turning interval. Adding benchmark
  names as ordinary mode records would invent inappropriate incubation data
  and still fail the current server/firmware control checks.
- Existing climate command ordering, expiry, acknowledgements, telemetry,
  local diagnostics, offline storage, and actuator protections should be reused.
  Their current schemas and payload sizes must be checked when adding fields.

## 1. Define the three local test behaviors

The following settings are proposed initial defaults, to be reviewed against
the current hardware limits before implementation. They are not measured
performance claims or permission to raise the existing safety cutoff.

| Mode | Heater | Mist | Upper circulation | Lower exhaust | Measurement |
| --- | --- | --- | --- | --- | --- |
| HTM | Controlled warm-up within test ceiling and existing relay guards | Off | On, with normal lead time | Off normally; safety cooling takes precedence | Highest sustained temperature within allowed limits |
| LTM | Off | Off | On | 100% | Lowest sustained temperature under current intake conditions |
| LHM | Regulate Chicken temperature, 37.5–37.8°C | Off | On | Compare fixed 60% and 100% stages | Lowest sustained RH at qualified stable temperature, with dew point |

### HTM

- Revised test ceiling: **40.0°C**. HTM ends at that measurement ceiling and
  uses a **40.5°C firmware overtemperature cutoff** while HTM runs and while the
  chamber cools afterward. This cutoff uses the same DHT22, not a second sensor
  or thermal fuse; the incubator has no thermal fuse. Normal modes retain their
  39.0°C software cutoff.
- Preserve the 30-minute continuous-heater limit, one-hour benchmark timeout,
  stale/invalid sensor handling, PWM failure behavior, and fault latching. These
  software checks cannot protect against a failed sensor, welded relay, or
  firmware failure, and do not establish an absolute physical maximum.
- If the ceiling is reached, end heating and label the result **ceiling reached;
  physical maximum not established**. Residual temperature rise remains logged.
- If temperature stabilizes below the ceiling, report the observed plateau and
  elapsed time. A finite trial does not prove an absolute hardware maximum.
- Preserve heater-on timeout and sensor/fan/fault protections even if they end
  the run before its nominal observation window.

### LTM

- Measure the cooling trajectory and plateau with the stated actuator settings.
- Record the starting temperature; do not introduce an unrequested preheating
  stage. Comparisons require comparable starting and intake conditions.
- Report a measured minimum under these conditions, not refrigeration capacity
  or a guaranteed temperature below intake air.

### LHM

- Warm up and stabilize at the Chicken temperature band before qualifying RH
  results. Keep the mist off throughout, including warm-up.
- Run 60% then 100% exhaust stages, with measured applied PWM and existing
  heater/exhaust coordination. Use a provisional **10-minute observation per
  stage** after stabilization; count ramp/startup intervals separately.
- Existing raw-temperature/fault guards override the stage command. Mark any
  override, sensor gap, or out-of-band interval; do not call it a valid fixed-duty
  plateau. Re-stabilize within the total timeout rather than forcing the stage.
- If temperature cannot be maintained at a duty, report **temperature-limited**
  and keep the trajectory. Do not hide the constraint by accepting colder or
  hotter readings as the minimum RH result.
- Compare RH only in qualified temperature windows; also save dew point or
  equivalent moisture. Warm-up RH reduction alone is not moisture removal.
- Expose both stage results and their order. A later lower RH is not proof that
  a higher duty alone caused it; time and changing room conditions can confound
  the comparison. A reversed-order repeat is useful before causal claims.

## 2. Specify bounded run state and result qualification

- Use a dedicated benchmark run identity and lifecycle:
  `requested → acknowledged → warming/stabilizing → measuring → terminal`.
- Terminal outcomes include completed, cancelled, timed out, ceiling reached,
  temperature-limited, sensor/fault interrupted, restart interrupted, and
  rejected. Keep the detailed reason, not just a success boolean.
- Proposed maximum total duration: **60 minutes per run**, enforced on the
  ESP32 with monotonic time. LHM warm-up and both stages share this limit.
- Proposed plateau qualification: at least **five minutes** of fresh readings,
  temperature span ≤0.2°C, and absolute temperature trend ≤0.05°C/min. For LHM,
  additionally require in-band temperature, RH span ≤1 percentage point and
  absolute RH trend ≤0.1 percentage point/min. These are provisional indicated
  stability criteria and require review against DHT22 quantization/noise.
- Compute a mean, minimum, maximum, duration, and sample count for each qualified
  window. Report transient extrema separately. Select the highest/lowest
  qualified window mean for the requested sustained benchmark result.
- Exclude stale/invalid intervals; require a new full qualifying window after a
  gap or disturbance. Timeout without qualification is **no plateau established**,
  while retaining extrema and the full trace.

## 3. Firmware work

1. Add explicit benchmark capability/version and test identifiers. Keep ordinary
   incubation mode IDs separate; do not blindly widen every mode array/index.
2. Add bounded start/stop commands with run ID, sequence/expiry, test identifier,
   and validated limits. Duplicate delivery must not restart timers or heating.
3. Implement one local owner for actuator decisions, with benchmark behavior
   subordinate to existing Stop, sensor, PWM, relay, and fault protections.
4. Disable tray scheduling for every benchmark; reject start while tray motion
   or another run/lifecycle transition is pending. Require a stopped chamber,
   fresh healthy readings, supported capabilities, and no active egg cycle.
5. Keep the current DHT22 sampling cadence and unmodified measurements. A
   benchmark does not calibrate the sensor or justify an arbitrary offset.
6. Publish stage, elapsed/remaining time, actual settings, fault/termination
   reason, run ID, and bounded result summary. Save supporting local readings.
7. Keep the local timeout effective offline. Persist run identity and outcome
   safely; after reboot, mark an unfinished run interrupted and remain stopped.
   Never automatically resume a benchmark.
8. Define Stop/timeout output handling explicitly, retaining necessary existing
   fault cooling. Keep timed-out or cancelled tests separate from tray-return
   actions used for cancelling an incubation cycle.

## 4. Server, storage, and worker work

1. Add benchmark selections to the mode-selection response using an explicit
   kind/discriminated contract. Existing incubation records remain compatible;
   do not fabricate incubation days for benchmark entries.
2. Add authenticated per-chamber start/stop/status operations and a benchmark-run
   record. Use existing farm authorization, command expiry, and replay protection.
3. Lock lifecycle changes so a benchmark and incubation cannot start concurrently.
   Require an empty-chamber confirmation and device capability acknowledgement.
4. Store requested and applied settings separately. Do not mark a test running
   from a website click alone; reconcile matching device acknowledgement.
5. Link telemetry and local backfill to the matching run/stage, preserving sample
   timestamps and deduplicating readings. Retain a result even if interrupted.
6. Preserve existing preset behavior and older firmware parsing. An unsupported
   device gets a clear firmware-update requirement, never a fallback preset.
7. Save benchmark history per chamber, separate from incubation/hatch records,
   with temperature and humidity plots using the existing Trends components.

## 5. Website work

- Show full names with acronyms in the existing selector; group the three as
  equipment benchmarks so farmers can distinguish them from species presets.
- Show a concise explanation, empty-chamber requirement, timeout, and proposed
  settings before **Start benchmark**. Do not show Begin Incubation for these.
- Display current stage, elapsed time, temperature/RH, and **Stop benchmark**.
  Keep existing typography, colors, form sizes, and button hierarchy.
- Clearly distinguish waiting for device, running, stale connection, and terminal
  result. The device continues only its bounded authorized run during an outage.
- Show the sustained result and transient extrema separately, with missing
  ambient measurements, safety ceilings, or incomplete qualification visible.
- Reuse chamber-filtered Trends for saved runs; no separate dashboard is required.

## 6. Conditions to record for every run

Firmware version; chamber/device identity; test/run ID; start/end timestamps;
requested/applied settings; initial readings; raw temperature/RH and sensor health;
heater/mist state; fan commanded/applied PWM; stage/override reason; supply and
reservoir state; sensor location; door disturbances; and termination reason.

Record intake temperature/RH when a suitable sensor is available; otherwise mark
them unmeasured. A chamber sensor is not an independent intake reference. Results
remain DHT22-indicated, specific to the recorded environment/configuration.

## 7. Implementation and verification order

1. Freeze the protocol, defaults, safe limits, and result qualification above.
2. Back up current source/release artifacts and the VPS database; preserve NVS
   and local telemetry storage. Record current installed versions.
3. Implement additive API/storage/worker support first, capability-gated so old
   firmware continues normal operation. Prepare compatible website selection.
4. Implement firmware and bounded diagnostics; check flash/RAM/payload budgets.
5. Before rollout, verify command rejection/replay, lifecycle exclusion, Stop,
   expiry, sensor failures, hard limits, timeout, offline operation, restart,
   history linkage, and unchanged preset operation using targeted checks.
6. Deploy compatible server/worker support, install firmware while the chamber
   is empty/stopped, verify its capability/version, then enable website controls.
7. Run HTM, LTM, and LHM separately under recorded conditions. Physical evidence
   must verify actuator behavior, termination, saved history, and qualification;
   successful compilation is insufficient.
8. Restore normal stopped operation and verify Chicken selection/control still
   works. Record rollback instructions and any unresolved physical limitations.

## Effort and dependencies

Preliminary estimate for the website-selectable, acknowledged, saved-history
implementation: **8–14 engineering hours**, plus **up to one hour per physical
run** and additional repeats. Schema/rollout findings can increase this.
The earlier 1–2 hour estimate applied only to temporary firmware/serial tests,
not this integrated feature. This scope does not depend on implementing arbitrary
custom incubation profiles first.

## Completion criteria

All three exact names are selectable; each starts the intended acknowledged,
bounded local behavior; no benchmark overlaps incubation or turns the tray;
Stop/fault/offline/restart handling is verified; every run can be reviewed per
chamber in Trends, including incomplete runs; and physical results show the
conditions and limitations described above. No maximum-humidity test is added.

Software installation and stopped-state checks are complete. Physical benchmark
trajectories, sustained limits, and repeatability are not yet established.


## Sensor recovery correction (2026-10-20)

Firmware v9 pauses an active benchmark while the controller handles its normal
short DHT22 recovery window. Measurements and stage time do not accumulate
through that hold; heater and mist remain paused. The existing controller fault
deadline and one-hour benchmark timeout remain active. V9 booted with valid
sensor data, the controller stopped and all actuators off. A fresh physical
benchmark retry is still needed to confirm this correction under a run.

Artifact: `output/firmware/benchmark-v9-20261020/`.
