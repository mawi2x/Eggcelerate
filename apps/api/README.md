# EGGCELERATE API

> **Current status:** The opt-in PostgreSQL backend, validated telemetry projection,
> and simulator command dispatch/ACK path are implemented through migration `0011`.
> Physical hardware is excluded. App-managed email/password authentication remains a
> later gated phase. See the [Phase 3 handoff](../../docs/refine/project-review-handoff-2026-09-23-phase3.md)
> for the latest API verification record.
> See `docs/guide/backend-dashboard-first-guide.md`.

Accepted technology decisions (local-only ADRs under `docs/archive/adr/`):

- Backend framework: **Python + FastAPI** (ADR-002, accepted 2026-07-27).
- IoT transport: **MQTT via Mosquitto**, QoS 1 commands / QoS 0 telemetry (ADR-001).
- Database: **PostgreSQL + TimescaleDB** (ADR-003).
- Device safety authority: **local ESP32**, server best-effort only
  (`docs/guide/firmware-safety-contract.md`, provisional values pending
  hardware verification).

## Layout

```text
pyproject.toml          exact pins + update policy (pytest/ruff under test extra)
Dockerfile              python:3.13-slim, loopback Compose service on :8000
src/eggcelerate_api/
  main.py               application factory, CORS, /healthz, /readyz
  config.py             local settings + production-without-auth refusal
  context.py            dormant disabled-auth request context (B6 replaces it)
  errors.py             result envelope, error codes, exception normalization
  models.py             Pydantic wire DTOs mirroring the frontend Zod contracts
  domain.py             condition/status/phase derivation ported from cycle.ts
  storage.py            state/unit-of-work protocols (transitional collection surface)
  store.py              deterministic memory seed + serialized rollback transactions
  services.py           use cases: validation, derivation, atomicity, idempotency
  api/v1/               routers (incubators, modes, alerts, history, preferences)
  database/             async store + chamber/device persistence, metadata, explicit seed
alembic.ini
migrations/             Alembic-only DDL, revisions 0001–0011; see the database setup guide for the mapping
tests/                  unit and PostgreSQL integration tests; CI is the source for current totals
```

## Local commands

```text
python3 -m venv .venv && ./.venv/bin/pip install -e ".[test]"
./.venv/bin/python -m pytest -q
./.venv/bin/mypy
./.venv/bin/ruff check src tests && ./.venv/bin/ruff format --check src tests
./.venv/bin/python -m uvicorn eggcelerate_api.main:app --port 8000  # from src/
docker compose up -d api  # from the repo root
```

The dashboard-first backend keeps authentication disabled for local development,
with a production startup guard. Do not treat that setting as suitable for a
public deployment. The opt-in database slice persists farm configuration,
preferences, alerts, cycles/history, candling, raw telemetry, the latest telemetry
projection, and durable device-command state. The MQTT worker is available for
local simulator dispatch; physical hardware and production broker security are
not implemented.

Memory request transactions roll back all state and idempotency results on failure.
The lock protects one process only; this is not persistence or distributed command
safety. In postgres_incubators, mode POST/PATCH and chamber create/profile/configuration/
reconnect, preferences PUT and alert action requests additionally use farm-scoped
SQL transactions and durable same-key replay with payload-conflict detection.
Candling create/update/delete, cycle start/reset/complete/stop, alert actions, settings save and chamber create/profile/configuration/reconnect Retry actions preserve their
logical key through the frontend and HTTP adapter. New user actions get new keys.
Manual turns are stored as durable device commands and the confirmed turn cursor
advances only after a matching successful acknowledgement. Keep the original
idempotency key across a retry; a new key denotes a separate user action.


## PostgreSQL persistence slice

`STORAGE_BACKEND=memory` remains the default. `postgres_incubators` persists
chamber configuration, device assignments and pairing state, farm preferences,
alerts, cycle state and history, candling journals/photo references, raw telemetry,
the latest device projection, and command state.
Pairing here is a configuration flag, not proof of physical hardware
connectivity. Account identities and authentication sessions are not implemented.

The database image is TimescaleDB 2.30.0 / PostgreSQL 17, pinned by digest in
Compose. Development port 5432 and disposable test port 55432 bind to loopback.
The development database uses a named volume; the test database uses tmpfs.
Stopping the test container discards test data. Never use `down -v` to run tests.

From the repository root, with Docker available:

```sh
export STORAGE_BACKEND=postgres_incubators
export DATABASE_URL=postgresql+asyncpg://eggcelerate:eggcelerate_local@db:5432/eggcelerate
docker compose --profile database up -d --wait db
docker compose build api
docker compose run --rm api alembic upgrade head
docker compose run --rm api python -m eggcelerate_api.database.seed
docker compose up -d api
```

