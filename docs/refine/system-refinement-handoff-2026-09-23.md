# System refinement handoff — Phase 4 complete

**Handoff date:** 2026-09-23  
**Completed phase:** Phase 4 — Durable, truthful command outcomes  
**Next phase:** Phase 5 — Continuous telemetry and fresh dashboard data  
**Authentication decision for Phase 6:** app-managed email/password with server-side sessions and farm-scoped authorization.

**Revision record:** main repository command implementation `0db4a94`; simulator
command/boot implementation `5746c94`. The main repository also contains the
separate Phase 5 commit `6b53341` and CI/migration gate commit `d5f6b44`.

## What is complete

The API no longer presents a manual-turn request as physical execution. A request
is durably recorded as `pending`, the MQTT worker claims it as `dispatched`, and a
validated ACK moves it to `acked` or `rejected`. A deadline moves it to
`timed_out`. Only a correlated successful ACK updates the confirmed turn cursor.
The original client idempotency key and the server-generated MQTT dispatch UUID
are stored separately.

The simulator now validates the full command envelope, rejects wrong-device,
wrong-schema, invalid-interval, future, and expired requests, persists a command
journal atomically, and replays the original outcome after restart. Duplicate
delivery does not turn again. The local worker publishes non-retained QoS 1
commands and retries from the database with a deadline. The loopback Mosquitto
profile and worker are opt-in; physical actuation is still disabled.

The UI and both repository adapters now show “last confirmed” separately from a
pending/rejected/timed-out request. The mock adapter follows the same pending
contract instead of advancing its clock on acceptance.

## Evidence

- API: `84 passed, 0 skipped` with `--require-database` against the disposable
  Timescale service; two upstream dependency deprecation warnings remain.
- Frontend: `294` tests pass; strict coverage passes; typecheck and lint pass.
- API tooling: Ruff check/format and mypy pass; fresh and populated migration
  upgrades pass at Alembic head `0008`.
- Shared HTTP repository contract: `28/28` cases pass against an isolated API.
- Simulator: `24` unit tests pass in `/home/mawi/Projects/eggcelerate-simulate`.
- End-to-end proof passes through REST acceptance, durable outbox, Mosquitto,
  simulator, ACK application, and confirmed cursor update.
- Read-separation regression remains green: focused GETs are read-only and the
  warmed six-client fixture uses 440 SQL statements with ten mutation locks
  versus 610 statements and 60 locks before the change; three repeat runs were
  p95 96.21, 92.29, and 97.07 ms against the local 150 ms budget.

## Files to review first

In the main repository, start with [migration 0008](../../apps/api/migrations/versions/0008_device_commands.py), [command state machine](../../apps/api/src/eggcelerate_api/mqtt/commands.py), [worker](../../apps/api/src/eggcelerate_api/mqtt/worker.py), [simulator Compose profile](../../compose.simulator.yaml), and [command tests](../../apps/api/tests/test_device_commands.py).

The simulator changes are in its separate repository at
`/home/mawi/Projects/eggcelerate-simulate`, commit `5746c94` (based on
`e112a25`). The main repository and simulator commits can be reviewed
independently.

## Known limitations and safety boundaries

- Telemetry is validated and stored, but the durable latest-device projection,
  boot-aware sequence ordering, freshness/offline state, and dashboard refresh
  are Phase 5 work.
- The local broker permits anonymous loopback access. Do not use that profile in a
  shared or public environment; add broker authentication/TLS/ACLs first.
- API auth remains disabled for the protected preview. Phase 6 will use
  app-managed email/password sessions; do not expose this API publicly.
- The worker dispatch flag defaults to false. Keep it false until the simulator
  and broker are intentionally started together.
- The current web build still has the known Vite main-chunk warning, and the
  upstream TestClient deprecation warnings remain.
- The already-running preview containers were built against migration `0007`;
  they will remain unready until an operator applies `0008` and rebuilds the
  API image. No running preview volume was modified during this phase.
- The original Phase 4 verification is historical. The current plan reran the
  live HTTP contract and found one failing reconnect case; see the Phase 5
  handoff and project review execution plan before treating the phase as ready
  for deployment.

## Resume procedure for Phase 5

1. Verify the main repository's Alembic head is `0008`, seed a unique disposable
   farm, and rerun the Phase 4 checks above.
2. Add the device projection fields and boot identity before treating `seq` as
   durable ordering. Keep raw telemetry identity as farm/device/observed time.
3. Run the worker in telemetry-only mode first, then add the dashboard refresh
   strategy and explicit observation age/stale state.
4. Re-run the six-client read benchmark with the selected refresh cadence before
   changing the local load budget.

The relevant planning details are in the [execution plan](system-refinement-execution-plan-2026-09-22.md) and the [B4 contract](../guide/b4-mqtt-contract.md).
