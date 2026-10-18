# Local climate PWM implementation — October 18, 2026

**Later connection decision:** use the VPS as the stable ESP32 destination and
`pnpm dev:vps` for frontend editing against its API. See
[VPS-connected development](vps-connected-local-development.md). The local backend
installation below remains a separate development database; it does not update
the VPS. A separate October 18 deployment has now migrated the VPS to 0024 and
installed the matching API/worker/dashboard, with MQTT connected. Default firmware
uses `CloudConfig.h`; local-recorder builds require an explicit flag. The new
VPS-targeted build is prepared but not uploaded.

Status: API/dashboard installed locally with schema 0024; worker activation and
firmware upload pending. API, worker and dashboard Docker
images built successfully; dashboard TypeScript compilation passed. ESP32
NodeMCU-32S/core 3.3.11 compile passed: 1,141,204 bytes flash (87%), 52,236 bytes
static RAM (15%). Migration 0024 applied and API/web replaced with built images;
HTTPS proxy reloaded. Readiness and dashboard requests succeeded. No firmware
upload, worker activation, tests or physical validation performed for this change.
The user's prior ESP32/MOSFET slider result and verified wiring are accepted.

## Included in this slice

- Chicken targets remain 37.5–37.8°C / 55–60% RH. Dashboard target formatting is
  unchanged. Preparation/confirmation, heater hysteresis, mist pulse/rest limits
  and tray logic are preserved.
- Upper circulation GPIO18 remains full on while regulating. Lower exhaust GPIO19
  is driven through one LEDC output owner. The old standalone bench's reversed
  pin labels are not used by production.
- Chicken temperature cooling requests duty proportional to excess temperature;
  humidity drying requests duty proportional to excess RH. Existing cooling and
  drying latches, temperature gate and 10-second/20-second drying pulse envelope
  remain. Mist cannot run against corrective exhaust. This slice does not add
  a measured continuous fresh-air minimum or an ambient humidity sensor.
- Requests below the configured nonzero floor are avoided. Every exhaust start
  gets a full-command boost; subsequent changes move in steps. Releasing demand
  or explicit Stop goes straight to zero. Fault/cooldown ventilation goes straight
  to full command. Duck/Quail retain their original full-command exhaust policy.
- Failed LEDC setup/write inhibits regulation via latched fault 7. Runtime write
  failure removes heat/mist/tray power commands and falls back to digital full
  exhaust for the fault response. Stop still forces everything off. After a PWM
  failure, a successful restart plus explicit fault reset is required; no automatic
  heat/mist recovery is added. No tach-based stall detection is claimed.
- Firmware reports requested/applied electrical duty, decision reason, effective
  targets, sample age, firmware marker, PWM settings and control-change sequence.
  API DTOs and Live Monitor display percentages as **commanded**, retaining the
  Boolean On/Off fallback for older firmware and existing freshness suppression.

## Initial settings

`apps/firmware/Eggcelerate/FanConfig.h` contains explicit initial engineering
settings. These are not the recovered settings or measured minimums from the
user's successful slider test:

| Setting | Initial value |
| --- | --- |
| Exhaust PWM | 1,000 Hz, 8-bit (0–255) |
| Nonzero duty floor | 50% |
| Startup command | 100% for 1 second |
| Normal ramp | 5 percentage points per 500 ms |
| Chicken cooling demand | Floor at cooling onset, reaching full request at 0.8°C above upper target |
| Chicken humidity demand | Floor at drying onset, reaching full request at 10 percentage points above upper RH target |

The 0.8°C/10%-point values scale fan demand; they do not widen acceptable species
targets or change the 39°C overheat latch. The settings do not establish reliable
startup, proportional RPM/airflow or egg-level temperature accuracy. No hardware
replacement or repeat basic compatibility test is imposed by this implementation.

## Logging and retained history

- Serial `CONTROL` lines record each sample and output/lifecycle/fault changes
  independently of cloud publishing. Capture Serial externally if a durable local
  event record is needed; the board does not write an offline event queue.
- Changed control state gets a cloud snapshot at most once per second. Unchanged
  state retains the configured normal telemetry interval. Multiple intermediate
  changes can be coalesced; `control_seq` and boot identity expose discontinuities.
  A successful MQTT publish is not a database receipt or an offline replay queue.
- Migration **0024** adds append-only `climate_report_history`, with the accepted
  report, observation/receipt time, boot/sequence and environmental readings when
  available. It does not reconstruct missing historical actuator events.
- Authenticated, farm-scoped history reads are available at
  `GET /api/v1/incubators/{id}/climate-control/history?limit=200`.
  Results are newest first, capped at 2,000. The `before` parameter accepts an
  aware receipt timestamp. Chamber deletion cascades its history. A retention
  cleanup policy and dashboard history overlays/export remain follow-up work;
  database volume grows as reports are collected.

This is basic durable received-snapshot history, not the full 2.5-second offline
sample/transition queue described in the broader improvement plan. Network gaps,
short coalesced transitions and power-loss events can still be missing.

## Local installation order for a later rollout

The source now expects schema 0024. Apply the additive migration before starting
updated API/worker images, then use the updated dashboard. Deploy the updated
worker parser before uploading firmware that emits the added report fields;
the old strict parser would reject those fields. Existing old-firmware reports
remain accepted by the new parser.

The existing local recorder's outdated LAN bind/certificate/firmware endpoint
issue is separate; see [startup guide](local-startup-guide.md). This change does
not modify private network configuration, start the worker or send commands.
October 18 local installation: backed-up database migrated to 0024, API/web
recreated from built images, HTTPS proxy reloaded. Existing 679 raw readings
remain. Control history is empty until reports are received. Broker and worker
remain stopped pending the network endpoint correction; ESP32 is not flashed.

Fault value 7 is a compatibility boundary: older firmware only understands saved
fault values through 6. An older firmware rollback will interpret a saved new
fault as invalid state and stop; do not erase NVS or bypass fault recovery to
manufacture a successful restart.

## Remaining optimization

Tune coordinated heater cutoff/thermal inertia after control history exists;
this slice does not claim to fix the unexplained graph drops near 35°C. Stage
humidity/ventilation profiles, fresh-air provision, sensor-loss fan policy changes,
history overlays/export and complete offline events remain separate work.
Tests and physical validation are deferred per the user's instruction. The
successful builds above establish compilation/packaging, not physical performance.
Private firmware artifacts are in `output/firmware/climate-pwm/`; they include
embedded connection configuration and are not public distribution artifacts.
