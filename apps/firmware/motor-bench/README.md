# Tray motor timing bench

Separate local experiment requested by the user, October 15. It controls only the
confirmed **220 V AC tray motor**, through **relay IN2 / GPIO25, LOW-on/HIGH-off**.
The user confirms 90 degrees total rocking travel. No direction or angle control
is inferred. Heater GPIO27, mist GPIO14 and fans GPIO18/19 initialize and stay off;
GPIO26 and sensor/I²C pins are not driven.

## Use on the ESP32

1. Keep the tray empty, mechanism clear and existing mains connections enclosed.
   This page does not change or qualify the mains wiring or relay contacts.
2. Open `motor-bench.ino` with its adjacent headers in Arduino IDE. Select
   **NodeMCU-32S**, ESP32 core **3.3.11**, upload speed **115200** and **flash erasure
   disabled**. Upload only when ready to replace the main sketch temporarily.
   This sketch never clears pairing, router Wi-Fi or main controller run records.
3. Join **Eggcelerate-Motor-Test**, password **mango123**, and open
   **http://192.168.4.1**. Internet and the VPS are unnecessary.
4. Enter **1–120 whole seconds**, initially **2**, and choose **Start timed run**.
   Observe the real mechanism. Increase gradually if appropriate. **Stop motor**
   is available during a run or an uncertain connection.
5. Record starting position, time to each endpoint, time back to the same position,
   whether continuous power causes repeated rocking, and whether switching off
   stops/holds motion. Page notes persist in that browser when storage is available.
6. Restore the full main `Eggcelerate` sketch afterward with flash erasure disabled.
   Its earlier saved controller authorization is preserved, so restore while ready
   to supervise its documented restart/resume behavior.

This replaces sensor/cloud/LCD/OLED services while installed. It adds no normal
dashboard testing panel, no automatic incubation or turning schedule, and no VPS
deployment. The 120-second cap is a software bound, not a qualified travel time.

## Cutoffs and limits

- A separate ESP32 task checks the duration and browser heartbeat every 10 ms,
  independently of synchronous HTTP processing. A 5-second heartbeat gap stops
  the relay. Closing/hiding the page also requests Stop; delivery is not guaranteed.
- Every run requires a deliberate Start. Boot never resumes a bench run. Duplicate
  run IDs do not restart/extend a run; a session allows at most 32 unique starts.
  Allow one second off between runs. Invalid, concurrent or out-of-range starts
  are rejected. Protected POSTs require a random per-boot page token; AP allows one
  connected station and provides no cross-origin permission.
- Relay state and elapsed time are commanded GPIO observations, not contact,
  motor-current, angle, completed-turn or home feedback. Off can leave the tray
  tilted. The software cannot stop welded contacts or establish mechanical limits.
  Physical boot/reset, timing under Wi-Fi load and actual stopping need acceptance.

## Laptop layout preview

```sh
python3 apps/firmware/motor-bench/embed-page.py
python3 -m http.server 8766 --bind 127.0.0.1 --directory apps/firmware/motor-bench/site
```

Open **http://127.0.0.1:8766/?preview=1**. This is explicitly a layout preview,
with motor controls disabled. Real control is served by the ESP32 at its local AP
address, avoiding browser cross-origin/mixed-content access to a separate device.

Regenerate `MotorPage.h` after changing `site/index.html`. Both serve the same UI.

## Recorded verification

NodeMCU-32S/ESP32 core 3.3.11 compile passed: 934,976 bytes flash (71%),
47,592 bytes static RAM (14%). Host timer assertions cover duration bounds,
concurrent starts, cutoff, heartbeat loss, Stop, off interval and clock rollover.
Run them with:

```sh
g++ -std=c++17 -Wall -Wextra -Werror apps/firmware/motor-bench/tests/timer-test.cpp -o /tmp/egg-motor-timer-test
/tmp/egg-motor-timer-test
```

JavaScript syntax and localhost HTTP checks passed. Firefox preview was inspected
at mobile and desktop sizes. No physical upload or motor acceptance was performed.

## Phase 3 presets

The Movement selector now also offers **+45° → −45° / 10 seconds** and
**+45° → level / 5 seconds**, based on the user's observations. Each named
movement requires the checkbox confirming the stopped +45° start. Confirmation
clears after every start attempt. Firmware chooses the fixed duration and rejects
missing confirmation, so editing the seconds field cannot extend a preset. Observe
arrival yourself: timer completion does not prove position. Custom timed runs
remain available for further measurement. Reverse presets and schedules are absent.

Main-firmware commissioning commands and persistent replay protection are described
in [the main sketch README](../Eggcelerate/README.md#phase-3--bounded-tray-commissioning).
The bench's duplicate-ID protection remains per boot, with no automatic run restore.

Preset build: NodeMCU-32S/core 3.3.11 compile passed at 936,716 bytes flash (71%)
and 47,592 bytes static RAM (14%). Firefox form check confirmed the level preset
locks duration to 5 seconds and requires the start-position checkbox. No new
physical upload or motion test was performed for the preset changes.
