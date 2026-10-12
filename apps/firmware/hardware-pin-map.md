# Eggcelerate hardware pin map

Recorded 2026-10-12 from the user's schematic:
`/home/mawi/Documents/CAPSTONE/schematic/2/3/4/not-clean.png`.
This is a trace of the drawing plus the user's DHT22 correction, not confirmation
of every physical wire, relay voltage/polarity, or the AC power circuit.

Use **GPIO numbers**, matching board labels IO4/IO21/etc. These are not the
physical header positions. The main NodeMCU-32S firmware currently implements
the DHT22, Wi-Fi/setup, cloud sensor transport, and LCD/OLED services; physical
actuator outputs remain unimplemented.

## Current allocation and proposed actuator connections

The user's revised hardware has **one 5 V two-channel relay board** for heater
and mist, and **one 5 V four-channel relay board** for DC tray rotation and the
12 V LED light. This supersedes the original single-board relay grouping and
its 220AC motor label. See [actuator integration](actuator-integration-guide.md).

| ESP32 GPIO | Current / proposed connection | Status |
| --- | --- | --- |
| **4** | DHT22 DATA | User moved from GPIO2; main firmware uses GPIO4 |
| **27** | Two-channel board A IN1 — heater | Proposed channel mapping, preserving original heater GPIO |
| **14** | Two-channel board A IN2 — mist maker | Proposed channel mapping, preserving original mist GPIO |
| **25** | Four-channel board B IN1 — DC tray motor enable | Proposed; replaces original GPIO12 if physically adopted |
| **26** | Four-channel board B IN2 — 12 V LED light | Proposed; replaces earlier light-IN4 idea |
| **19** | Upper fan MOSFET control | Drawn; actual interface still to confirm |
| **18** | Lower fan MOSFET control | Drawn; actual interface still to confirm |
| **21** | Time module / LCD / OLED SDA | Drawn shared I²C bus; display firmware uses it |
| **23** | Time module / LCD / OLED SCL | Drawn shared I²C bus; display firmware uses it |

Board B IN3/IN4 are reserved. Motor voltage, direction and stop/position method
remain unconfirmed; do not assume a single enable relay can reverse it.

Legacy drawing: GPIO12→relay IN1 motor, GPIO14→IN2 mist, GPIO27→IN3 heater.
Those original channel numbers are historical only. GPIO12 is a classic ESP32
boot strapping pin; the proposed GPIO25 move avoids that concern, but has not
been confirmed as a physical wiring change. Firmware still initializes no
relay or MOSFET outputs. Both fan Tach and PWM terminals are unconnected in the
original drawing, so fan feedback/dedicated PWM control are not established.

## Planned additions — not yet wired or implemented

| Item | Planned connection | Still needed |
| --- | --- | --- |
| Relay-controlled LED light | Revised four-channel board B IN2; **GPIO26 proposed** | Confirm actual GPIO26 availability, relay active level, light voltage/current, and contact wiring |
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
- Use board B IN2 for the light only after the proposed map and its control/output details are confirmed.

See [display integration](display-integration.md) for the existing service hook.

References: [Espressif Arduino I²C API](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/i2c.html),
[ESP32 datasheet: boot configuration and electrical limits](https://documentation.espressif.com/esp32_datasheet_en.html),
[Espressif GPIO voltage tolerance](https://docs.espressif.com/projects/esp-faq/en/latest/esp-faq-en-master.pdf).
