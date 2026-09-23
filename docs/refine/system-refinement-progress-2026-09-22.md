# System refinement implementation evidence

Plan: [phased execution](system-refinement-execution-plan-2026-09-22.md).
Starting revision: `e391a1e`; working tree initially clean. Changes remain uncommitted.

## Phase 1 — Local implementation and checks passed

Fixed the five web lint findings. Pagination now uses named native fieldsets,
retaining its buttons, handlers and selected states. Added the API workflow with
the pinned disposable Timescale service, strict integration-test mode, migration
verification and shared live contracts. Both workflows run on all PRs and target
branch pushes to avoid missing required checks through path filtering.

Added repository-local Ruff configuration so import classification is stable
regardless of invocation directory. No dependency versions were changed.

Evidence: 293 web tests; coverage thresholds; typecheck; build; lint; 79 API tests
with zero skips using `--require-database`; Ruff lint/format; mypy; fresh and
populated upgrades; 28 shared memory/live HTTP contract cases all passed.
Missing `TEST_DATABASE_URL` with strict mode correctly exits 4 before collection.
The Vite bundle warning and dependency deprecation warnings remain tracked.

External administration remains: push/run the new workflow, then configure
`web / web` and `api / api` as required checks. No GitHub CLI is installed in this
environment, and no remote run or branch-protection change is claimed. This
remaining administrative step does not prevent local phase implementation.
See [verification commands](../guide/verification-gates.md).

## Phase 2 — Unsupported hardware controls corrected

All four reviewed controls are device configuration, not dashboard preferences:

| Control | Existing preview | Scope and availability |
|---|---|---|
| Sensor sampling | 30 seconds; 10/30/60/300 choices | Per controller; unavailable until a configuration command/ACK exists |
| Battery saver | Off | Per controller; unavailable |
| Temperature offset | 0 °C; previous UI bounds −10…10 in 0.1 steps | Per sensor/controller; unavailable; these are preview bounds, not a validated firmware contract |
| Status LEDs | On | Per controller; unavailable |

Removed component-local editing/success state and disabled the controls. Visible
copy identifies the values as previews, not confirmed device settings. Calibration
cannot claim “Saved” or imply an applied offset. The fixed five-minute research
logging description remains informational.

No new persistence fields were invented for unsupported capabilities. Existing
account/notification preferences retain their repository persistence path; API
preference restart/replay coverage passed in phase 1. A rendered regression test
checks disabled semantics, failed attempts to activate the controls, and remount
behavior (6 settings tests passed). Device configuration enablement remains a
future capability; turn-command support alone will not enable these controls.

## Phase 3 — Read separation under verification

PostgreSQL GET requests use request-local, read-only repeatable-read transactions.
Mode/preferences/alert/history endpoints load their own collections; incubator
detail filters by public ID and reads runtime/current journals without loading
terminal history or other settings. Mutation locking and durable replay remain.
Memory/mock behavior remains unchanged. Sensor projection is still the existing
development fixture boundary pending phase 5.

The rollback test now compares process memory to its own pre-mutation snapshot
and durable data to its pre-mutation HTTP snapshot independently: GET no longer
hydrates global memory as a side effect. Both rollback assertions remain.

Load budget for this local 12-chamber, six-client/60-request fixture: p95 below
150 ms after connection warmup, fewer SQL statements than baseline, and only
the 10 mutations taking the farm write lock. This is a local regression budget,
not a production capacity claim. Cold connection setup is measured separately.
The reproducible script is `apps/api/scripts/benchmark_reads.py`; use the same
`TEST_DATABASE_URL` and `PYTHONPATH=apps/api/src` as other API tooling.

## Phase 4 — Durable command outcomes completed

Manual turn requests now create a durable `device_commands` record through
migration `0008`. The request idempotency key is separate from the UUID placed on
the MQTT command. Confirmed `last_turned_at` and `next_turn_at` do not change on
acceptance; only a matching successful ACK advances them. Rejected, expired,
missing, mismatched, delayed, or terminal-conflicting ACKs cannot advance or
overwrite the command. The command status is exposed as pending, dispatched,
acked, rejected, or timed out, and the UI labels the timestamp as last confirmed.

The opt-in `mqtt.worker` subscribes to telemetry and ACK topics, expires and
claims durable commands with bounded retries, publishes non-retained QoS 1
commands, and applies correlated ACKs. `compose.simulator.yaml` supplies a
loopback-only Mosquitto profile; it does not enable physical actuation. The
worker defaults dispatch off and requires explicit `SIMULATOR_DISPATCH_ENABLED`.

The sibling simulator repository was updated to validate schema, device, interval,
request time and expiry; atomically persist command journals; and replay original
outcomes across restarts. The simulator working tree has two modified files and
must be committed/reviewed separately from this repository.

Evidence: 84 API tests pass against the disposable database with no skips; Ruff,
format, mypy and migration verification pass; 294 frontend tests and coverage
pass; 28 shared live HTTP contract cases pass; 24 simulator unit tests pass; and
the local REST → outbox → MQTT → simulator → ACK → confirmed-cursor proof passes.

Phase 4 exit gate is complete for the simulator path. Remaining boundaries are
telemetry device projection/freshness, broker security for shared environments,
physical hardware, and B6 authentication. Next eligible phase: Phase 5.
