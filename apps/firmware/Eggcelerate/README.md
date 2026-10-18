# Eggcelerate main firmware

Open **Eggcelerate.ino** in Arduino IDE with every file in this folder beside it.
Target: **NodeMCU-32S**, ESP32 core 3.3.11, upload speed 115200, flash erasure
**disabled**. Libraries: Adafruit DHT sensor library, Adafruit Unified Sensor,
PubSubClient and hd44780 by Bill Perry; WiFi/WebServer/DNSServer are bundled.

## Normal website flow

**Prepare → select mode → Begin Preparation → one minute of stable readings →
Ready to load eggs notification → enter 1–38 eggs → confirm Start Incubation.**

The website commands the ESP32, which acknowledges after processing and saving
run authorization. Day 1 begins at owner confirmation; climate regulation continues
through the handoff. There is no separate Start Test panel or 60-minute timer.
See the [preparation guide](../../../docs/guide/incubator-preparation-guide.md)
for readiness, power recovery and commissioning limits.

Heater IN1 GPIO27 and mist IN3 GPIO14 are active-low. Upper circulation fan GPIO18
and lower exhaust GPIO19 are active-high. DHT22 is GPIO4. LCD/OLED share SDA21/SCL23.
The user confirms the tray motor is 220 V AC with 90 degrees total rocking travel.
Tray IN2 GPIO25 supports explicitly requested bounded commissioning movements;
scheduled/manual timed turning is integrated locally; position is estimated,
with owner confirmation of level/home;
IN4 is vacant and GPIO26 is not driven.

| Mode | Temperature | Humidity |
|---|---|---|
| Chicken | 37.5–37.8°C | 55–60% RH |
| Duck | 37.4–37.6°C | 62–68% RH |
| Quail | 37.5–37.8°C | 55–60% RH |

See the [timed tray turning guide](../../../docs/guide/tray-turning-guide.md) for
the current scheduled/manual tray flow. Earlier Phase 3 notes below are historical.

Modified/custom presets are rejected by the automatic-control API. Normal targets
remain unchanged throughout this implementation; no new lockdown profile is added.
The heater stops at the upper bound, with circulation maintained at full command.
Chicken uses variable supply PWM for lower exhaust; humidity drying retains its
10-second on / 20-second off envelope near temperature targets. Duck and Quail
retain full-command exhaust behavior. Fault/cooldown ventilation uses full command.
Low humidity uses mist bursts of at most three seconds with twenty seconds rest.
See [local PWM implementation](../../../docs/guide/climate-pwm-local-implementation.md)
for initial settings, logging, deployment order and limitations. This is source
implementation, not confirmation that this revision is flashed on the ESP32.

## Stop and recovery

Cancel preparation, Stop Cycle and completion queue an all-equipment Stop.
Explicit Stop turns off heater, mist, both fans and tray until an explicit new
preparation/resume. Sensors, LCD/OLED, Wi-Fi and recording keep operating.

Authorization/phase/mode are saved in a separate checksummed NVS record. Normal
power recovery waits for two fresh valid sensor readings and fan lead before
resuming. Manual Stop, saved faults, corrupt storage and crash/watchdog recovery
prevent automatic heat/mist restart. Fault reset stays stopped; use the website
recovery action after resolving the cause. Thirty minutes continuous commanded heat,
sensor invalid/stale readings and >=39°C latch faults. No physical feedback can
detect a welded relay, blocked fan or empty mist reservoir.

Serial 115200/Newline: `status`, `setup`, `climate status`, `climate stop`,
`climate reset`. Start regulation through the existing website preparation flow.
The reported laptop-USB/UPS EN-button problem requires separate diagnosis; this
firmware cannot recover until the board actually boots.

## Wi-Fi setup

- Network: **Eggcelerate-001**
- Password: **eggcelerate**
- Page: **http://10.10.10.10**
- Pairing code: **EGG01**; device ID: **EGG-001**

Send `setup` to open setup Wi-Fi. Supported clients offer a captive-portal prompt;
otherwise open the HTTP address manually. Canonical-host and CSRF checks protect
credential submission. AP DNS stops with setup; successful connection closes the
AP after two minutes without a page visit/submission. Saved router Wi-Fi and
identity remain in NVS; a verified migration applies the approved setup password.

## Local Docker recording

**October 18: VPS is now the default destination.** `CloudConfig.h` supplies the
stable VPS broker so moving the incubator requires router Wi-Fi setup rather than
reflashing a home-computer IP. See the
[VPS/local development guide](../../../docs/guide/vps-connected-local-development.md).
The local recording option below requires an explicit build flag.

