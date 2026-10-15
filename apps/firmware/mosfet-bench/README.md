# Local MOSFET / two-fan bench

Prepared October 14, 2026. User later reported flashing the sketch and successful
fan switching on GPIO18/19. Detailed channel, combined-load, boot/reset and timeout
results remain unrecorded. PWM is disabled; main firmware integration is pending.

This separate sketch checks upper/lower fan MOSFET switching with a local web
page. It replaces the running program while flashed: sensor uploads, LCD/OLED,
and the normal Eggcelerate setup portal are not running during this bench test.
It does not read/write the project's saved identity, pairing code or settings.
Keep **Erase All Flash Before Sketch Upload: Disabled**, then restore the main
`../Eggcelerate/Eggcelerate.ino` after testing. No VPS rollout is involved.

## Wiring confirmation before outputs

### Identified module — user-supplied listing, October 14

The purchase image shows a blue dual-MOSFET **HW-517** board sold by Wangzm as
a 15 A / 400 W trigger/PWM switch. The supplied seller description specifies:

| Property | Seller-stated specification |
| --- | --- |
| Load/power input | DC 5 to 36 V |
| Trigger signal | DC 3.3 to 20 V digital HIGH/LOW |
| PWM trigger frequency | Up to 20 kHz |
| Advertised capacity | 15 A continuous / 400 W at room temperature |

The listed 3.3 V trigger range supports planning direct ESP32 control. The text
does not explicitly establish HIGH-on polarity or actual reset/default-off
behavior; verify those on the received board. Ratings are seller claims, not
measured capacity or approval for a particular fan/load. The board's PWM support
does not establish the fan's supply-PWM compatibility. Never apply the board's
5 to 36 V load supply to an ESP32 GPIO.

Use the received board's VIN/power, OUT/load, trigger and GND labels to establish
terminal order; the purchase screenshot does not clearly expose every label.
The saved [prototype schematic](../hardware/not-clean.png) already labels both
fans **12 V DC** and shows four terminals: **PWR, GND, Tach, PWM**. PWR/GND
are wired through the MOSFET; Tach/PWM are unconnected in that drawing. This is
recorded design information, not confirmation of the purchased fan's model,
current, physical wire count or supported control method. Those actual fan
details and GPIO wires remain pending.

### Identified fans — DeepCool XFAN 120

Permanent component record: [fan reference](../hardware/fan-reference.md).

