# ESP32 setup, fixed pairing codes, and VPS integration

Prepared October 11, 2026. This is the implementation sequence for the approved
AP/portal and recovery scope. The user's latest decision is a fixed pairing code
per incubator, replacing the previous dashboard code-change feature.

Main development sketch: `Eggcelerate/Eggcelerate.ino`. Phase sketches remain
fallback snapshots; extend the main sketch for subsequent phases. It now integrates Phases 1–2 setup and the sensor cloud transport. The frozen
`wifi-setup` sketch remains a fallback. Activation steps: [cloud activation](cloud-activation.md).

Latest user simplification: embed VPS/broker settings in the ESP32 firmware for
this pilot. Users enter home Wi-Fi in the local portal and only the fixed pairing
code in the system. Do not ask them to enter device ID, server address, farm ID,
broker credentials, or chamber routing IDs. Device identity and authentication
remain internal. `Eggcelerate/CloudConfig.example.h` is the developer-side
template; transport and server code are implemented, while actual broker settings,
VPS deployment, and hardware acceptance remain pending.

## Confirmed starting point

- Arduino IDE selects NodeMCU-32S; physical module/flash details still need confirmation.
- DHT22 DATA uses GPIO4. The user's Serial Monitor screenshot shows 11 successful
  reads, zero failures, 30.8°C and 85.3% RH. Communication is demonstrated, not calibration.
- Local sketch: `dht22-local/dht22-local.ino`.
- VPS screenshot: Ubuntu 24.04, 2 vCPUs, 4 GiB RAM, public IP 4.193.224.4,
  no DNS name configured. Live services and access have not been inspected.
- Water checks are manual reminders; the device does not need a water sensor.
- Existing MQTT checker and operator registry are starting points. They do not
  implement the AP portal, code-based claims, or production device operation.

## Intended user flow

Power on → connect to the protected setup Wi-Fi → open the local setup page →
enter home Wi-Fi → sign in to EGGCELERATE → enter the fixed incubator code →
see confirmed temperature/humidity readings.

Later boots reconnect automatically. Wi-Fi changes and outages preserve the
same pairing code, device identity, and farm ownership.

## Phase 0 — preserve the working sensor baseline

Status: initial communication demonstrated by the user; extended observation pending.

- Keep GPIO4 and the working sketch as the rollback starting point.
- Record actual module labels, supply voltage, board model, and wiring.
- Observe readings for several minutes and compare with a reference if available.
- Disconnect/reconnect USB and confirm the sensor starts again.

Exit: repeatable readings after reboot; failures are displayed honestly.

## Phase 1 — permanent identity and fixed code

Status: initial firmware implemented in `wifi-setup/wifi-setup.ino`; compile,
upload, persistence, and recovery evidence pending. See its README for bench steps.

- Use a stable internal device ID, separate from the human-entered pairing code.
- Latest decision: embed `EGG-001` in the main sketch for this incubator; assign
  `EGG-002`, `EGG-003`, etc. to later devices. Migrate the current board's original
  MAC-based saved ID while retaining its existing code and Wi-Fi configuration.
- Generate a random fixed code once during controlled commissioning. Proposed
  format: 10 uppercase letters/digits excluding ambiguous characters, displayed
  in two groups of five. Normalize case, spaces, and the display separator at entry.
- Generate using the platform's cryptographic random source. Do not derive the
  code from the public device ID/MAC, and do not use sequential codes.
- Persist identity/code in ESP32 configuration storage; maintain a protected
  commissioning record so reinstalling firmware does not silently invent a new code.
- Print the identity/code to Serial Monitor for this bench phase. OLED output
  comes later. Avoid placing real codes in source control or general server logs.
- Keep the setup AP password, pairing code, and broker credentials distinct.
- Wi-Fi reset clears only Wi-Fi settings. Ordinary boot, reconnect, and firmware
  upgrades must preserve identity/code. Erased storage requires controlled
  reprovisioning using the commissioning record, not automatic new enrollment.
- Remove owner-facing code-change UI from this phase's scope.

Exit: code and identity survive reboot and Wi-Fi reset; repeated initialization
does not regenerate them. Server enrollment in Phase 3 checks code uniqueness.

## Phase 2 — protected AP and local Wi-Fi setup

Status: initial firmware implemented, including saved-network rollback and manual
portal URL. Phone/hardware acceptance remains pending; automatic captive popup
and physical setup button are not included in this bench batch.

- First boot without working saved credentials opens `Eggcelerate-Setup-<suffix>`
  with a unique per-device password. Show the name/password/local URL in Serial.
