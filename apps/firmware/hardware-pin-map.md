# Eggcelerate hardware pin map

> **Latest tray confirmation — October 15:** The installed motor is **220 V AC**,
> and the user confirms **90 degrees total rocking travel**. Earlier DC motor
> assumptions below are historical and superseded. Control remains relay IN2 /
> GPIO25 (LOW on / HIGH off); main firmware holds it off. Cycle duration,
> self-stop/continuous-power behavior and position/home feedback remain unknown.
> Use the [current handoff](../../docs/guide/capstone-next-phases-2026-10-15.md).


> **October 15 update:** Earlier mappings/implementation status below include historical proposals.
> Use the [current capstone handoff](../../docs/guide/capstone-next-phases-2026-10-15.md)
> for authoritative pins, implemented climate lifecycle and remaining tray/power phases.


Recorded 2026-10-12 from the user's schematic:
`/home/mawi/Documents/CAPSTONE/schematic/2/3/4/not-clean.png`.
This is a trace of the drawing plus the user's DHT22 correction, not confirmation
of every physical wire, relay voltage/polarity, or the AC power circuit.

Use **GPIO numbers**, matching board labels IO4/IO21/etc. These are not the
physical header positions. The main NodeMCU-32S firmware currently implements
the DHT22, Wi-Fi/setup, cloud sensor transport, and LCD/OLED services; physical
actuator outputs remain unimplemented.

## Current pin use versus original schematic — October 14

User reports the MOSFET/fan test is working after flashing the separate bench
and connecting triggers to GPIO18/19. This records user-reported functional
success. Individual channel identity, combined-load, boot/reset, timeout and
module-temperature observations were not separately supplied. PWM remains
disabled; integration into main firmware remains pending.

| Function | Original schematic | Current pin / allocation | Status |
| --- | --- | --- | --- |
| DHT22 DATA | GPIO2 | **GPIO4** | Used by main firmware; user corrected wiring and real readings recorded |
| Upper fan MOSFET trigger | GPIO19 | **GPIO19** | User connected GPIO18/19; bench reported working; upper label follows code |
| Lower fan MOSFET trigger | GPIO18 | **GPIO18** | User connected GPIO18/19; bench reported working; lower label follows code |
| Shared I²C SDA | GPIO21, time module | **GPIO21** for shared LCD/OLED/time-module bus | Used in main display code; physical display/time-module acceptance remains unrecorded |
| Shared I²C SCL | GPIO23, time module | **GPIO23** for shared LCD/OLED/time-module bus | Used in main display code; retain GPIO23 rather than default GPIO22 |
| Heater relay | GPIO27 → old IN3 | **GPIO27 → four-channel IN1** | Proposed revised channel; physical connection/test pending |
| Mist maker relay | GPIO14 → old IN2 | **GPIO14 → four-channel IN4** | Proposed revised channel; physical connection/test pending |
| DC tray motor relay | GPIO12 → old IN1 | **GPIO25 → four-channel IN2** | Proposed replacement; physical adoption not confirmed |
| 12 V LED light relay | No original assignment | **GPIO26 → four-channel IN3 (reserved)** | Proposed; connection/test pending |
| Former DHT pin | GPIO2 | No current planned assignment | DHT moved to GPIO4; not a qualified spare output |
| Former motor pin | GPIO12 | Legacy assignment; avoided in revised plan | Old wire removal not confirmed; preserve boot-strapping context |

GPIO4/21/23 remain reserved for the main sensor/display program, even while the
fan bench replaces it. Shared PSU DC negative/ESP32 GND is a reference connection,
not a GPIO assignment. The user-confirmed USB arrangement disconnects external
+5 V from ESP32 while retaining common DC ground. User channel order: IN1 heater, IN2 tray, IN3 empty/reserved LED, IN4 mist. GPIO wires remain unconfirmed. Proposed relay pins are not confirmed or tested outputs.

## Current allocation and proposed actuator connections

October 14 current decision: use **one MakerLab 5 V four-channel relay board**
for DC tray rotation, mist, heater and 12 V light. The purchased two-channel board
is spare. This supersedes the October 12 two-board allocation; the original
earlier DC motor decision was superseded on October 15 by user confirmation
of the installed 220 V AC motor. See [actuator integration](actuator-integration-guide.md).

| ESP32 GPIO | Current / proposed connection | Status |
| --- | --- | --- |
| **4** | DHT22 DATA | User moved from GPIO2; main firmware uses GPIO4 |
| **27** | Four-channel IN1 — heater | Enabled LOW-trigger bench; user reports working October 14 |
| **14** | Four-channel IN4 — mist maker | Enabled LOW-trigger bench; user reports working October 14 |
| **25** | Four-channel IN2 — DC tray motor enable | Enabled LOW-trigger bench; user reports working October 14; replaces old GPIO12 in bench |
| **26** | Four-channel IN3 — reserved 12 V LED light | Proposed; replaces earlier light-IN4 idea |
| **19** | Upper fan MOSFET control | User connected; bench reported working October 14; main integration pending |
| **18** | Lower fan MOSFET control | User connected; bench reported working October 14; main integration pending |
| **21** | Time module / LCD / OLED SDA | Drawn shared I²C bus; display firmware uses it |
| **23** | Time module / LCD / OLED SCL | Drawn shared I²C bus; display firmware uses it |

