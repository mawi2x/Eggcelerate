# Integrated actuators, VPS manual controls and threshold control

> **Latest tray confirmation — October 15:** The installed motor is **220 V AC**,
> and the user confirms **90 degrees total rocking travel**. Earlier DC motor
> assumptions below are historical and superseded. Control remains relay IN2 /
> GPIO25 (LOW on / HIGH off); main firmware holds it off. Cycle duration,
> self-stop/continuous-power behavior and position/home feedback remain unknown.
> Use the [current handoff](../../docs/guide/capstone-next-phases-2026-10-15.md).


> **October 15 update:** Earlier mappings/implementation status below include historical proposals.
> Use the [current capstone handoff](../../docs/guide/capstone-next-phases-2026-10-15.md)
> for authoritative pins, implemented climate lifecycle and remaining tray/power phases.


Planning checkpoint: October 14, 2026. User reports the separate relay and
MOSFET benches working. This document plans the next implementation; it enables
no new hardware outputs, uploads no firmware and changes no deployed service.

## User requirements

- Keep manual actuator controls, hosted on the existing Eggcelerate VPS.
- Do not host the actuator-control page on the ESP32. Preserve its existing
  local Wi-Fi provisioning portal for network recovery; that is a setup service.
- Use temperature/humidity thresholds for automatic environmental control.
- Tray first movement should reach a chosen angle. User agreed that the final
  movement before lockdown returns the tray to a **level base/home position**,
  confirms arrival, then stops the motor and disables turning throughout lockdown.
  The user subsequently confirmed a 90-degree total rocking arc; cycle timing,
  dwell behavior and endpoint/home detection remain unresolved.

## Current pins and existing boundaries

| Device | Pin / channel | Confirmed bench behavior |
| --- | --- | --- |
| Heater | GPIO27 / relay IN1 | LOW-on / HIGH-off |
| Tray motor enable | GPIO25 / relay IN2 | LOW-on / HIGH-off |
| Future LED | GPIO26 / relay IN3 | Empty/reserved; disabled |
| Mist maker | GPIO14 / relay IN4 | LOW-on / HIGH-off |
| Upper/lower fans | GPIO19 / GPIO18 | HIGH-on / LOW-off; supply PWM disabled |
| DHT22 | GPIO4 | Main sensor assignment |
| LCD/OLED/shared time-module bus | SDA21 / SCL23 | Main display allocation; RTC functionality not qualified |

Functional success is user-reported; no load/current/fault/timeout measurements
are inferred. Main firmware currently provides sensor/cloud/display/setup
services but no actuator controller. Its MQTT callback consumes reading
receipts only. The deployed hardware worker is sensors-only and rejects dispatch;
the existing simulator outbox/ACK path is a foundation, not a commissioned
physical command implementation. Do not enable hardware by turning on the
simulator dispatch flag or deleting its production guard.

## Control architecture

Browser on existing HTTPS dashboard → authenticated farm-scoped API → durable
command outbox → commissioned hardware MQTT worker → per-device TLS MQTT →
ESP32 controller → correlated outcome/state → database → dashboard.

The browser talks to the VPS; the ESP32 connects outbound to the existing broker.
No public ESP32 HTTP service, router port-forward or new public broker port is
needed. Extend existing broker ACLs only for the device's required commands/ACKs
and worker topics. Keep telemetry and durable reading receipts working.

The VPS stores chosen profiles, lifecycle and requested actions. The ESP32 owns
real-time switching, sensor freshness, motor stop rules and overrides. Network
loss must not stop a valid local automatic environmental loop or leave a manual
energize command running indefinitely.

## Commands, confirmation and manual overrides

- Define versioned commands: configure control profile, set lifecycle, apply
  bounded manual output override, clear override, stop motion, and request tray
  position/home only after the positioning hardware is qualified.
- Validate farm ownership/session/CSRF, device capability, active lifecycle,
  allowed output/target, command UUID, expiry and configuration revision.
- Raw actuator commands are non-retained. Reject expired, wrong-device,
  malformed and obsolete commands. Rate-limit writes and bound overrides locally.