- Provide a mobile-friendly local page for SSID/password and connection status.
  Offer a manual URL even when automatic captive-portal opening is unavailable.
- Keep entered Wi-Fi credentials local to the ESP32; never send them to the VPS.
- Validate a new connection before replacing saved credentials. Restore the
  previous credentials if the attempt fails, and keep setup available.
- Keep DHT22 sampling and sensor-error reporting independent of setup/reconnect.
- Save working settings and reconnect after reboot. Close AP after connection
  success and a short active-session grace period.
- Add bounded retry and setup-session timing. Provide a bench Serial setup
  command initially; choose the physical button/pin before installing in the chamber.

Exit: phone setup succeeds, incorrect credentials are recoverable, saved Wi-Fi
survives reboot, and sensor sampling continues during setup.

## Phase 3 — VPS and device enrollment

Pilot source prepared: verified TLS broker/ACL overlay, sensor-only worker, and
operator enrollment of fixed code digests for a specified farm. VPS stack is deployed with PostgreSQL migration 0017 and trusted dashboard HTTPS.
Public MQTT 8883 remains blocked pending an Azure inbound rule; farm/device
enrollment is pending owner details and the existing pairing code. Unowned factory inventory/ownership transfer are later work.

- Obtain server access and inspect the existing deployment before changing it.
  Record Compose services, database state, application revision, DNS/TLS,
  and Azure/host firewall settings.
- Configure authenticated MQTT with verified TLS and per-device topic access.
  Give the ingestion service separate credentials. Commission a physical-device
  ingestion path; the simulator-only worker's production guard must not simply be bypassed.
- Add an enrollment inventory mapping a permanent device ID to a securely stored
  fixed-code verifier and enrollment state. Store codes with an appropriate
  secret-verification scheme; use a server-held secret if a lookup digest is needed.
- Enroll the Phase 1 device through a controlled operator action. Do not create
  farm ownership merely because someone publishes a device ID over MQTT.
- Reconcile the inventory with the existing farm-bound `device_registry`:
  currently it assigns a device directly to a farm. New claims need an eligible
  unowned state and an atomic transition into the existing routing/ownership model.
- Preserve current operator-provisioned devices and enforce global code/device
  uniqueness. Plan migrations, rollback, and controlled credential recovery.

Exit: a device is enrolled with unique credentials and a recognized code;
the broker rejects unauthorized topics. No sensor data is routed to an arbitrary farm.

## Phase 4 — dashboard pairing using the fixed code

Pilot implemented: farm-scoped code resolution and code-entry forms. Server
enrollment and migration 0017 must be applied before live pairing.

- A signed-in user chooses Add incubator and enters the printed code.
- That code is the only device-linking identifier required from the user.
  Resolve the internal device ID and its cloud assignment on the backend.
- Backend validates the code, eligibility, and account scope with bounded guessing
  limits. Claim ownership and create/assign the chamber atomically.
- Handle invalid codes and concurrent claims. Repeating the same successful
  request must not create a second chamber.
- Once owned, the same code cannot give another farm ownership. Removing a
  chamber or changing Wi-Fi must not silently release the device for takeover.
- Keep ownership transfer/decommissioning as controlled operator actions with
  explicit authorization. A fixed code alone is insufficient for a transfer.
- Show separate states: linked to farm, waiting for telemetry, online, and offline.
  Completing pairing does not mean that telemetry has arrived.

Exit: correct code links one device to one farm; wrong codes fail; another farm
and concurrent claims cannot take over or duplicate the device.

## Phase 5 — real DHT22 telemetry on the dashboard

Source implemented in the main firmware: fresh 15-second uploads, UTC/boot/sequence
identity, server-side chamber resolution, and receipts after database commit.
Compilation and deployed end-to-end acceptance are separate gates.

- Connect firmware to the commissioned broker using its individual credentials
  and verified certificate hostname. Synchronize time before sending timestamps.
- Embed the pilot VPS/broker configuration in a private `CloudConfig.h`. Keep
  server settings out of the setup portal and dashboard pairing form. Resolve
  chamber assignment through an authenticated server response; do not hardcode
  a farm/chamber in a generic sketch or use the pairing code as broker authentication.
- Publish the actual temperature/humidity readings with permanent identity,
  boot identity, advancing sequence, and observed time. No water-level field is required.
- Retain sensor-error indication and keep network retries independent of sampling.
- Confirm the device's assigned chamber/farm, database persistence, and fresh
  live readings. Check Celsius/Fahrenheit display conversion.
- Add a server receipt contract acknowledging durable database storage, scoped
  to the authenticated device and sample identity. MQTT publish success alone
  is not a database receipt.
