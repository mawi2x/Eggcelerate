# EGGCELERATE Dashboard-First Backend Guide

> **Status:** B3 exit passed; B4 telemetry boundary implemented, command reconciliation next
> **Prepared:** 2026-09-04
> **Scope:** Local FastAPI backend for the existing dashboard, followed by persistence and device simulation
> **Deferred:** Real authentication, user administration, production deployment, and physical actuator control

## 0. Current handoff (2026-09-15)

B0–B2 are recorded complete. B3 now persists farms, modes, chamber/device configuration, farm preferences, alerts, cycle runtime, terminal history, candling journals/photo references, and their replay records. Migration 0007 adds internal telemetry ingestion and raw/five-minute research queries; PostgreSQL dashboard readings now use stored samples. The local dashboard B3 exit passed; see [the final review](b3-exit-review.md) for evidence and recorded scope limits.
The dated checkpoints below are historical evidence, not current resume instructions.

### Evidence and limitations

- The latest candling gate passed 283 frontend tests (34 files), coverage, lint/typecheck/build, 69 API tests including PostgreSQL integration, Ruff/mypy (28 source files), and 28/28 live repository cases on an isolated farm. Packaged API migration 0006 and schema drift are verified.
- Simulator S0/S1/GUI and 22 unittest results are user-reported for the separate `eggcelerate-simulate` repository; its source and revision were not verified here. Simulator completion does not establish API/MQTT integration.
- Candling create/update/delete, cycle start/reset/complete/stop, alert actions, settings saves and chamber create/profile/configuration/reconnect retries now reuse one logical key through the hook and HTTP adapter. Mode create/update/delete and manual-turn hooks now preserve keys across retries as well.
- Wire examples now describe the current memory readiness response and accepted B1 mutation shapes; all seven error codes have examples. Operational health/readiness responses use their own shapes rather than the dashboard result envelope.
- Commit `035f555` contains the alerts, cycle, candling and readings-foundation slices. The earlier “implement cycle-scoped candling entries and photo metadata” prompt is already fulfilled by migration 0006; resume at the remaining B3 command retry gate in section 10.

### Implemented versus planned

The main repository has in-memory FastAPI, API Docker/Compose configuration, `ApiRepository`, the mock/API switch, and an opt-in `postgres_incubators` backend (`postgres_modes` remains a configuration alias). PostgreSQL currently persists farms/modes, chamber/device configuration, preferences, alerts, cycle runtime, terminal history, candling journals/photo references, and their replay records. Other persistence slices, API MQTT integration, WebSockets, real authentication, and hardware integration remain future work.

MQTT QoS/retention, 15-second live cadence, and five-minute research avg/min/max/count are requirements to reconcile and verify during B3/B4, not integration results from this review. Authentication remains deferred to B6; no VPS/public deployment before that gate.

Error mapping: `validation_error` → 422; `not_found` → 404; `conflict` and `rejected` → 409; `offline` → 503; `timeout` → 504; `unknown_error` → 500.

### B3 candling checkpoint (2026-09-14)

- **Changes:** migration 0006 adds cycle-owned entries, ordered photo-reference metadata and replay receipts. Unique cycle/day and scoped foreign keys enforce ownership. Deletion tombstones survive seeding; fixture entries stay with their original cycles. Archived journals survive completion/reset while current endpoints show the current visible journal.
- **Validation/contract:** per-count loaded-egg bounds, merged PATCH validation, and rejection of writes to ready chambers. DELETE adds an optional replay header; response shapes and 22 API paths remain unchanged. API deletion now sends DELETE; the shared test explicitly requires success. No file-upload service or archived-journal endpoint was added.
- **Retries:** frontend stores the original per-entry action plan and keys, and retains resolved update/delete targets. Six behavior tests cover lost committed responses and lost follow-up GETs across create/update/delete.
- **Verification:** 69 API tests; 283 frontend tests; 28/28 isolated live cases; coverage 89.30% lines, 82.87% branches, 82.66% functions; lint/typecheck/build and Ruff/mypy (28 source files). Tests cover tombstones, photo replacement/order, old replay without overwriting newer edits, archived-cycle and farm isolation, partial entry/photo/receipt rollback, concurrent same-day creates, and populated migration preservation. Packaged API is at `0006 (head)` with clean schema drift.
- **Restart proof:** journals, ordered photo references, deleted entries and exact create/update/delete replay survived an actual API/database restart and repeated seeding on an isolated farm in the named development volume. Temporary proof container removed. Explicit recreation of deleted seeded days is also covered.
- **Limits:** remaining state is `readings_memory`; manual-turn acceptance/replay and mode-hook retry continuity still need B3 exit review. Existing journal changes from before 0006 were volatile and cannot be recovered by migration. Photo keys are references, not uploaded files. Prior uncommitted work is preserved; no commit created.
- **Next:** persistent readings and Timescale aggregation, then finish remaining B3 command/replay gates before B4.

