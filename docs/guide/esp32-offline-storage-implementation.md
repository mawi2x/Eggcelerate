# ESP32 offline storage implementation

Implementation date: October 18, 2026. This guide accompanies the
[approved plan](./esp32-offline-storage-plan-2026-10-18.md).

## Activation status

Installed on the ESP32 and VPS. The controller reports local recording `ready`,
connected Wi-Fi and committed database receipts. The saved queue drained to zero
on reconnection; continuing readings are arriving. The controller and cycle remain
stopped, with heater/mist/upper fan/exhaust/tray off. No incubation was started.

The actual 4 MiB flash was backed up and verified against the chip. The installed
partition table matches the compiled default layout. The existing data filesystem
was listed as empty before initialization; the queue was created without formatting
it. Wi-Fi/run configuration was preserved. The user then configured home Wi-Fi
through the setup portal.

Initial captures preceded the first server assignment generation: **26 records
were retained as `quarantined_assignment`**, not silently imported into charts.
New assigned captures were imported successfully. All **561 original VPS readings**
remain. Serial connection resets also demonstrated recovery of committed records;
this does not replace a physical power-cut/endurance qualification. Thermal
behavior, sensor calibration and physical actuator checks remain deferred.

## What is implemented

- `apps/firmware/Eggcelerate/OfflineStorage.h`: independent lower-priority
  storage task; 15-second environmental capture; four-record/60-second flush;
  versioned 64-byte records with CRC32; 96 segments of up to 124 records.
- Alternating checksummed metadata, block-reserved sequence IDs, immutable queue
  generation, a random boot session, durable acknowledgement cursor, and restart
  scanning. A normal full queue holds up to 11,904 records (49 hours 36 minutes
  at 15 seconds). Partially filled segments, repeated restarts, filesystem space,
  and storage errors can reduce that retention. This is not measured endurance.
- Separate GPIO/control and recording tasks. Storage errors disable recording,
  not climate regulation. Existing actuator pins and control policies are retained.
- UTC milliseconds refer to the actual sensor observation. Live and queued
  captures share the same boot anchor and timestamp calculation. Invalid/stale
  captures carry explicit invalid status and no fabricated temperature/humidity.
- A boot without NTP can collect untimed records. A later anchor in that same
  boot is persisted in its segment headers before replay. Records from a previous
  boot with no saved anchor remain untimed and are held for review on the server.
  The RTC is not assumed operational.
- `apps/api/src/eggcelerate_api/mqtt/offline.py`: dedicated batch validation,
  historical insertion, ownership generations, duplicate handling, and durable
  quarantine. Migration **0025** adds assignment, replay, conflict, and status
  tables. The existing raw-reading primary key is unchanged.
- Worker dispatch separates historical ingestion from current telemetry. Replay
  does not update live freshness, control reports, preparation stability, command
  acknowledgements, or current-temperature alert evaluation. Live messages have
  queue priority over history.
- The Monitor tab shows local recording, pending uploads, unsaved RAM records,
  unknown times, discarded/corrupt counts, and last historical receipt. It labels
  stale device reports explicitly. Chart tooltips identify buckets that include
  historical uploads; observation time remains on the chart axis.
- OLED header shows `Q:<count>` while recording or `REC OFF`. Existing pairing
  and connection information remain. Visible output has not been checked here.

Detailed heater/mist/fan transition persistence is a subsequent phase, as the
plan specifies. The first release stores environmental history and recording
health; it does not provide a complete forensic actuator event log.

## Wire contract

Use the existing per-device MQTT ACLs and topics:

- Device writes `eggcelerate/v1/devices/<device>/telemetry`.
- Worker writes `eggcelerate/v1/devices/<device>/receipt`.

A batch contains `schema_v: 1`, `kind: "offline_batch"`, `device_id`, a 32-character
hex queue generation, a 64-character SHA256 `batch` digest, and up to eight
records. Serialized payload must fit 2,048 bytes. Firmware shrinks batches to
fit its bounded record-array buffer. Its MQTT buffer is 2,816 bytes, including
room for the live storage report and protocol/topic overhead.

Record keys, in transmitted order:

| Key | Meaning |
| --- | --- |
| `n` | Immutable unsigned 64-bit sequence, encoded as a decimal string. |
| `s` | Capture boot session, 16 lowercase hex characters. |
| `m` | 64-bit monotonic observation time in milliseconds. |
| `t` | Original UTC milliseconds or `null` when unknown. |
| `g` | Server-issued assignment generation, 32 hex characters, or `null`. |
| `a` | Sensor sample age at capture in milliseconds. |
| `c`, `h` | Integer temperature/humidity hundredths; `null` for invalid samples. |
| `v` | Boolean sample validity. |

