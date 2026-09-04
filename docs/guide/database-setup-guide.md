# EGGCELERATE Database Setup Guide

> **Status:** Planned — implementation must wait for the frontend F5/F6 exit gate
> **Prepared:** 2026-09-04
> **Scope:** Local backend and database preparation for PostgreSQL + TimescaleDB
> **Out of scope:** MQTT provisioning, ESP32 firmware, production deployment, and frontend redesign

## 1. Outcome

Introduce persistence without changing the frontend's feature behavior or coupling React components to database details.

The finished path is:

```text
React screens
  -> feature query/mutation hooks
  -> EggcelerateRepository contract
  -> ApiRepository
  -> FastAPI /api/v1 endpoints
  -> application services and transactions
  -> SQLAlchemy repositories
  -> PostgreSQL + TimescaleDB
```

The in-memory repository remains the reference implementation and local mock option. The API and database implementations must satisfy the same behavior and structured result contract.

## 2. Start conditions

Do not provision the database until all of these are true:

- [ ] Frontend F5 selector/hook and keyboard/responsive checks are closed.
- [ ] Frontend typecheck, tests, coverage policy, lint, build, Docker build, and `git diff --check` pass.
- [ ] The current uncommitted F5/F6 checkpoint is committed.
- [ ] ADR-005 and ADR-006 are superseded so local ESP32 safety control is authoritative; FastAPI may coordinate and audit but must not be the only thermal control loop.
- [ ] ADR-002 (FastAPI), ADR-003 (PostgreSQL + TimescaleDB), and ADR-004 (authentication) are reconciled with `apps/api/README.md` and the System Architecture Guide.
- [ ] The canonical ADR location is agreed, even if documentation remains local during the current solo-development phase.

Schema design may continue before these checks pass. Running database services, creating migrations, and adding `ApiRepository` begin only after the checks pass.

## 3. Decisions to freeze before migration 0001

### 3.1 Identity and tenancy

- Use PostgreSQL `uuid` columns for durable IDs.
- Keep `userId`, `farmId`, `incubatorId`, `deviceId`, `cycleId`, and record IDs distinct.
- Use `farm_id` as the tenant boundary for farm-owned records.
- Use a `farm_memberships` table rather than copying ownership rules into every handler.
- Display names are mutable labels and never foreign keys.

### 3.2 Time and units

- Store timestamps as `TIMESTAMPTZ` in UTC; localize only for display.
- Store temperature in Celsius and humidity as relative percentage.
- Store the device/wire turn interval in minutes; map to frontend domain hours at the transport boundary.
- Store the float sensor as `water_ok BOOLEAN`; retire the mock-only numeric `Reading.water` field at the API mapper.
- Persist research telemetry at a fixed five-minute interval unless the research protocol explicitly changes it. Live sampling and UI refresh frequency remain separate settings.

### 3.3 Historical integrity

- Snapshot mode setpoints onto a cycle when it starts so later mode edits cannot rewrite history.
- Complete/stop-cycle operations are single database transactions.
- Commands use client-generated idempotency keys so retries cannot create duplicate harvest, stop, or actuator records.
- Store image metadata and an object/file key in PostgreSQL; do not store base64 candling images in normal relational rows.

### 3.4 Derived state

Cycle phase, condition severity, percentages, and display status remain derived domain values unless a historical snapshot or query-performance requirement proves otherwise. Database constraints protect raw facts; shared domain/application services calculate presentation state.

## 4. Initial logical schema