### Historical B3 cycle checkpoint (2026-09-13)

- **Changes:** migration 0005 adds cycle identity, chamber runtime, terminal history and replay. Constraints permit one active cycle per chamber and one terminal outcome per cycle, with scoped foreign keys. Historical mode/name snapshots survive later edits. Runtime persists day/egg counts, phase and turn timestamps.
- **Behavior:** start/reset preserve existing replacement semantics, closing replaced active cycles as reset. Complete/stop commit runtime, history and receipt together; a competing terminal action returns 409. Stopped state survives unrelated updates. Public DTO fields and 22 OpenAPI paths remain unchanged.
- **Retries:** start/reset/complete/stop hooks preserve their logical key, including failures in follow-up GET composition. Old-key replay returns its saved response without replacing newer runtime.
- **Verification:** 63 API tests; 277 frontend tests; 28/28 isolated live repository cases; coverage 87.18% lines, 84.71% branches, 80.64% functions; lint/typecheck/build and Ruff/mypy (27 source files). Tests cover partial-write rollback, separate-instance complete/stop races, same-key replay, seed/restart preservation, scoped constraints, and populated 0004→0005 upgrade/downgrade preserving earlier slices.
- **Live proof:** packaged API reports `0005 (head)` and schema drift is clean. Active/completed/stopped/reset states, both terminal histories and all four exact replay responses survived a database/API container restart and repeated seeding on an isolated farm in the named development volume. Temporary proof container removed.
- **Limits:** remaining state is `candling_readings_memory`. Initial runtime bootstrap uses development fixtures; pre-0005 volatile changes cannot be recovered. Cycle day progression keeps existing behavior, without a scheduler. Candling stays volatile but cannot be attached to a newer loaded cycle. Manual-turn acceptance/replay remains volatile despite durable timestamps. Full B3 remains open; B4/B6 remain gated. No commit created; prior alerts work preserved.
- **Next:** cycle-scoped candling entries and photo metadata (0006), then readings.

### Historical B3 alerts checkpoint (2026-09-13)

- **Changes:** migration 0004 adds farm-scoped alert columns, acknowledgement timestamps, dismissal tombstones and replay receipts. The configured backend name remains `postgres_incubators`, with `postgres_modes` accepted as an alias. Readiness requires 0004 and seeded alert rows; hidden rows count when the visible list is empty.
- **Contract:** optional `Idempotency-Key` headers added to acknowledge, dismiss, acknowledge-all and clear-acknowledged. Existing envelopes and paths are unchanged. The frontend preserves one key through Retry; fresh actions receive fresh keys. Older replay responses do not reapply mutations or resurrect removed alerts.
- **Verification:** 56 API tests; 269 frontend tests; 24/24 isolated live repository cases; coverage 84.34% lines, 83.82% branches, 77.91% functions; lint/typecheck/build and Ruff/mypy (25 source files). Populated migration upgrade/downgrade preserves preference edits and receipts. Tests prove unread preservation, seed/restart survival, bulk rollback, farm isolation and concurrent same-key dismissal.
- **Live proof:** packaged API build and migration `0004 (head)` verified; schema drift check passes. All four exact replay responses and dismissal tombstones survived an actual database/API container restart and repeated seeding on an isolated farm in the named development volume. The temporary proof container was removed; default-farm alert actions were not changed by the proof.
- **Limits:** `cycles_candling_readings_memory` remains volatile. Alert generation from telemetry is still deferred. Full B3 remains open; B4 MQTT and B6 auth boundaries remain unchanged. Existing Vite chunk and upstream Python dependency warnings remain.
- **Next:** persist cycles, then candling/history and readings.

