# EGGCELERATE Dashboard-First Backend Guide

> **Status:** Paused after B0A; resume at B0B
> **Prepared:** 2026-09-04
> **Scope:** Local FastAPI backend for the existing dashboard, followed by persistence and device simulation
> **Deferred:** Real authentication, user administration, production deployment, and physical actuator control

## 0. Pause and resume snapshot

Backend runtime development is intentionally paused while mobile frontend planning and improvement takes priority.

### Completed before the pause

- Frontend restructuring F0–F6 is complete.
- B0A added strict frontend Zod contracts for the API envelope, modes, incubators, readings, alerts, hatch/aborted history, preferences, and minimal incubator/cycle requests.
- Mode transport mapping explicitly converts domain hours to wire minutes.
- Incubator update contracts reject server-derived fields such as status and condition severity.
- Standalone `recordHarvest` and `recordAbortedCycle` methods were removed from the production repository contract. Atomic `completeCycle` and `stopCycle` remain.
- The B0A gate passed 159 tests across 22 files, scoped coverage, typecheck, Biome lint, production build, and `git diff --check`.

### Current uncommitted backend-scope files

Before unrelated implementation begins, checkpoint only these B0A/backend-plan changes after reviewing the working tree:

```text
apps/api/README.md
apps/web/src/app/data/repositories/repository.ts
apps/web/src/app/data/repositories/in-memory-repository.ts
apps/web/src/app/data/transport/contracts.ts
apps/web/src/tests/repository.test.ts
apps/web/src/tests/transport-contracts.test.ts
docs/SYSTEM_ARCHITECTURE_GUIDE.md
docs/guide/backend-dashboard-first-guide.md
```

Do not use `git add -A`; unrelated documentation, `.agents`, Vite, and PostCSS work is present in the working tree.

### Not started

- No FastAPI package or Python dependencies.
- No API Dockerfile or Compose service.
- No `ApiRepository` or frontend environment switch.
- No PostgreSQL, TimescaleDB, SQLAlchemy, Alembic, or migrations.
- No Mosquitto, MQTT client, WebSocket stream, or device simulator.
- No backend login/logout, JWT, cookies, users, memberships, or authorization.
- No ESP32 firmware or LED harness.

### Exact resume point

Resume at **B0B**, replacing broad `updateIncubator(id, Partial<Incubator>)` behavior with explicit repository commands. Do not redo B0A and do not scaffold FastAPI until B0 exits cleanly.

## 1. Outcome

Connect the completed React dashboard to a local FastAPI service without changing screen behavior. Begin with an in-memory backend, prove the HTTP contract through `ApiRepository`, then add PostgreSQL/TimescaleDB persistence and MQTT simulation.

The implementation order is:

```text
Current React screens
  -> existing feature hooks
  -> refined EggcelerateRepository commands
  -> ApiRepository
  -> FastAPI application services
  -> in-memory backend adapter first
  -> PostgreSQL/TimescaleDB adapter second
  -> Mosquitto + device simulator third
  -> ESP32 LED harness later
```

The frontend never imports backend models, SQL, or MQTT code. FastAPI never becomes the thermal safety loop; the future ESP32 remains the local safety authority.

## 2. Authentication decision for this milestone

Authentication is deliberately deferred while the dashboard data path is built.

- Keep `MockAuthProvider` and the existing login/onboarding screens as frontend-only demonstration behavior.
- Do not add FastAPI login, logout, refresh, registration, password hashing, JWT dependencies, cookies, user administration, or role enforcement yet.
- Add a backend `RequestContext` dependency now, but let `AUTH_MODE=disabled` resolve a fixed seeded development farm and actor.
- Keep `farm_id` on farm-owned persistence models so adding authentication later does not require rewriting ownership relationships.
- Do not accept a caller-selected farm ID as proof of authorization. In disabled mode the server supplies `DEFAULT_FARM_ID`; future authenticated mode will derive it from the verified session.
- Refuse application startup when `APP_ENV=production` and `AUTH_MODE=disabled`.
- Bind the local API to `127.0.0.1` by default and allow only explicit local frontend origins through CORS.

Suggested dormant context shape:

```text
RequestContext
  farm_id = configured development farm
  actor_id = "local-dashboard"
  role = "development"
  authenticated = false
```

Authentication becomes a separate later phase. At that point this dependency is replaced by session verification without changing dashboard services or SQL ownership filters.