| Table | Purpose | Important relationships and constraints |
|---|---|---|
| `users` | Login identity | Unique normalized email; password hash only; timestamps |
| `refresh_tokens` | Revocable sessions | User FK; store a token hash, expiry, revocation time, and rotation lineage |
| `farms` | Tenant/account boundary | Name, timezone, timestamps |
| `farm_memberships` | User access to farms | Composite unique `(farm_id, user_id)`; role constraint |
| `devices` | Provisioned physical controllers | Farm FK; unique serial/provisioning identity; firmware and last-seen fields |
| `incubators` | User-facing chambers | Farm FK; nullable/unique active device assignment; mutable display name |
| `modes` | Reusable incubation presets | Farm FK for custom modes; built-in flag; version; validated setpoints and wire-minute turning interval |
| `cycles` | Incubation lifecycle | Incubator/mode FKs; status; counts; start/end; mode snapshot; optimistic version |
| `candling_entries` | Cycle observations | Cycle FK; checkpoint/day/count constraints; author and timestamp |
| `candling_photos` | Photo metadata | Entry FK; storage key, MIME type, byte size, checksum |
| `alerts` | Farm/device/incubator events | Stable incubator/device FKs; severity/code; acknowledge/dismiss audit fields |
| `farm_preferences` | Repository-backed settings | One row per farm; explicit columns for stable settings, JSONB only for genuinely extensible preferences |
| `telemetry_samples` | Five-minute research telemetry | Timescale hypertable partitioned by `observed_at`; device FK; composite uniqueness includes the time partition key |
| `device_commands` | Command lifecycle and audit | Device/cycle/requester FKs; idempotency key; requested/published/acknowledged/failed timestamps and error code |

Completed hatch history and aborted-cycle history should initially be API projections over terminal `cycles`, not duplicated tables. Add dedicated outcome tables only if a real one-to-many outcome requirement appears.

### Required constraints

- `0 <= humidity_pct AND humidity_pct <= 100`
- battery and fan percentages remain within `0..100`
- egg counts are non-negative
- `hatched_eggs <= fertile_eggs <= total_eggs` when fertility is known
- cycle terminal timestamps match terminal statuses
- built-in modes cannot be deleted through farm APIs
- one active cycle per incubator
- every tenant-owned lookup includes an authorized `farm_id`
- telemetry uniqueness includes `observed_at`, because Timescale hypertable unique indexes must contain partition columns

## 5. Contract normalization before persistence

The current frontend repository contract is the behavioral baseline, but several mock-era fields must not become database keys:

| Current field | Database/API replacement |
|---|---|
| `AlertEntry.unit` | `incubator_id`, with an optional mapped display name in responses |
| `HatchRecord.chamber` | `cycle_id` and `incubator_id`; chamber name is a historical snapshot or response projection |
| `HatchRecord.modeName` | `mode_id` plus the cycle's mode-name snapshot |
| `AbortedCycleRecord.incubator` | `cycle_id` and `incubator_id` |
| `AbortedCycleRecord.modeName` | `mode_id` plus mode snapshot |
| `Reading.water` | `water_ok` on wire/database DTOs |
| optional candling entry ID | required server-created UUID after persistence |

Create versioned Zod and Pydantic transport schemas for these shapes. Keep compatibility mapping inside `ApiRepository`; do not make screens understand migration fields.

## 6. Execution phases

### DB0 — Close architecture and API contracts

- [ ] Complete the frontend F5/F6 exit gate.
- [ ] Supersede the server-only automation statements in ADR-005/006.
- [ ] Confirm FastAPI and PostgreSQL/TimescaleDB as accepted choices in all local guides and READMEs.
- [ ] Write `/api/v1` request/response schemas and stable error codes.
- [ ] Map every `EggcelerateRepository` method to an endpoint or explicitly defer it.
- [ ] Freeze ID ownership, units, timestamps, pagination, and idempotency behavior.

**Exit:** no unresolved contract changes would force migration 0001 to be rewritten.

### DB1 — Build the API against memory first

- [ ] Scaffold `apps/api` with FastAPI, Pydantic, a health endpoint, and dependency-injected application services.
- [ ] Implement read endpoints using an in-memory adapter.
- [ ] Add mutation endpoints with structured errors and transaction-shaped service boundaries.
- [ ] Generate and review OpenAPI output.
- [ ] Add API contract tests for success, validation, missing resources, authorization, conflict, timeout, and idempotent retry.
- [ ] Keep MQTT and device commands simulated.