### Historical B3 preferences checkpoint (2026-09-13)

- **Changes:** migration 0003 adds explicit preference columns, an extensible JSONB notification-toggle map and farm-scoped replay receipts. Reads and replacements use the existing SQL farm transaction. Missing preference rows fail closed; seeding repairs missing rows without overwriting edits.
- **Retries:** settings saves retain their operation key through frontend Retry. Replaying an old save returns the original response without replacing newer settings; payload mismatches return 409.
- **Verification:** 49 API tests; 265 frontend tests; coverage 82.78% lines, 83.08% branches, 70.76% functions; frontend lint/typecheck/build; Ruff check/format and mypy on 24 source files. Populated 0002→0003 upgrade/downgrade preserves existing configuration and receipts. Database schema drift check passes.
- **Live proof:** 24/24 shared repository cases passed against an isolated disposable test farm. Preferences and exact replay survived an actual API/database restart with the development volume retained; original preferences were restored. Packaged API reports `0003 (head)`.
- **Environment:** `postgres_incubators` remains the configured backend, with `postgres_modes` accepted as an alias. Readiness now requires 0003 and seeded preferences; remaining state is `cycles_candling_alerts_readings_memory`.
- **Limits:** alerts, cycles/candling/history, readings and turn timestamps remain volatile. Full B3 is open; B4 and B6 boundaries are unchanged. Existing Vite chunk-size and upstream TestClient deprecation warnings remain. No commit created.
- **Next:** alerts persistence (0004), then cycles/candling/history and readings.

### Historical B3 chamber/device checkpoint (2026-09-13)

- **Completed scope:** persistent chamber names, mode assignments, auto-turn/interval settings, device assignments and pairing flag; farm-scoped SQL foreign keys, case-insensitive device uniqueness, and single-chamber assignment constraints. Profile/configuration/create/reconnect results replay atomically with their writes. Fresh API instances hydrate persisted configuration before executing the existing service logic.
- **Files added/changed:** `database/store.py` (renamed from modes.py), new `database/incubators.py`, metadata/migration 0002, seed/configuration/dependency wiring, shared pytest fixtures and chamber integration tests; frontend repository mutation options, HTTP key forwarding, hook Retry propagation, mock duplicate-device guard, and behavioral tests. README/environment example/this guide updated; unrelated visual work preserved.
- **Migrations:** `0002` adds `devices`, `incubators`, and `incubator_idempotency`, plus a composite mode identity constraint. A populated 0001 upgrade is tested with existing mode edits and replay data intact. Seeding inserts missing defaults without replacing existing chamber/device edits.
- **Environment:** canonical backend is `STORAGE_BACKEND=postgres_incubators`; `postgres_modes` is a backward-compatible configuration alias to the expanded slice. Readiness requires 0002 and seeded chambers, reports the still-volatile collections, and fails closed on missing database state.
- **Contracts:** all 22 paths and OpenAPI schemas unchanged from the modes checkpoint. Duplicate device assignment returns 409 in Python and the frontend memory repository. Four frontend action families now keep the same key on Retry while a separate user action receives a new key; other action families remain deferred.
- **Verification:** 45 API tests; 264 frontend tests; 24/24 live shared repository cases; Ruff including migrations and mypy on 23 source files; frontend lint/typecheck/build and scoped coverage (82.14% lines, 82.99% branches, 68.51% functions); API Docker build, Compose configuration, migration 0002 and schema drift checks. SQL tests cover rollback of chamber/device/replay writes, cross-farm FK rejection, concurrent same-key replay and different-key assignment conflicts, changed-payload replay, and restart/seeding preservation. Frontend tests cover lost committed responses through the actual hook and HTTP adapter for create/profile/configuration/reconnect.
- **Live restart proof:** restarted API + development DB without removing the volume; profile, configuration, device assignment and original replay results survived. Original proof chamber settings were restored. Live shared tests mutate their target farm, so use a disposable target for subsequent parity runs.
- **Known limitations:** cycle counters/state/history, candling, sensor values, and turn timestamps are not yet durable. Seeded chambers restart with their fixture cycle/sensor projection; newly created chambers restart with a ready simulation projection, overlaid with durable configuration. Preferences and alerts also remain volatile. Use one API worker until these remaining collections persist; farm-level serialization is transitional. Pairing is a simulation/configuration flag, not hardware ACK evidence. Other hook retries still need stable-key propagation.
- **Exact next phase:** preferences (migration 0003), then alerts, cycles/candling/history, and readings; full B3 remains open and B4 remains gated.
- **Working tree:** no commit made; preserve pre-existing UI edits and keep the database setup WIP unchanged when selectively staging this checkpoint.

