# DHT22 and ESP32 bring-up

Prepared October 11, 2026. Arduino IDE currently selects NodeMCU-32S; the physical
board/module and DHT22 package have not been inspected. VPS screenshot records
Ubuntu 24.04, 2 vCPUs, 4 GiB RAM, and public IP 4.193.224.4. This is not evidence
that MQTT, TLS, or the ingestion worker is configured.

## 1. Local DHT22 readings now

Disconnect USB before wiring. For a labeled three-pin module, use its labels:

| DHT22 | ESP32 |
| --- | --- |
| VCC / + | 3V3 |
| DATA / OUT / S | GPIO4 (IO4, not the fourth physical header pin) |
| GND / - | GND |

For a bare four-pin DHT22, verify its package orientation and pinout before
wiring: VCC, DATA, unused, GND. Add a 10k resistor between DATA and 3V3 unless
the module already provides one. Keep DATA at 3.3V logic levels.
Source: [Adafruit DHT wiring](https://learn.adafruit.com/dht/connecting-to-a-dhtxx-sensor).

Open `dht22-local/dht22-local.ino` as a separate sketch in Arduino IDE.
Install **DHT sensor library by Adafruit** and **Adafruit Unified Sensor** in
Library Manager. Select the attached board and USB port, upload, and open Serial
Monitor at **115200 baud**. Expect a reading every 2.5 seconds and success/failure
counters. Observe several minutes of plausible readings before moving on.
Repeated failures require checking wiring, power, pull-up, sensor type, and GPIO.
This sketch has been prepared but not compiled, flashed, or verified on hardware.

## 2. Protected Wi-Fi setup AP and local portal

AP means the ESP32's Wi-Fi access point, not a cellular APN. Build this next after
the sensor check, retaining sensor sampling independently of network state.
Follow `provisioning-plan.md`: first boot opens a protected AP, credentials are
saved only after a successful connection, and old settings survive failed changes.
Implement the approved 30-second Wi-Fi-loss recovery trigger. Implement the
15-minute upload-failure trigger when durable server receipts exist.

Use a permanent device identity plus a distinct per-device AP password. Proposed
pairing code: 10 random uppercase letters/digits excluding ambiguous characters,
generated once with the platform random source and persisted across restarts.
This format is a proposal, not an implemented contract. Do not derive either secret
from a public MAC/device ID. The code is fixed per incubator; cloud claims require backend support.
During bench development, show setup instructions in Serial Monitor; add OLED
output after its model and wiring are confirmed.

## 3. VPS telemetry and dashboard

Inspect the existing VPS services, broker configuration, device registration,
TLS hostname/certificate, and Azure/host firewall settings. Use the existing
MQTT checker only after these are known. Register a device/chamber and confirm
actual database receipt and fresh dashboard readings. A publish success is not
a durable receipt. Production dispatch is not implemented by the simulator worker.

## 4. Dashboard pairing, then recovery

Implement farm-scoped, rate-limited claims for eligible devices using their fixed
pairing codes. Then implement the persistent offline queue, original
timestamps, durable upload receipts, and deduplicated retries. Keep pairing codes,
AP passwords, and broker credentials separate. Heater/turner control and local
safety firmware are later work and are not included in the sensor check.