**Exit:** the API contract is testable without PostgreSQL, and no route handler contains SQL.

### DB2 — Add local PostgreSQL + TimescaleDB infrastructure

- [ ] Add a version-pinned TimescaleDB image to Compose; never use `latest`.
- [ ] Add a named development volume and `pg_isready` healthcheck.
- [ ] Keep the database off public interfaces; expose it only to the Compose network or bind a development port to `127.0.0.1` when a local client is required.
- [ ] Add `.env.example` with non-secret names such as `DATABASE_URL`, `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`.
- [ ] Keep real credentials and volume data ignored.
- [ ] Create a separate disposable test database configuration.
- [ ] Document start, stop, logs, reset, and backup commands; database reset must require an explicit confirmation because it destroys local data.

**Exit:** the database becomes healthy from a clean clone without manually executing schema SQL.

### DB3 — Add SQLAlchemy models and Alembic migrations

- [ ] Use SQLAlchemy 2.x and one `AsyncSession` per request/transaction.
- [ ] Use Alembic as the only schema-change path.
- [ ] Migration 0001 enables TimescaleDB and creates identity/tenant tables.
- [ ] Migration 0002 creates devices, incubators, modes, cycles, candling, alerts, and preferences.
- [ ] Migration 0003 creates command audit storage.
- [ ] Migration 0004 creates the empty telemetry hypertable and indexes.
- [ ] Review generated migrations manually for constraints, indexes, server defaults, extension operations, and downgrade safety.
- [ ] Add deterministic development seed data separately from migrations.

**Exit:** migrations upgrade an empty database and API startup never creates or mutates schema implicitly.

### DB4 — Implement the persistent adapter

- [ ] Implement persistence behind application-service interfaces rather than inside route handlers.
- [ ] Port repository operations in vertical slices: modes, incubators, settings, alerts, cycles/candling, then history/readings.
- [ ] Make complete-cycle and stop-cycle writes atomic.
- [ ] Use optimistic version checks for user-edited resources.
- [ ] Translate database/HTTP failures into stable `ResultError` codes.
- [ ] Run the shared repository behavior suite against both in-memory and database-backed implementations.

**Exit:** restarting the API preserves data and both adapters expose equivalent observable behavior.

### DB5 — Add telemetry persistence deliberately

- [ ] Validate telemetry at ingestion and retain both device observation time and server receipt time.
- [ ] Reject or quarantine impossible values without marking the device healthy.
- [ ] Persist at the agreed five-minute research interval; do not accidentally store every UI refresh as a new observation.
- [ ] Create indexes for `(device_id, observed_at DESC)` and cycle/time queries.
- [ ] Decide retention and aggregate policies from measured volume before enabling automatic deletion.
- [ ] Test out-of-order, duplicate, delayed, and clock-skewed samples.

**Exit:** 24-hour, 7-day, and full-cycle reading queries return deterministic ordered data within an agreed latency budget.

### DB6 — Add authentication and tenant enforcement

- [ ] Store password hashes only.
- [ ] Store hashed, rotated, revocable refresh tokens.
- [ ] Use secure HTTP-only cookies in the deployed environment.
- [ ] Authorize every farm-owned query and mutation in the application layer.
- [ ] Add cross-farm denial tests and WebSocket authentication tests before realtime work.
- [ ] Consider PostgreSQL row-level security only as defense in depth; it does not replace application authorization.

**Exit:** one farm cannot read or mutate another farm's data through any tested endpoint.

### DB7 — Connect the frontend through `ApiRepository`

