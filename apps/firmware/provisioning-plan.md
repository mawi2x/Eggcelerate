# ESP32 connection, pairing, and offline recovery plan

Approved by the user on October 3, 2026. Status: **approved scope; implementation
and hardware verification pending**. The capstone research group owns delivery.
Physical integration belongs to M8, with API/web support and M7 Azure VPS
hosting, broker security, and operational preparation.

This supersedes the undecided Wi-Fi transport, LED-flashed/temporary pairing code,
and immediate AP activation on every disconnect. Selected transport: **AP plus
browser portal**. Bluetooth provisioning is outside this approved scope.

## Approved behavior

### Device identity and pairing

- Permanent internal device ID, separate stable and changeable setup/pairing code
  per incubator. Display the code on the OLED for entry by a signed-in dashboard user.
- Treat the code as an authorization secret. Rate-limit guesses and associate an
  eligible unowned device with a farm atomically. Knowing its code must not allow
  takeover of an already-owned device; transfers require explicit authorization.
- Allow the authorized owner to change the code through the dashboard. Show
  **Pending device update** until device confirmation. Specify coordinated code
  activation so the server and device cannot silently disagree after outages/reboot.
- Preserve ownership through Wi-Fi changes, restarts, and network outages.
- Authenticate devices separately with unique credentials and verified TLS.
  A public device ID or human-entered code does not replace device authentication.
  Integrate claims with the existing operator registry and farm isolation.

### Wi-Fi setup and recovery

- Open a protected setup AP/local browser portal on first boot without saved
  credentials, or through a deliberate physical setup action.
- After Wi-Fi loss, reconnect for **30 seconds**, then open AP if still disconnected.
- With Wi-Fi connected but uploads unconfirmed for **15 minutes**, open AP.
  Measure since the last server-confirmed upload, or since upload attempts begin
  if none has succeeded. Specify timer/reboot behavior before implementation.
- Distinguish Wi-Fi disconnected, server/upload unavailable, and confirmed online
  states. One failed upload does not prove internet loss. Do not introduce an
  immediate no-internet trigger without defining how that condition is established.
- Continue bounded reconnection attempts, local control, display updates, and
  offline recording while AP is active.
- Protect AP with a unique per-device password; keep Wi-Fi passwords off the cloud
  dashboard. Supply a manual portal address if automatic opening fails.
- Preserve old credentials until the replacement connection is validated.
- Close AP after connection recovery, with a short grace period for active setup.
  Specify bounded idle setup sessions, retry backoff, grace, and reopening behavior.
- Provide a physical setup fallback; button/pin and hold duration remain undecided.
  Wi-Fi setup must not implicitly factory-reset or unpair the device.

The 30-second and 15-minute thresholds are approved starting settings; adjust
after recorded hardware testing. Setup must not interrupt local incubation control.

### Displays

- **Square OLED:** incubation condition, water/sensor warnings, connection state,
  queued-reading count, and setup/pairing instructions including the code.
- **16×2 I²C LCD:** current temperature and humidity, with explicit unavailable/
  sensor-error indication. Do not present stale or invalid values as current readings.
- LED patterns may supplement status; they are not the code-entry method.
  Exact display models, layout/rotation, and LED patterns require specification.

### Offline readings and backlog upload

- Continue sampling during outages; save original measurement timestamps and
  unique sample identifiers in a bounded, persistent ESP32 flash queue.
- Queue survives normal restarts. Confirm flash capacity, partition/storage method,
  retention duration, and overflow policy; show queue-full/data-loss conditions.
- Configure and verify the reported DS3231 RTC; define synchronization, invalid
  clock handling, and sensor-error records.
- Upload in bounded batches after recovery. Remove records only after server
  confirmation of durable receipt. Deduplicate retries end to end; broker/transport
  acknowledgments alone do not establish database persistence.
- Choose storage suitable for repeated logging, manage flash wear, and test power
  interruption during recording, uploading, and queue removal.

## Intended recovery sequence

Local control continues → reconnect automatically → open protected AP when a
threshold is reached → configure replacement Wi-Fi if needed → confirm server
connection → upload saved readings in batches. Close AP after recovery and any
active-session grace; a large backlog must not keep setup open indefinitely.

## Implementation and verification tasks

- [ ] Confirm firmware source/tooling, board/flash/display variants, full inventory,
      wiring, and physical setup action against the prototype schematic.
- [ ] Specify code format/secret handling, coordinated code changes, claim/transfer
      rules, and device enrollment/credential recovery.
- [ ] Implement protected AP/portal, saved configuration, recovery timers, physical
      setup fallback, display behavior, and continuous local control.
- [ ] Implement durable queue, RTC/clock validation, overflow policy, batch ingestion
      receipts, end-to-end deduplication, and interrupted-write recovery.
- [ ] Implement dashboard entry/change/pending states and atomic isolated claims,
      reconciling the existing registry and assignment rules.
- [ ] Verify wrong/correct credentials, interruptions shorter than 30 seconds,
      prolonged disconnection, 15-minute upload failures, server outage,
      replacement-network failure/success, and AP closure without blocking control.
- [ ] Verify guessing limits, conflicting/concurrent claims, code-change outages/
      reboot, ownership transfer, TLS, and per-device broker ACLs.
- [ ] Verify offline sampling/displays, clock failure, reboot/power loss, full
      storage, backlog retries, duplicates, and original-time preservation in
      backend storage and chart/export paths.

## Existing boundaries and references

This plan is not implemented by the current operator registry/onboarding UI.
The simulator worker still refuses production. Firmware source availability,
hardware commissioning, and physical safety qualification remain pending.

- [Device provisioning](../../docs/guide/device-provisioning-guide.md)
- [MQTT contract](../../docs/guide/b4-mqtt-contract.md)
- [Provisional firmware safety contract](../../docs/guide/firmware-safety-contract.md)
- [Prototype schematic](hardware/README.md)
- [Espressif provisioning](https://docs.espressif.com/projects/esp-idf/en/v5.2/esp32/api-reference/provisioning/provisioning.html)
- [Espressif AP/STA example](https://github.com/espressif/esp-idf/blob/master/examples/wifi/softap_sta/README.md)
- [Espressif storage guidance](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/storage/nvs_flash.html)
