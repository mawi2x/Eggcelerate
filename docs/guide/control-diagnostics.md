# Climate diagnostic logging

Historical logging step: implemented locally on 19 October 2026. The subsequent
[adaptive Chicken revision](adaptive-climate-control.md) supersedes the firmware
marker and trend semantics described here. Not deployed to the VPS or flashed
on the ESP32. This step adds observations; climate decisions, targets, PWM settings,
relay timing and safety thresholds remain unchanged. Adaptive control is a later step.
Firmware marker: `climate-pwm-diagnostics-v1`.

## Recorded data

- Every sampled sensor update and each final control-loop output/state change,
  including intermediate exhaust ramp steps, mode/phase, fault and demand changes.
- Raw temperature/RH (also the values used for control; no filtering was added).
- Two-sample temperature and humidity slopes, in units per minute. These are
  diagnostic differences, not a smoothed trend estimator or control input. Slopes
  are invalid after an invalid sample, a stale interval, or before two valid samples.
- Heater, mist, circulation and exhaust commands; requested/applied exhaust duty;
  humidity/temperature/idle/fault reason; demand latches and vent state.
- Time since heater/mist transition and vent phase start; sample number/age,
  control sequence, 64-bit event/sample monotonic times, random boot session,
  UTC when available, queue-drop count, format version and CRC32.

An event is captured after the loop applies its outputs. It is a software command
snapshot, not an oscilloscope timestamp or proof of relay/fan operation. Commands
processed within the same loop can be coalesced; it is not an individual-command
or GPIO-edge journal. Sequence gaps expose missing queued records, not every
possible physical failure.

## Local persistence and resource bounds

The control task uses a zero-wait 32-record RAM queue (112 bytes per record).
The existing storage task owns all filesystem operations and drains up to 16
records per second. The producer never waits for flash, networking or serial I/O. Readable `CONTROL`
Serial lines are emitted asynchronously by storage task (normally about a second
later); their `ms` field remains the captured event time. If storage is unavailable,
those lines also stop, and loss/availability counters identify the missing capture.
The journal uses `/egg-diagnostics/current.bin` and `previous.bin`, each capped
at 64 KiB (128 KiB total, at most 1,170 complete records). Retention duration
varies with sample/output activity; it is not a guaranteed multi-hour archive.
Rotation discards the oldest file; `rotations` reports that retention activity.

A 64 KiB free-space reserve protects filesystem headroom. Diagnostic failures do
not format storage, delete environmental readings, stop regulation, or change
actuator commands. The existing environmental offline queue and ACK/replay protocol
are unchanged. Diagnostic journal writes require the existing storage to be ready;
there is no automatic initialization. If unavailable, the queue eventually fills
and drops events; losses are explicit rather than blocking regulation.

Events wait in RAM until the next drain/flush, normally about one second. Power
loss may lose unflushed events or leave a partial tail. On recovery the writer
rotates a partial tail rather than appending after it. CRC decoding detects damaged
records. A completed File.flush is used; physical power-loss durability and flash
wear have not been characterized. Diagnostic files survive ordinary restarts but
are bounded rotating evidence, not an exactly-once archive. All status counters
reset per boot; session IDs distinguish saved records from different boots.

UTC may be unknown before synchronization. Later records in the same boot allow
the decoder to infer a UTC anchor. If no timed record survives from that boot,
UTC remains null; timestamps are not fabricated from another boot's clock.

## Cloud compatibility and deployment order

An optional `climate_test.diagnostics` object adds current slopes, latches, timers
and journal health to regular reports. Existing JSONB climate report history stores
this object without a database migration. It does not upload the complete local
journal or remove the one-second MQTT reporting limit. Old firmware remains accepted
by the new backend because the field is optional.

Before a later firmware installation, update **both API and MQTT telemetry worker**
to accept the new nested schema. The older strict validator rejects unknown report
fields and would reject the new report. VPS deployment and flashing have not been
performed as part of this local step. Keep the old firmware image and configuration
for rollback; changing the backend alone does not change regulation.

The cloud payload buffer is 3,072 bytes and MQTT buffer 3,584 bytes. Serialization
is bounded; diagnostic serialization refuses truncation rather than sending invalid
JSON. Fan status tiles remain On/Off as requested; diagnostics do not change UI copy.

## Retrieving a bounded capture later

This board has previously reset when opening Serial. Do not open it during an
incubation run just to inspect diagnostics. Arrange retrieval during an intentional
maintenance window. Serial commands themselves do not command actuators:

- `diagnostics status` prints availability, records written, dropped records,
  write failures and rotations, all for the current boot.
- `diagnostics dump` streams CRC-protected `DIAG <hex>` records from previous then
  current journal, one per storage iteration, followed by `DIAG END`.

Save Serial output as a text file and decode it offline:

```sh
python3 apps/firmware/scripts/decode-control-diagnostics.py capture.txt > capture.jsonl
```

If files were retrieved through separate maintenance tooling, decode them directly:

```sh
python3 apps/firmware/scripts/decode-control-diagnostics.py previous.bin current.bin > capture.jsonl
```

The decoder never opens a serial port. It validates length/version/CRC, removes
repeated session/sequence pairs and identifies sequence gaps. It preserves unknown
UTC as null and reports invalid records to stderr with a nonzero exit code, while
still emitting valid records. Dumps are best-effort while recording continues:
rotation can affect retained files during export; this is not a frozen snapshot.
No erase or format command is introduced.

## Interpretation for the adaptive-control work

Use one selected mode and the same chamber arrangement for baseline comparisons.
Read control events by event monotonic time, not by the sensor observation time.
Examine heating coast-up, cooling coast-down, complete humidity vent/rest periods,
and boost/ramp time relative to useful fan-on time. Compare against raw readings,
not only smoothed chart averages. Reference temperature/RH and incoming-air moisture
remain separate physical measurements; the firmware cannot infer them.

The reservoir was clarified to be closed. This implementation does not assume
exposed water or change reservoir hardware.

## Checks and outstanding verification

NodeMCU-32S / ESP32 core 3.3.11 compilation passed: 1,216,860 bytes flash
(92%) and 61,540 bytes static RAM (18%). Targeted Ruff and Mypy checks passed.
Source and binary hashes are recorded in
`output/audits/control-diagnostics-build-20261019.json`. Automated tests and device/flash persistence tests were not
run. Before release, verify sensor/state capture, startup allocation, queue overflow,
partial writes/rotation, reboot decoding, export during rotation, report acceptance,
control-task timing and sustained offline environmental recording on the device.
These checks remain outstanding; source implementation alone does not establish
physical durability, timing isolation, or successful target regulation.