### Historical B3 farms/modes checkpoint (2026-09-13)

- **Completed scope:** pinned TimescaleDB/PostgreSQL development and tmpfs test services; SQLAlchemy 2.0.52 async sessions with asyncpg 0.31.0; Alembic 1.20.0 migrations; repeatable seed; durable mode CRUD and same-key POST/PATCH replay. Internal UUIDs preserve public string IDs. SQL mode changes and replay receipts commit together; a farm row lock coordinates separate API instances. Existing service logic remains authoritative.
- **Files added/changed:** `apps/api/src/eggcelerate_api/database/`; `alembic.ini`, `migrations/`, `tests/test_postgres_modes.py`, API configuration/dependency/lifespan wiring, dependency pins/Dockerfile, Compose, `.env.example`, API README, this guide. No frontend feature edits in this slice.
- **Migrations:** `0001` installs/verifies the Timescale extension and creates only the currently used `farms`, `modes`, and `mode_idempotency` tables. Later slices add the remaining B3 tables. No auth tables or unused telemetry hypertable were scaffolded.
- **Environment:** `STORAGE_BACKEND=memory|postgres_modes` (memory default); `DATABASE_URL` requires `postgresql+asyncpg://` for postgres_modes; `POSTGRES_PASSWORD` configures the new development database; `TEST_DATABASE_URL` opts into disposable-database tests. Runtime does not migrate, seed, or silently fall back.
- **Contracts:** dashboard paths and component schemas unchanged (22 paths). `/readyz` now supports adapter-dependent output and 503 when PostgreSQL is unavailable, unmigrated, or unseeded. It explicitly reports that remaining state is memory. Mode POST/PATCH same-key/different-payload requests return 409 in postgres_modes.
- **Verification:** 38 API tests with the disposable DB; frontend 259 tests with coverage thresholds green; frontend lint/typecheck/build; Ruff including migrations; mypy on 22 source files; API Docker build; schema drift check reports no upgrade operations; live shared repository suite 22/22 with postgres_modes. Empty database migrated to 0001, repeated seed preserves edits, and mode CRUD/replay/farm isolation/rollback/concurrency/outage/restart-projection tests pass.
- **Restart proof:** actual API and development DB containers restarted with their named volume preserved. An isolated mode edit and its original create replay survived; changed payload returned 409; proof mode cleaned up. This establishes mode durability only.
- **Coverage:** frontend scoped coverage remains 80.71% lines, 81.66% branches, 65.38% functions. API integration tests are behavior checks; no API coverage percentage is claimed.
- **Known limitations:** all non-mode state remains volatile; use one API worker until incubator assignments and remaining collections are durable. The farm lock currently serializes database-backed requests. Frontend logical retries still mint fresh keys. Durable replay for other commands, populated upgrades to later revisions, cycle constraints, telemetry hypertables/aggregation, and full B3 restart parity remain open. Vite chunk-size and upstream TestClient deprecation warnings remain.
- **Exact next phase:** persistent incubators/devices (migration 0002), then preferences, alerts, cycles/candling/history, and readings. B4 remains gated on complete B3.
- **Working tree:** no commit created; existing unrelated UI work and database setup WIP left untouched. Selective staging is still required.

