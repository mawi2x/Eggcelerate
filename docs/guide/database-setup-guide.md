# EGGCELERATE Database Setup Guide

> **Status:** Current implementation reference; the original pre-database checklist below has been superseded
> **Prepared:** 2026-09-04
> **Updated:** 2026-09-23
> **Scope:** Local backend and database preparation for PostgreSQL + TimescaleDB
> **Current limits:** Authentication and production deployment remain gated; physical actuator control is excluded.

This guide began as a proposal before the API and database existed. The current API,
Compose profiles, environment names and migration history are documented here for
reference; use the [backend guide](backend-dashboard-first-guide.md) and
[API README](../../apps/api/README.md) for the current implementation and commands.

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

## 2. Local database use

The initial frontend gate is complete. The current Compose setup keeps the
development database behind the `database` profile, binds its host port to
`127.0.0.1`, and stores data in a named volume. The separate `database-test`
profile uses a disposable database on port 55432. Run migrations and seeding
explicitly; API startup never creates schema or overwrites existing rows.

See the current start, migration, seed, and test commands in the
[API README](../../apps/api/README.md). Do not use `docker compose down -v` for
routine testing because that removes the development database volume.

## 3. Original schema decisions (historical proposal)

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

## 4. Initial logical schema proposal

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

## 5. Original contract normalization proposal

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

## 6. Current implementation status

### Migration history

| Revision | Schema change |
|---|---|
| `0001` | Farms, modes and atomic mode replay records |
| `0002` | Incubators, devices and device assignments |
| `0003` | Farm preferences and save replay |
| `0004` | Alerts, dismissal tombstones and action replay |
| `0005` | Cycles, runtime, terminal history and action replay |
| `0006` | Candling journals, photo references and replay |
| `0007` | Timescale telemetry hypertable and raw samples |
| `0008` | Durable device commands and acknowledgements |
| `0009` | Latest device telemetry projection |
| `0010` | Boot identity snapshot for each command dispatch |
| `0011` | Command claim index and restrictive incubator foreign key |

Migrations and development seed data run explicitly. Fresh and populated upgrade
proofs are in `apps/api/scripts/verify_migrations.py`; Alembic's schema drift
check is part of the API verification gate.

| Area | Current state |
|---|---|
| API contract and memory adapter | FastAPI/Pydantic endpoints and the in-memory repository are implemented; the web `ApiRepository` shares a tested HTTP contract with it. |
| Local database services | TimescaleDB/PostgreSQL 17 is opt-in through Compose profiles, with loopback-only development access and a separate disposable test database. |
| Schema and migrations | SQLAlchemy async sessions and Alembic migrations are implemented through revision `0011`; see the migration table above. |
| Persistent adapter | Farm configuration, alerts, cycles/history, candling, raw telemetry, latest telemetry state, and durable turn commands are persisted in the opt-in PostgreSQL backend. User accounts and authentication sessions are not implemented. |
| MQTT and device boundary | Validated telemetry, command outbox, and opt-in worker are implemented. The anonymous Mosquitto broker is limited to the local simulator network; physical hardware and production broker security are not included. |
| Authentication and public deployment | App-managed email/password is the selected sign-in approach, but implementation remains gated. Do not treat the local preview as a public service. |
| Operations | Readiness, fresh/populated migration verification, and schema drift checks exist. A verified production backup/restore drill has not been recorded. |

For implementation detail and runnable commands, use the [API README](../../apps/api/README.md)
and [backend guide](backend-dashboard-first-guide.md). The live frontend/API contract
and database gates are listed in [verification gates](verification-gates.md).

## 7. Original API proposal

This table records the initial design. The current HTTP contract is the FastAPI
OpenAPI document and the API README; do not treat this proposal as a route inventory.

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

Before a new production cutover, additionally prove:

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

The API, local database, migrations, frontend HTTP adapter and simulator-facing
MQTT path are implemented through migration `0011`. Public release remains gated
on app-managed sign-in and tenant authorization, broker security, backup restore
proof, and physical-device qualification; merely running the Compose stack does
not complete those gates.