- UI status: requested/pending → acknowledged/applied, rejected, or timed out.
  Request acceptance is not device execution. A network timeout leaves the
  physical state unknown until fresh device state arrives; do not depict an
  OFF rollback as physically completed without acknowledgement.
- Reuse durable outbox/idempotency concepts and extend schema/contracts where
  required. Preserve boot correlation. Duplicate retry must never cause another
  motor movement. Persist motion identity/state before starting; after a reset
  with uncertain position, stop and require position recovery instead of replay.
- ACK output changes as applied GPIO state; this is not verified contact/current
  or fan RPM. Report position completion only from actual position feedback.
- Retained desired profile, if introduced later, is versioned configuration,
  not an executable relay/motor command; reconcile safely at reconnect/startup.
- Manual override leases are explicit in the UI and device. They suspend the
  affected normal control output for a bounded period, while local fault limits
  still apply. At expiry/clear, resume Auto only if a valid profile, lifecycle and
  recent sensor reading permit it. Choose lease durations during qualification.
- Separate “stop tray”, “end manual override” and lifecycle cancel/stop actions
  from ordinary OFF requests, so Auto does not immediately undo a user stop.
- Disable new remote ON/motion requests when device state is stale/offline.
  Indicate delivery pending/unknown for stop requests that cannot reach a device.

## Threshold controller — proposed behavior

Current built-in pilot modes are **Chicken, Duck and Quail**. User-created
custom profiles remain supported; current development/qualification focuses
on the three built-ins. See the
[mode catalog reference](mode-catalog-reference.md) for current preset values.
Other presets are retired from new selection. Qualify each retained mode's
control boundaries and stage-specific hatch/turning rules before Auto is enabled.

Use a versioned control profile derived from the chosen species/mode. Keep
normal switching thresholds distinct from warning/critical alert thresholds
and independent safety cutoffs. Existing UI severity helpers are not controllers.

| Output | Normal automatic behavior | Required qualifiers |
| --- | --- | --- |
| Heater | Below lower temperature boundary: ON; at/above upper: OFF; between: hold previous state | Fresh valid DHT22 sample, valid profile/lifecycle, bounded maximum on duration, qualified minimum switching interval |
| Mist | Below lower humidity boundary: ON; at/above upper: OFF; between: hold previous state | Fresh valid sample, manual reservoir check and verified device dry-run behavior, bounded on duration/minimum switching interval |
| Fans | Initially qualified full-on/full-off policy for preparation/incubation and cooling faults | Define actual ventilation/fault policy; XFAN 120 supply PWM is not qualified |
| Tray | Position/turn schedule | Separate from temperature/humidity thresholds; confirmed position/stop mechanism required |