The digest covers the compact JSON `records` array exactly, preserving field
order, with no whitespace. The server rejects duplicate JSON keys, malformed record identities, and invalid
sequence ordering. Records with valid identities but invalid measurement/schema
fields are durably quarantined individually, so their neighbours can proceed. A host-generated C++ packet is checked against the Python
parser as part of software verification.

The committed receipt is `offline|<queue>|<batch digest>`. It is sent only after
PostgreSQL commits every accepted or quarantined record. The device matches it
against its in-flight batch, journals the cursor, then reclaims records. Lost
receipts cause duplicate replay and another receipt; MQTT publish success alone
never deletes records. Retry delay grows to at most 60 seconds with jitter;
transmission is capped at one batch per second.

Assignment receipts use `storage|<live boot ID>|<live sequence>|<generation>`.
They are tied to a current live upload. Captures made before receiving an
assignment are quarantined rather than assigned to whichever farm receives them
later. Internal chamber/device IDs and registry creation time identify each
server assignment. A reassignment or recreated chamber obtains a new generation.

## Failure and data-loss behavior

- A power cut may lose roughly the last minute still in RAM under normal writer
  operation. Writer errors/stalls can increase that window. Only committed,
  intact flash records are intended to recover.
- A full queue evicts its oldest segment. If that segment is in flight, the
  batch is cancelled and subsequent stale receipts cannot delete newer data.
  Counters and first/last sequence bounds record the discarded unconfirmed
  records. Some might already exist on the server if only their receipt was lost;
  the counter therefore means discarded **before confirmation**, not necessarily
  missing from PostgreSQL.
- CRC-invalid records and incomplete append tails are counted. Earlier intact
  records are retained. A partial newest header with no possible complete record
  is reclaimed. A damaged committed header or both damaged metadata copies stop
  recording and preserve data for manual recovery.
- No automatic format, partition changes, NVS clearing, or deletion of credentials
  occurs. Mount failure is visible as `needs_init`.
- Changed contents at an existing timestamp go to `offline_records` quarantine.
  Reused record IDs with changed contents go to `offline_conflicts`; originals
  are never overwritten. Both are persisted before issuing a receipt.
- Wrong/unknown assignment records have no current farm attribution and remain
  available only to server operators. Farm APIs cannot expose them to a new
  owner. Farm-scoped quarantine counts cover that farm's authorized records.
- Quarantines are not automatically reinterpreted or put on charts. An operator
  must investigate the reason before any separate recovery/import decision.

## Device installation

1. Install server schema/API/worker support first. Preserve the existing database,
   source/configuration, and application image backups.
2. Ensure the controller is safe to restart, then back up its existing full flash
   using its actual chip/flash-size information. Full flash backups contain
   credentials and must remain private.
3. Upload `apps/firmware/Eggcelerate/Eggcelerate.ino`, NodeMCU-32S, with **Erase All
   Flash disabled**. Default private `CloudConfig.h` targets the VPS. The installed
   release output is `output/firmware/offline-storage-vps/`. Never publish binaries
   containing the device's embedded credentials.
4. At 115200 baud, run `storage status`. If the existing compatible filesystem
   and queue mount, recording resumes automatically.
5. For a first installation, inspect/back up the actual data partition before
   running **`storage init ERASE-DATA`**. This explicit command can format the
   `spiffs`-labelled data partition when it cannot mount; it does not erase NVS or
   either application slot. Do not run it blindly on unknown existing contents.
   A mounted filesystem's unrelated files are preserved. Damaged queue metadata
   with saved segments requires manual recovery, not this initialization command.
6. Confirm `state: "ready"`, increasing queued/pending values, then committed
   receipts and a decreasing queue after reconnection. `REC OFF` or `needs_init`
   means there is **no active persistent local recording**.

The installed default toolchain reserves about 1.375 MiB for its data region;
actual board layout/contents must be read before initialization. Runtime refuses
missing/undersized data partitions and preserves application slots.

## Server operation and rollback

`OFFLINE_REPLAY_ENABLED=false` on the MQTT worker rejects historical batches
without receipts, while normal live telemetry/control continues. The device
retains/retries within its bounded storage. This is an operational replay switch,
not a way to obtain unlimited offline retention.

Migration 0025 is additive. Old firmware remains accepted. Previous API image
readiness expects schema 0024, so an image-only rollback is insufficient. Preserve
new replay/quarantine data before reverting schema; use the saved source/database
rollback procedure and previous firmware if reverting the whole protocol. Do not
silently drop historical data merely to restore an old readiness check.

Software checks use a disposable TimescaleDB at loopback port 55432 and a host
filesystem in a newly created `/tmp/egg-offline-host-*` directory. They do not
exercise the physical ESP32's flash, fan, heater, or mist maker. Hardware checks
listed in the plan remain deferred; do not infer thermal safety or flash endurance
from software recovery tests.


