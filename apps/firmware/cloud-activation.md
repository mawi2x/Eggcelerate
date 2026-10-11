# DHT22 to dashboard: activate the integrated pilot

The requested destination is the **Eggcelerate dashboard on the server**.
LCD/OLED readings are deferred; see [the later display guide](display-integration.md).

## October 11 deployment checkpoint

Local build/rehearsal passed, then the same API/web images were loaded into the
separate `eggcelerate-hardware` VPS project. PostgreSQL is migrated to 0017, the
sensor worker is connected to MQTT, and `https://4.193.224.4/readyz` reports ready.
The public HTTPS certificate is installed with an eight-hour renewal schedule.
The original HTTP demo and original Git checkout remain available.

The configured private `Eggcelerate/CloudConfig.h` is prepared locally and its
main sketch compiled successfully. This build has not been uploaded yet. Public
MQTT port 8883 currently times out: an Azure inbound rule is still needed. Real
owner account details and the board's existing code are required for enrollment.
No synthetic readings were inserted, and physical end-to-end acceptance remains
pending. See [VPS operations](../../infrastructure/https/README.md) for the active
snapshot path and commands. The instructions below describe activation from scratch.

## What is ready in source

The main sketch is `Eggcelerate/Eggcelerate.ino`, with implementation and private
configuration tabs beside it. It retains Wi-Fi, setup AP, fixed pairing code and
GPIO4 DHT22 sampling. It adds verified TLS MQTT and UTC timestamps, fresh readings
every 15 seconds, reconnect attempts, and database receipts. No additional phase
sketch needs uploading. Earlier fallback sketches are retained.

The server resolves the assigned chamber from EGG-001. The dashboard accepts the
fixed 10-character code (XXXXX-XXXXX), resolves it for the signed-in farm, and
creates the chamber using the real device ID. Existing telemetry projections and
live refresh show temperature/humidity and mark old data stale/offline.

VPS transport is now deployed; device enrollment and physical activation remain
pending. MQTT credentials and its private CA are prepared in ignored files; the
existing pairing code still needs enrollment for the real farm. Main sketch compilation passed for NodeMCU-32S with ESP32 core 3.3.11 and
PubSubClient 2.8.0 (81% flash, 15% static RAM). Web type checking and Python syntax
compilation passed. VPS migrations passed; end-to-end hardware acceptance has not been
performed. Compilation is not hardware qualification.

## Phase 3 — prepare the VPS

1. Establish SSH access and inspect the existing deployment before changing it.
   Public IP recorded from the screenshot: `4.193.224.4`; DNS is not yet known.
2. Use the authenticated PostgreSQL/API deployment in `compose.production.yaml`,
   with the web build using the API and live refresh enabled. Follow the existing
   production guide for HTTPS, sessions, owner account, and database configuration.
3. Prepare `infrastructure/mqtt-hardware/private/` on the VPS. Supply `ca.crt`,
   `server.crt`, `server.key`, and a Mosquitto `passwords` database. The server
   certificate needs SANs for the external hostname (or IP `4.193.224.4`) and the
   internal Compose hostname `hardware-broker`. Only copy the public CA to firmware;
   keep CA and server private keys on the operator side.
4. Create two different broker passwords: username `EGG-001` for this ESP32 and
   username `eggcelerate-worker` for ingestion. Use `mosquitto_passwd` interactively;
   do not put passwords in shell history. Ensure the broker can read its files
   (container UID 1883) and the worker can read the public CA (UID 10001).
5. Use the supplied `mosquitto.conf` and `acl`. Run
   `python3 infrastructure/mqtt-hardware/prepare_passwords.py --env-file .env.hardware`
   to install the password database and private runtime ACL with broker ownership.
   The helper expects the already prepared `private/device-password` and TLS files. EGG-001 can only write its own
   telemetry and read its own receipts. The worker cannot dispatch commands.
   Set `MQTT_WORKER_PASSWORD` and `MQTT_DEVICE_ACL_CONFIRMED=true` in the private
   deployment environment. Open TLS TCP 8883 in Azure networking and host firewall.
   Do not expose the anonymous simulator broker.
6. Apply migrations before starting updated API/worker:

   ```sh
   docker compose -f compose.yaml -f compose.production.yaml --profile database run --rm api alembic upgrade head
   ```

7. Start the hardware services alongside the API/web:

   ```sh
   docker compose -f compose.yaml -f compose.production.yaml -f compose.hardware.yaml --profile database up -d --build
   ```

Mosquitto reference: https://mosquitto.org/man/mosquitto-conf-5.html

## Phase 4 — enroll the fixed pairing code

From the main firmware Serial Monitor, send `status` and retain the commissioning
record privately. Enroll the **existing** code under the correct farm. Do not
commission again or regenerate it.

```sh
docker compose -f compose.yaml -f compose.production.yaml exec api python -m eggcelerate_api.admin provision-device --farm-id YOUR_FARM_UUID --device-id EGG-001 --with-pairing-code
```

The command privately prompts for the code and stores its digest. Repeating the
same enrollment is safe; replacing an enrolled fixed code is refused. For this
pilot, an installer assigns the farm at enrollment; cross-farm transfer and
unowned factory inventory remain later phases.

Sign in to that farm and add the incubator using its pairing code and chamber name.
No chamber ID or farm ID is entered on the ESP32. Pairing can happen while offline;
the dashboard waits for actual telemetry before showing a live connection.

## Phase 5 — configure and flash the main firmware

1. Install Adafruit DHT sensor library, Adafruit Unified Sensor, and PubSubClient
   through Arduino IDE Library Manager.
2. Copy `Eggcelerate/CloudConfig.example.h` to `Eggcelerate/CloudConfig.h` locally.
   Fill MQTT_HOST with the certificate's external hostname/IP, MQTT_PORT=8883,
   MQTT_USERNAME=EGG-001, this device's password, and the PEM public CA certificate.
   These are embedded developer settings. Home Wi-Fi stays in the setup portal.
3. Open `Eggcelerate/Eggcelerate.ino`; select NodeMCU-32S. Keep flash erase disabled
   to retain the code/AP password/Wi-Fi and upload. Serial Monitor: 115200 baud.
4. Expected sequence: sensor readings → Wi-Fi connected → UTC clock ready → MQTT
   connected → reading sent → **Cloud: database accepted reading N**.
5. The dashboard should show the corresponding temperature/humidity. A socket send
   does not mean database success. If receipts are absent, inspect worker logs and
   farm enrollment/chamber assignment; if MQTT fails, inspect TLS, listener, ACL,
   credentials, and Azure networking.

## Phase 6 — user acceptance on the hardware

Confirm dashboard readings track Serial values, Celsius/Fahrenheit conversion,
reboot persistence, Wi-Fi recovery, and stale/offline handling after unplugging.
A disconnected DHT must not produce invented readings. This phase needs the real
board, deployed services, and explicit verification; it is not marked complete.

The pilot sends only current readings (QoS0). It has no offline backlog. TLS/MQTT
connect attempts may briefly block sensor/portal handling. The USB-powered pilot
reports battery_pct=100/power_source=grid as compatibility constants, not measured
power data. OLED, relay/turn commands, durable offline queues, and hardware timing
qualification are outside this temperature/humidity activation step.
