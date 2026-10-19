# Timed tray turning

October 15 implementation, using the motor timings already supplied by the user.
No additional motor timing or behavioral tests were requested or run for this batch.

## Normal owner flow

Prepare and confirm incubation through the existing flow. In **Live Monitor →
Tray turning**, save the tray's current observed position once. This establishes
the starting reference; it is not another timing test. When automatic turning is
enabled, saving a position resumes the schedule. From an observed level start,
the device first runs for **5 seconds** toward +45°. From either side, normal
turns run for **10 seconds** toward the other side.

Chicken/Quail default to four hours and Duck to six hours, using the chamber's
existing interval/automatic-turn settings. The existing manual Turn button uses
the same durable hardware command path. Manual turns are allowed with automatic
turning disabled, within normal incubation. No turns occur in preparation/idle.

**Stop tray / pause turning** cancels motion and suspends the schedule. Saving a
fresh observed side resumes it during normal incubation. Stop Cycle, completion,
climate Stop and faults also stop the tray. Climate, sensing and displays continue
during tray-only Stop. Every timed movement is bounded locally by the independent
control task, with a one-second off interval.

## Before lockdown

Normal turning stops two minutes before the lockdown boundary calculated from
the cycle's stored UTC start date and existing lockdown-day rule. An authorized,
unsuspended tray at a known/estimated side is sent one **5-second** return toward
level. It then stays paused. The owner saves **Level** after observing arrival;
timer completion alone is never reported as verified home. If the tray is already
paused, faulted or its position is unknown, the system requests level confirmation
instead of starting an automatic recovery movement. A missed return is not replayed
automatically after lockdown. Explicit bounded home recovery remains available
for an active cycle after its side is established; ordinary/manual turns remain
blocked during lockdown, hatching and awaiting finish.

The cutoff uses the persisted cycle date even if a displayed day counter lags.
No new lockdown climate profile was added in this batch.

## Position and timing meaning

- User-observed: +45° to −45° takes 10 seconds; +45° to level takes 5 seconds;
  the earlier base-to-side observation also used 5 seconds.
- Implementation assumption: the same half-cycle timing applies on the reverse
  side. Subsequent positions are estimates from motor ON time, not angle readings.
- The UI distinguishes owner-supplied/estimated position, running, queued, rejected,
  interrupted and timed-out commands. The motor has no integrated position sensor.
- Reboot never resumes a tray run or restores position as known. Save the observed
  position again before resuming its schedule. Climate recovery remains separate.
- A timer cannot detect a stalled/slipping mechanism or welded relay contacts.

## Persistence and transport

Migration **0023** adds nullable `climate_tests.tray` JSON state for the schedule,
request, high-water mark, pause and home status. Existing `device_commands` rows
provide durable turn receipts and manual idempotency. Last/next-turn cursors advance
only after the controller reports the matching timed run ended. Completion time is
the server receipt time, not a measured mechanical arrival time.

The hardware worker schedules at most one due turn. Next due time is based on the
latest acknowledged completion; missed intervals do not become a backlog. Server
outages pause dispatch. TLS/ACL receipt-channel packets are bound to the device's
boot, latest telemetry sequence, increasing ID and 90-second expiry. Used IDs are
stored and read back in ESP32 NVS before energizing. Rejected IDs are also consumed.
Simulation dispatch remains disabled; no simulator actuator path was enabled.

Commands use `tray|BOOT|SEQ|ID|ACTION|FROM|EXPIRY`, where actions are turn 0,
home 1, confirm-plus 2, confirm-minus 3, confirm-level 4, stop 5, initial-tilt 6.
`FROM` is unknown 0, +45° 1, −45° 2, level 3. Expected starting position must
match the controller's current reference. Firmware reports tray capability,
running/position/status, motion ID, persisted high-water mark and correlated ACK.

The normal session/CSRF boundary protects `/api/v1/incubators/{id}/tray-control`.
It provides status and explicit turn/home/stop/position-confirmation actions. The
existing `/commands/turn` route is connected transactionally to the same queue.

## Local installation

`TRAY_CONTROL_ENABLED` defaults false. Local hardware Compose opts in for both API
and worker, alongside `CLIMATE_CONTROL_ENABLED=true`. Real commands still require
new firmware capability, healthy confirmed incubation and a starting reference.
Migration/build/restart preserve farm data. The VPS remains unchanged.

