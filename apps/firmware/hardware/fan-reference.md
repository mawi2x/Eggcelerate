# Fan reference — DeepCool XFAN 120

Recorded October 14, 2026 from the user's purchase screenshot and supplied
specifications. These identify the selected fan; physical wiring and operation
have not yet been fully qualified.

October 14 update: user connected triggers to GPIO18/19 and reports the fan test
is working. Individual channel, combined-load, reset and timeout results remain
unrecorded. PWM stays disabled. See the [current pin map](../hardware-pin-map.md).

## Identification

| Item | Value |
| --- | --- |
| Manufacturer | DeepCool |
| Model | XFAN 120 |
| Part number | DP-FDC-XF120 |
| EAN | 6933412703624 |
| Project quantity | Two: upper fan and lower fan |
| Purchase listing | Cybertech, Shopee; screenshot supplied by user |
| Manufacturer reference | [DeepCool XFAN 120 specifications](https://es.deepcool.com/products/Cooling/fans/2021/14989.shtml) |

## Published specifications

| Property | Per fan |
| --- | --- |
| Overall dimensions | 120 × 120 × 25 mm |
| Fan dimensions | 120 × 120 × 25 mm |
| Net weight | 180 g |
| Bearing | Hydro bearing |
| Rated voltage | 12 V DC |
| Operating voltage | 10.8 to 13.2 V DC |
| Starting voltage | 7 V DC |
| Rated current | 0.07 A ±10% |
| Input power | 0.84 W |
| Speed | 1300 RPM ±10% |
| Maximum airflow | 43.56 CFM |
| Noise | 23.7 dB(A) |

Two fans have a combined nominal rating of **0.14 A / 1.68 W at 12 V**.
These totals do not establish startup, stall or maximum measured current.

## Project control arrangement

- Upper fan: separate MOSFET module, planned ESP32 **GPIO19** trigger.
- Lower fan: separate MOSFET module, planned ESP32 **GPIO18** trigger.
- Selected switch: blue **HW-517** dual-MOSFET board sold by Wangzm.
  Seller lists 5 to 36 V DC load supply, 3.3 to 20 V trigger and PWM input
  up to 20 kHz; advertised 15 A / 400 W is not a measured project rating.
- Initial qualification uses full **12 V ON/OFF** through each MOSFET.
- Supply PWM remains unqualified. The fan specifications provide no supported
  PWM frequency/duty range. The 7 V starting voltage is a DC specification,
  not a minimum PWM percentage.

## Connector and schematic distinction

The purchase thumbnail appears to show three fan wires plus a peripheral/Molex
power connector. Actual connector labels, pin order and wire functions still
need confirmation on the received fan. A four-position power connector does
not establish a dedicated four-wire PWM fan interface.

The saved prototype schematic labels both fans 12 V DC and uses generic
PWR/GND/Tach/PWM symbols. Only PWR/GND are wired through MOSFETs; Tach/PWM
are unconnected. Do not use the generic symbol to infer the purchased fan's
connector or a dedicated PWM input. Keep any alternate power connector
disconnected when it would bypass the MOSFET's switched power path.

## Remaining observations to record

- Actual fan label and connector/pin mapping.
- Actual GPIO19/18 connections and module terminal labels.
- HIGH-on polarity, 3.3 V switching and boot/reset default-off behavior.
- Each fan's ON/OFF results, both together, supply stability and module heating.
- Actual startup current and any later speed-control qualification.

Related records: [hardware pin map](../hardware-pin-map.md),
[actuator integration](../actuator-integration-guide.md),
[local MOSFET bench](../mosfet-bench/README.md),
[prototype schematic](not-clean.png).

## Latest bench confirmation — October 14

User reports all relays and MOSFETs working. Manual fan MOSFET control on
GPIO19/18 is recorded as user-reported success. PWM remains disabled; combined
main-firmware integration and detailed reset/timeout/load observations remain
pending. See [relay reference](relay-reference.md) for the matching relay results.