Hysteresis avoids repeated switching around one boundary. The existing safety
contract's 0.2 °C / 3% RH and 42 °C cutoff are provisional, not approved operating
values. Establish actual targets, hysteresis, switch intervals, maximum on
times and protection thresholds from the selected mode and physical response.
Reference: [OMRON hysteresis explanation](https://www.ia.omron.com/support/faq/answer/53/faq00549/).

Sensor invalid/stale: heater and mist OFF immediately, overriding normal dwell
intervals; stop/disable new tray motion if its safeguards require it. Fan fault
behavior must be qualified for cooling rather than assumed universally OFF.
Heating needs independent over-temperature protection; sensor-only software is
not proof of safe unattended operation. Network status alone does not determine
environmental outputs. No real targets means heater/mist remain unarmed.

Use a nonblocking actuator state machine and an independently timely control
loop. Current Wi-Fi/TLS/MQTT calls can block; measure worst-case blocking and
separate control timing from those calls as necessary before qualifying cutoffs.
Persist validated profiles and lifecycle recovery information with bounded flash
writes. Do not persist/replay an active manual ON or resume unknown tray motion
after reboot. Fan RPM remains unavailable without a qualified tach input.

## Preparation and lifecycle

Idle → select mode → preparing with local threshold control → server-confirmed
five continuous in-range minutes → ready to load → user loads/counts eggs →
confirmed Start cycle → incubating → final-return/lockdown → complete/stop.

Automatic preparation is new device work. Preserve the existing server check:
real sample coverage, no gap over 45 seconds, latest sample fresh, both targets
in range and mode matching. Day 1 starts only after loading/start confirmation.
Do not count time before targets are accepted/applied by the device. Hold off
empty-tray automatic turning until an active loaded cycle. Mode changes/cancel
must synchronize with acknowledged device lifecycle/profile state.

## Tray angle and home plan — hardware-dependent

Proposed state model: **unknown → homing → home → moving-to-angle → angled →
returning-home → home**, with any timeout/invalid feedback entering fault/stopped.
One movement at a time. Do not run motor indefinitely awaiting a server command.

Needed information: motor model/voltage/running and stall current, linkage and
gearing, forward-only crank versus reversing drive, angle value, home definition,
feedback/limit switches and maximum travel/run time. “Last turn” now means the
final movement into the level home position before lockdown.

Current single SPDT tray relay enables power but does not establish reversible
positioning or measured angle. A mechanically forward-only crank can return home
without reversing if its geometry and feedback permit it; otherwise a suitable
bidirectional motor driver is needed. Do not assume two seconds produces a known
angle. A home sensor establishes base; a second endpoint sensor can establish a
fixed tilt endpoint. Arbitrary angles need suitable position feedback or a
calibrated mechanism whose limits/accuracy are explicitly qualified.
The earlier brushed-DC driver reference does not describe the now-confirmed
220 V AC motor. Establish its actual interface before choosing any direction control.

No extra driver or feedback GPIO is allocated until the motor/mechanism is
identified. Keep GPIO26 reserved for LED. If driver/feedback pins are added,
update the roadmap pin table before wiring. “Return home” must remain pending
until home is detected; relay OFF alone cannot confirm the tray is at base.
Entering the final-return/lockdown transition immediately suppresses further
ordinary scheduled turns. Mark return-home complete only after confirmed
arrival; a failed return never re-enables ordinary turns. Fault/unknown position
remains visible and requires explicit position recovery.

## Agreed final-return and lockdown behavior

Decision recorded October 14: **last movement → level/home confirmed → motor
OFF → no further automatic turning during lockdown**. This applies to the
custom tilting-tray design. Tray level and egg orientation/hatching surface are
separate requirements; confirm the actual tray safely accommodates hatching.

Reference: [Brinsea OvaEasy manual, section 9.3](https://www.brinsea.com/manuals/OvaEasy_190_380_580_Advance_Series_2_US.pdf)
describes leveling shelves and leaving turning off when used for hatching.
[Mississippi State Extension](https://accessibility.extension.msstate.edu/agriculture/livestock/poultry/important-incubation-factors)
recommends no turning during the final three days and lists species-specific
cutoffs (chicken: day 18 of a typical 21-day cycle). Use the selected species
profile's validated elapsed-time cutoff; do not hardcode chicken timing for
every mode or use a rounded UI day label to trigger movement.

| Tray state | Motor / turning behavior | VPS display |
| --- | --- | --- |
| Incubating, known position | Execute only eligible bounded scheduled moves | Position and next turn |
| Final return requested | Suppress ordinary turns; reject duplicate/concurrent movements | Returning to level; pending |
| Returning home | Locally stop on qualified home feedback; enforce travel timeout | Moving; position not yet confirmed |
| Home verified | Motor off; persist completed return and turning lockout | Level/home confirmed; turning disabled |
| Return failed / position unknown | Motor off; ordinary turns remain disabled | Position fault; operator recovery needed |
| Lockdown | Reject normal turn/manual jog/tilt requests | Lockdown; turning disabled |

An explicit bounded home-recovery action may be offered to an authorized
operator after inspecting a fault; it is not an ordinary manual ON override.
Before allowing recovery during hatch, establish that movement will not disturb
pipping eggs or chicks. All stop requests remain available. Heater/mist/fans
continue their validated phase-appropriate control independently of tray status;
a home fault must not postpone the biological lockdown profile transition.

### Implementation tasks

1. Confirm home is mechanically level, target angle, normal turning pattern,
   motor/linkage/direction and home/angle feedback. Determine travel bounds from
   measured operation; qualify sensor debounce and implausible/stuck indications.
2. Add versioned species turning cutoff, maximum travel duration, permitted
   positions, configuration revision and lifecycle identity to the device profile.
   Persist validated schedule/lockout locally so VPS/Wi-Fi loss cannot enable
   another turn. Establish trustworthy clock recovery before scheduled movement.
3. Start final return early enough to complete within a qualified travel margin
   before lockdown. Exact lead time remains a hardware measurement. Stop if home
   is already confirmed. If timing is missed, suppress queued turns and show a
   recovery requirement rather than blindly moving during hatch.
4. Journal the final-return command/motion identity before energizing. Apply
   only one movement; stop at home or timeout. Save success only after home is
   verified. Duplicate delivery returns the known outcome, not another movement.
5. On reboot: motor inactive; restore lockdown/turning inhibition. Interrupted
   movement means position unknown until checked. Do not automatically replay
   motion, reset a turn deadline or run catch-up turns on reconnection.
6. Extend VPS API/worker and firmware contracts for return-home, stop and actual
   position outcome. Report requested/accepted/moving/completed/failed distinctly.
   A completed GPIO OFF command is not a completed home-position command.
7. Show phase, turning-enabled state, known/unknown position, final-return
   progress and failure reason in the existing chamber Hardware/Monitor views.
   Disable ordinary turning controls throughout lockdown. Log commands, physical
   outcomes and timing for later review.

### Acceptance checks before automatic turning is released

- [ ] Measured target angle and level/home position, including loaded tray.
- [ ] Successful final return from each permitted position; no movement when
      already home; actual motor release and tray holding behavior checked.
- [ ] Stop/timeout behavior with jammed mechanism, disconnected/stuck/contradictory
      feedback, invalid clock and missing configuration.
- [ ] No extra movement on retries, duplicate ACKs, stale commands or reconnect.
- [ ] Power loss during movement stops motor; restart retains lockout and exposes
      unknown position until qualified recovery.
- [ ] Final-return timing matches selected species and mode revisions; missed
      cutoff never produces catch-up turns during lockdown.
- [ ] Lockdown prevents scheduled turns and ordinary manual jog/ON requests,
      while environmental control and stop commands continue working.
- [ ] VPS status never reports home or physical completion from request acceptance,
      relay OFF or network timeout alone.

Until the motor/feedback facts are supplied, implement independent actuator,
threshold and VPS command work first; keep automatic tray positioning disabled.

## Delivery stages and completion evidence

| Stage | Deliverable | Completion evidence |
| --- | --- | --- |
| 1 | Integrated main-program actuator service, inactive startup, real applied-state reporting; keep sensor/LCD/OLED/setup/cloud working | Bench per pin, preserved identity/settings/readings, reset and sensor/network fault behavior |
| 2 | Physical command/ACK contract and commissioned worker, initially restricted to unloaded/manual tests | Duplicate/expired/wrong-device/cross-farm rejection, boot correlation, restart/retry and timeout behavior |
| 3 | Manual controls in existing chamber Hardware view on VPS | Pending/applied/unknown states, independent On/Off, bounded leases, stop behavior and device-side expiry |
| 4 | Local threshold Auto and automatic preparation integration | Qualified targets/hysteresis/dwell/max-on/cutoffs, in-range stability, sensor faults, operation through VPS/Wi-Fi loss |
| 5 | Feedback-based tray tilt/home and scheduled final-return behavior | Measured endpoint/angle, bounded motion, stop/fault/reboot handling, replay-safe commands and final-home confirmation |
| 6 | Deployment/pilot qualification and recorded release | Matched source/images/firmware revisions, rollback, physical soak and remaining operations/release gates |

Stage 5 requires the unresolved motor facts. Environmental/VPS work can progress
while those are clarified; no guessed tray actuation is required to unblock it.
Implement locally first, review the concrete command/UI behavior, then follow
the established staging/VPS rollout workflow. Planning is not a deployment.

Related records: [roadmap](../../ROADMAP.md),
[relay reference](hardware/relay-reference.md), [fan reference](hardware/fan-reference.md),
[pin map](hardware-pin-map.md), [preparation](../../docs/guide/incubator-preparation-guide.md),
[provisional safety contract](../../docs/guide/firmware-safety-contract.md),
[existing simulator command contract](../../docs/guide/b4-mqtt-contract.md).
