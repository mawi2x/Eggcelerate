# B4 MQTT contract reconciliation — 2026-09-15

First B4 slice implemented: validated simulator telemetry → trusted farm/device
lookup → existing Timescale ingestion. This is a callable transaction boundary,
not a running MQTT subscriber. B4 is in progress; no command dispatch is enabled.

## Inspected implementation

Separate repository: `/home/mawi/Projects/eggcelerate-simulate`, clean revision
`258f0e9` at inspection. Sources: `sim/mqtt.py`, `sim/physics.py`, examples and
`tests/test_mqtt_logic.py`. All 22 unittest cases passed. Three freshly generated
`dry-run --seed 7 --ticks 1` messages passed the new API telemetry validator.
The simulator repository was not modified.

| Topic suffix under `eggcelerate/v1/devices/{device_id}` | Current simulator behavior |
|---|---|
| `/telemetry` | QoS0, non-retained; schema_v, device_id, incubator_id, seq, observed_at, temperature_c, humidity_pct, water_ok, battery_pct, power_source |
| `/state` | QoS1 retained; online/offline, at, optional reason; registered LWT before connection |
| `/commands` | Subscribed QoS1; turn_now with command_id and turn_interval_min; subscription uses persistent session |
| `/ack` | QoS1 non-retained; command_id, device_id, seq, observed_at, acked/rejected and nullable error_code |

Sequence increments across telemetry and ACKs and resets on process start. It is
not globally unique, nor a safe persistent high-water mark without boot identity.
The LWT timestamp is assembled during construction, not at disconnect time; use
server receipt time to mark loss of connection. Rate is configurable; the existing
README demo's two-second rate is not the agreed 15-second live cadence.

## Implemented API boundary

`mqtt.telemetry.ingest_telemetry(session, farm_id, topic, payload)` rejects payloads
above 16 KiB, invalid schema/values/timestamps, extra fields, topic/body mismatch,
and unassigned farm/device/chamber identity. The caller provides trusted farm scope;
no tenant is accepted from the payload. `received_at` is server assigned.

Temperature/humidity/water and observed time enter the B3 raw sample table;
battery/power/sequence are validated but not persisted as device projection yet.
Exact retries preserve the first receipt; conflicting samples at the same observed
instant use B3 conflict handling. Late samples are permitted. Farm/device/observed
time remains the sample identity. The caller owns commit/rollback and must catch
invalid messages individually; invalid input must never mark a device healthy.
No quarantine store is implemented yet.

Verification: six telemetry/readings PostgreSQL tests pass, including valid writes,
duplicate replay, malformed fields, foreign farm/chamber, oversized payloads,
window/aggregation behavior and atomic imports. Ruff and mypy pass. The previous
B3 source manifest remains the frozen B3 checkpoint; B4 additions are subsequent.

## Command-path gaps found in the simulator

The current handler only checks command type and presence of command_id. It does
not validate the addressed device, schema version, interval bounds or expiry.
Repeated command IDs advance turn cursors again. There is no durable command replay
journal. Stored turn cursors are written on graceful shutdown but not restored by
`NvsStore.load_into`; a crash can lose them. Timers emit delayed ACKs, but a restart
can cancel them. These gaps were found in source review, not claimed as passing
behavior by the simulator's existing tests.

Before enabling retained command publishing, fix and test the simulator's command
validation and durable deduplication. Otherwise reconnecting can replay a stale
retained command. Do not treat retained delivery or API acceptance as execution.

## Next implementation slice

1. Add a validated command envelope with server-generated unique dispatch ID,
   schema_v, device_id, type, interval, requested_at and expires_at. Preserve the
   client idempotency key separately from the dispatch ID across farms/chambers.
2. Add simulator persistent deduplication and original ACK replay, bounds/device/
   version/expiry validation and restart tests. Introduce boot_id before persisting
   sequence-based ordering. Reconcile fixture and contract-check updates together.
3. Add migration 0008 for durable dispatch/ACK records, request identity, deadlines,
   attempts and terminal outcome. ACK application must match farm/device/command,
   be idempotent, and not overwrite terminal state with delayed conflicting ACKs.
4. Add broker/worker Compose profile and telemetry subscription using the implemented
   boundary; use server receipt time for liveness. Publish QoS1 retained commands
   only with expiry/deduplication behavior established, and clear terminal retained
   messages. Test success, duplicate, rejection, timeout, late ACK and reconnect.
5. Keep physical hardware disabled and authentication/public deployment gated on B6.
