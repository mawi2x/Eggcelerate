# EGGCELERATE ESP32 firmware

**Current build: automatic climate preparation and confirmed incubation.** Use
[the preparation guide](../../docs/guide/incubator-preparation-guide.md) and
[main firmware instructions](Eggcelerate/README.md). The separate Start Test panel
is retired. Physical acceptance and tray commissioning remain pending.

Home for the physical incubator controller firmware. The capstone research
group owns this application. Target platform: a 38-pin ESP32 development board;
the exact board/module variant remains to be confirmed.

**Main sketch: [Eggcelerate.ino](Eggcelerate/Eggcelerate.ino).** Open this for current
development and later phases. Keep `EggcelerateFirmware.h` beside it. See the
[main firmware instructions](Eggcelerate/README.md).

For the combined manual relay/MOSFET test, upload
[relay-bench.ino](relay-bench/relay-bench.ino) and follow the
[combined bench instructions](relay-bench/README.md). It provides three relay
and two fan controls on one local page using the current pin allocation.

Start with the [local DHT22 sketch](dht22-local/dht22-local.ino), which prints readings
without network configuration. The [bring-up guide](bringup-guide.md) covers wiring,
Arduino setup, and the sequence for AP setup, pairing, and VPS telemetry.
The [phase plan](phase-plan.md) is the current implementation sequence, including
the fixed pairing-code decision and the demonstrated local sensor check.
For the next bench step, use [Eggcelerate.ino](Eggcelerate/Eggcelerate.ino) and the
[upload/setup instructions](wifi-setup/README.md): persistent fixed code, protected
local portal, saved Wi-Fi, and continuing DHT22 readings. Hardware verification is pending.
The `dht22-local`, `wifi-setup`, and `test` folders remain phase/checker fallbacks.

The [test sketch](test/test.ino) is a small Arduino ESP32 connectivity checker. It
reads the DHT22 and publishes contract-shaped telemetry over MQTT/TLS every 15
seconds. It is for checking the sensor-to-broker path; production firmware,
actuator control, full build tooling, pin assignments, and hardware verification
remain pending. The exact board/module variant also needs confirmation.

## MQTT connectivity check

1. Install the ESP32 Arduino board support, Adafruit DHT sensor library, and
   PubSubClient in Arduino IDE.
2. Copy `test/config.example.h` to `test/config.h`, then enter Wi-Fi settings,
   the VPS MQTT hostname, per-device broker credentials, the trusted root CA,
   and the registered `DEVICE_ID` and assigned `INCUBATOR_ID`. `config.h` is
   ignored by Git so secrets stay local.
3. Open `test/test.ino` in Arduino IDE, select the ESP32 board and port, then
   upload it. Open Serial Monitor at 115200 baud to see Wi-Fi, TLS/MQTT, DHT22,
   and publish status.

The sketch publishes QoS 0 telemetry to
`eggcelerate/v1/devices/{device_id}/telemetry`, matching the current backend
payload contract. `battery_pct` is fixed at 100 and `power_source` at `grid` for
this checker; the board does not measure either value. The broker hostname must
resolve to a TLS-enabled MQTT listener on the VPS, with a device account and
publish ACL. The current repository broker is anonymous and loopback-only, and
the bundled worker is simulator-only, so configuring this sketch alone does not
make the current VPS ingest physical-device data. Server-side broker access and
telemetry subscription must be configured separately.

## Integration contracts

- [Approved connection, pairing, and offline recovery plan](provisioning-plan.md) — AP portal, changeable per-incubator code, displays, and persistent offline queue; implementation pending.

- [MQTT contract](../../docs/guide/b4-mqtt-contract.md)
- [Device provisioning](../../docs/guide/device-provisioning-guide.md)
- [Provisional firmware safety contract](../../docs/guide/firmware-safety-contract.md)

The backend MQTT worker currently supports the simulator. Physical-device
integration and qualification are M8 work in the [roadmap](../../ROADMAP.md).
Firmware must maintain local control through network/server outages and implement
the agreed command acknowledgement behavior before physical control is qualified.

## Provisional parts list

The latest user-supplied prototype schematic is in
[hardware/](hardware/README.md), with PNG and SVG copies. Component names,
voltages, and connections remain under review.

Reported by the user on October 3, 2026; updated October 11 to remove the missing water sensor. Water checks are manual reminders. Approximately 3–5 additional items are
expected; inventory, wiring, and successful hardware tests remain unconfirmed.

| Component | Quantity |
| --- | ---: |
| 38-pin ESP32 development board | 1 |
| ESP32 expansion board | 1 |
| DHT22 temperature and humidity sensor | 1 |
| DS3231 RTC module | 1 |
| 4-channel and 2-channel relay modules | 1 each |
| PWM trigger-drive and trigger-switch MOSFET modules | 2 each |
| 0.96-inch OLED and 16×2 I²C LCD | 1 each |
| 5 mm LED kit | 4 |

## Next setup steps

1. Confirm the full inventory and exact board variant; keep the connectivity
   checker separate from the production firmware implementation.
2. Select production build tooling and document reproducible build/flash commands.
3. Record wiring, pin assignments, and actuator safe states.
4. Implement sensor drivers, local control, telemetry, and command handling with
   the existing contracts; record verification against the actual hardware.

Keep Wi-Fi passwords, broker credentials, and device secrets out of committed
files. Document configuration with example values when build tooling is added.

Sensor cloud activation is now integrated into the main sketch. See
[cloud activation](cloud-activation.md) for the prepared broker overlay, fixed-code
enrollment, firmware configuration, and the remaining VPS/hardware gates.
