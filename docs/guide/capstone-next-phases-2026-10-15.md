# Capstone handoff and next phases — October 15, 2026

## Resume here

Read this file, the top and latest October 15 entries in ROADMAP.md, and
`docs/guide/incubator-preparation-guide.md` before editing. The user is pausing
because session usage is nearly exhausted. This handoff is a plan, not approval
to flash a board, energize equipment, replace hardware or deploy the VPS.

The user rejected the separate **Start Test** panel. It has been removed. Do not
reintroduce it or a separate testing workflow. Use the existing owner flow:

**Add/pair chamber → Prepare → select mode → Begin Preparation → automatic
regulation → five minutes stable → Ready to load eggs notification → load 1–38
eggs → confirm incubation → Day 1.** Regulation continues through confirmation.
Cancel preparation, Stop Cycle and completion request all actuators off. Sensors,
LCD/OLED, Wi-Fi and recording remain active. Explicit Stop stays stopped.

## Current implemented state and evidence

- Main sketch: `apps/firmware/Eggcelerate/Eggcelerate.ino`, with
  `EggcelerateFirmware.h`, `ClimateControl.h` and `ClimateRuntime.h` beside it.
- Website uses existing preparation/confirmation and Live Monitor Chamber status.
  Recovery actions reset faults and explicitly resume regulation. No Start Test.
- API lifecycle changes and controller intent commit in the same database
  transaction; worker dispatches expiring, ordered, boot/sequence-bound commands
  over the device's authenticated TLS MQTT receipt channel. Device reports
  running phase, fault, outputs and command acknowledgement.
- Five-minute readiness requires fresh real samples and acknowledged, healthy,
  matching preparation. Durable Ready to load eggs notification is generated once
  per preparation. Server checks readiness again on owner confirmation.
- Firmware phase handoff preserves regulation; old 60-minute timer removed.
  Independent control task, sensor/overheat/continuous-heater faults, all-output
  Stop and checksummed NVS run authorization are implemented. Normal power boot
  may restore authorized operation after two fresh valid readings. Manual Stop,
  faults and crash/watchdog recovery block automatic restart. Server reconciliation
  respects local manual Stop and suspended faults.
- Local schema is **0022**. Local Docker API/web are healthy; worker logged
  **hardware-climate-control**. Local stack was rebuilt/restarted.
- Web typecheck and Python lint passed. Firmware compile: **1,125,465 bytes flash
  (85%), 51,932 bytes RAM (15%)**, NodeMCU-32S/core 3.3.11.
- Private binaries: `output/firmware/preparation-incubation/`. Do not expose their
  embedded connection credentials. Latest physical upload is NOT confirmed.
  Last read-only handoff check still saw lifecycle capability 0 from the older
  firmware, no lifecycle intent and zero queued control packets. Recheck live
  local state; do not assume it remains unchanged.
- No behavioral test suite or physical acceptance was run for this integration.
  Full API mypy still has the pre-existing optional-password override error in
  `api/v1/platform_admin.py:137`; no new mypy errors were reported.
- Git working tree has extensive uncommitted changes across this session. Inspect
  status/diff and preserve them; do not reset, overwrite or silently commit them.

### Authoritative wiring — supersedes earlier plans

| Equipment | Pin/channel | Control |
|---|---|---|
| Heater | GPIO27, relay IN1 | LOW on, HIGH off |
| Tray motor enable | GPIO25, relay IN2 | LOW on, HIGH off; currently held off |
| Mist maker | GPIO14, relay IN3 | LOW on, HIGH off |
| Vacant channel | IN4; GPIO26 unused | Do not enable LED or drive GPIO26 |
| Upper heater-facing circulation fan | GPIO18 MOSFET | HIGH on, LOW off |
| Lower exhaust fan | GPIO19 MOSFET | HIGH on, LOW off |
| DHT22 | GPIO4 | Read independently every 2.5 seconds |
| LCD/OLED I²C | SDA21 / SCL23 | Keep working during Stop |

Earlier October 12/14 drawings and plans contain superseded channel/fan mappings.
Manual relay/fan operation was user-reported successful; this is not proof of
qualified motor travel, physical feedback or production reliability.

### Current normal-incubation presets

| Mode / stable ID | Temperature | Humidity | Turn interval |
|---|---|---|---|
| Chicken / broiler | 37.5–37.8°C | 55–60% RH | 4 hours |
| Duck / duck | 37.4–37.6°C | 62–68% RH | 6 hours |
| Quail / quail | 37.5–37.8°C | 55–60% RH | 4 hours |

