# EGGCELERATE ESP32 firmware

Reserved home for the physical incubator controller firmware. The capstone research
group owns this application. Target platform: a 38-pin ESP32 development board;
the exact board/module variant remains to be confirmed.

This directory currently contains planning documentation only. Existing firmware
source, build tooling, pin assignments, and hardware verification have not been
provided. PlatformIO, Arduino, or ESP-IDF tooling will be selected when the group
confirms its existing code and board.

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

Reported by the user on October 3, 2026. Approximately 3–5 additional items are
expected; inventory, wiring, and successful hardware tests remain unconfirmed.

| Component | Quantity |
| --- | ---: |
| 38-pin ESP32 development board | 1 |
| ESP32 expansion board | 1 |
| DHT22 temperature and humidity sensor | 1 |
| Water-level sensor | 1 |
| DS3231 RTC module | 1 |
| 4-channel and 2-channel relay modules | 1 each |
| PWM trigger-drive and trigger-switch MOSFET modules | 2 each |
| 0.96-inch OLED and 16×2 I²C LCD | 1 each |
| 5 mm LED kit | 4 |

## Next setup steps

1. Confirm the full inventory, exact board variant, and existing firmware source.
2. Select build tooling and document reproducible build/flash commands.
3. Record wiring, pin assignments, and actuator safe states.
4. Implement sensor drivers, local control, telemetry, and command handling with
   the existing contracts; record verification against the actual hardware.

Keep Wi-Fi passwords, broker credentials, and device secrets out of committed
files. Document configuration with example values when build tooling is added.