## 3. Decisions frozen for the first API

### 3.1 API conventions

- Base path: `/api/v1`.
- JSON field names at the wire use `snake_case` and explicit units such as `_c`, `_pct`, and `_min`.
- IDs are opaque strings in HTTP DTOs. PostgreSQL-backed records use UUIDs, but clients do not parse their format.
- Timestamps use UTC RFC 3339 strings. Telemetry additionally retains device observation time and server receipt time.
- Successful operations use `{ "ok": true, "data": ... }` and may add a `meta` object for pagination.
- Failed operations use `{ "ok": false, "error": { "code", "message", "details"? } }`.
- Collection responses are deterministically ordered. Paginated collections use a cursor rather than page-number offsets when persistence begins.
- Create requests do not trust browser-generated IDs for durable entities. The API owns IDs and returns them.
- Derived fields such as cycle phase, connection state, condition severity, display status, and percentages are read-only response fields.
- Mutation requests use explicit command/resource DTOs rather than `Partial<Incubator>` over HTTP.
- Retriable state-changing commands accept an `Idempotency-Key` header.

### 3.2 Stable error mapping

| Result code | HTTP status | Meaning |
|---|---:|---|
| `validation_error` | 422 | Request shape or domain invariant is invalid |
| `not_found` | 404 | The requested resource does not exist in the active farm |
| `conflict` | 409 | Duplicate ID/name, active assignment, stale version, or incompatible state |
| `rejected` | 409 | A valid command was rejected by current domain/device state |
| `offline` | 503 | Required local service or device is unavailable |
| `timeout` | 504 | Confirmation was not received within the bounded command window |
| `unknown_error` | 500 | Unexpected server failure; internal details stay out of the response |

FastAPI validation errors must be normalized into the same error envelope rather than exposing a second frontend error shape.

## 4. Repository contract cleanup before `ApiRepository`

The current repository is a good UI boundary, but two mock-era patterns must not become public HTTP contracts.

### 4.1 Replace broad incubator patches with commands

`updateIncubator(id, Partial<Incubator>)` currently carries profile edits, mode changes, cycle start/reset, manual turn, connection simulation, and entire candling arrays. Keep the screen-facing hooks stable, but split the repository port into explicit operations before implementing HTTP:

- `updateIncubatorProfile(id, { name })`
- `updateIncubatorConfiguration(id, { modeId, autoTurn, turnIntervalHours })`
- `startCycle(id, { modeId, totalEggs })`
- `resetStoppedCycle(id)`
- `requestManualTurn(id)`
- `reconnectIncubator(id)`
- `createCandlingEntry(id, input)`
- `updateCandlingEntry(id, entryId, patch)`
- `deleteCandlingEntry(id, entryId)`
- `completeCycle(input)`
- `stopCycle(input)`

Application services—not route handlers or screens—derive the resulting status fields.

### 4.2 Remove test-only history writers from the public port

`recordHarvest` and `recordAbortedCycle` are used only by in-memory repository tests and lack stable cycle/incubator IDs. They should become private adapter helpers or a test-support extension. Dashboard history is produced only by atomic `completeCycle` and `stopCycle` commands.

All current observable behavior must remain covered while these operations are introduced. Do this as a focused frontend-boundary checkpoint before `ApiRepository`, not during database work.

## 5. Dashboard API map

