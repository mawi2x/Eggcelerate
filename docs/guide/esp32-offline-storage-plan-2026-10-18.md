# ESP32 offline reading storage and recovery plan

Date: October 18, 2026. Status: first release implemented, deployed and active.
Physical power-loss/endurance and actuator qualification remain deferred. See the
[implementation and activation guide](./esp32-offline-storage-implementation.md)
for current behavior, verification, and remaining device activation steps.

## Goal and scope

Keep collecting temperature and humidity when Wi-Fi, MQTT, or the VPS is
unavailable, retain committed records across restarts, and upload them after
reconnection. Existing local incubation control must continue independently.

First release: environmental readings, sensor validity, storage health, and
recovery status. Detailed actuator transition recording is a subsequent phase;
15-second readings alone cannot explain every short heater, mist, or fan event.
This completes the remaining storage/replay part of the existing
[provisioning plan](../../apps/firmware/provisioning-plan.md) and firmware
[Phase 7](../../apps/firmware/phase-plan.md).

## Baseline before implementation and integration points

| Area | Baseline behavior | Required change |
| --- | --- | --- |
| Firmware `EggcelerateFirmware.h`, `serviceCloud()` | Returns when Wi-Fi is unavailable; cloud boot identity depends on a usable clock. No durable reading queue. | Capture independently of cloud service and initialize storage/session identity before NTP. |
| Firmware `receiveCloudReceipt()` | Receipt handling depends on `cloudLastSent`; receipts also carry live commands/settings. | Dispatch a distinct backlog receipt before the live-reading guard. |
| Firmware `ClimateRuntime.h` | Local control and serial diagnostics exist. | Keep flash operations and replay outside the control task. |
| API `mqtt/telemetry.py`, `ingest_telemetry()` | Raw samples can arrive out of time order, but ingestion also handles live reports and current state. | Add a dedicated historical ingestion handler with no live-control side effects. |
| API `database/readings.py`, `ingest_sample()` | Same device/timestamp/content is idempotent; different values at the same timestamp conflict. | Preserve this contract; add durable replay identities and conflict handling. |
| API `mqtt/worker.py` | Publishes live database receipts after transaction commit. | Apply the same commit-before-receipt rule to separate backlog batches. |
| Broker `infrastructure/mqtt-hardware/acl` | Device writes its telemetry topic and reads its receipt topic. | Initially reuse these authorized topics with explicitly different message types. |

Paths above are relative to `apps/firmware/Eggcelerate/` or
`apps/api/src/eggcelerate_api/`, as indicated. The
[reading storage contract](./readings-storage-contract.md) remains applicable.

## Proposed defaults

| Setting | Initial plan |
| --- | --- |
| Capture interval | Every 15 seconds, whether connected or disconnected; independent of live reporting interval. |
| Local storage | Dedicated bounded append journal using LittleFS in the existing data partition, subject to confirming the flashed layout and existing contents. |
| Retention target | At least 48 hours under normal recording, within a proposed 1 MiB total queue budget. |
| Record budget | Aim for a versioned 64-byte stored record. 48 hours requires 11,520 records, or 720 KiB before filesystem/journal overhead. Recalculate against the actual implementation. |
| Flush policy | Every 60 seconds or four records, whichever comes first; expose pending RAM records. Only flushed records are intended to survive power loss. |
| Replay | One batch in flight; up to eight records and a strict serialized byte limit per batch; initially at most one batch per second. Live traffic has priority. |
| Full storage | Evict the oldest eligible retained segment, preserve recent data, and report the lost record count/range. Never hide overflow. |

The installed NodeMCU-32S default partition table provides a `0x160000`-byte data
region (about 1.375 MiB); **the board's flashed layout and available space have
not been established**. The 48-hour target is a sizing proposal, not a measured
capacity guarantee. Preserve both application slots, credentials, and run state.
Do not automatically format on mount failure or repartition the board.