- [ ] Add a validated `VITE_API_URL` environment contract and `.env.example` entry.
- [ ] Implement `ApiRepository` without changing screen APIs.
- [ ] Keep the in-memory adapter selectable for deterministic local demos/tests.
- [ ] Run shared contract tests against the live API adapter.
- [ ] Hydrate through REST first; add WebSocket cache patches only afterward.
- [ ] Preserve pending, rejected, timeout, stale, offline, retry, and rollback UI states.

**Exit:** changing repository selection switches between mock and persisted data without feature-component changes.

### DB8 — Operational readiness

- [ ] Test migration upgrade from a clean database and from the previous released revision.
- [ ] Test backup and restore, not just backup creation.
- [ ] Document rollback/roll-forward policy; never run destructive downgrades automatically in production.
- [ ] Add API and database health/readiness checks.
- [ ] Add pool, slow-query, storage-growth, migration, and failed-command observability.
- [ ] Pin service versions and document the update process.

**Exit:** persistence can be deployed, upgraded, backed up, and restored predictably.

## 7. Initial API map

| Repository behavior | Proposed API |
|---|---|
| List/get/add/update incubators | `GET/POST /api/v1/incubators`, `GET/PATCH /api/v1/incubators/{id}` |
| List readings | `GET /api/v1/incubators/{id}/readings?window=24h|7d|full` |
| Mode CRUD | `GET/POST /api/v1/modes`, `PATCH/DELETE /api/v1/modes/{id}` |
| Alert operations | `GET /api/v1/alerts`, command-style subresources for acknowledge/dismiss/clear |
| Complete or stop a cycle | `POST /api/v1/incubators/{id}/cycles/{cycleId}/complete|stop` |
| Hatch/aborted history | `GET /api/v1/cycles?status=completed|stopped_early` |
| Settings | `GET/PUT /api/v1/farms/{farmId}/preferences` |

Bulk alert operations and actuator-affecting commands must define idempotency and partial-failure semantics before implementation.

## 8. Verification matrix

Every database checkpoint should run:

```text
frontend typecheck, tests, lint/coverage policy, and build
API unit and contract tests
migration upgrade on an empty disposable database
database adapter integration tests
shared in-memory/database behavior tests
Docker/Compose configuration validation
git diff --check
```

Before frontend cutover, additionally prove:

- process restart persistence;
- transaction rollback on the second half of complete/stop-cycle operations;
- duplicate idempotency-key behavior;
- tenant isolation;
- ordered and bounded telemetry queries;
- migration from the prior schema revision;
- backup restoration.

Browser automation is not part of this gate. Use Vitest/jsdom, API tests, database integration tests, and focused manual browser review.

## 9. Implementation boundaries

- React never imports SQL or database models.
- Route handlers validate and delegate; application services own use-case transactions.
- SQLAlchemy models are persistence models, not frontend DTOs.
- Alembic migrations are committed implementation artifacts, not local setup notes.
- MQTT does not write directly to tables; validated ingestion services own persistence.
- The backend records commands and acknowledgements, but the ESP32 retains autonomous safety control.
- Do not add continuous aggregates, aggressive retention, partition-by-device, or extra indexes until test data demonstrates the need.

## 10. Official implementation references

- [SQLAlchemy 2.0 documentation](https://docs.sqlalchemy.org/en/20/)
- [SQLAlchemy session guidance](https://docs.sqlalchemy.org/en/20/orm/session_basics.html)
- [Alembic migration documentation](https://alembic.sqlalchemy.org/en/latest/)
- [PostgreSQL UUID type](https://www.postgresql.org/docs/current/datatype-uuid.html)
- [TimescaleDB hypertables](https://docs.timescale.com/use-timescale/latest/hypertables/)
- [TimescaleDB unique-index constraints](https://docs.timescale.com/use-timescale/latest/hypertables/hypertables-and-unique-indexes/)

## 11. Definition of database-ready

Database setup is ready to start when DB0 is complete. Database setup is finished only when DB1 through DB8 meet their exit criteria. Merely running a TimescaleDB container is not completion.