IN3 is currently empty and reserved for the future LED light. User confirmed channel order; GPIO wires remain unconfirmed. Motor voltage, direction and stop/position method
remain unconfirmed; do not assume a single enable relay can reverse it.

Legacy drawing: GPIO12→relay IN1 motor, GPIO14→IN2 mist, GPIO27→IN3 heater.
Those original channel numbers are historical only. GPIO12 is a classic ESP32
boot strapping pin; the proposed GPIO25 move avoids that concern, but has not
been confirmed as a physical wiring change. Main firmware still initializes no
relay or MOSFET outputs; the separate bench drives GPIO18/19. Both fan Tach and PWM terminals are unconnected in the
original drawing, so fan feedback/dedicated PWM control are not established.

October 14 schematic recheck: both fans are explicitly labelled **12 V DC FAN**.
Each schematic symbol has **PWR, GND, Tach and PWM** terminals. Only PWR/GND
are wired, through its MOSFET module; Tach/PWM are unconnected. Actual purchased
fan model/current/wire count and control requirements are not recorded yet.

Later October 14 identification supersedes that inventory gap: user supplied
**DeepCool XFAN 120, DP-FDC-XF120** specifications: **12 V DC**, **0.07 A ±10%**,
**0.84 W**, **1300 RPM ±10%**, operating 10.8 to 13.2 V, starting 7 V. Purchase
thumbnail appears to show three fan wires plus a peripheral power connector;
actual connector pin mapping still needs confirmation. Do not infer a dedicated
PWM wire from the schematic symbol. Begin with 12 V ON/OFF switching; supply
PWM is not qualified by the provided fan specifications.

## Planned additions — not yet wired or implemented

| Item | Planned connection | Still needed |
| --- | --- | --- |
| Relay-controlled LED light | Four-channel IN3, currently empty/reserved; **GPIO26 proposed** | Confirm actual GPIO26 availability, relay active level, light voltage/current, and contact wiring |
| Four-pin LCD / "LED screen": user identified 1602 16×2 HD44780 with I²C backpack | Shared SDA **GPIO21**, SCL **GPIO23**, common GND, suitable VCC | Main firmware driver added using hd44780 1.3.2 with address detection; safe power/level conversion and physical output remain unconfirmed |
| Four-pin OLED: LAFVIN 0.96-inch 128×64, blue, I²C | Shared SDA **GPIO21**, SCL **GPIO23**, common GND, suitable VCC | Provisional SSD1306 status service added, with 0x3C/0x3D probing; controller/voltage and physical output remain unconfirmed |

SDA/SCL identify I²C displays. The two screens can share the time module's bus
if their addresses are compatible and distinct. Do not assign separate GPIOs
to each display simply because they are separate modules. Confirm addresses
with an I²C scan before selecting libraries/initializing the displays.

For this drawing, initialize the shared bus explicitly, e.g.
`Wire.begin(21, 23)`, rather than relying on GPIO21/GPIO22 defaults. Libraries
must use that bus and must not reinitialize it on different pins.

The drawing powers the time module from 5 V. Check where its SDA/SCL pull-ups
are connected before sharing the bus. ESP32 GPIO must not be exposed to 5 V
pull-ups; use a 3.3 V logic bus or appropriate I²C level translation according
to the actual modules. A display's VCC requirement and I²C logic level are
separate specifications. No display VCC assignment is confirmed yet.

## Display behavior planned for later coding

- Reuse the existing DHT22 reading; do not read the sensor separately per screen.
- Show temperature, humidity, EGG-001, and connectivity as screen space permits.
- LCD always shows temperature/humidity. OLED shows pairing code plus
  online/offline status in normal use and during setup AP.
  Distinguish Wi-Fi connected, server connection pending, and server-confirmed
  reading delivery; broker connection alone must not be labelled verified delivery.
- Show the fixed pairing code on the OLED, not Wi-Fi or MQTT passwords.
- Keep displays responsive if Wi-Fi/cloud is unavailable.
- A missing display must not stop the DHT22 or telemetry loop.
- Use reserved four-channel IN3 for the future light only after the proposed map and its control/output details are confirmed.

See [display integration](display-integration.md) for the existing service hook.

References: [Espressif Arduino I²C API](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/i2c.html),
[ESP32 datasheet: boot configuration and electrical limits](https://documentation.espressif.com/esp32_datasheet_en.html),
[Espressif GPIO voltage tolerance](https://docs.espressif.com/projects/esp-faq/en/latest/esp-faq-en-master.pdf).

## Latest functional checkpoint — October 14

User reports all relays and MOSFETs working with the separate bench sketches.
Current active bench GPIO allocation is heater 27, tray 25, mist 14, upper fan 19
and lower fan 18. IN3/light GPIO26 remains reserved, not active. Sensor GPIO4
and shared I²C GPIO21/23 remain allocated to the main program. Relay controls
use LOW-on/HIGH-off; MOSFET controls use HIGH-on/LOW-off. No combined main-program
actuator integration, PWM or detailed fault/reset/timeout qualification is implied.
This latest checkpoint supersedes earlier pending bench allocation notes.