With the proposed flush interval, a sudden power cut can lose roughly the most
recent minute still in RAM under normal operation. Writer stalls can extend
that window and must be visible. Wi-Fi loss alone does not discard those records.

## Phase 1 — define identities, timestamps, and ownership

1. Assign each stored record an immutable device/queue-generation/sequence ID.
   Persist sequence allocation safely so reboot, truncation, or queue eviction
   cannot reuse an ID for different data. Keep this separate from live command
   sequence numbers and the current cloud boot ID.
2. Create a random capture-session identity immediately at boot. Record a
   64-bit monotonic sample time, sensor validity/age, and temperature/humidity.
   Invalid measurements become explicit invalid records, never repeated values
   presented as new valid samples.
3. Store UTC time quality and a clock anchor. If NTP becomes available later in
   the same boot, derive historical UTC from that boot's monotonic anchor.
   Freeze the normalized timestamp before publishing and reuse it on retries.
4. After a cold boot without reliable UTC, retain untimed records separately.
   Do not invent timestamps across power-off intervals or plot them at upload
   time. A battery-backed RTC can be a later option after its presence and
   firmware integration are confirmed; it is not assumed here.
5. Define a server-issued assignment generation for farm/device ownership.
   Persist it while online and attach it to captures. The server resolves it
   through trusted assignment history. Unknown or changed ownership goes to
   quarantine instead of importing an old owner's readings into the current farm.
6. Define canonical capture values/timestamps shared by live and historical
   uploads when they refer to the same reading. Preserve exact duplicate
   behavior; quarantine different content at an existing timestamp.

Deliverable: versioned record, batch, receipt, ownership, and error contracts.

## Phase 2 — implement bounded device storage

1. Inspect the actual partition layout and existing filesystem usage before
   enabling storage. If initialization is needed, prepare an explicit data
   preservation/provisioning step; mount errors must never trigger auto-erasure.
2. Use a bounded RAM handoff to a lower-priority flash writer. No filesystem,
   network, or retry waits in the climate control task. Avoid per-reading NVS
   writes; retain existing NVS identities, Wi-Fi configuration, and run state.
3. Append versioned records with checksums to bounded segments. Recover complete
   records after reboot, reject incomplete tails, and report corruption. Journal
   acknowledgement cursors before reclaiming acknowledged segments. Interrupted
   cleanup may cause duplicate replay, which the server must safely accept.
4. Capture before attempting transmission. Spool even while online: a successful
   socket publish does not establish that PostgreSQL committed the sample.
5. Bound queue bytes, RAM records, segment count, and recovery work. Keep at most
   one batch in flight. On overflow, durably record eviction of the oldest
   segment and cancel its batch if necessary. Ignore its later receipt by batch
   digest, preserving newer data without blocking control.
6. On storage failure, continue local regulation and live communication where
   possible. Expose “local recording unavailable” with the reason. Do not reset
   the device or claim history was saved.

Deliverable: persistent capture queue with visible loss/error accounting.

## Phase 3 — add VPS historical ingestion and committed receipts

1. Add an explicit `offline_batch` envelope on the existing telemetry topic.
   Dispatch it before normal live payload validation. Keep legacy live telemetry
   compatible; do not send backlog through the live ingestion function.
2. Validate authenticated device identity, assignment generation, payload size,
   record schema, timestamp quality, and sensor values. Reject unauthorized farm
   routing supplied by the device.
3. Add a database migration for replay deduplication, assignment history as
   needed, and backlog diagnostics. Reserve the next migration number at
   implementation time; do not change the existing readings primary key merely
   to add replay IDs.
4. In one transaction, record durable replay identities and insert valid raw
   historical samples. Exact retries are successful no-ops; conflicting IDs or
   sample content must produce explicit errors. Keep unresolved/time-unknown
   records outside normal timestamped charts.