### 5.1 Health and bootstrap

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/healthz` | Process liveness; no database dependency |
| `GET` | `/readyz` | Readiness of configured adapters |

Use the individual resource endpoints below as the authoritative dashboard data sources. Do not add a second aggregate bootstrap contract until measurements show that the separate requests are a problem.

### 5.2 Incubators and cycles

| Method | Path | Repository/application behavior |
|---|---|---|
| `GET` | `/api/v1/incubators` | List incubators for the request context farm |
| `POST` | `/api/v1/incubators` | Pair/create an incubator; server owns ID and derived state |
| `GET` | `/api/v1/incubators/{incubator_id}` | Get one incubator |
| `PATCH` | `/api/v1/incubators/{incubator_id}` | Update mutable profile/configuration fields only |
| `POST` | `/api/v1/incubators/{incubator_id}/reconnect` | Request a reconnect/handshake simulation |
| `POST` | `/api/v1/incubators/{incubator_id}/cycles` | Start a cycle |
| `POST` | `/api/v1/incubators/{incubator_id}/cycles/current/reset` | Reset a stopped cycle to Ready |
| `POST` | `/api/v1/incubators/{incubator_id}/cycles/current/complete` | Atomically complete cycle and create hatch history |
| `POST` | `/api/v1/incubators/{incubator_id}/cycles/current/stop` | Atomically stop cycle and create aborted history |
| `POST` | `/api/v1/incubators/{incubator_id}/commands/turn` | Request a manual turn; simulated until MQTT exists |
| `GET` | `/api/v1/incubators/{incubator_id}/readings?window=24h|7d|full` | Ordered readings for Trends and Detail |

### 5.3 Candling

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/incubators/{incubator_id}/cycles/current/candling-entries` | List current-cycle entries |
| `POST` | `/api/v1/incubators/{incubator_id}/cycles/current/candling-entries` | Validate and create an entry |
| `PATCH` | `/api/v1/incubators/{incubator_id}/cycles/current/candling-entries/{entry_id}` | Update notes/counts/photo metadata |
| `DELETE` | `/api/v1/incubators/{incubator_id}/cycles/current/candling-entries/{entry_id}` | Delete an entry and recompute the snapshot |

Image bytes are deferred. The first API may preserve fixture image references; production uploads require a separately reviewed storage contract.

### 5.4 Modes, alerts, history, and settings

| Method | Path | Purpose |
|---|---|---|
| `GET/POST` | `/api/v1/modes` | List or create modes |
| `GET/PATCH/DELETE` | `/api/v1/modes/{mode_id}` | Read, update, or delete a mode |
| `GET` | `/api/v1/alerts` | List alerts |
| `POST` | `/api/v1/alerts/{alert_id}/acknowledge` | Acknowledge one alert |
| `DELETE` | `/api/v1/alerts/{alert_id}` | Dismiss one alert |
| `POST` | `/api/v1/alerts/actions/acknowledge-all` | Atomically acknowledge all matching alerts |
| `POST` | `/api/v1/alerts/actions/clear-acknowledged` | Atomically clear acknowledged alerts |
| `GET` | `/api/v1/cycles?status=completed|stopped_early` | Project hatch or aborted-cycle history |
| `GET/PUT` | `/api/v1/preferences` | Read or replace the active farm's dashboard preferences |

Bulk alert actions are atomic in the first local implementation. No partial-success response is needed.

## 6. Backend package shape

```text
apps/api/
├── pyproject.toml
├── Dockerfile
├── src/eggcelerate_api/
│   ├── main.py
│   ├── config.py
│   ├── context.py
│   ├── errors.py
│   ├── api/v1/
│   ├── domain/
│   ├── application/
│   └── adapters/
│       ├── memory/
│       ├── postgres/       # added after HTTP contract passes
│       └── mqtt/           # added after persistence baseline
└── tests/
```

Use FastAPI and Pydantic with a `pyproject.toml`, pytest/httpx for API tests, and Ruff for Python lint/format checks. Pin exact versions when implementation starts and record the update policy. Route handlers validate and delegate; application services own use cases and transaction boundaries.

## 7. Implementation phases

### Phase dependency map

| Phase | Depends on | Produces | Must not pull forward |
|---|---|---|---|
| B0B | Completed B0A | Explicit dashboard repository commands and finalized wire examples | Python, Docker services, database |
| B1 | Completed B0 | In-memory FastAPI and reviewed OpenAPI | PostgreSQL, MQTT, auth |
| B2 | Passing B1 HTTP contract | `ApiRepository` and mock/API switch | Database-specific DTOs |
| B3 | Passing B2 behavior suite | Persistent PostgreSQL/TimescaleDB adapter | MQTT, auth tables |
| B4 | Stable persisted API | Mosquitto, simulator, REST hydration, WebSocket patches | Physical actuators |
| B5 | Passing simulator protocol | Safe four-LED ESP32 harness | Relays, motors, heaters, mains |
| B6 | Stable dashboard/API ownership | Real identity, membership, sessions, and authorization | Public deployment before its gate |

### B0 — Freeze the dashboard contract

- [ ] Write representative request, success, and failure JSON examples for every endpoint above.
- [ ] Add matching Zod schemas and transport mappers at the frontend boundary.
- [ ] Introduce explicit repository commands while preserving screen APIs.
- [x] Remove test-only history writers from the production repository port.
- [ ] Freeze the result envelope, error mapping, ID ownership, units, timestamps, ordering, and idempotency rules.
- [ ] Record that ADR-005/006 server-only control is superseded by the firmware safety contract.