User identified the purchased fan as **DeepCool XFAN 120**,
**P/N DP-FDC-XF120**, EAN **6933412703624**. The supplied specifications match
[DeepCool's product page](https://es.deepcool.com/products/Cooling/fans/2021/14989.shtml).

| Property | Published specification per fan |
| --- | --- |
| Dimensions | 120 × 120 × 25 mm |
| Rated supply | 12 V DC |
| Operating supply | 10.8 to 13.2 V DC |
| Starting voltage | 7 V DC |
| Rated current | 0.07 A ±10% |
| Rated input power | 0.84 W |
| Speed | 1300 RPM ±10% |
| Maximum airflow | 43.56 CFM |
| Noise | 23.7 dB(A) |
| Bearing / net weight | Hydro bearing / 180 g |

For two of these fans, nominal totals are **0.14 A / 1.68 W** at 12 V.
These are rated totals, not measured startup or maximum currents.
The purchase thumbnail appears to show three fan wires and a peripheral/Molex
power connector. Confirm the received connector before mapping pins; a
four-position power connector is not a dedicated four-wire PWM fan interface.
The schematic's generic Tach/PWM symbol does not establish the actual connector.

Use full **12 V ON/OFF** for the first MOSFET check. The published specifications
do not provide a supply-PWM frequency, duty range or control guarantee, so PWM
remains disabled. The 7 V starting-voltage specification is a DC threshold;
it is not a 7/12 minimum PWM duty calculation. Any second power connector must
remain disconnected if it would bypass the MOSFET's switched power path.

The user confirmed disconnecting external +5 V from the ESP32 while using USB,
with PSU DC negative/common ground retained. That confirms the power arrangement;
it does not yet establish the actual MOSFET pin labels or trigger polarity.

1. Confirm the upper trigger really connects to **GPIO19**, lower to **GPIO18**.
2. Confirm each module accepts a **3.3 V active-HIGH trigger**, and its trigger
   ground connects to ESP32 GND and the isolated PSU DC negative.
3. Confirm fan voltage/current, module load-terminal labels and the power path.
   Fan load current must return directly to the PSU, not through the ESP32 or USB.
4. Confirm hardware pull-down/default-off behavior during reset and upload.
   Firmware cannot hold a pin low before it starts. Keep fan power off while
   flashing or changing wiring.

Initially `BenchConfig.h` had **kWiringConfirmed = false**. Later October 14,
the user confirmed trigger wires on GPIO18/19 and readiness for testing, so it
is now **true** for manual ON/OFF bring-up. Verify which fan each pin operates
and confirm LOW-off/HIGH-on behavior with the received modules. Set it back to
false to disable output initialization and arming. The current draft supports
active-HIGH modules; revise the polarity handling before using active-LOW ones.
Keep unrelated heater/mist/tray/light load power disconnected during this test.

## Upload and open the actual controller

1. Open `mosfet-bench.ino` in Arduino IDE. Keep all headers beside it.
2. Select **NodeMCU-32S**, ESP32 Arduino core **3.x**, and the correct USB port.
   WiFi, WebServer and LEDC come with the board package; no extra libraries.
3. Disconnect the external +5 V feed to ESP32 5V/VIN, including shared-rail paths.
   Leave common DC ground connected. Plug in USB and upload with flash erase disabled.
4. Open Serial Monitor at **115200 baud**. The AP password is
   **mango123** (all lowercase).
5. Join **Eggcelerate-Fan-Test** from one phone or computer. Remain connected even
   if it says the network has no Internet. Open **http://192.168.4.1**.
6. With wiring confirmed, apply the fans' rated load supply, check both fans are
   off, then press **Arm test**. Switch upper fully on/off, then lower, then both.
7. Press **All off** and visually confirm both stop. Stop immediately for abnormal
   heating, stalled fans, unstable switching or ESP32 resets.

The local bench AP password is fixed: **mango123**.
This follows the user's request for a shorter fruit-based password; protected
Wi-Fi requires at least eight characters. Commands
use a per-boot request token and POST; the page makes no Internet/CDN requests.
One Wi-Fi client is allowed. Anyone given that AP password can operate this bench.

## Output and timeout behavior

- Boot starts disarmed; confirmed outputs start LOW/off. No auto-resume.
- Each fan has Off, Full on, and optional PWM duty controls.
- Commands return the output setting only after it is applied by the sketch.
  This is **not** measured RPM, current, watts or proof of MOSFET/load operation.
- A visible page sends heartbeats every two seconds. A lost heartbeat ends the
  session after ten seconds; every session also ends after 120 seconds.
- Closing/hiding the page sends a best-effort All off request. The firmware
  timeout is the fallback; restoring the page never automatically rearms.
- Timeouts are software checks in the main loop. WebServer calls can block;
  exact cutoff timing under stalled connections needs bench qualification.
  This test sketch is not an independent hardware safety cutoff.

## PWM power adjustment

ON/OFF is the initial enabled mode. `kSupplyPwmConfirmed = false` and
`kPwmFrequencyHz = 0` keep intermediate percentages disabled in both API and UI.

Before enabling PWM, identify the fan's wire count/model and confirm it supports
chopping its **power supply** through the MOSFET module. A four-wire fan's
dedicated PWM input is a different interface. Verify the module's trigger
frequency rating and fan startup/minimum-duty behavior. Then enter the verified
frequency, set `kSupplyPwmConfirmed = true`, and compile/upload again.

The draft uses the ESP32 core 3.x `ledcAttach(pin, frequency, resolution)` and
`ledcWrite(pin, duty)` APIs, 8-bit resolution. Duty is adjustable from 0 to 100%.
No startup boost or assumed minimum running duty is supplied; establish those
from the actual fan before enabling automated control.
Reference: [Espressif LEDC API](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/ledc.html).

## Local computer preview

From the repository root:

```sh
python3 -m http.server 18719 --bind 127.0.0.1 --directory apps/firmware/mosfet-bench/site
```

Open **http://127.0.0.1:18719/?preview=1**. This preview shows the same responsive
page with controls disabled; it has no hardware connection or simulated success.
Actual operation uses the page served by the ESP32 itself.

After editing `site/index.html`, regenerate the embedded copy before upload:

```sh
python3 apps/firmware/mosfet-bench/embed-page.py
```

## Acceptance record

| Check | Status |
| --- | --- |
| Shared ground / USB +5 V separation | User confirmed power arrangement |
| Module model / listed trigger range | HW-517 purchase image; seller lists 3.3 to 20 V trigger |
| Fan identification | User: DeepCool XFAN 120, DP-FDC-XF120; published 12 V / 0.07 A / 0.84 W |
| Actual connectors / GPIO wires / HIGH-on polarity / default-off behavior | Pending |
| Local page HTTP / JavaScript syntax | HTTP 200 and `node --check` passed October 14 |
| Browser visual review | Pending; browser unavailable in this session |
| ESP32 compile/upload | User reports sketch flashed; agent did not compile/upload |
| Fan switching overall | User reports working October 14; detailed observations remain unrecorded |
| Upper and lower independently switch | Pending |
| Both together / supply stability / module temperature | Pending |
| Browser-loss timeout / 120-second limit / boot/reset off | Pending |
| PWM compatibility, frequency and usable duty range | Pending |
| Restored main firmware and sensor/cloud delivery | Pending |

Record real results and the module/fan models before integrating outputs into
the main pilot firmware or marking M8 hardware acceptance complete.

## Latest user confirmation — October 14

User reports all relays and MOSFETs working. Manual MOSFET/fan control now works according to the user on GPIO19/18.
PWM remains disabled.
Detailed fault/reset/timeout measurements and combined main-program integration
remain pending. This supersedes earlier draft/not-tested status for manual
bench controls; the agent did not operate or measure the hardware.