### Historical B3 preparation checkpoint (2026-09-12)

- **Completed scope:** baseline repair and verification; memory request transactions with rollback and serialized same-key replay; storage protocols decoupling service type annotations from the memory implementation; route dependencies separated from router aggregation; mypy gate configured; wire examples reconciled.
- **Files added/changed:** API `storage.py`, `store.py`, `services.py`, `api/v1/dependencies.py` and routers, `tests/test_transactions.py`, `pyproject.toml`, README; frontend transport examples/error coverage; existing frontend lint diagnostics repaired (format/import fixes, native calendar list, documented intentional effect dependencies and navigation-group semantics).
- **Contracts changed:** internal `StoreState`/`UnitOfWork` boundary only; generated OpenAPI remains identical to the captured memory API schema (22 paths). `/readyz` example now uses `store: memory` and incubator count. No HTTP runtime shape changes.
- **Migrations / environment variables:** none. `mypy==2.3.1` added to the API test extra; source checks include untyped function bodies and the Pydantic plugin, not full strict mode.
- **Verification:** 259 frontend tests; 26 pytest (including two terminal-operation rollback cases and concurrent same-key completion); Ruff check/format; mypy on 18 source files; frontend lint/typecheck/build; scoped coverage thresholds passed (80.71% lines, 81.66% branches, 65.38% functions); live shared repository suite 22/22; API Docker build and Compose configuration green; `git diff --check` clean. TestClient and live HTTP tests require network-capable execution in this environment; sandbox attempts hung/returned offline and were rerun outside it.
- **Known limitations:** memory transaction locking is single-process and serializes reads as well as writes; collection-based service access is transitional, not an async SQL adapter. Hook retries still mint fresh keys; payload fingerprinting, durable replay, and competing different-key cycle termination remain B3 work. No database restart/migration proof yet. Existing Vite large-chunk and upstream TestClient deprecation warnings remain. Simulator not checked. No commit created; the working tree includes earlier work.
- **Exact next phase:** B3 schema/migrations, then persistent vertical slices using the reconciled decisions below and the verification matrix in section 10.
- **Unrelated work:** existing UI feature edits preserved; `App.tsx` spacing change observed during the session was not modified. Lint repairs extend beyond backend files and should be reviewed separately when staging.

### Database WIP reconciliation for the next migration

The database setup guide was reviewed as input and left unchanged. These phase-specific decisions supersede its stale frontend prerequisite and initial authentication-table sequence:

1. Keep public IDs opaque strings (`chamber-1`, `broiler`, etc.) in HTTP responses. Use internal UUID primary keys with farm-scoped unique public IDs and explicit mapping at the adapter boundary; deterministic development UUIDs can be derived from stable farm/type/public-ID inputs. Never substitute UUIDs into the existing public contract silently.
2. Create only the B3 table set listed in section 7. Defer users, refresh tokens, and memberships to B6; use the configured development farm context for scoped lookups. Requester audit fields must support the disabled-auth context without fake user rows.
3. Persist a stable cycle identity and mode snapshot at start, and project terminal history from that cycle. The memory implementation currently invents cycle IDs at terminal operations; migrating it requires parity tests for the public projections plus new lifecycle integrity tests.
4. Replace the transitional collection surface slice by slice with async SQL repositories and explicit transaction ownership. Do not serialize the whole farm into a JSON blob or use the memory lock as cross-process concurrency control.
5. Keep public reading DTO compatibility while defining five-minute UTC buckets with avg/min/max/count internally. Fix bucket boundaries, empty-bucket behavior, and water-state aggregation in fixtures before telemetry migrations; live MQTT ingestion remains B4.
6. Persist a farm-scoped operation key, request fingerprint, and replay result in the same transaction as the mutation. A logical client retry reuses its key; changed payloads conflict. Unique active-cycle/terminal-outcome constraints must also protect different-key concurrent requests.

### Historical checkpoints