**Exit:** every dashboard operation maps to an explicit service and no arbitrary derived state can be written over HTTP.

Checkpoint B0A: strict Zod schemas now define the shared result/error envelope, explicit-unit mode/incubator/reading DTOs, alerts, cycle-history projections, preferences, and minimal incubator/cycle requests. Contract tests reject derived incubator fields on writes and verify mode hour-to-minute mapping. Standalone `recordHarvest` and `recordAbortedCycle` methods were removed from the production repository; atomic `completeCycle` and `stopCycle` remain the only paths that create dashboard history. The remaining B0 work is response mapping, representative endpoint examples, and replacement of broad incubator updates with explicit commands.

### B1 — Scaffold a local in-memory FastAPI service

- [ ] Add the Python package, application factory, configuration validation, request context, and error normalization.
- [ ] Implement Pydantic request/response models matching the reviewed B0 examples.
- [ ] Add `/healthz`, `/readyz`, and OpenAPI output.
- [ ] Port deterministic fixture data into a backend in-memory adapter without importing TypeScript.
- [ ] Implement read endpoints first, then dashboard mutations.
- [ ] Add API tests for success, validation, missing resources, conflicts, atomic cycle completion/stop, and idempotent retry.
- [ ] Add an API Dockerfile and Compose `api` service bound to `127.0.0.1`.
- [ ] Keep database, MQTT, authentication, and hardware absent.

**Exit:** the full dashboard API passes against memory and OpenAPI is reviewed.

### B2 — Implement and switch `ApiRepository`

- [ ] Add `VITE_DATA_SOURCE=mock|api` and validated `VITE_API_URL` configuration.
- [ ] Implement fetch timeout, abort, response parsing, Zod validation, and stable error translation.
- [ ] Run shared observable-behavior tests against in-memory and HTTP repositories.
- [ ] Preserve loading, stale, offline, rejected, timeout, retry, and rollback UI states.
- [ ] Keep mock mode as the default until the HTTP adapter gate passes.

**Exit:** selecting API mode requires no screen changes and all dashboard flows work against FastAPI memory state.

### B3 — Add PostgreSQL and TimescaleDB

- [ ] Review the existing database setup WIP before implementation; do not edit it as part of this guide.
- [ ] Add version-pinned PostgreSQL/TimescaleDB and disposable test database services.
- [ ] Add SQLAlchemy 2.x async sessions and Alembic-only migrations.
- [ ] Initially create `farms`, `devices`, `incubators`, `modes`, `cycles`, `candling_entries`, `candling_photos`, `alerts`, `farm_preferences`, `device_commands`, and `telemetry_samples`.
- [ ] Seed one deterministic development farm matching `DEFAULT_FARM_ID`.
- [ ] Defer `users`, `refresh_tokens`, and `farm_memberships` until authentication work begins.
- [ ] Port vertical slices in this order: modes, incubators, preferences, alerts, cycles/candling/history, readings.
- [ ] Prove restart persistence, migration upgrade, transaction rollback, and shared adapter behavior.

**Exit:** API mode survives restart and is behaviorally equivalent to the in-memory service for dashboard operations.

### B4 — Add MQTT and a software device simulator

- [ ] Reconcile ADR-007 payloads with explicit `command_id`, schema version, device sequence, observation time, receipt time, and ACK correlation.
- [ ] Add Mosquitto and a Python simulator through Compose.
- [ ] Persist validated five-minute research samples while allowing a faster live stream.
- [ ] Add REST hydration before WebSocket cache patches.
- [ ] Test duplicate, delayed, out-of-order, offline, rejected, and timed-out messages.
- [ ] Keep all actuator behavior simulated.

**Exit:** dashboard → API → MQTT simulator → ACK → persisted/audited result works without hardware.

### B5 — Add the ESP32 LED harness

- [ ] Select the exact board and safe GPIO map.
- [ ] Use LEDs for heater, fan, humidifier, and egg-turn outputs; no alarm channel.
- [ ] Simulate sensors first and verify safe boot/watchdog behavior.
- [ ] Keep real relays, motors, heaters, mains voltage, and physical actuator control disconnected.

**Exit:** the hardware protocol is demonstrated safely without treating LEDs as proof of actuator safety.

