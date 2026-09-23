# B4 MQTT contract and telemetry reconciliation — 2026-09-23

The telemetry boundary and command path are now implemented in two separately
reviewable slices. Telemetry validation enters the existing Timescale ingestion
boundary and now also updates a durable, boot-aware latest-device projection.
The command slice adds durable request/outbox state, a local Mosquitto worker,
validated simulator commands, persistent simulator replay, and correlated ACK
application. The worker and dispatch path are opt-in; physical hardware is still
excluded.

The API accepts a turn request without changing the confirmed turn cursor. The
cursor advances only after a matching successful ACK. Pending, dispatched,
acked, rejected, and timed-out command states are durable. The client idempotency
key remains separate from the server-generated MQTT dispatch UUID.

## Inspected implementation

Separate repository: `/home/mawi/Projects/eggcelerate-simulate`, modified working
tree at the handoff revision recorded in the system refinement note. Sources:
`sim/mqtt.py`, `sim/physics.py`, examples and `tests/test_mqtt_logic.py`. Its 24
unit tests pass. The simulator now validates schema/device/interval/request/expiry,
persists an atomic command journal, and replays the original ACK after restart.

| Topic suffix under `eggcelerate/v1/devices/{device_id}` | Current simulator behavior |
|---|---|
| `/telemetry` | QoS0, non-retained; schema_v, device_id, incubator_id, boot_id, booted_at, seq, observed_at, temperature_c, humidity_pct, water_ok, battery_pct, power_source |
| `/state` | QoS1 retained; online/offline, at, optional reason; registered LWT before connection |
| `/commands` | Subscribed QoS1; validated schema_v, command_id, device_id, turn_now, interval, requested_at and expires_at; non-retained dispatch |
| `/ack` | QoS1 non-retained; command_id, device_id, optional boot_id/booted_at, seq, observed_at, acked/rejected and nullable error_code |

Sequence increments across telemetry and ACKs and resets on process start. For a
new boot, a strictly later `booted_at` replaces the projection even when its
`observed_at` is earlier than the previous boot's last observation. Within one
boot, both `seq` and `observed_at` must advance. Earlier boots remain unable to
replace a newer projection, and `seq` is never treated as a global identity.
Late samples remain in raw history. A valid first sample after device
reassignment removes the previous device's latest row for that chamber while
preserving its raw history. The LWT timestamp is assembled during construction,
not at disconnect time; use server receipt time to mark loss of connection. Rate
is configurable; the agreed live cadence is 15 seconds.

## Implemented API boundary

`mqtt.telemetry.ingest_telemetry(session, farm_id, topic, payload)` rejects payloads
above 16 KiB, invalid schema/values, boot or observation timestamps more than the
shared 60-second clock tolerance ahead of server receipt time, extra fields,
topic/body mismatch, and unassigned farm/device/chamber identity. The caller
provides trusted farm scope; no tenant is accepted from the payload. `received_at`
is server assigned.

Temperature/humidity/water and observed time enter the B3 raw sample table;
battery/power, boot identity, sequence, observation time and server receipt times
also update `device_telemetry_state` in migration `0009`. Exact retries preserve
the first raw receipt; conflicting samples at the same observed instant use B3
conflict handling. Late samples and exact retries cannot refresh liveness or replace a newer
latest projection. Freshness uses `last_seen_at`: fresh through 45 seconds, stale
through 180 seconds, then offline. The caller owns commit/rollback and catches
invalid messages individually; invalid input never marks a device healthy. No
quarantine store is implemented yet.

Verification: telemetry/readings PostgreSQL tests cover valid writes, duplicate
replay, malformed fields, future timestamps, foreign farm/chamber, oversized
payloads, boot-aware ordering, latest projection hydration, window/aggregation
behavior and atomic imports. Ruff and mypy pass. The previous B3 source manifest
remains the frozen B3 checkpoint; B4 additions are subsequent.

## Command-path safeguards now implemented

The simulator rejects malformed, foreign-device, wrong-schema, out-of-range,
future, and expired commands. It persists the command request and original ACK
before exposing the outcome, and duplicate delivery replays that outcome without
advancing the turn cursor again. Commands are published QoS 1 and non-retained;
the worker retries from durable state with a deadline. Terminal ACKs cannot be
overwritten by delayed conflicting ACKs. A simulator journal corruption is
treated as a startup failure rather than silently re-enabling duplicate turns.

The worker defaults to dispatch disabled. Set `SIMULATOR_DISPATCH_ENABLED=true`
only in the opt-in simulator profile. No production broker, TLS/ACL configuration,
or physical actuator path is claimed here.

## Verification — command closure, 2026-09-23

- 87 API tests pass against the disposable Timescale database with no skips.
- Fresh and populated migrations pass at head `0009`.
- 36 frontend files / 298 tests pass; strict frontend coverage passes.
- The shared live HTTP repository contract passes 28/28 cases.
- The simulator passes 24 unit tests.
- An end-to-end local proof passes: REST acceptance → durable outbox → MQTT
  worker → simulator → ACK → confirmed turn cursor.
- Rejection, timeout, mismatched ACK, duplicate ACK, delayed terminal conflict,
  and command restart replay are covered by API/simulator tests.

The local proof uses a temporary Mosquitto listener on loopback and an isolated
test farm. It is not a public deployment or hardware qualification.

## Phase 5 live dashboard slice — 2026-09-23

The worker now routes validated telemetry into the projection while isolating
rejected messages. PostgreSQL incubator DTOs expose `telemetry_status`,
`telemetry_observed_at`, `telemetry_received_at`, and
`telemetry_last_seen_at`. The dashboard polls incubator summaries and reading
windows every 15 seconds while visible, and monitoring views show the server
receipt age as Live, Stale, or Offline. The selected thresholds are a local
15-second-cadence target and should be revalidated against deployed device rate.

No WebSocket path is enabled. Broker security, authenticated farm scope, and
physical actuation remain gated on later phases.

## Next implementation slice

1. Add app-managed email/password authentication and farm-scoped sessions (B6).
2. Reconcile worker broker security and deployment secrets before any shared or
   public environment uses the simulator profile.
3. Qualify one physical device against the command and telemetry contract before
   enabling any actuator path.

### Phase 5 timing and recovery

Healthy visible-dashboard target: 15s device cadence + 2s ingestion allowance +
15s polling = 32s from a physical change, or 17s from an emitted observation.
A 5s local timer ages cached status if API refresh fails. Exact retries and old
samples never refresh liveness. Observation age is displayed separately from
receipt age. Live telemetry requires boot_id/booted_at; deploy sender and API
changes together and maintain synchronized UTC device clocks.

Build with `VITE_LIVE_REFRESH_ENABLED=false` to pause automatic polling while
keeping REST reads and ageing status. The separate B5 LED harness remains
unqualified; refinement Phase 5 belongs to B4 simulator integration.
