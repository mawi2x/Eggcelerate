# Incubation-control improvement plan — October 18, 2026

Status: proposed implementation plan based on the October 17 audit in
[ROADMAP.md](../../ROADMAP.md#october-17--incubation-control-audit-chicken-targets-humidity-and-fans).
Plan revised with the user's clarifications. Implementation is pending. Chicken
is the first implementation profile; do not assume its settings transfer to
Duck/Quail.

## Current scope — supersedes earlier validation gates below

The user explicitly requests proceeding **without validation**, retaining the
earlier **planning only, no code edits** instruction. Complete the plan using
the confirmed arrangement. No repeat wiring/PWM check, thermometer comparison,
airflow measurement, test suite or soak run is required or requested now.
All validation checklists, exit evidence and physical qualification requirements
below are deferred reference material, not prerequisites for completing this
plan or claims of passed performance. Do not ask for more validation to proceed.

Accepted planning baseline:

- Wiring/pins unchanged and verified by the user; ESP32 PWM through the MOSFET
  successfully adjusted fan speed using a slider.
- Upper GPIO18 faces the heater and circulates heat internally; lower GPIO19
  exhausts chamber air.
- DHT22 sits above the egg tray near the rear intake side of the upper fan.
  Insulation is food-delivery-bag-style foam. The user feels similar warmth
  above/below the tray; a separate thermometer comparison has not been recorded.
  Accept this setup without claiming quantified egg-level temperature agreement.
- CPU chicken reference range is **37.5–37.8°C for both internal control and
  display**, per the user's latest correction. The earlier 37–38°C display
  proposal is withdrawn. Use precise effective targets for status/readiness and
  details/logs; retain explicit alert and fault thresholds.
- Working PWM frequency, minimum start/run duty and boost remain settings to
  recover from existing evidence or select explicitly during later implementation.
  Do not invent a prior measured value or re-open basic fan compatibility.

First future implementation slice: basic control/output history, one PWM output
owner, full upper circulation and gradual lower-exhaust duty, startup behavior
and existing Stop/fault priorities. Follow with coordinated heater cutoff,
mist/exhaust arbitration and stage profiles. Retain current mist pulse/rest
limits initially. No PID, tray changes or hardware replacement is required by
this slice. The sustained drops near 35°C remain unexplained; PWM is not their
confirmed cure.

October 18 user clarification: installed wiring is already verified and pin
allocation has not changed. Accept that confirmation; wiring continuity and pin
allocation are not open prerequisites.

Latest user clarification supersedes the earlier uncertainty: they previously
tested adjusting fan power and it worked. Accept adjustable operation of the
installed arrangement as user-confirmed; repeating basic compatibility tests is
not a prerequisite. The production firmware still uses ON/OFF commands, so the
main gap is software integration. Recover the prior working control method and
settings where available; frequency, minimum reliable start/run duties and boost
have not yet been recorded. The user now explicitly confirms the upper fan faces
the heater and circulates heat internally; the lower fan exhausts chamber air.
These roles are established. Feedback availability still awaits clarification.
The phase-2 checklist below covers remaining operating parameters
and performance evidence, not a requirement to re-prove basic compatibility.

## Chicken temperature reference review — October 18

The user asked whether a 37.5°C midpoint should imply a 37–38°C operating range.
That arithmetic is **±0.5°C**, not ±5°C. It is a proposed tolerance, not an
established recommendation or an authorized change to the current firmware.

The confirmed internal circulation makes forced-air guidance relevant:

- [Brinsea Mini Eco manual, section 5.6](https://www.brinsea.com/manuals/miniecous.pdf)
  recommends 37.4–37.6°C for hens and emphasizes stable temperature. This supports
  a nominal 37.5°C target for planning, rather than routinely traversing 37–38°C.
- [Mississippi State Extension, Important incubation factors](https://accessibility.extension.msstate.edu/agriculture/livestock/poultry/important-incubation-factors)
  uses 100°F (about 37.8°C) for forced-air incubation and advises fluctuations
  smaller than half a degree on either side. Its units are Fahrenheit:
  ±0.5°F is about ±0.28°C, not ±0.5°C. The stated maximum total variation of
  1°F is about 0.56°C. Source setpoints differ; do not combine one source's
  midpoint with another's tolerance and present the result as a common rule.

Initial recommendation before the user's CPU reference was supplied: use 37.5°C as the proposed nominal chicken target and
37.4–37.6°C as a reference-based normal regulation aim, subject to calibrated
egg-level measurements and achievable chamber performance. Keep nominal target,
control hysteresis, observed excursions, sensor uncertainty and alarm/cutoff
thresholds distinct. Sensor ±0.5°C accuracy does not justify allowing the actual
temperature to cycle ±0.5°C. Do not label 37–38°C a universally advisable normal
band or a guaranteed safe exposure range; duration and egg temperature matter.

Current source remains 37.5–37.8°C (midpoint 37.65°C); adopting a 37.5°C nominal
profile would require a later explicit profile revision across firmware/API/UI.
No targets, alarms or output logic were changed during this reference review.

### User's chosen reference and display preference

The user supplied [CPU Research Center for Philippine Native Chicken — Hatchery
Management](https://www.phlnativechicken.com/Hatchery-Management/), reviewed October
18. It specifies forced-draft setter/hatcher temperature of **37.5–37.8°C**,
matching current chicken firmware. Use this as the working chicken temperature
reference for the revised plan; the earlier Brinsea-based proposal is an
alternative, not an adopted replacement. The midpoint of 37.5–37.8°C is 37.65°C.

The user's latest correction withdraws the earlier 37–38°C display preference.
Show **37.5–37.8°C** as the chicken target range, matching internal control and
the CPU reference. Keep decimal precision in live readings, details and logs;
use effective targets consistently for dashboard status and readiness. Alert and
fault thresholds remain separate explicit settings.

This CPU page also supplies stage humidity/turning guidance. Reconcile those
separately during stage planning; supplying the reference is not a request to
change mist or tray scheduling now. No control-code edits are authorized here.

## Objective and constraints

Deliver measured, stable temperature and humidity control with qualified fan
speed control, adequate mixing/fresh air, explainable actuator decisions and
dashboard reports that distinguish commands from observed operation.

- Current authoritative pins: DHT22 4; heater 27/IN1; mist 14/IN3; upper
  circulation 18/MOSFET; lower exhaust 19/MOSFET. Wiring and this unchanged pin
  allocation are user-confirmed verified.
- Retain the existing Prepare → readiness → owner confirmation → incubation flow.
  Use a separate bench only for the necessary hardware qualification; do not add
  a second production start workflow.
- Keep autonomous regulation on the ESP32. Cloud loss must not disable a healthy
  local regulator. Preserve explicit all-equipment Stop and fresh acknowledgement.
- Do not equate MOSFET PWM capability with fan compatibility. Do not choose a
  frequency, minimum duty, startup boost or stage target without supporting data.
- No hardware energization, firmware upload, deployment or controller tuning is
  part of this planning change. Existing paused power/EN work remains open.

## Delivery order

| Phase | Deliverable | Planning outcome |
| --- | --- | --- |
| 1 | Traceable configuration and durable control history | Can identify the actual firmware, profile and actuator decisions behind a trace |
| 2 | Record accepted hardware and recover available settings | Wiring, working slider, airflow roles and sensor placement accepted; missing settings explicit |
| 3 | Production PWM output layer and explicit fault policy | One output owner, duties, startup behavior and priority rules specified |
| 4 | Coordinated temperature/humidity/ventilation control | Tight internal range and gradual exhaust/heater/mist arbitration specified |
| 5 | Stage-aware profiles and truthful dashboard/export | Stage transitions work locally and every display agrees with effective device state |
| 6 | Implementation handoff | Scope, remaining settings, rollback and deferred validation documented |

Plan basic logging and PWM/duty telemetry as the initial implementation slice.
Reuse the successful fan-control approach without requesting a new validation
session. Full history UI and stage scheduling can follow. Keep the separate
power/EN issue visible; do not make resolving it a prerequisite to this plan.

## Phase 1 — make the next trace explainable

Changes:

1. Add firmware build/hash, configuration version/hash, boot/reset identity,
   mode, lifecycle/stage and effective targets to controller reports. Distinguish
   website-selected mode from device-applied mode. A running mismatch blocks
   readiness and creates an actionable notification.
2. Add append-only control samples, actuator transitions, fault/boot events and
   command history. Keep the existing latest-state projection for dashboard reads.
   Relate records by device, boot ID, monotonic time, sample sequence and command ID.
3. Capture each 2.5-second control sample: raw and control T/RH, validity/error,
   sample age, demand flags, inhibition reasons, timer states, profile and applied
   outputs. Capture applied output changes, including startup/fault overrides,
   independently of the normal 15-second dashboard publishing cadence.
4. Batch history uploads without blocking the control task. Use a bounded offline
   buffer with explicit overflow/drop counters; display gaps instead of implying
   complete history. Size capacity and retention from measured event volume,
   especially during duty ramps; avoid flash writes on every control tick.
5. Extend export with these fields and mark mode/stage changes, resets, missing
   data and manual interventions. Preserve UTC plus explicit display timezone.
6. Reconcile the obsolete reversed fan labels in the standalone bench and hardware
   records against the user-confirmed current pins; do not reopen wiring checks.
   Mark the provisional September safety contract as historical and
   document current source behavior separately from unverified physical claims.

Primary files: `EggcelerateFirmware.h`, `ClimateRuntime.h`, API
`database/schema.py`, `database/climate_control.py`, telemetry ingestion/migrations,
DTOs and web `features/trends/raw-export.ts`.

Exit evidence: reconstruct a three-second mist pulse, ten-second exhaust pulse,
command rejection, fault and reboot from stored events. Verify duplicate/reordered
uploads, overflow reporting and visible gaps. Confirm a live chicken request is
reported as mode 0 with its effective targets; historical October 16 mode remains
unresolved rather than being rewritten from the latest Duck report.

## Phase 2 — record accepted setup and remaining parameters

Current instruction: accept verified wiring, working PWM adjustment, confirmed
fan roles and sensor position. The characterization checklist below is deferred
reference material only. It is not a required activity or blocker. Keep upper
circulation at its current full command in the initial slice and focus variable
speed on lower exhaust first. Do not assume a tach signal is connected.

Record one operating sheet per fan/channel, reusing the user's successful prior
test and recovering its settings where available. Do not repeat basic wiring or
adjustability checks already confirmed:

- Record the already verified wiring and unchanged GPIO assignments as the
  baseline. Obtain installed fan/module identity, airflow direction, mounting,
  vent path and feedback availability from the user and existing evidence.
- Document the module topology and known trigger behavior needed to interpret
  supply PWM. Qualify power/reset output behavior as a runtime requirement;
  this does not reopen accepted wiring continuity or ground connections.
- GPIO and switched-load waveforms, candidate frequency compatibility, supply
  current/stability, RPM or independently measured rotation, noise and temperature.
- Minimum reliable duty from rest versus minimum sustainable duty while spinning,
  startup boost duty/duration, stall/restart behavior and variation with supply,
  mounting and expected environment. Do not infer duty from the 7 V DC start rating.
- Continuous circulation speed sufficient for egg-level temperature uniformity;
  measured fresh-air exchange through passive vents and/or exhaust at representative
  loading. Mixing and fresh-air exchange need separate acceptance evidence.

Compare the DHT22 against a calibrated reference near operating temperature and
RH. Map egg-level conditions with heat/mist/fans active. Correct placement and
record calibration uncertainty before narrowing the controller band. Check supply
rails/reset reasons around heater, mist and fan transitions as part of the open
power/EN investigation.

Exit gate: recover/document the working control method and usable operating
envelope plus airflow requirements. Hardware replacement is not a planned
prerequisite. Revisit the control method only if new operating evidence exposes
a specific limitation beyond the already confirmed adjustable operation.

## Phase 3 — introduce a single production fan-output owner

Implementation boundaries:

- `ClimateControl.h`: replace fan Booleans as the control representation with
  numeric requested duties and explicit decision/override reasons. Keep legacy
  Boolean telemetry derived from applied duty for compatibility.
- `ClimateRuntime.h`: one output owner initializes LEDC with the qualified
  frequency/resolution, checks setup/write results, applies calibrated limits,
  handles startup boost and writes actual duties. Other paths submit intent.
  After attachment, ordinary fan updates must not use competing `digitalWrite()`.
- Store separate per-fan settings: pin, polarity, frequency, resolution, start/run
  limits, boost and qualified airflow duty. Version settings and reject invalid
  combinations. Map requested nonzero duties below the usable range explicitly;
  never silently request a stalled speed.
- Log requested duty, applied duty and boost/limit/fault reason. A duty percentage
  describes electrical command, not RPM or airflow percentage.
- Add minimal API/UI duty support in the same delivery. Use capability negotiation
  so old reports remain readable and unsupported firmware is identified.

Specify the actuator priority table before tuning:

| State | Heat / mist | Fans and recovery |
| --- | --- | --- |
| Explicit Stop | Off immediately | All off; remains stopped until explicit authorized start |
| Confirmed overheat | Off immediately | Qualified emergency cooling; bypass ordinary ramp limits; latch and require deliberate recovery |
| Invalid/stale sensor | Off immediately | Separate qualified sensor-loss ventilation policy; avoid blindly inheriting indefinite overheat exhaust; latch and notify |
| PWM/output failure or verified fan stall | Inhibit heat and mist as required by airflow dependency | Apply qualified failure response; report failure rather than claiming duty was applied |
| Healthy running | Coordinated phase-4 decisions | Continuous qualified circulation and required fresh-air provision |
| Normal power recovery | Off during validation | Restore only valid saved authorization after fresh sensor/profile checks and established airflow |
| Crash/watchdog, saved fault or corrupt storage | No automatic heat/mist restart | Explicit fault recovery; document whether each fan can operate safely in this state |

Keep immediate heat/mist inhibition and existing fault latching initially; do not
add automatic recovery from a transient invalid sample as a tuning shortcut.
Choose exact sensor-loss fan duty/duration from independent temperature/airflow
evidence. Add tach/airflow supervision if feasible; without it, label fan operation
unverified and require an independent heater overtemperature cutoff. A timed fan
lead alone does not prove circulation. Confirm the cutoff rating/trip behavior
against the actual assembly rather than adopting the old provisional 42°C value.

Exit evidence: PWM scope/RPM checks, cold starts at minimum command, stop during
boost/ramp, failed attachment/write, fan stall where detectable, invalid/stale data,
overheat, NVS corruption, power and watchdog recovery. Verify no command or timer
can override explicit Stop or a higher-priority fault.

## Phase 4 — coordinate heat, humidity and airflow

Use a bounded rule-based regulator first; do not introduce PID before measuring
thermal response. Keep heater/mist on their existing relay outputs with equipment-
appropriate switching limits. Do not apply high-frequency PWM to those relays.

1. Establish separate inputs for minimum circulation, required fresh-air exchange,
   temperature cooling and humidity drying. Upper circulation normally stays at a
   qualified steady speed; its speed need not oscillate with exhaust demand.
2. Compute exhaust as the greater required airflow demand from temperature,
   humidity and fresh-air provision, then map it through the qualified fan curve.
   Apply a temperature constraint to optional drying demand, never silently remove
   required fresh air to retain heat or humidity. Report unsatisfied demands.
3. Add hysteresis/deadbands, minimum dwell where needed and normal duty ramp limits
   based on measurements. Overheat and Stop bypass gradual transitions. Distinguish
   intentional drying with bounded heat replacement from avoidable heat/cool cycling.
4. Measure post-cutoff thermal rise and temperature slope. Tune heater cutoff before
   the upper boundary when needed to account for stored heat; retain raw emergency
   overheat protection. Decide controller/filter parameters using measured lag.
5. Dose mist from measured pulse response and settling time. Block mist during
   corrective drying/emergency cooling. Required baseline fresh-air ventilation
   must not permanently disable mist: replenish its moisture loss when safe.
   Track mist availability, excessive runtime and reservoir condition if measurable.
6. Keep raw readings plus a modest validated control filter if needed. Detect
   implausible jumps/disagreement without filtering away an actual overheat. Lack
   of sensor variation alone is not proof of failure in a stable chamber.
7. Expose one effective configuration for targets and hysteresis across firmware,
   API and dashboard. Remove or clarify settings that do not affect the controller.

Qualification metrics: time-weighted time inside/outside each effective target
band, peak overshoot/undershoot, longest excursion, settling/recovery time,
temperature spread at egg level, heater cycles, fan starts/stalls, mist use and
measured fresh-air exchange. Exclude warm-up explicitly, and report missing time
separately. Define numerical pass limits before the comparison runs, accounting
for reference uncertainty; current chicken targets remain the baseline until an
approved profile change is recorded. The existing 383-point trace is diagnostic
evidence, not a clean same-mode performance baseline.

## Phase 5 — local stage profiles and truthful presentation

- Define versioned chicken preparation, normal-incubation and lockdown/hatching
  profiles with documented temperature/RH/ventilation requirements. Confirm exact
  values using appropriate incubation guidance and chamber measurements; do not
  copy normal-incubation values into every stage by default.
- Send the accepted schedule/start time to the device and persist it with run
  authorization. Stage transitions must operate without the dashboard online.
  Define clock validation and clock-loss/reboot behavior; never silently reset to
  day 1 or revert to an earlier stage. Preserve owner-confirmed incubation start.
- Add explicit stage/targets/configuration acknowledgement. Update preset validation
  and command compatibility rather than bypassing the current unchanged-preset guard.
- Display selected versus applied mode where they differ, effective stage/targets,
  commanded/applied duty, measured RPM if present, report age and feedback capability.
  Label unavailable feedback and stale status honestly. Preserve current On/Off
  compatibility while upgrading the API and UI.
- Overlay output changes, faults, stage changes, resets and gaps on climate history;
  include them in export. Keep raw readings available for diagnosis.

Exit evidence: stage boundary, offline transition, normal power restoration, invalid
clock, configuration mismatch, old firmware and stale reports. All displayed values
must agree with device-applied state; no inferred fan rotation from a GPIO command.

## Phase 6 — implementation handoff; validation deferred

Current deliverable: complete planning documentation. No code implementation,
tests, physical measurements, 24-hour soak, upload or deployment is requested.
Earlier acceptance ideas below are retained only as deferred reference material;
they are not gates under the user's current instruction. Keep selected future
PWM settings, output priorities, compatibility and rollback explicit. Deferred
validation is not a claim of proven stability or physical accuracy.

Use isolated controller/transport tests and firmware builds before supervised
physical qualification. Cover threshold boundaries, conflicting demands, timer
rollover, Stop precedence, sensor faults, duty limits/startup and command replay.
Use a disposable database for migration and history-contract verification.

Compare the characterized baseline and candidate under recorded ambient/load
conditions with representative thermal loading before any live-egg acceptance.
Exercise cold start, steady operation, humidity disturbances, door opening,
power recovery, network loss and stage transitions. Run at least 24 hours of
representative steady operation to expose repeated cycling, buffer growth and
unexpected resets; this does not establish full-cycle hatch performance. Verify
lockdown separately and retain raw evidence and the agreed metrics.

Release gate: no unexplained resets/stalls or unsafe output transitions; measured
airflow and declared stability limits met; every excursion/gap is visible;
independent protection and recovery verified. Numerical acceptance thresholds
and test conditions must be recorded before execution. Record remaining limits
instead of declaring success solely from a successful firmware compile.

Prepare rollback to a known firmware/configuration pair and compatible schema/API.
Faults and explicit Stop must not be erased or auto-resumed during rollback.
Upload and deployment are separate operational steps after a reviewable change.

## First implementation slice

When implementation is requested, combine phase-1 basic decision/output logging
with phase-3 PWM support using the accepted phase-2 arrangement. Preserve full
upper circulation; add gradual lower-exhaust duty, startup settings and existing
Stop/fault overrides. Report applied duty through API/UI. Keep CPU chicken targets
37.5–37.8°C internally and on the display. Follow with
coordinated heater/mist/exhaust improvements using decision history, then stage
profiles. Missing PWM parameters remain explicit implementation choices; no
further validation is required to complete the plan.