Upload the complete current `apps/firmware/Eggcelerate` main sketch using
NodeMCU-32S, 115200, **flash erasure disabled**. This replaces the separate bench
sketch and restores sensing, displays and cloud service. Do not erase pairing,
Wi-Fi or run-state records. Source compilation does not mean an upload occurred.

This phase does not resolve the separate laptop-USB/UPS EN-button startup issue.

Local installation record: migration 0023 applied; final API/worker/web containers
recreated and API/web healthy; worker connected. New main firmware compiled at
1,130,405 bytes flash (86%), 52,020 bytes static RAM (15%). Typecheck, packaging
and targeted lint pass. No behavioral tests, new upload or motor operation were
performed. The currently recorded device has no tray capability and no tray
command has been queued. The VPS was not changed.

## October 19 VPS repair and cancellation return (v7)

The VPS API and telemetry worker had `TRAY_CONTROL_ENABLED=false`. A recorded
manual request timed out with `attempts=0`, no execution or ACK; it was never
sent to the motor controller. This configuration is now enabled for both services.
The guide's normal starting-position confirmation is still required. A physical
flat position does not automatically become a controller reference after reboot.
The user observed the current tray as flat before the repair; no movement was
commanded from that observation during installation.

Firmware `climate-tray-cancel-return-v7` retains v6 climate control and adds a
separate lifecycle **cancel** command. Cancelling a cycle switches climate outputs
off immediately, cancels queued tray commands and pauses the schedule. From a
stationary established +45°/−45° reference, it waits one second, reserves/verifies
a new motion ID in NVS and makes one bounded five-second return toward level.
It reports the result as estimated and still requires visual checking.

Unknown position, an interrupted/moving tray, expired commissioning reference,
sensor/fault/storage/PWM problems or a reboot cannot authorize this return. A
subsequent ordinary climate Stop or tray Stop remains an immediate all-off stop;
it never initiates a return. Sensor loss/fault during return interrupts motion and
marks position unknown. Timed return is not restored across power loss. Already
established level needs no motor movement. No new direction GPIO or timing is
introduced; the existing single-relay motor assumptions remain unchanged.

The firmware advertises `tray_cancel_return_capability` and reports
`tray_cancel_return` while pending/moving. Backend cancellation uses that distinct
command only for capable firmware, otherwise ordinary Stop. The worker pauses
regular dispatch and does not interrupt the explicitly authorized bounded return.
It waits for the matching cancel acknowledgment before interpreting a stopped
report as completion; an older stopped report cannot complete the new request.
No cycle count/date is fabricated and timed level is never marked user-confirmed.

Software checks: original tray timing tests plus cancellation cases (both sides,
level/unknown, moving, expired reference, unhealthy sensor, Stop, timeout and
millis rollover); climate regression tests; 23 backend schema/cancellation tests;
web typecheck. These do not prove that GPIO25 relay switching physically moves
the tray. Physical movement/arrival confirmation remains required from the owner.

For the empty mechanical check, use the normal owner flow while confirmed
incubation is regulating: save the observed **Level** position in Live Monitor.
With automatic turning enabled, the five-second initial tilt should run. Observe
it before cancelling the test cycle; cancellation should then request the bounded
return toward level. Keep normal tray turning disabled in preparation/idle.
Do not repeatedly press Turn Now after a timeout or invent a side reference.

VPS deploy and firmware evidence are under
`output/releases/tray-repair-v7-20261019/`. The original unreadable-response banner
could not be reproduced in current API checks: authenticated dashboard routes
returned 200, the unauthenticated API returned JSON 401, and readiness was healthy.
Refresh/retry the dashboard after deployment; do not assume an old cached banner
means the motor command was sent.

Post-install check: v7 cloud capability true, sensor valid, fault 0, all actuators
including tray off. The current cycle was subsequently found Ready with its prior
cycle stopped, so no owner-flow turn could be tested in that state. Physical
movement remains unverified; no successful tilt or home arrival is claimed.
The user's observation of flat was not fabricated into a sensor reading or motor
reference. Save the observed position in the normal active-incubation flow.

The deployed dashboard status fix is deliberately narrow: it derives from the
currently installed web image, replaces the incorrect lockdown-only sentence with
"Turning is paused. Check that the tray is level.", and cache-busts the JS graph.
Other in-progress frontend changes were not bundled. More specific cancellation
messages are prepared in the source component for the next normal frontend build.