The shown password is a local-development default. If `POSTGRES_PASSWORD` is
changed before database initialization, use the same password in `DATABASE_URL`.
For host-side Alembic/seed commands, use `127.0.0.1` instead of `db` in the URL.
Migrations and seed are explicit: startup never runs DDL, reseeds, or falls back
to memory when the database fails. Repeated seeding inserts missing defaults and
preserves existing edits. Deleted default modes can return when explicitly seeded again; alert and candling
deletion markers prevent those entries from reappearing.

The previous `postgres_modes` configuration is accepted as an alias for
`postgres_incubators`; readiness requires migration `0011` and farm, chamber,
preferences, alert, and runtime seed data.

`GET /readyz` reports `store: postgres_incubators`, database availability, and
`remaining_state: auth_and_deployment`. It returns 503 for a missing migration, missing farm/chamber/preferences/alert/runtime seed,
or unavailable database. `GET /healthz` remains a database-independent liveness
check. Dashboard DTOs and all 22 paths are preserved; OpenAPI is unchanged from the
previous modes checkpoint. Device assignment conflicts return 409 in both the
Python API and frontend memory repository. Farm-scoped foreign keys enforce
mode/device isolation, and hardware IDs are unique per farm without case sensitivity.

## Database verification

Start the disposable service from the repository root:

```sh
docker compose --profile database-test up -d --wait db-test
```

Then from `apps/api` (after installing `.[test]`):

```sh
export TEST_DATABASE_URL=postgresql+asyncpg://eggcelerate:eggcelerate_test@127.0.0.1:55432/eggcelerate_test
./.venv/bin/python -m pytest -q
./.venv/bin/mypy
./.venv/bin/ruff check src tests migrations
./.venv/bin/ruff format --check src tests migrations
DATABASE_URL="$TEST_DATABASE_URL" ./.venv/bin/alembic check
```

Tests refuse to migrate any database not named `eggcelerate_test`; each case uses
an isolated farm. Without `TEST_DATABASE_URL`, database-dependent cases skip.
Covered: migration/extension existence, populated 0001→0002 upgrade with mode
edits/replays preserved, CRUD parity, repeated seed preservation, API restart,
create/patch replay, changed-payload rejection, cross-farm foreign-key rejection,
failure after inserts before replay persistence, separate-instance concurrency
and double-assignment rejection, and database availability checks. Frontend
tests simulate a committed request whose response is lost, exercise Retry, and
verify one server operation plus a new key for a separate user action.

The 2026-09-13 chamber checkpoint restarted the actual API and database with the
named volume retained. A chamber profile/configuration, device assignment and
original replay responses survived; changed-payload replay returned 409. The
proof restored the original chamber settings afterward. The earlier modes
checkpoint also proved mode persistence across both container restarts. No
development volume reset was used. The shared HTTP suite mutates its target
farm: use a disposable database/farm for repeatable live testing.