5. Publish a distinct `offline_receipt` only after the transaction commits.
   Include queue generation, batch identity/digest, and the exact accepted record
   range. Database failure means no success receipt. Lost receipts cause safe
   retransmission and another receipt after deduplication.
6. Define per-record quarantine/rejection outcomes so one malformed record cannot
   block the queue forever. Preserve rejected content and a reason before any
   device deletion; never acknowledge uncommitted or silently discarded samples.
7. Historical ingestion must not advance live freshness, apply climate/tray
   commands, acknowledge actuator requests, satisfy preparation stability, or
   generate present-tense climate alerts from old measurements.

Deliverable: durable, idempotent historical ingestion isolated from live control.

## Phase 4 — reconnect and drain safely

1. Resume current telemetry first, then drain retained history in the background.
   Cloud recovery must not delay sensor acquisition or actuator control.
2. Use a maximum of eight records per batch, shrinking to fit the measured
   serialized byte budget. Current MQTT buffer is 2,304 bytes; firmware payload
   storage is also bounded. Reserve topic/header space and check every publish.
3. Keep a batch identity stable across retries. Use acknowledgement timeouts and
   bounded exponential backoff with jitter. Application receipts provide durable
   delivery confirmation; MQTT delivery alone is insufficient.
4. Validate receipt device/session/generation/digest before advancing the queue.
   Ignore old, mismatched, or malformed receipts. Backlog receipts must never
   enter the live command parser or reset live-reading health timers.
5. Stop replay cleanly when disconnected, retain unacknowledged data, and resume
   after reconnection or restart. AP setup remains usable while data is queued.

Deliverable: automatic recovery without manual CSV export or duplicate history.

## Phase 5 — show recording and recovery status

- Show current connectivity separately from local recording and pending uploads.
- Report queued count/bytes, oldest record age when known, pending RAM count,
  last committed backlog receipt, untimed/quarantined records, and loss counters.
- Label delayed readings in history using original observation time, with upload
  time available separately. Backfilled data must not make a stale device green.
- Explain storage failure/full-buffer loss plainly. Never imply unlimited storage
  or continuous recording while the ESP32 has no power.

Detailed actuator events follow this release: retain heater/mist states, upper
and lower fan commanded duty, fault/Stop/restart transitions, and effective
targets. Revisit storage capacity and critical-event flush behavior at that point.

## Future verification and rollout

These are acceptance steps for implementation, **not tests run or requested by
this planning change**. Physical validation remains deferred as requested.

| Scenario | Required outcome |
| --- | --- |
| Wi-Fi loss / broker loss / VPS database failure | Capture continues; local control remains independent; no false committed receipt. |
| Reconnection with a large backlog | Current data arrives first; bounded replay fills historical gaps without changing live control. |
| Duplicate delivery or lost receipt | One historical reading; repeated safe receipt; no premature queue deletion. |
| Restart / interrupted write / interrupted cleanup | Committed intact records recover; partial data is reported; no reused IDs. |
| Boot offline without UTC / clock correction / long uptime | Honest time quality, stable timestamps after normalization, no fabricated dates or timer-wrap errors. |
| Full or damaged filesystem | Bounded memory/storage, visible loss counters, continued regulation, no automatic format. |
| Invalid or stale DHT22 sample | Explicit invalid status; no fabricated valid temperature or humidity. |
| Changed device ownership | Old records cannot cross farm boundaries. |
| Stop/fault during replay | Existing fail-safe output behavior takes priority; backlog cannot execute commands. |

Implement server support first, then opt-in firmware, then dashboard indicators.
Back up the database and firmware/configuration before rollout. Confirm image
size fits the existing application slot. Deploy to one device before wider use;
do not erase flash as an upload shortcut. Keep new schemas backward compatible
so disabling replay leaves live telemetry and climate control functional.

### Suggested first implementation task

Define the batch/receipt contracts, clock/ownership rules, and database replay
journal first. Then implement firmware storage against those contracts. This
avoids creating a device queue that the deployed server cannot safely accept.