## Verification record

- Firmware: NodeMCU-32S / ESP32 core 3.3.11, marker
  `climate-pwm-offline-v1`; **1,212,204 bytes flash (92%), 61,412 bytes static RAM
  (18%)**. Hashes are in the private build manifest beside the binaries.
- 25 selected backend MQTT/PostgreSQL/readings tests passed, including rollback,
  retries, ownership isolation, malformed-record quarantine and unchanged live
  projections. 18 selected frontend/transport/trend tests passed. TypeScript,
  targeted Ruff and offline-module mypy passed.
- C++ host harness ran with address/undefined-behavior sanitizers. It exercises
  initialization without auto-format, append/metadata interruption, restart,
  matching/mismatched committed receipts, clock wrap, overflow and stale ACKs.
  A serialized C++ batch passed the actual Python digest/schema parser.
- An existing broader frontend CSV-header assertion expects a removed `Water OK`
  column; both current and Git HEAD export code use the six-column header. This
  unrelated assertion was recorded and left unchanged. The full suite is not
  claimed green.
- VPS schema is 0025; API/worker image is
  `eggcelerate-api:offline-storage-20261018-r2`; dashboard image is
  `eggcelerate-web:offline-storage-20261018`. TLS readiness succeeded; protected
  recording status returns HTTP 401 without a session. Actual reports show the
  expected firmware marker, all outputs off and no pending climate command.
- Release builds used deployed public source plus the explicit offline changes.
  Final source hashes are recorded in `SOURCE-SHA256SUMS-final` under the private
  release directory. Unrelated local notification/auth changes were preserved.

Private recovery artifacts (do not publish):

- ESP32: `output/backups/pre-offline-storage-20261018-esp32/`, including the full
  flash, extracted data partition, manifest, empty-filesystem listing, upload and
  observation logs. Long serial reads failed; resumable chunks were assembled
  and the final full image passed a chip comparison before any upload.
- VPS: `/opt/eggcelerate/rollback-offline-storage-20261018-wUelsG/`; local mirror
  `output/backups/vps-pre-offline-0025-20261018/`. Checksums matched. Database dump
  is 89,972 bytes; source/configuration archive is 791,629,607 bytes because it
  includes older release archives. Dump listing parsed; restore rehearsal is not
  claimed.
- Release: `output/releases/vps-offline-storage-20261018/` and
  `/opt/eggcelerate/releases/offline-storage-20261018/`.

Opening/closing a Serial connection can reset this board. Use Serial while the
controller is safe to restart. The observation process was stopped before handoff;
no timed monitor task was left to reset the controller later.

To rerun the host check from the repository root (requires g++ and OpenSSL
headers/library):

```sh
g++ -std=c++20 -Wall -Wextra -Werror -Wno-misleading-indentation \
  -fsanitize=address,undefined -g apps/firmware/tests/offline-storage-test.cpp \
  -lcrypto -o /tmp/egg-offline-storage-test
/tmp/egg-offline-storage-test /tmp/egg-offline-host-batch.json
```

Backend tests require `TEST_DATABASE_URL` pointing to a disposable loopback
`eggcelerate_test` database on port 55432; the fixture rejects other targets.
The actual device was observed while stopped. No heater, mist, fan or tray
activation was used to establish these results.

## Completion audit against the plan

| Deliverable | Evidence |
| --- | --- |
| Phase 1: identities, timestamps and ownership | Versioned wire contract; shared canonical live/capture timestamps; reserved IDs; assignment/quarantine tests and real first-assignment quarantine. |
| Phase 2: bounded persistent storage | Actual default partition confirmed; verified full backup; empty LittleFS listing; device `ready`; committed records recovered across Serial resets; host interruption/overflow checks. |
| Phase 3: historical ingestion and committed receipts | Schema 0025 and matching API/worker installed; rollback/idempotency/tenant tests; real replay rows and preserved original data. |
| Phase 4: reconnect and drain | User completed Wi-Fi setup; verified TLS connection; device queue 23 → 8 → 0; continuing database receipts and historical imports. |
| Phase 5: recording/recovery status | Deployed Monitor panel and chart metadata/tooltips; targeted render/transport tests; actual recording status and firmware reports persisted by the API. |
| Rollout and handoff | Source hashes matched all 17 application change files; firmware upload hashes verified; backups mirrored/checksummed; no scheduled Serial observer left running; controller and cycle stopped. |

Physical power-cut/endurance, calibration and actuator qualification are deferred
by user instruction. Detailed actuator-event persistence remains the explicitly
subsequent release; it is not claimed implemented here.