**B0B complete (2026-09-12).** The broad `updateIncubator(id, Partial<Incubator>)` port is replaced by nine explicit repository commands (profile, configuration, start/reset/turn/reconnect, candling create/update/delete); the screen-facing `updateIncubator(id, patch)` hook keeps its signature and routes each patch shape to exactly one command. Next: B0 remainder (response mapping + representative endpoint examples), then B1 in-memory FastAPI. Do not scaffold FastAPI until B0 exits cleanly.

Checkpoint B0B:
Completed scope: repository port split; in-memory adapter commands with server-derived status/condition/connection state; hook patch router with candling diff; command request schemas replacing the broad update schema; regression tests (235 passing).
Files added/changed: `apps/web/src/app/data/repositories/repository.ts`, `apps/web/src/app/data/repositories/in-memory-repository.ts`, `apps/web/src/app/features/farm/use-farm-data.ts`, `apps/web/src/app/data/transport/contracts.ts`, `apps/web/src/tests/repository.test.ts`, `apps/web/src/tests/mutation-states.test.tsx`, `apps/web/src/tests/transport-contracts.test.ts`, this guide.
Contracts changed: `EggcelerateRepository` drops `updateIncubator`; nine commands added; `UpdateIncubatorRequestSchema` replaced by per-command request schemas.
Migrations added: none. Environment variables added: none.
Tests and counts: 235 Vitest passing (30 files); typecheck, production build, Biome on touched files, `git diff --check` green. Repo-wide lint still reports pre-existing formatting diagnostics in untouched files.
Docker/Compose verification: not applicable (no services added).
Known limitations: candling diff in the hook router retires with the mock-era funnel when `ApiRepository` exposes entry endpoints directly; wire examples landed as part of B0 completion below.
Exact next phase: B0 remainder, then B1.
**B0 complete (2026-09-12).** Remainder landed: numeric `Reading.water` retired at the mapper (no screen consumed it); response mappers added for readings, incubators, candling entries, alerts, hatch/aborted history, and preferences (both directions where the API needs them); 32 wire examples (one per endpoint plus all six error envelopes) validated against the Zod schemas with mapper round-trips in `transport-examples.test.ts`. Open B1 review items are marked PROPOSED in `apps/web/src/app/data/transport/examples.ts` (health/readiness shapes, complete/stop response records, turn acknowledgement, delete-id responses). Suite: 238 passing. **B0 exit met — B1 unlocked.**
**B1 complete (2026-09-12).** In-memory FastAPI implements the full dashboard API: 22 OpenAPI paths, deterministic 12-chamber/10-mode/12-alert dev seed, server-derived status/condition/phase, atomic complete/stop with history records, turn acceptance with `Idempotency-Key` replay, strict request validation normalized into the result envelope. Proven: 23 pytest green, Ruff check + format clean, `docker compose build/up api` serves seeded data on `127.0.0.1:8000`, `docker compose config` valid. Deviations from B0 examples (all reviewable): `GET /readyz` reports `{"store": "memory"}` until B3/B4 add database/MQTT checks; unknown mode *references* are 422 while direct mode lookups are 404; `POST` creates return 201; `command_id` defaults to the `Idempotency-Key` when sent. Frontend untouched (238-test suite unaffected). **Next: B2 `ApiRepository`.**
**B2 complete (2026-09-12).** `ApiRepository` speaks the full HTTP contract with Zod-validated envelopes, error-code translation (abort→timeout, unreachable→offline, unknown codes→unknown_error), `Idempotency-Key` per mutating call, and hours→minutes conversion; follow-up GETs compose turn/candling/complete/stop results. `VITE_DATA_SOURCE=mock|api` switch in `app-repository.ts` (mock default; api requires a valid `VITE_API_URL`); Docker web build takes both as build args. Shared `repository-contract.test.ts` passes against memory (11) and live HTTP (11) — proven via compose API + `EGG_API_URL`. Parity fixes from the B2 audit: stop marks stopped_early/warning without reset; optional-but-not-nullable fields omitted (not nulled); reading windows inclusive (13/85/109 for chamber-1); new chambers pair on creation; mode duration bounds widened to the biological 7–45 days (Zod + Pydantic + tests). Timeout uses raced promises, not AbortController signal (jsdom/undici interop throws). Known edge: hook-level retry mints a fresh idempotency key per attempt — server dedupes same-key replays only. **Next: B3 PostgreSQL/TimescaleDB.**
**Review follow-up (2026-09-12).** Independent review caught three out-of-box breakers, all fixed and re-proven: constructor normalizes a trailing `/api/v1` so the documented base URL cannot double-prefix (regression test pins both shapes); CORS now allows bare-loopback compose origins alongside dev ports (config default + compose env + `.env.example`); `VITE_API_URL` validates with `new URL` instead of regex. Live shared suite re-run green 22/22 using the documented suffixed URL. Suite now 259 passing.

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