Automatic climate firmware currently accepts these unchanged built-in ranges.
Edited/custom presets are rejected before preparation is committed. No new
lockdown climate profile or PWM exhaust speed has been implemented. Current mist
pulse is 3 seconds on / 20 off; humidity exhaust is 10 on / 20 off once temperature
is within 0.5°C below its lower target. High temperature runs both fans. Heater
stops at the upper bound; continuous commanded heat for 10 minutes or >=39°C
latches a fault. Observe actual warm-up/overshoot before changing safeguards.

## Phase 1 — accept the integrated climate owner flow

1. Recheck git diff and local services; confirm firmware/source versions.
2. User uploads the complete main sketch, NodeMCU-32S, 115200 upload speed,
   **flash erasure disabled**. Preserve pairing, router Wi-Fi and run records.
3. Verify updated lifecycle capability 1 and real sensor/equipment reports.
4. Through the existing Prepare flow, confirm selected mode, acknowledgement,
   warm-up, high/low humidity responses, stable window reset on gaps/out-of-range,
   Ready to load eggs notification, and owner confirmation behavior.
5. Confirm Day 1 only begins after owner confirmation and regulation is continuous
   across handoff. Do not load fictitious eggs or start real cycles on the user's
   behalf to manufacture acceptance records.
6. Confirm Cancel/Stop/complete switch heater, mist, both fans and tray off and
   preserve readings/screens/recording; pending/offline must not claim confirmed
   physical Stop. Output telemetry proves commands, not relay/contact operation.

Exit: supervised owner evidence covers this flow. Build success alone is not this
acceptance. Keep live server unchanged during local work.

## Phase 2 — identify the tray mechanism (next missing information)

**Outstanding question already asked, not answered:**
When IN2 turns on, does the motor complete a movement and stop automatically, or
keep moving until the relay is switched off?

Also establish the motor's voltage/current, drive/direction arrangement, whether
it already has internal travel limits/controller, fitted external limit/home
sensors, normal tilt positions/angles and how level/home is detected. Ask only
what available photos/part numbers/wiring cannot establish.

Do not infer two-direction control from a single enable relay. Do not assign new
GPIOs or energize a motor until its actual interface and endpoints are known.
Current IN2 GPIO25 stays off pending that information.

## Phase 3 — implement bounded tray movement

Based on Phase 2, integrate the actual actuator interface into the independent
firmware task, retaining its climate, sensing, display and network services.

- Provide a bounded movement operation and actual completion/failure criteria.
- Enforce travel timeout and stop on fault, explicit Stop or invalid position.
- Report moving/completed/fault and use unique command identity/replay protection.
  Retries/reboots must not execute the same turn twice.
- Validate direction/interlocks if the mechanism needs reversible drive. Never
  claim a confirmed endpoint from elapsed time alone when hardware cannot prove it.
- Establish level/home behavior. User previously required the final pre-lockdown
  movement to return level/home and confirm arrival; implement only with a known
  mechanism/feedback strategy. Stop motor and latch a fault on failed homing.
- Stop Cycle always cancels pending/moving tray operations and de-energizes drive.

Exit: supervised movement, endpoint, timeout, Stop and retry acceptance.

## Phase 4 — connect real turning to incubation schedule

Use existing selected-mode intervals (Chicken 4h, Duck 6h, Quail 4h), phase and
existing owner settings. Do not enable the simulator dispatcher for real hardware.
Build a commissioned real tray command/ack path after the motor interface is known.

- No turning during idle or preparation; schedule starts only with confirmed eggs
  and Day 1. Climate preparation continues independently.
- Persist schedule/execution identity, acknowledge actual completed movement, and
  update last/next-turn fields from confirmed execution, not a button click.
- After downtime, skip/backpressure missed turns according to a documented rule;
  never replay a burst of missed motor operations.
- Last pre-lockdown movement returns to verified home, then disable turning during
  lockdown, hatching and awaiting finish. Stop/complete cancels remaining commands.
- Manual turn uses the same limits, phases, deduplication and completion reporting.

Exit: real scheduled/manual turns and lockdown/home behavior agree across website,
server and firmware without synthetic success or duplicate movement.

## Phase 5 — solve power and restart reliability

Reported symptom: after an outage, user must press EN to recover. **ESP32 USB is
connected to the laptop**, while other equipment uses a UPS with transfer delay.
It is not yet established whether the laptop stays on, whether USB power dips,
or whether the LCD/readings freeze, go blank or keep updating before EN.