- Keep actuator commands disabled during this sensor integration phase. The
  connectivity checker uses placeholder battery/power values; qualify or clearly
  mark those fields before treating them as measured hardware status.

Exit: actual readings reach the correct farm/chamber, persist, and appear live;
sensor errors and stale/offline conditions are visible without invented values.

## Phase 6 — reconnect and setup recovery

- Wi-Fi loss: try reconnecting for 30 seconds, then open the protected AP.
- Wi-Fi connected but no durable upload confirmations for 15 minutes: open AP
  while continuing bounded reconnect/upload attempts.
- Define the no-success-yet timer and reboot behavior explicitly. Treat Wi-Fi,
  broker connectivity, and server-confirmed uploads as separate states.
- Preserve identity, code, ownership, and previous working credentials.
- Close AP after recovery with a bounded grace period; do not wait for the full
  backlog to drain. Confirm the physical setup fallback on the actual board.

Exit: short outages avoid unnecessary AP setup; prolonged outages expose setup;
failed replacement Wi-Fi preserves the old configuration; reboot preserves pairing.

## Phase 7 — displays and persistent offline readings

October 18 update: the environmental flash queue, committed historical replay,
recording-status dashboard and OLED queue indicator are installed. See the
[implementation guide](../../docs/guide/esp32-offline-storage-implementation.md)
for current scope, activation evidence and limits. RTC qualification, full
actuator event persistence and physical acceptance remain deferred. The text
below records the earlier Phase 7 baseline.

Deferred: current temperature/humidity work targets the server dashboard only.
The main loop contains a future display hook; follow
[display integration](display-integration.md) when hardware details are available.

October 12 wiring context is recorded in [hardware-pin-map.md](hardware-pin-map.md).
Keep DHT22 DATA on GPIO4. The existing time module uses SDA GPIO21 / SCL GPIO23;
plan both I²C displays on that shared bus after confirming their models,
addresses and voltage levels. Do not rely on the default GPIO22 SCL assignment.
The revised LED light plan uses four-channel relay board B IN2, with GPIO26 proposed and
unconfirmed. Its relay polarity, ratings and safe startup state must be known
before enabling it. This is a future addition, not existing actuator support.

- Confirm OLED/LCD models, I²C addresses, pins, and DS3231 RTC wiring.
- OLED shows setup/code, connection status, and queued readings; LCD shows real
  temperature/humidity or explicit sensor-error/stale state.
- Define flash capacity, queue format, timestamp validity, overflow policy, and
  flash-write budget before adding persistent logging.
- Store readings with original timestamps and stable identifiers during outages.
- Upload bounded batches; remove only durably acknowledged records. Deduplicate
  retries end to end, including interrupted uploads and server/device restarts.
- Show storage-full/data-loss conditions and invalid clock state explicitly.

Exit: power loss does not corrupt queue/configuration; backlog appears once with
original times after recovery; display states match actual device conditions.

## Phase 8 — integrated bench acceptance

Record firmware/server revisions, wiring, configuration, and observations for:

- cold start, reflash preserving configuration, and repeated power cycles;
- sensor disconnection/recovery and comparison with a reference sensor;
- correct/incorrect Wi-Fi, replacement-network failure/success, router outage;
- VPS/broker outages, TLS/credential rejection, device/farm isolation;
- wrong code, duplicate pairing, competing farms, and continued fixed-code identity;
- queue capacity, clock loss, repeated batch upload, and interrupted writes.

Exit: group records the evidence and outstanding issues before moving to heater,
fan, mist, turning control, and full local safety qualification. Sensor integration
does not qualify those actuator functions.

## Immediate implementation batch

### October 12 revised actuator hardware

The current user allocation supersedes the original one-board relay diagram:
5 V two-channel board A for heater/mist; 5 V four-channel board B for DC tray
rotation/12 V light; two MOSFET modules for the fans. Follow
[actuator-integration-guide.md](actuator-integration-guide.md) for the proposed
pin/channel map, missing hardware details, local fault behavior and later phase
order. GPIO25 for the tray and GPIO26 for the light are proposals, not confirmed
physical connections. No relay/MOSFET output is enabled in the current sketch.

Implement Phases 1–2 locally first. VPS discovery can proceed alongside them when
access is available. Do not deploy server changes or flash the board as part of
this planning task. Continue through the later gates using the evidence above.

References: [approved scope](provisioning-plan.md), [bring-up guide](bringup-guide.md),
[operator registry](../../docs/guide/device-provisioning-guide.md),
[MQTT contract](../../docs/guide/b4-mqtt-contract.md),
[firmware safety](../../docs/guide/firmware-safety-contract.md).