Recorded complete; the following is the original acceptance checklist, not a resume queue.

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

Recorded complete with the retry limitation in section 0. The original acceptance checklist below does not establish fresh verification; timeout uses a promise race rather than request cancellation.

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
STORAGE_BACKEND=memory          # postgres_incubators opts into durable configuration
DATABASE_URL=                   # asyncpg URL required for postgres_incubators
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
Python type check: cd apps/api && .venv/bin/mypy
API unit and contract tests
OpenAPI generation/diff review
Docker image build and Compose configuration validation
git diff --check
```

Database checkpoints additionally run migrations against a disposable empty database and adapter integration tests. MQTT checkpoints additionally run simulator integration tests. Browser automation is not part of these gates.

## 10. Next implementation batch: B4 MQTT simulator integration

The simulator at `258f0e9` has now been inspected and its 22 tests pass. The API
telemetry validation/persistence boundary is implemented. See [B4 reconciliation](b4-mqtt-contract.md) for verified payloads and command-handler gaps; duplicate
execution, missing target/expiry validation and restart replay must be addressed
before command publishing is enabled. No broker worker is running yet.

B3 passed the [2026-09-15 exit review](b3-exit-review.md): 78 API tests,
288 frontend tests, 28 live contract cases, fresh/populated migrations, seed,
restart/replay and real outage recovery. Implementation remains uncommitted on
base `035f555`; use the review's source manifest to identify the tested checkout.

1. Inspect the separate simulator and reconcile command/ACK/telemetry wire contracts.
2. Add durable dispatch/ACK state (`device_commands`, migration 0008), including
   retries, deadlines, correlation and duplicate handling. Acceptance receipts
   already persist; they are not a dispatch queue or proof of execution.
3. Integrate a local MQTT broker and worker with the simulator; test delayed,
   duplicate, rejected, out-of-order and missing acknowledgements.
4. Connect validated telemetry and REST hydration before live cache updates.
   Keep physical actuation disabled. Authentication/public deployment remain B6.

### B3 verification matrix

| Gate | Required proof |
|---|---|
| Migrations | Empty database upgrades to head; an earlier revision with data upgrades without loss; Timescale extension/hypertable exists |
| Seed | Repeated seed leaves one deterministic development farm and stable references without duplicates |
| Adapter parity | Shared behavior suite passes for memory and persistent HTTP adapters against isolated fixtures |
| Restart survival | Mutate data, restart API and database retaining the volume, then verify saved entities and command replay |
| Atomicity | Inject failure during complete/stop and prove neither partial history nor partial cycle state commits |
| Concurrency/idempotency | Concurrent requests cannot create duplicate terminal outcomes; same-key replay returns the original result |
| Readings | Verify UTC bucket boundaries, avg/min/max/count, empty buckets and gaps against fixed sample data |
| Database outage | Readiness fails and operations requiring persistence return the documented error without partial writes |

## 11. Resume procedure

1. Read the current handoff above, API README, architecture and firmware safety contracts, and database setup WIP.
2. Inspect source and working-tree changes; current source wins over historical examples. Preserve unrelated changes.
3. Execute B3 steps in section 10 in order, starting with simulator contract reconciliation.
4. Keep the API contract and screen behavior stable; document any necessary contract change before implementing it.
5. Record the section 13 checkpoint and actual repository revisions before switching phases.

## 12. Decisions that must survive each phase

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