Collect that evidence and Serial boot/reset logs (without adding a second power
source that backfeeds the board). Distinguish supply/reset timing, peripheral/I²C
hang, USB/DTR/reset behavior and a merely stopped controller. Check supply/EN
behavior against the actual board and Espressif documentation before proposing
specific circuit changes. Do not call automatic-resume firmware a fix for a chip
that never boots.

Then supervise normal power-loss recovery, delayed peripheral power, manual Stop
across reboot, sensor faults, watchdog/crash behavior, unavailable network/server,
controller storage failures and tray recovery after Phase 3. Do not automatically
clear faults or authorize new starts on reboot.

Exit: reliable device boot and bounded recovery are demonstrated, including the
actual laptop/UPS arrangement; no EN press needed for normal recovery.

## Phase 6 — release review and deploy only when requested

- Review changes across firmware, API, database, UI and MQTT protocol; fix the known
  mypy issue. Add/run tests only when the user requests tests/verification under
  session instructions; record actual evidence, failures and unverified items.
- Complete physical acceptance, target calibration/reference checks, independent
  thermal protection and hardware feedback/limitations documentation.
- Preserve current frontend; no extra test panels or unrelated features. Default
  pnpm dev:web remains mock mode; local Docker is the real recording workflow.
- Before any authorized live deployment, back up the existing VPS database/source
  and configuration, prepare rollback and migrate in a compatible order. Current
  revision target is 0022. No user accounts, farm history or recordings are reset.
- CLIMATE_CONTROL_ENABLED defaults false; deliberate hardware enablement must be
  applied consistently to API/worker. Keep SIMULATOR_DISPATCH_ENABLED=false.
- Remove/omit the local private LocalCloudConfig.h override deliberately when
  building for the VPS, and use verified server TLS/ACL/device credentials. Do not
  copy laptop broker IP/CA into the live build or expose secrets in output.
- Deploy or flash only under the user's current authorization. No VPS action was
  performed during this session.

## Local addresses and operations

- Dashboard: **https://127.0.0.1:18443**; isolated Compose project egg-hardware-local.
- Wrapper: `./hardware-local-compose.sh`; persistent existing PostgreSQL preserved.
- Local MQTT: **192.168.1.115:18883**, TLS. Laptop IP may change: check first.
- Setup AP: **Eggcelerate-001**, password **egg12345**, page **http://10.10.10.10**.
  Send `setup`; captive portal prompt is OS dependent. Setup AP address is not
  the Docker dashboard or MQTT broker address.
- Device **EGG-001**, pairing code **EGG01**. Fixed stale frontend validation;
  user subsequently showed a paired chamber named **1**. Do not re-enroll/reset it.
- The local owner farm is test. Do not invent/reset login credentials or print
  private .env/firmware configuration. Existing earlier Docker project is separate.

```sh
./hardware-local-compose.sh build api hardware-telemetry web
./hardware-local-compose.sh run --rm --no-deps api alembic upgrade head
./hardware-local-compose.sh up -d api hardware-telemetry web
./hardware-local-compose.sh ps
```

## Main source entry points

- `apps/api/src/eggcelerate_api/api/v1/dependencies.py`: lifecycle/intent transaction hook.
- `database/store.py`: hook after lifecycle writes, before commit.
- `database/climate_control.py`: intent, reconciliation, ordering and acknowledgements.
- `database/preparation.py`: actual stability gate and durable readiness notification.
- `database/alert_episodes.py`: evaluator invokes readiness notification.
- `mqtt/telemetry.py` / `mqtt/worker.py`: reports, trusted assignment, TLS commands.
- `api/v1/climate_control.py`: status/stop/reset/resume; no separate Start endpoint.
- `apps/web/src/app/components/screens/DetailScreen.tsx`: existing preparation/confirmation.
- `components/detail/LiveMonitorTab.tsx` / `ClimateControlStatus.tsx`: actual equipment/recovery.
- `apps/firmware/Eggcelerate/ClimateControl.h`: climate behavior/phase handoff.
- `ClimateRuntime.h`: independent GPIO/DHT task, watchdog and NVS run authorization.
- `EggcelerateFirmware.h`: AP/Wi-Fi/cloud/protocol/display integration.

API paths above are relative to `apps/api/src/eggcelerate_api/`; web paths are
relative to `apps/web/src/app/` unless given in full. The internal legacy table and
MQTT property name `climate_test` remains for compatibility; it is not a test UI.