Open **https://127.0.0.1:18443**. The local broker is configured at
**192.168.1.115:18883** with TLS, per-device credentials and ACLs.
`LocalCloudConfig.h` overrides private `CloudConfig.h` only when the build defines
`EGG_USE_LOCAL_RECORDER`. Its mere presence no longer changes the destination.
These files and upload artifacts contain private configuration: keep them private.
If laptop LAN IP changes, run `python3 apps/firmware/scripts/prepare-local-recorder.py
--host YOUR_LAN_IP`, recreate the broker/worker and recompile/upload.

`./hardware-local-compose.sh` manages the isolated persistent local stack. API and
worker require CLIMATE_CONTROL_ENABLED=true (enabled in the local overlay); normal
farm sessions/CSRF protect controls. Sensor reporting is saved at 5/10/15/30-second
cadence; DHT reads independently every 2.5 seconds and research logging stays five
minutes. The device can regulate while networking is absent, but cannot record to
an unavailable server. This update does not deploy to the VPS.

## Physical acceptance still required

Build success is not physical commissioning. Check real target stability, output
polarity, all-equipment Stop, reliable boot/UPS behavior, recovery and the complete
owner flow. Bounded tray commissioning is implemented as described below. Automatic
turning, PWM, calibration and hardware feedback remain unqualified. Earlier bench sketches remain separate fallbacks.

## Phase 3 — bounded tray commissioning

The main independent control task now supports two user-observed timings from
an operator-confirmed **+45°** start: **10 seconds toward −45°**, or **5 seconds
toward level**. There is no inferred endpoint, reverse command, automatic turning
schedule or automatic lockdown home movement. Phase 4 must add the full lifecycle
permission/lockdown contract before scheduled or remote tray control is enabled.

Serial Monitor: **115200 / Newline**. Use `tray status` to inspect relay signal,
state, elapsed time, run ID and highest used ID. Main-firmware movement requires
healthy confirmed-incubation climate phase (not idle/preparation); use the separate
motor bench for empty-tray experiments. Do not create a fictitious incubation to
exercise the main controls.

1. Visually establish a stopped +45° position. Send `tray confirm plus`.
2. Check `tray status` for operator confirmation (valid for 30 seconds).
3. Send either `tray opposite ID` (10 seconds) **or** `tray level ID` (5 seconds),
   replacing ID with a positive integer above the displayed highest ID.
4. Check `tray status`: Moving → Timer ended; check actual position. The ending
   position stays unconfirmed; re-observe +45° before any subsequent movement.
5. `tray stop` cancels tray movement while preserving climate control.
   `climate stop`/website Stop also cancels tray motion and queued requests.

The run ID is persisted and verified before power is applied; used IDs cannot
execute again after retries/reboot. A failed storage check disables tray movement.
Position is never persisted/restored as known. Reboot never resumes tray movement.
Climate faults, invalid/stale sensor data or leaving incubation phase stop motion
and invalidate starting-position confirmation. A one-second off interval applies.
Cutoff is enforced by the independent control task, not by a browser timer.
No new tray command is exposed over MQTT or the normal website in this phase;
tray commissioning status is available through Serial only.

Upload/physical acceptance of these changes remains pending. Keep existing motor
mains wiring enclosed. Clock timing cannot detect a stalled motor, slipping
linkage, welded relay or missed endpoint.

Phase 3 recorded verification: NodeMCU-32S/core 3.3.11 compile passed at
1,128,921 bytes flash (86%), 51,996 bytes static RAM (15%). Host state-machine
checks passed for fixed durations, confirmation expiry, Stop, replay, unknown
positions, off interval and clock rollover. Runtime NVS/queue/watchdog behavior
still requires supervised hardware acceptance; no upload performed.

## Phase 4 — scheduled and manual tray integration

The normal dashboard now controls real timed tray commands through the hardware
worker's authenticated TLS receipt channel. Start incubation, then save the
observed tray position in Live Monitor → Tray turning. Existing mode intervals
and the manual Turn button use 10-second side changes. An observed level start
uses a 5-second initial tilt. A 5-second return toward level is requested before
lockdown; the owner confirms level. Positions after motion are estimates.

Explicit Stop, fault and reboot safeguards remain; no missed-turn burst or motor
run resumes on reboot. No further timing tests are required by this update.
New firmware upload is still necessary; no upload or motor operation was performed.
Latest NodeMCU-32S build: 1,130,405 bytes flash (86%), 52,020 bytes static RAM (15%).
See the linked guide for the full lifecycle, assumptions and server requirements.

## October 18 — persistent environmental history

The offline-storage implementation adds a separate flash writer and bounded,
receipt-confirmed replay. Use `storage status` at 115200 baud to distinguish
active recording from an uninitialized/unavailable filesystem. Initial setup is
explicit; never enable flash erasure as an upload shortcut. See the
[activation and recovery guide](../../../docs/guide/esp32-offline-storage-implementation.md)
for the partition backup, initialization command, timestamp/ownership rules,
retention limits, verification evidence and installation status. This supersedes
older descriptions of Serial-only environmental logging. Actuator-event
persistence and physical qualification remain separate follow-up work.
