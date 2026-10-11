# EGGCELERATE main firmware

Current reading destination: **the server and Eggcelerate dashboard**. Physical
LCD/OLED output comes later; the marked firmware hook and
[display integration guide](../display-integration.md) describe that addition.

Open **Eggcelerate.ino** in Arduino IDE. Keep **EggcelerateFirmware.h** in this
same folder; it appears as the implementation tab and is compiled with the sketch.
This is the main program to extend as subsequent phases are implemented.

Current implementation integrates the local Phases 1–2 baseline and sensor cloud transport: DHT22 on GPIO4, persistent
device identity/fixed pairing code, protected Wi-Fi setup page, saved-network
rollback, and Serial setup commands. The integrated main sketch compiled successfully for NodeMCU-32S with ESP32 core
3.3.11 and PubSubClient 2.8.0 (81% flash, 15% static RAM). Hardware and VPS
acceptance remain pending.
See [cloud activation](../cloud-activation.md) for the deployment and enrollment steps.

**Embedded device ID: `EGG-001`**, set by `kDeviceId` in `EggcelerateFirmware.h`.
Its setup network is **`Eggcelerate-Setup-EGG-001`**. Give each additional board
its own embedded ID (`EGG-002`, `EGG-003`, etc.) before commissioning/enrollment.
The random fixed pairing code remains the only identifier the user enters in the system.

When updating the already commissioned board from the original MAC-based ID,
the main sketch migrates that board's saved ID to `EGG-001` and retains its pairing
code, AP password, and saved Wi-Fi. No flash erasure or new `commission` is needed.
Reflash with erase disabled and send `status` to inspect the result. This migration
compiled with the integrated sketch but has not been verified on hardware. Update the private commissioning
record and use `EGG-001` for future VPS enrollment.

Pilot cloud setup will use embedded developer-side VPS/broker settings from
`CloudConfig.example.h`, copied locally to the Git-ignored `CloudConfig.h`.
The user will enter home Wi-Fi on the setup page and only the fixed pairing code
in Eggcelerate. Internal device IDs and broker credentials are not user-entry fields.
The template records the VPS IP, but the actual MQTT hostname/listener, credentials,
certificate, and VPS deployment still need to be established. Transport is integrated,
but stays disabled until private CloudConfig.h contains complete settings. Install
**PubSubClient** alongside the DHT libraries. Readings publish every 15 seconds;
server receipts confirm committed database ingestion. Invalid/stale sensor values
are skipped. No offline telemetry queue or actuator commands are implemented.
For this USB-powered pilot battery_pct=100 and power_source=grid are compatibility
constants, not measured battery/power data. MQTT/TLS connection calls can pause the
main loop for their configured timeouts; sensor and portal timing still need hardware checks.

Use the [Phase 1–2 setup instructions](../wifi-setup/README.md), opening this
main sketch instead of wifi-setup.ino. Select NodeMCU-32S and Serial Monitor at
115200 baud. Send `commission` only for first commissioning; an existing saved
identity is reused automatically. The fallback and main sketch share the original
NVS record layout. After migration to `EGG-001`, the frozen Wi-Fi fallback will
reject the new ID; use the main sketch for setup and avoid re-commissioning through
the fallback. The sensor-only fallback remains usable without touching these records.

## Fallback sketches

| Sketch | Purpose |
| --- | --- |
| `../dht22-local/dht22-local.ino` | Sensor-only baseline demonstrated on the board |
| `../wifi-setup/wifi-setup.ino` | Frozen initial Phases 1–2 implementation; hardware evidence pending |
| `../test/test.ino` | Earlier MQTT checker requiring broker configuration |

Future development goes into this main folder. Preserve each fallback's source,
and record its actual verification status rather than assuming it has passed.

## October 11 activation checkpoint

The locally ignored `CloudConfig.h` is now prepared for the deployed pilot broker
at 4.193.224.4:8883 with this device's credentials and public MQTT CA. The configured
sketch compiled successfully for NodeMCU-32S (81% flash, 15% static RAM). TCP,
TLS handshake, and MQTT response timeouts are bounded, but blocking timing still
needs hardware acceptance. Do not regenerate the saved pairing code.

The server is running PostgreSQL, authenticated API access, trusted dashboard
HTTPS, and sensor-only MQTT ingestion. Public MQTT 8883 is still blocked pending
Azure networking. Owner account details, existing-code enrollment, and firmware
upload remain pending; the ESP32 has not been reflashed in this deployment step.
The physical destination remains the Eggcelerate dashboard; LCD/OLED are later.