### B6 — Add authentication later

- [ ] Review ADR-004 rather than activating it automatically; choose the final server-session/token design at that time.
- [ ] Add users and memberships through new migrations.
- [ ] Replace disabled `RequestContext` resolution with verified identity and farm membership.
- [ ] Add login/logout/session endpoints, secure cookie behavior, authorization, and cross-farm denial tests.
- [ ] Refuse public deployment until this phase and production hardening pass.

**Exit:** every HTTP and WebSocket operation is tenant-authorized. This phase is not required for the local dashboard backend milestone.

## 8. Environment contract

The first local API configuration should contain names only in `.env.example`; real values remain ignored.

```text
APP_ENV=development
AUTH_MODE=disabled
DEFAULT_FARM_ID=00000000-0000-0000-0000-000000000001
API_HOST=0.0.0.0                # inside the container
API_PORT=8000
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
DATABASE_URL=                   # added in B3
MQTT_URL=                       # added in B4
VITE_DATA_SOURCE=mock
VITE_API_URL=http://127.0.0.1:8000/api/v1
```

Compose publishes API port 8000 to host `127.0.0.1` only. `AUTH_MODE=disabled` is a local-development capability, not a deployment shortcut.

## 9. Checkpoint gates

Every backend checkpoint runs:

```text
frontend lint, typecheck, tests, scoped coverage, and production build
Python lint/format check
Python type check selected during B1 scaffolding
API unit and contract tests
OpenAPI generation/diff review
Docker image build and Compose configuration validation
git diff --check
```

Database checkpoints additionally run migrations against a disposable empty database and adapter integration tests. MQTT checkpoints additionally run simulator integration tests. Browser automation is not part of these gates.

## 10. Immediate implementation batch

The next coding batch is **B0 only**:

1. Add transport DTO schemas and fixture examples.
2. Refine the repository port into explicit commands with regression tests.
3. Write the OpenAPI-facing endpoint/error contract.
4. Keep all current frontend checks green.
5. Review the contract before adding Python dependencies, containers, or database services.

Do not start authentication, PostgreSQL, MQTT, or ESP32 work inside B0.

## 11. Resume procedure

When backend work resumes:

1. Confirm the B0A files above are committed separately from mobile UI changes.
2. Read this guide, `apps/api/README.md`, the System Architecture Guide, and the firmware safety contract.
3. Read the database setup guide as input, but reconcile its authentication sequence with the deferred-auth decision here before editing or implementing it.
4. Inspect the current `EggcelerateRepository`, in-memory adapter, farm hooks, transport contracts, and repository tests; current source wins over stale examples.
5. Run the baseline gate before editing:

```sh
pnpm lint
pnpm --filter eggcelerate-ui typecheck
pnpm --filter eggcelerate-ui test
pnpm --filter eggcelerate-ui coverage
pnpm --filter eggcelerate-ui build
git diff --check
```

6. Implement B0B test-first, one command family at a time: profile/configuration, cycle lifecycle, manual turn/reconnect, then candling.
7. Preserve screen behavior and TanStack Query rollback semantics during the command split.
8. Update this guide only for work actually completed and record the exact gate counts.

## 12. Decisions that must survive the pause

- Dashboard first; authentication remains dormant until B6.
- Disabled auth is local-only, supplies a configured development farm, and is forbidden in production.
- The server owns durable IDs; display names are never identifiers.
- Domain/UI turning intervals use hours; HTTP/device wire values use minutes.
- Derived health, condition, cycle, and percentage fields are response-only.
- Cycle completion and stopping are atomic and idempotent.
- REST hydration precedes WebSocket patching.
- Research telemetry persistence and live sampling are separate rates.
- The browser never connects directly to MQTT.
- The ESP32—not FastAPI—is the thermal safety authority.
- No alarm channel is planned for the initial LED harness.
- Do not create empty adapters, tables, services, or packages ahead of their phase.

## 13. Required checkpoint handoff format

At the end of every resumed backend checkpoint, record:

```text
Checkpoint:
Completed scope:
Files added/changed:
Contracts changed:
Migrations added:
Environment variables added:
Tests and counts:
Coverage:
Docker/Compose verification:
Known limitations:
Exact next phase:
Unrelated working-tree files left untouched:
```

This record is required before switching back to frontend, database, MQTT, or firmware work. It prevents later sessions from inferring completion from folders or placeholder files.
