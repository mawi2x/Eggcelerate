# EGGCELERATE API

> **Current status:** B3 modes, chamber/device configuration, and farm preferences are persistent.
> Next: persistent alerts, then cycles/candling/history and readings.
> See the guide’s current handoff for verification scope and retry limitations.
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
migrations/             Alembic-only DDL; 0001 farms/modes; 0002 chamber/device configuration/replay; 0003 preferences/replay
tests/                  49 tests with TEST_DATABASE_URL, including persistence/rollback/replay
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

The dashboard-first backend keeps authentication disabled and local-only
initially, with a dormant request-context boundary and a production startup
guard. Do not add fake auth endpoints or JWT storage during that milestone.
The opt-in database slice persists farms, modes, chamber/device configuration,
and the corresponding replay records. MQTT
and hardware integration remain deferred.

Memory request transactions roll back all state and idempotency results on failure.
The lock protects one process only; this is not persistence or distributed command
safety. In postgres_incubators, mode POST/PATCH and chamber create/profile/configuration/
reconnect and preferences PUT requests additionally use farm-scoped
SQL transactions and durable same-key replay with payload-conflict detection.
Settings save and chamber create/profile/configuration/reconnect Retry actions preserve their
logical key through the frontend and HTTP adapter. New user actions get new keys.
Mode and remaining command hooks still need the same retry propagation; cycle
and other replay durability remain later B3 work.


## PostgreSQL chamber/device slice

`STORAGE_BACKEND=memory` remains the default. `postgres_incubators` is deliberately
partial: alerts, cycle state/history, candling, sensor values and
turn timestamps remain in memory and reset with the API. Chamber names, modes,
auto-turn/interval settings, device assignments, pairing state and farm preferences persist.
Pairing here is the existing simulator-facing flag, not proof of hardware
connectivity. Use one API worker while the remaining
collections remain volatile. Do not treat this checkpoint as the full B3 exit.

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
preserves existing edits. An intentionally deleted default returns if explicitly
seeded again.

The previous `postgres_modes` configuration is accepted as an alias for
`postgres_incubators`; migration 0003 and chamber/preferences seeding are required.

`GET /readyz` reports `store: postgres_incubators`, database availability, and
`remaining_state: cycles_candling_alerts_readings_memory`. It returns 503 for a missing migration, missing farm/chamber/preferences seed,
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

### Preferences checkpoint (2026-09-13)

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
