# B3 exit review — 2026-09-15

**Result: PASS for the local dashboard persistence scope. B4 is unlocked.**
This does not establish MQTT delivery, physical execution, authentication, or
production readiness. Mock mode remains available and seed records were preserved.

## Evidence

| Gate | Result and evidence |
|---|---|
| Empty migration | A newly created disposable database upgraded from empty to 0007, became ready, and passed Alembic schema drift. The audit database was removed afterward. |
| Populated migration | `test_postgres_cycles.py` upgrades populated earlier slices through 0007 and downgrades while checking prior cycle/journal/configuration state. |
| Timescale | The regression suite checks the extension and actual `telemetry_samples` hypertable, not merely table existence. |
| Seed | On the new database, all rows in 12 domain tables were identical before/after repeated seed; exactly one farm, 12 chambers and no generated telemetry. Existing slice tests cover tombstones and edited values. |
| Adapter behavior | 28/28 shared memory/live HTTP cases, using the new repository-owned isolated-farm runner. Stored reading boundaries and non-empty values are verified separately in PostgreSQL tests; HTTP parity no longer requires synthetic point counts. |
| Restart | Prior slice restart proofs are recorded in the main guide. On this review, actual database stop/start preserved turn receipts and cursor state. Existing isolated turn/delete and telemetry proof records were rechecked after recovery and reseed, including original telemetry receipt timestamps. |
| Atomicity | Full PostgreSQL suite includes failure injection for terminal history/runtime, journal/photos/receipts, preferences, modes, and turn receipt rollback; telemetry imports roll back conflicting batches. |
| Concurrency/replay | Concurrent terminal operations, same-key mode/turn requests, candling creates and telemetry retries pass. Old receipts do not reapply over newer state. |
| Research | Fixed data verifies UTC five-minute edges, sparse buckets, counts, temperature avg/min/max, late arrival and farm isolation. Raw samples are durable; summaries are computed on demand. |
| Outage/recovery | Real database shutdown: health 200, readiness 503, readings and keyed turn requests return `offline`/503. Recovery leaves chamber state unchanged, preserves earlier replay and permits retry of the failed key. Database and local API are healthy afterward. Regression coverage also exercises unavailable mode DELETE. |

Validation rerun: **78 API tests, 288 frontend tests (34 files), 28 shared live
contract cases**, frontend coverage policy, typecheck, build and lint; Ruff check
and format (55 Python files), mypy (30 source files), Alembic drift and diff checks.
Existing Vite chunk-size, upstream TestClient deprecation and intermittent Pydantic
schema-alias warnings remain; no failing gate resulted.

## Reproducing the automated gates

Use the pinned Compose disposable database, set `TEST_DATABASE_URL` to its
`postgresql+asyncpg` URL (database name must be `eggcelerate_test`), then from root:

```sh
apps/api/.venv/bin/python -m pytest -q apps/api/tests
apps/api/.venv/bin/python apps/api/scripts/verify_live_contract.py
pnpm typecheck:web
pnpm coverage:web
pnpm build:web
pnpm lint
git diff --check
```

From `apps/api`, run `.venv/bin/ruff check src tests migrations scripts`,
`.venv/bin/ruff format --check src tests migrations scripts`, `.venv/bin/mypy`,
and `.venv/bin/alembic check` with DATABASE_URL set to the migrated database.
The new live runner creates an isolated farm and shuts down its temporary API;
its fixture rows remain in the disposable test database. Real outage and fresh
whole-database checks above were supervised operational proofs, not steps hidden
inside the automated suite. Repeat disruptive proofs only against local services.

Base revision: `035f555`. Readings API and command retry work plus this audit remain
uncommitted; that revision alone does not reproduce this checkpoint. The accompanying
[b3-source-manifest.sha256](b3-source-manifest.sha256) fingerprints tracked and
untracked non-ignored implementation/configuration files at review time, excluding
all documentation and this manifest. Run `sha256sum -c` from repository root to
check those inputs. No commit or public deployment was created by this review.

## Recorded boundaries and B4 handoff

- `full` readings start at midnight UTC on the cycle's date; exact cycle-start
  instants and historical device assignment are not represented. Queries follow
  the chamber's current device. See [readings contract](readings-storage-contract.md).
- Five-minute research summaries are internal on-demand queries, not continuous
  aggregates or scheduled persisted summaries. No retention policy deletes data.
- Manual turns durably record acceptance and retain existing dashboard cursor
  behavior. Acceptance and cursor changes do not mean the device moved.
- `cycle_idempotency` stores turn acceptance; durable dispatch/outbox, attempts,
  deadlines, ACKs and execution outcomes require B4 `device_commands` work. This
  is an explicit sequencing change from the initial B3 table list.
- Sensor/connection projection is simulated (`device_projection_memory`). No MQTT
  ingestion, automatic cycle-day scheduler, uploaded photo storage or physical
  actuator path is enabled. History uses existing terminal snapshots, not a new
  versioned mode-at-cycle-start schema.
- Disabled authentication is local-only. Public/VPS deployment remains gated on B6.

Next bounded implementation: inspect the separate simulator and reconcile its
actual command/ACK/telemetry payloads; document command ID, device sequence, time,
QoS and retained-message behavior; then add migration 0008 for dispatch/ACK state
and the local broker/worker integration. Preserve the ESP32 safety authority.