Implementation references: [SQLAlchemy async sessions](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html),
[Alembic async migrations](https://alembic.sqlalchemy.org/en/latest/cookbook.html#using-asyncio-with-alembic),
and [TimescaleDB Docker images](https://github.com/timescale/timescaledb-docker).

### Historical preferences checkpoint (2026-09-13)

Migration 0003 adds one `farm_preferences` row per farm and atomic
`preferences_idempotency` receipts. Stable fields use explicit columns; the
extensible notification enabled map uses JSONB. Seed inserts missing rows only.
Old-key replay returns its original response without overwriting a newer save;
changed payloads with that key return 409. The frontend settings Retry action
preserves its logical key, while a new save gets a new key.

Verified: 49 API tests, 265 frontend tests, coverage thresholds (82.78% lines,
83.08% branches, 70.76% functions), lint/typecheck/build, Ruff/mypy, populated
0002→0003 upgrade and downgrade preservation, and schema drift check.
Readiness requires migration 0003 and a seeded preferences row. The existing
`postgres_incubators` configuration name and `postgres_modes` alias remain valid.

Live verification also passed 24/24 shared repository cases against an isolated
farm in the disposable database. Preferences and their exact replay response
survived a real API + development database restart with the named volume retained;
the temporary verification settings were restored to their original values.
The running packaged API reports migration `0003 (head)`.

### Historical alerts checkpoint (2026-09-13)

Migration 0004 adds farm-scoped alert rows with timestamps and a dismissal flag,
plus `alert_idempotency` receipts. Dismiss and clear operations hide rows rather
than deleting their identities, so repeated seeding cannot resurrect them.
All four actions commit atomically and accept an optional `Idempotency-Key`;
response envelopes and the 22 API paths remain unchanged. Same-key replay
returns the original response even if the alert is now dismissed. Single-alert
and bulk-action replay scopes are distinct. Frontend Retry preserves the key;
a new user action gets a new key.

Readiness requires migration 0004 and at least one seeded alert row, including
hidden rows when all alerts have been cleared. New alert generation and MQTT
integration remain deferred. Cycles/candling/history and readings remain volatile.

Verification: 56 API tests; 269 frontend tests; 24/24 live repository cases on
an isolated disposable farm; frontend lint/typecheck/build and coverage thresholds
(84.34% lines, 83.82% branches, 77.91% functions); Ruff/mypy (25 source files).
Tests cover repeated seeding, acknowledgement timestamps, unread preservation,
old replay without resurrection, bulk rollback, concurrent same-key dismissal,
farm isolation, and populated 0003→0004 upgrade/downgrade preservation.

The packaged API reports `0004 (head)`; schema drift check passes. On an isolated
farm in the named development volume, dismissed/cleared alerts and all four exact
replay responses survived an actual database/API container restart and repeated
seed. The temporary proof container was removed; the default farm's alert actions
were not changed by the proof. Next is cycle persistence with atomic terminal
outcomes, then candling/history and readings.

### Historical cycle checkpoint (2026-09-13)

Migration 0005 adds `cycles`, `incubator_runtime`, `cycle_history`, and
`cycle_idempotency`. Internal cycle IDs originate at start and flow into terminal
history. A partial unique index permits one active cycle per chamber; history's
farm/cycle primary key permits one terminal outcome. Farm/chamber/cycle foreign
keys prevent mismatched references. Historical mode/name values are snapshots,
so later configuration edits cannot rewrite a terminal record.

Cycle changes, chamber runtime, history and replay commit together. A competing
complete/stop request gets 409 once the cycle is terminal. The memory adapter
has matching terminal guards. Start/reset retain their existing replacement/reset
behavior: replaced active cycles are closed as `reset`, without inventing harvest
or stopped history. Stopped cycles remain stopped after unrelated updates.
Public chamber/history DTO fields and 22 API paths are unchanged.

The frontend keeps the start/reset/complete/stop key through Retry, including
failures of the follow-up chamber GET after a committed terminal write. Older
replay returns its original result without reapplying an old cycle snapshot.

Migration creates storage; explicit seed initializes missing runtime from the
existing development fixtures (new custom chambers start ready). Previously
volatile pre-0005 changes cannot be recovered by this migration. Repeated seed
preserves existing runtime, history and receipts. Day counts retain current
behavior; no calendar scheduler or MQTT execution was added. Candling data
remains volatile and is cleared when the loaded cycle identity changes, preventing
bootstrap entries from being attached to a newly started cycle.

Verified: 63 API tests; 277 frontend tests; 28/28 live memory/HTTP contract cases
on an isolated farm; coverage thresholds (87.18% lines, 84.71% branches, 80.64%
functions); lint/typecheck/build, Ruff/mypy (27 source files), populated
0004→0005 upgrade/downgrade, schema drift, and API Docker build.
Active/completed/stopped/reset runtime, both terminal histories, and exact replay
for all four lifecycle actions survived an actual database/API restart and
repeated seed on an isolated farm in the named development volume. The proof
container was removed. Packaged API reports `0005 (head)`.

### Candling checkpoint (2026-09-14)

Migration 0006 adds cycle-scoped `candling_entries`, ordered `candling_photos`
reference metadata, and `candling_idempotency`. Farm/cycle foreign keys and a
unique cycle/day constraint prevent duplicate or mismatched journal ownership.
Deleted entries retain tombstones, so repeated seed cannot revive them. New
explicit create actions can recreate a deleted day. Seed applies fixture entries
only to their original fixture cycles, never a newer cycle.

Current-cycle endpoints load the current journal; completion/reset hides it while
retaining archived rows. Stopped journals remain visible until reset/replacement.
Archived journal rows are retained in SQL; no new archive endpoint or photo-upload
service was added. Photo references are stored in their supplied order.

Create/update validate each count against loaded eggs. A chamber without a current
cycle cannot accept a journal write. PATCH validates the merged entry, rejecting
null required values. Entry/photo changes and replay receipts commit atomically.
DELETE now accepts the optional replay header, with unchanged response shapes and
22 API paths. The frontend sends DELETE correctly and preserves the action plan,
keys and resolved targets through retries, including lost follow-up GET responses.
The shared deletion test now requires success rather than accepting a failed call.

Verified: 69 API tests; 283 frontend tests; 28/28 live repository cases on an isolated
farm; coverage 89.30% lines, 82.87% branches, 82.66% functions; lint/typecheck/build;
Ruff/mypy (28 source files); populated 0005→0006 upgrade/downgrade preservation;
API Docker build, migration `0006 (head)` and clean schema drift. Pre-0006 volatile
journal edits cannot be recovered by migration. Full B3 remains open for readings
and remaining command/retry gates; B4 MQTT and B6 auth remain deferred.

Journal contents, ordered photo references, deletion markers and exact replay
responses survived an actual API/database restart and repeated seeding on an
isolated farm in the named development volume. Temporary proof container removed.
Explicit recreation of a deleted seeded day replaces its tombstone safely, even
when its original seed ID differs from the new entry ID.

### Readings foundation — 2026-09-14

Migration 0007 adds the telemetry hypertable and internal ingestion/raw/five-minute research queries. Source readiness now requires 0007. The running development stack remains on 0006 until the endpoint integration is ready. Dashboard readings still use generated data. See [the storage contract](../../docs/guide/readings-storage-contract.md) for duplicate identity, time boundaries, retention and remaining integration gates.

Foundation verification: 71 API tests passed against the disposable Timescale database; Ruff lint/format, mypy (29 source files), Alembic schema-drift check and git diff check passed. New tests prove timestamp/value validation, ordered stored reads, duplicate/conflicting ingestion, sparse UTC buckets, late arrivals, farm isolation, and reconnect/reseed persistence. Real database restart and dashboard HTTP integration are not yet proven for readings. Frontend code was unchanged in this checkpoint; its prior results are not a new test run.

### Stored readings API — 2026-09-14

PostgreSQL dashboard reads now use durable telemetry, with no generated fallback.
Mock/memory mode is preserved. The local database and rebuilt API run migration
0007; readiness reports `manual_turn_replay_memory` as the remaining volatile state.
Use the explicit JSON importer described in [the readings contract](../../docs/guide/readings-storage-contract.md).
No seed records were deleted. Research queries remain internal.

Verification: full API suite passed 73 tests before the final concurrent-ingestion
case and populated migration extension; the affected suites were rerun afterward.
Live memory/HTTP contracts passed 28/28, frontend readings/contracts passed 17/17,
and frontend typecheck passed. Actual database/API restart, reseeding and repeated
import preserved the proof sample and its first receipt timestamp. Schema drift,
Ruff and mypy checks passed. Full B3 remains open for command retry closure.

### Command retry closure — 2026-09-14

Manual-turn acceptance receipts now persist in `cycle_idempotency`, atomically with
runtime timestamps. Older replay returns the original acceptance without replacing
newer cursors. No-key requests receive generated durable IDs. Mode DELETE accepts
an optional Idempotency-Key and stores its response in `mode_idempotency`.
Mode create/update/delete and manual-turn frontend retries preserve their original
keys; intentional new actions mint new keys. Migration head remains 0007.

Readiness now reports `device_projection_memory`: simulated sensor/connection state
is still a projection. Durable acceptance is not MQTT dispatch or physical execution;
`device_commands` and ACK state remain B4 work. Mock mode remains available.

Verification: 78 API tests and 28 shared memory/live HTTP contract cases passed;
new tests cover restart replay, concurrent turn retries, receipt-failure rollback,
and durable mode deletion. Five new hook cases cover lost mode/turn responses and
lost turn follow-up GETs. Full B3 exit review remains explicit in the main guide.

Final checks for command retries: frontend coverage suite (288 tests), build, lint
and typecheck passed; Ruff lint/format and mypy (30 source files) passed. Turn and
mode-delete receipts survived an actual local database/API restart and reseed on
an isolated farm; replaying the first turn preserved the newer turn timestamps.
The local rebuilt API is healthy at migration 0007. Existing Vite chunk-size and
upstream TestClient deprecation warnings remain. No commit was created.

### B3 exit — 2026-09-15

The local dashboard persistence exit passed. See the [final review](../../docs/guide/b3-exit-review.md) for the full gate matrix, reproduction commands, source manifest and explicit B4 boundaries. Added outage regression coverage for readings/turn/mode deletion and a repository-owned live contract runner. Verified 78 API, 288 frontend and 28 live contract tests, plus fresh migration, seed stability, actual outage/recovery and replay. Next is B4 simulator payload reconciliation and durable dispatch/ACK state; no MQTT execution is claimed.

### B4 telemetry boundary — 2026-09-15

Added simulator-v1 telemetry validation with topic/device/farm/chamber checks and deduplicated Timescale ingestion. Six affected PostgreSQL tests, 22 simulator tests and three fresh simulator payloads passed; Ruff/mypy clean. See [the B4 contract](../../docs/guide/b4-mqtt-contract.md). Broker transport and command dispatch are not implemented yet; command validation and durable simulator replay are the next prerequisite.
