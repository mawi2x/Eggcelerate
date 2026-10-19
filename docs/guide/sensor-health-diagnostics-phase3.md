# Sensor-health diagnostics phase 3

Firmware `climate-sensor-diagnostics-v5`, installed 19 October 2026 around 20:18
Asia/Manila. Includes phase 1 sensor recovery and phase 2 fault ventilation.
VPS API/worker parser update deployed with rollback images/module/wrapper/database
backup. Application-only flash hash verified; NVS/LittleFS preserved. Previous
installed application privately backed up before writing. Installation evidence:
`output/releases/sensor-diagnostics-v5-20261019/installation.json`.

Postflight: v5 sensor valid, fault 0, all outputs off, mode Chicken/phase stopped;
17 successful readings and no failures at uptime 44 seconds. Six v5 reports saved
in PostgreSQL; journal v2 available, 21 written, no drops/write failures, one
expected version-transition rotation. Temperature 33.1°C, humidity 77.7% RH.
This is a stopped-state boot/upload check; the empty-chamber regulation trial
has **not started**.

## What is recorded

Every existing sample/control/fault journal event now includes:

- Successful and failed acquisition totals, consecutive failures, consecutive good
  readings, and whether regulation is in the brief recovery hold.
- Stream recovery count (two consecutive valid acquisitions following any failed
  attempt). This count also advances while idle or fault-latched: recovered data
  does not imply a reset fault or permission to heat.
- Last valid temperature/humidity and their current age. Unknown values are null
  in cloud reports/decoded output, never invented temperature/humidity readings.
- Most recent failed-acquisition and stream-recovery timestamps.
- Most recent observed transition into a nonzero fault, plus ESP reset reason.
- Existing actuator states, PWM requests, output reasons, mode, phase, measured
  temperature/humidity and rate estimates in the same event record.

Timestamps ending `_ms` are unsigned 32-bit milliseconds since boot. `fault_at_ms`
is when the control loop observed the fault, including a stored fault at startup;
it cannot recover the original pre-restart fault time. Zero means unknown/unset.
Failure/recovery counters distinguish an unset timestamp from an event at boot.
The journal's 64-bit monotonic time and UTC anchor allow decoder reconstruction
of event UTC within the current 32-bit wrap interval. Events older than a full
millis wrap cannot be uniquely dated from the 32-bit event fields alone.
Reset reason is ESP-IDF's numeric `esp_reset_reason()` value.

Invalid DHT library results do not identify checksum, power or wiring causes.
Correlating failures with relay/fan transitions supports investigation but does
not prove electrical interference. Journal capture remains after applied-output
processing; it describes the requested/applied software state, not measured GPIO
waveform, RPM, relay contact state or heater current.

## Storage and compatibility

- Binary journal **version 2, 156 bytes**, same CRC32 and existing bounded queue.
  Two 64 KiB files hold at most about 840 records total. Retention depends on
  sample and actuator event rate; this is not a 24-hour archive.
- A different-version current file is rotated into previous before v2 append.
  Normal rotation can evict the older previous file; export before upgrading if
  both existing files must be retained. No autoformat or environmental queue change.
- Serial dump supports v1 (112-byte) and v2 (156-byte) records. The local decoder
  accepts either version, including mixed inputs, CRC errors and partial tails.
- `CONTROL` and `climate status` include health counters. Cloud diagnostics include
  optional `sensor` health, and journal status reports version 2.
- Backend parser accepts old reports and v1/v2 journal statuses. The updated `database/climate_control.py` was deployed to both VPS API and
  telemetry worker before installing v5. An older strict parser rejects the new
  fields; do not roll back the parser alone while v5 remains installed. No migration
  is needed: diagnostic history already stores report JSON.
- Cloud payload, nested diagnostics and MQTT buffers are increased to 4096, 1536
  and 4608 bytes respectively. Enlarged networking buffers and storage batches
  use owner-task static storage to avoid the previous loopTask stack issue.

## Checks and release

Checks cover counters, stream recovery while faulted, null last-good data,
rollover, small/max-size report buffers, journal version migration, legacy Serial
export, partial-tail rotation, CRC, mixed-version decoder input and actual C++
JSON accepted by the API. Existing recovery, ventilation and 21 adaptive control
scenarios are retained. Seven decoder tests and ten API schema tests pass.

Arduino build: NodeMCU-32S, ESP32 core 3.3.11, 1,223,700 bytes flash (93%),
72,388 bytes static RAM (22%). Release artifacts/source hashes and check results
are in `output/firmware/sensor-diagnostics-v5-local-20261019/build-manifest.json`.
No physical sensor-loss, electrical-noise, power-loss or incubation trial has been
performed for v5. Firmware behavior still needs an empty-chamber trial.

## Next trial

1. Back up the running VPS module/images and retained diagnostic logs; deploy the
   optional API/worker parser update and confirm old firmware uploads still work.
2. With the chamber empty and regulation stopped, install v5 without erasing NVS
   or LittleFS. Confirm its marker, valid readings, fault state and health reports.
3. Clear a fault only after its cause has been addressed and reset checks pass.
4. Select Chicken and record an uninterrupted 2–4 hour empty-chamber run. Monitor
   local health/journal losses, sensor failures, faults and heater cycling. Export
   local diagnostics promptly because event retention is short.
5. Evaluate temperature and humidity together using actual actuator history.
   Moisture removal, intake conditions and physical sensor failure causes remain
   unconfirmed; use those observations for the temperature/humidity tuning phases.
