# EGGCELERATE — System Architecture Guide

> **Status:** Working implementation guide
> **Last reviewed:** 2026-09-23
> **Scope:** Current frontend and local backend implementation, plus the remaining authentication, production, and hardware boundary.
> **Validation note:** This guide was cross-referenced against source and local documentation. Browser automation is not a current validation gate.

This guide separates implemented behavior from the remaining product and deployment work. Current source code is the authority for implemented behavior. The current phase-by-phase review plan records the next implementation sequence; older frontend and database plans are historical context.

## 1. Reading rules and source precedence

Use these labels:

| Label | Meaning |
|---|---|
| **Implemented** | Present in the repository and verified against the source. |
| **Simulated** | Browser-only, fixture-backed, or in-memory behavior used by the prototype. |
| **Planned** | Proposed by an implementation plan but not present in the repository. |
| **Decision pending** | Documents disagree, or a contract must be confirmed before implementation. |

For this checkout, use the following precedence:

1. Current source under apps/, packages/, infrastructure/, and the root configuration files.
2. The current system review and execution record: [phase-by-phase plan](refine/project-review-execution-plan-2026-09-23.md).
3. Current subsystem references: [backend guide](guide/backend-dashboard-first-guide.md), [database guide](guide/database-setup-guide.md), [auth and onboarding guide](guide/auth-onboarding-guide.md), [firmware safety contract](guide/firmware-safety-contract.md), and [frontend restructuring guide](guide/frontend-restructuring-guide.md).
4. Historical plans and audits are context only; verify every claim against the current source.

The accepted local stack decisions are summarized in `apps/api/README.md`. The ADR
set is still local-only; it is not required to interpret the implemented service
boundaries in this guide.

## 2. Delivery strategy

The current delivery shape is:

Finish frontend with realistic mock behavior
              ↓
Keep stable domain contracts and repository boundary
              ↓
Use the same UI with FastAPI and optional persistence
              ↓
Exercise MQTT commands and telemetry through a separate simulator
              ↓
Add authentication, production broker security, and hardware qualification

The frontend contract is implemented and connects to both memory and HTTP
repositories. The local backend includes an opt-in PostgreSQL/TimescaleDB store
and simulator-focused MQTT command/telemetry paths. WebSockets, real
authentication, production broker security, and physical firmware remain outside
the verified system boundary.

The memory adapter remains a deterministic option for demos and tests, while API mode exercises the same dashboard contract against the local service. Neither mode establishes behavior on a physical ESP32.

## 3. Current system snapshot

| Area | Status | Current reality |
|---|---|---|
| Web dashboard | **Implemented** | Vite + React application in apps/web. |
| Shared UI primitives | **Implemented** | Tailwind 4, Radix-based primitives, project tokens, responsive shell, charts, dialogs, tables, and form controls. |
| Incubator, cycle, candling, alert, trend, and settings flows | **Implemented with memory/API adapters** | The checked-in web default uses fixture-backed memory; API mode reads and writes through the FastAPI repository. |
| Domain helpers | **Implemented / expanding** | Entity types, candling, fertility, incubator calculations, dates, cycle helpers, and condition derivation now live under apps/web/src/app/domain. |
| Mock repository boundary | **Implemented** | `EggcelerateRepository` and `InMemoryEggcelerateRepository` own fixture copies, mutable farm records, and deterministic reading queries. Screens do not import fixtures. |
| Navigation | **Implemented** | Wouter 3.10 owns canonical paths, Back/Forward updates, legacy-query migration, and safe parameter redirects through the routing module. |
| Server-state layer | **Implemented** | TanStack Query 5 and farm feature query/mutation hooks wrap the injected memory or API repository. |
| Auth and onboarding | **Simulated with boundary** | `/login` and `/onboarding/:step` are public mock routes. `MockAuthProvider` and `RequireAuth` guard dashboard navigation; there is no server session or real authorization. |
| API contract and runtime | **Implemented** | FastAPI/Pydantic, strict DTOs, error envelopes, health/readiness, and `ApiRepository` are present; see `apps/api/README.md`. |
| Database | **Implemented, opt-in** | PostgreSQL/TimescaleDB persistence and Alembic revisions `0001`–`0011`; raw telemetry and latest device state are durable. |
| MQTT | **Implemented for local simulation** | Mosquitto config and a worker exist in the simulator overlay; command dispatch defaults off and physical hardware is excluded. |
| Authentication | **Selected, not implemented** | Sign-in will use app-managed email/password. Local `AUTH_MODE=disabled` is not a production authorization boundary. |
| Web deployment | **Implemented/configured** | Docker multi-stage build and Nginx SPA/API proxy; Compose includes API and opt-in database profiles. |
| Automated checks | **Implemented** | Web and API checks run in CI; see `.github/workflows/web.yml`, `.github/workflows/api.yml`, and `docs/guide/verification-gates.md` for current gates rather than a stale test count. Rendered accessibility and browser E2E remain open. |

The current web checks are:

    pnpm --filter eggcelerate-ui typecheck
    pnpm --filter eggcelerate-ui test
    pnpm --filter eggcelerate-ui coverage
    pnpm --filter eggcelerate-ui build
    pnpm lint
    git diff --check

The web suite and live HTTP contract verify frontend/API behavior. The database
suite exercises persistence and migrations. These checks do not qualify physical
device safety, production broker security, or public authentication.

### 3.1 Current repository topology

    pnpm workspace
      ├── apps/web
      │     ├── Vite + React + TypeScript + Tailwind
      │     ├── App.tsx composition root
      │     ├── providers/AppProviders.tsx and injected repository context
      │     ├── providers/auth-context.tsx mock session and navigation guard
      │     ├── features/farm query keys, query boundary, and query/mutation hooks
      │     ├── routing/routes.ts and use-app-router.ts
      │     ├── domain/types.ts plus focused cycle, candling, fertility, date, and incubator helpers
      │     ├── data/repositories, data/fixtures including deterministic readings, dto.ts, account.ts, onboarding.ts
      │     ├── components/screens, detail, settings, alerts, auth, ui
      │     └── Docker build → Nginx static SPA
      ├── apps/api
      │     └── FastAPI, memory/PostgreSQL stores, Alembic, MQTT telemetry and command worker
      ├── apps/mobile
      │     └── placeholder README
      ├── packages
      │     └── reserved until a real second consumer exists
      └── compose.yaml
            └── web/API plus opt-in database profiles; compose.simulator.yaml adds broker/worker

Current implementation measurements:

- App.tsx is 547 lines and combines account/onboarding UI state with screen composition. Farm-data ownership, repository mutations, path parsing, history listeners, and auth state have moved out.
- mockData.ts has been removed; application imports from the old compatibility barrel are zero, down from 24 before F1.
- CandlingJournalTab.tsx is 2,475 formatted lines, TrendsScreen.tsx is 1,178 lines, and IncubatorsScreen.tsx is 953 lines. Pure incubator filter/natural-order sort, trends filtering/KPIs, candling timing/feed merge, and tally validation have moved to focused selectors under `features/` with regression tests.
- `.env.example` defines local API, database, MQTT worker and web repository settings;
- `ApiRepository`, TanStack Query integration, Wouter routing, Biome lint config, and web CI (`.github/workflows/web.yml`) are implemented. Real server authentication is not.

Large file size is an indicator, not the acceptance criterion. Refactoring is complete when ownership and dependencies are clear, not when a file reaches an arbitrary line count.

### 3.2 Current data and control flow

1. `VITE_DATA_SOURCE` selects the memory or HTTP repository. `ApiRepository` validates result envelopes and talks to the versioned FastAPI routes; the memory adapter remains the deterministic demo/test option.
2. Farm hooks use TanStack Query for cache, mutation state, invalidation and visible retry/error handling. Wouter owns canonical routes and browser history.
3. FastAPI delegates to services and persistence boundaries. The default API store is memory; `postgres_incubators` opts into farm-scoped PostgreSQL transactions and explicit Alembic migrations/seeding.
4. PostgreSQL persists dashboard configuration and journals, raw telemetry, a boot-aware latest-device projection, and durable turn-command outcomes. Timescale samples retain observation and server receipt times.
5. The MQTT worker validates telemetry and acknowledgements and claims commands from the outbox. Its dedicated simulator overlay provides a private Mosquitto network; dispatch defaults off. A separate simulator repository exercises the wire contract.
6. Readiness reports database/migration/seed state in PostgreSQL mode. `AUTH_MODE=disabled` is limited to local development and is not farm authorization for a public service.

This is a working local integration path, not a production or physical-electronics
qualification. Authentication, secure remote broker access, restore drills and
ESP32 firmware/hardware verification remain before public or actuator deployment.

## 4. Stack alignment

### 4.1 Web stack

| Layer | Current repository | Planned direction |
|---|---|---|
| Runtime | React 18.3.1 | Keep React. |
| Build/dev | Vite 6.3.5, pnpm 9.12.3 | Keep Vite and the pnpm monorepo. |
| Language | TypeScript 5.6.3, strict compiler options | Keep strict types; do not add any to new code. |
| Styling | Tailwind 4.1.12, CSS variables, Radix/shadcn-style primitives | Keep the existing token and primitive system. |
| Charts | Recharts 2.15.2 | Keep charts behind feature-level loading boundaries. |
| Validation | Zod, currently in apps/web/src/app/data/dto.ts and data/onboarding.ts | Make schemas the input/output boundary for mock and API data. |
| Client data | TanStack Query feature hooks over memory or `ApiRepository` | Keep the shared result/error contract and exercise both adapters. |
| Routing | Wouter 3.10 with focused path/parser hooks | Keep stable canonical routes; add future role-aware routes without duplicating URL state in components. |
| Server state | TanStack Query 5.102.8 | Keep it for REST hydration, cache, mutations, and future realtime patches. |
| Tests | Vitest + jsdom, including shared memory/HTTP contract coverage | Keep the shared contract; broader rendered accessibility checks remain open. |
| Lint | Biome 2.x recommended preset; `pnpm lint` is clean | Keep lint in the local and CI gates; add focused rules only when they preserve the established frontend behavior. |
| Browser E2E | Not configured | The plan names Playwright, but it is not required for the current frontend phase. Keep the E2E tool decision open until a reliable workflow is agreed. |

### 4.2 Backend and device status

| Component | Current responsibility | Status and limit |
|---|---|---|
| FastAPI + Pydantic | REST validation, result envelopes, services and readiness | Implemented; no real user authentication or WebSocket bridge. |
| PostgreSQL + TimescaleDB | Farm configuration, histories, telemetry, and command audit | Implemented as an opt-in local store through Alembic revision `0011`. |
| Mosquitto MQTT | Device telemetry and command/ACK transport | Local anonymous broker config and worker overlay exist; dispatch is opt-in and not production secured. |
| Python simulator | Exercise firmware-facing telemetry and command contracts | Implemented in a separate repository; it does not establish physical hardware behavior. |
| ESP32 firmware | Local sensing, actuation and safety control | Not present in this repository and not hardware-verified. |
| Docker Compose | Run web/API, optional database, and simulator worker/broker overlay | Implemented for local work; public deployment still requires security and recovery gates. |
| Nginx | Serve the SPA and proxy same-origin API calls | Implemented. |

The ADR files remain local-only. Current implementation details and the ordered
remaining work are recorded in the [API README](../apps/api/README.md), [backend
guide](guide/backend-dashboard-first-guide.md), and [project review plan](refine/project-review-execution-plan-2026-09-23.md).

## 5. Target system architecture

The target system is local-first at the device layer and API-first at the web layer:

    Browser
      ↓
    React SPA
      ↓ REST hydration, mutations, and WebSocket patches
    FastAPI
      ├── PostgreSQL / TimescaleDB
      └── Mosquitto MQTT
            ↓ telemetry and commands
          ESP32 local controller
            ├── sensors
            ├── actuators
            ├── watchdog
            └── NVS safe setpoints

    Nginx serves the built React SPA.

The frontend must never connect directly to MQTT. It receives device state and sends commands through the API. The ESP32 remains responsible for safe thermal control even if Wi-Fi, MQTT, FastAPI, or the database is unavailable.

## 6. Frontend architecture

### 6.1 Current composition

    apps/web/src/main.tsx
      ↓
    AppProviders
      ├── RepositoryProvider → InMemoryEggcelerateRepository
      └── QueryClientProvider
            ↓
    apps/web/src/app/App.tsx
      ├── account and onboarding UI state
      ├── Wouter route state from useAppRouter
      ├── farm feature query/mutation hooks
      ├── OverviewScreen
      ├── IncubatorsScreen
      ├── DetailScreen
      ├── TrendsScreen
      ├── AlertsScreen
      └── SettingsScreen
            ↓
          prop-driven leaf components

App.tsx currently owns account/onboarding form state and screen composition. F3 removed farm-data state and repository mutation implementations; F4 removed URL synchronization and auth-session ownership. Further decomposition is driven by F5 feature responsibilities rather than a line-count target.

The temporary mockData.ts compatibility barrel has been removed. Fixture examples and deterministic reading generation are private to the in-memory repository; application code consumes domain modules or feature hooks directly.

### 6.2 Required frontend boundary

The target frontend flow is:

    Screen container
      ↓
    Feature hook
      ↓
    TanStack Query for server-like state
      ↓
    Injected repository interface
      ├── InMemoryRepository during frontend development
      └── ApiRepository during backend integration
            ↓
          FastAPI

Presentational and leaf components should continue receiving typed props. They should not each call global data hooks. Repository hooks belong at screen or feature-container boundaries.

The current boundary is named `EggcelerateRepository` because it covers the farm dashboard, not only incubators. Keep broad operations behind that contract or split them into domain-focused interfaces when a real second consumer needs them.

The first refactor should separate the existing module into conceptual layers:

    domain/
      types.ts
      cycle.ts
      calculations.ts
    data/
      dto.ts
      fixtures/
      repository.ts
      inMemoryRepository.ts
      apiRepository.ts for the validated HTTP adapter
    hooks/
      feature query and mutation hooks
    providers/
      repository dependency and auth boundaries
    routing/
      route definitions and URL-state helpers

State ownership must remain explicit:

| State type | Owner |
|---|---|
| URL/navigation state | Wouter owns canonical paths and browser history. |
| Server-like farm data | TanStack Query backed by the injected repository. |
| Repository implementation | A small provider created at application startup. |
| Authentication/session view | Auth provider; server cookies remain the future security authority. |
| Temporary form/modal/filter state | The component or feature that owns the interaction. |

Do not add Zustand during this refactor unless a concrete cross-feature, client-only state requirement remains after URL state, query state, auth state, and local UI state have been separated.

The exact folders may evolve, but the rules do not:

- screens and components must not import fixtures after the repository boundary is introduced;
- domain types may be imported directly from domain modules;
- mock and API adapters must expose the same operations and structured result shape;
- fixture data must use stable IDs, timestamps, and the same units as API data;
- parsing and normalization happen at the boundary, not inside individual screens;
- data mutations expose pending, success, error, and rejected states;
- derived status is calculated through one shared path from readings and the active mode;
- `ApiRepository` and the in-memory adapter expose the same screen-facing contract.

Keep the existing `ApiRepository` aligned with the HTTP schemas. Authentication is a separate server boundary and remains unimplemented.

### 6.3 Current structural risks

| Priority | Risk | Architectural response |
|---|---|---|
| Resolved in F5A | Two remaining compatibility-barrel imports exposed deterministic generated history | Reading generation now sits behind cached repository queries and the compatibility barrel has been removed. |
| Resolved in F5B | Fire-and-forget and multi-step cycle writes could announce success early or partially update history/chambers | Farm actions now return confirmation, pending controls block duplicates, failures retain input and offer retry, optimistic incubator writes restore the prior cache snapshot, and finish/stop commands are atomic. These are simulated frontend outcomes, not hardware ACKs. |
| Resolved in F2 | Module-global hatch and aborted-cycle arrays plus React copies | The repository now solely owns mutable mock histories and adapter tests cover write-then-read behavior. |
| Reduced in F2–F3 | Domain invariants were enforced in several callers | The repository validates references and counts, preserves IDs, and derives condition/connection state; feature hooks now provide the React command seam. |
| Resolved in F0 | Mode updates could leave unit condition/status stale | App mode updates now recalculate affected chamber condition and status through the shared domain helper; preserve this in repository contract tests. |
| Reduced in F4 | App.tsx owned routing, mock auth, account/onboarding UI state, and composition | Routing and auth state now have focused boundaries; onboarding form orchestration and screen composition remain for focused later extraction. |
| Resolved in F4 | Custom query-string routing had no route-level tests | Wouter routes now have direct-link, canonicalization, unknown-ID, auth-redirect, and jsdom Back/Forward coverage. |
| Reduced in F5 | Large screens mix transformations with rendering | Incubator, trends, and candling selectors now own several pure transformations. Continue extracting only when a responsibility is independently testable; do not split files solely because they are large. |
| P2 | Hardcoded presentation values remain outside theme.css | Continue the existing token audits and documented exceptions; do not make a blanket no-hex rule an architecture blocker. |
| Resolved in F6 | No lint, coverage, or CI gate | Biome is clean and web CI runs lint, typecheck, tests, scoped coverage, build, and diff validation. |

The current condition helper applies warning and critical thresholds. It is not a stateful hysteresis controller. True actuator hysteresis belongs in the future firmware/control contract.

## 7. Domain and transport contracts

### 7.1 Entity identity

Persisted and navigable entities need stable identifiers:

- farmId and userId;
- incubatorId and deviceId;
- cycleId;
- modeId;
- alertId;
- candlingEntryId;
- hatchRecordId.

Display names are labels, not keys. Alerts and deep links should resolve a chamber by incubatorId, not by its current display name.

### 7.2 Units and naming

The following conventions must be resolved and then used by both Zod and Pydantic:

| Value | Required convention |
|---|---|
| Temperature | Celsius in transport and domain calculations; convert only at the presentation boundary. |
| Humidity | Relative humidity percentage. |
| Water | waterOk: boolean for the binary float sensor. |
| Research telemetry | Fixed five-minute persisted records. |
| Live sampling | Configurable independently, such as 10 seconds, 30 seconds, or one minute. |
| Turn interval | Domain/UI models use hours. Wire DTOs and device commands use explicit minutes; conversion occurs in the transport mapper. |
| Hysteresis | Planned temperature and humidity hysteresis fields; firmware contract must confirm values. |

The current Reading shape still contains numeric water, while the plan calls for waterOk. This is a migration item, not a reason to hide the difference in the API adapter.

The structured ResultError with code, message, and optional details is the selected operation result contract. Some older plan examples use a string error and are superseded by this decision.

Transport DTO names may use the plan's wire naming, such as target_temp_c and turn_interval_min. Convert between wire DTOs and ergonomic frontend models in one boundary module.

### 7.3 Domain invariants

These rules apply to both mock and API implementations:

- tray capacity is 38 eggs and belongs to the tray/device, never to a mode;
- 0 ≤ hatchedEggs ≤ fertileEggs ≤ totalEggs when fertile count is known;
- hatchability is unavailable when fertile eggs are unknown or zero;
- fertility is unavailable when the egg-set denominator is zero;
- counts cannot exceed the loaded count;
- cycle phase and environmental condition are separate dimensions;
- water low, disconnected devices, unsafe temperature/humidity, and critical battery state cannot be represented as healthy;
- candling entries must validate day range, inspected counts, cumulative category rules, checkpoint type, image type/size, cycle ID, and timestamp;
- IDs and timestamps must survive persistence and reload.

### 7.4 Cycle and candling model

The target cycle phases are:

    ready → incubating → lockdown → hatching → awaiting_finish → completed
                                      └───────────────→ stopped_early

Candling uses:

- first checkpoint: Fertile, Clear, Uncertain;
- later checkpoints: Developing, Clear, Uncertain, Stopped Developing;
- cumulative snapshots;
- no unresolved uncertainty at lockdown.

The current implementation models these concepts in the web domain and persists cycle and candling records through the opt-in API store. Physical egg counts and other sensor-derived facts still depend on real device integration.

## 8. Device safety and realtime behavior

The safety hierarchy is:

1. hardware cutoff and relay behavior default to a safe state;
2. firmware watchdog enters a safe mode if control is stuck;
3. local ESP32 control continues with locally available readings and setpoints;
4. NVS retains the last accepted safe setpoints across reboot and network loss;
5. backend/cloud services send validated changes, store telemetry, and report status on a best-effort basis.

The provisional firmware safety contract records a 42°C hardware cutoff, 0.2°C temperature hysteresis, 3% humidity hysteresis, and a 180-second watchdog. These values remain provisional until verified on the selected hardware.

### Read path

    React → REST hydration → query cache
                              ↑
                       WebSocket telemetry patches
                              ↑
                    FastAPI → MQTT → ESP32

The UI should eventually distinguish loading, stale, reconnecting, cached-offline, and retry states. If WebSocket connectivity drops, use a visible connection state and a bounded polling fallback.

### Command path

    User action
      → frontend validation
      → authorized API command
      → backend queue
      → MQTT command
      → ESP32 execution
      → MQTT acknowledgement
      → backend persistence and WebSocket update
      → UI confirmation or rollback

Actuator-affecting controls need pending, acknowledged, rejected, timeout, and rollback states. A browser state update alone is not proof that a device command succeeded.

### Service outage and recovery

The ESP32 remains the local safety authority during Wi-Fi, MQTT, API, database, or full-server loss. Expected degraded behavior:

- API unreachable: dashboard serves stale cached data with a visible offline warning; remote commands fail instead of pretending to succeed.
- MQTT unreachable: devices continue local control on NVS setpoints; commands return `503 offline`; device health derives from `last_seen` freshness, since no LWT can arrive with the broker down.
- Database unreachable: `/readyz` fails and actuator-affecting commands are rejected until audit persistence is restored (decided: fail closed — an un-auditable command is not executable).
- Backend restart: devices start `unknown`/`stale`; resubscribing replays retained `state`, but a device returns to healthy only on fresh telemetry inside the live window — retained `online` alone is insufficient.
- Commands in flight across a restart are reconciled by `command_id`: resume waiting inside the bounded ACK window, then mark `timeout`. Never blindly re-publish.
- QoS 0 telemetry lost during an outage stays lost; gaps are expected unless a device-side store-and-forward buffer is specified later.


## 9. Current implementation and remaining work

The older twelve-task delivery plan is historical. The current order and phase
evidence live in the [project review plan](refine/project-review-execution-plan-2026-09-23.md).

| Area | Status |
|---|---|
| Frontend contracts and responsive dashboard | Implemented; mock and HTTP repositories use the same DTO/result boundary. |
| API and local persistence | Implemented for the current dashboard slices; PostgreSQL/TimescaleDB is opt-in and migrations are at `0011`. |
| Telemetry and commands | Validated telemetry, durable projection, command outbox, worker and simulator contract are implemented; worker dispatch remains off by default. |
| Sign-in | The selected approach is app-managed email/password; server sessions and farm authorization remain to be implemented. |
| Production and electronics | Secure broker/deployment settings, backup restore proof, ESP32 firmware and physical actuator tests remain open. |

The [backend guide](guide/backend-dashboard-first-guide.md) describes the current
API boundaries. The [database guide](guide/database-setup-guide.md) lists the
actual migration history. The [auth guide](guide/auth-onboarding-guide.md)
documents the current mock-only sign-in UI and future server boundary.

## 10. Historical frontend-first execution plan

This section records the original frontend delivery sequence. Current status and
remaining backend work are summarized in §9 and the linked project review plan.

Each phase must preserve behavior and keep the current checks green. Avoid combining the repository, router, token cleanup, large-screen decomposition, and UI redesign in one change.

### Phase F0 — Freeze contracts and add regression tests

1. Record the turn-interval wire unit and structured Result<T> shape.
2. Define stable IDs for farms, users, incubators, devices, cycles, alerts, candling entries, and hatch records.
3. Write tests before each correction and make them pass within this phase for:
   - harvest counts above known fertile count;
   - mode updates changing affected unit severity;
   - DTO parsing of every fixture;
   - zero and invalid fertility/hatchability denominators.
4. Implement only the minimal shared domain fixes required by those tests.
5. Keep existing mock output and screen behavior unchanged except for confirmed defects.

**Exit gate:** the high-risk domain behavior is green and protected before files move.

### Phase F1 — Separate domain code from fixtures

1. Move reusable entity types out of mockData.ts into domain/types.ts.
2. Move fertility, hatchability, candling, and reset calculations into domain/calculations.ts or focused domain modules.
3. Keep cycle.ts framework-free.
4. Move the twelve chambers, modes, alerts, and history records into data/fixtures/.
5. Keep a temporary mockData.ts compatibility barrel while imports are migrated in small batches.
6. Make fixture arrays immutable seed input rather than mutable application state.

**Exit gate:** domain modules contain no React or fixture ownership; fixtures contain no application mutations.

### Phase F2 — Introduce the in-memory repository

1. Define the repository interface and operation-level structured Result<T> values.
2. Implement an in-memory repository that owns mutable copies of fixture data.
3. Move harvest, abort, candling, alert, mode, and incubator writes into the repository.
4. Add contract tests covering list, read, update, write, reset, invalid input, missing-ID results, and record-harvest then list-history round trip.
5. Simulate optional latency and failures through repository configuration, not screen-specific timers.
6. Do not add the API repository yet.

**Exit gate:** only data/fixtures and the in-memory repository import fixture modules; write-then-read behavior is deterministic.

### Phase F3 — Add React integration and reduce App.tsx

1. Inject the repository through a small provider.
2. Add TanStack Query and feature-level query/mutation hooks against the in-memory repository.
3. Move farm-domain state and mutations out of App.tsx.
4. Keep leaf components prop-driven; only screen containers use data hooks.
5. Leave query-string handling unchanged until F4 so the data migration and router migration remain independently verifiable.
6. Remove farm-data ownership from App.tsx; routing, simulated auth, shell composition, and overlays remain until their focused phases.

**Exit gate:** App.tsx contains no incubator/mode/history mutation implementation, and changing repository implementation does not change screen component APIs.

### Phase F4 — Stabilize routes and simulated auth

1. Use wouter, the router already selected by the consolidated plan, unless a separate architecture decision selects React Router.
2. Define stable paths for overview, incubators, incubator detail/tab, candling logs, trends, alerts, settings, login, and onboarding steps.
3. Add route and deep-link integration tests with Vitest/jsdom, including alert navigation by incubator ID.
4. Add an AuthProvider interface with a mock implementation for frontend completion.
5. Treat frontend route guards as navigation behavior only; the future API remains responsible for real authorization.

**Exit gate:** refresh, Back/Forward, direct paths, unit IDs, and onboarding steps resolve predictably without syncUrl variants in App.tsx.

### Phase F5 — Complete frontend states and focused decomposition

1. Preserve and normalize onboarding data.
2. Add a rendered test proving onboarding Back preserves entered values.
3. Implement honest settings dirty/save/reset behavior against the mock repository.
4. Add loading, empty, error, retry, stale, offline, pending, rejected, and timeout presentations where the future API/device flow requires them.
5. Move Trends history generation behind the repository and cache by unit/range.
6. Extract testable selectors and hooks from the large screens one responsibility at a time.
7. Continue token cleanup using the existing color, typography, and control-size guides, including documented exceptions.
8. Finish manual responsive and keyboard verification.

**Exit gate:** the frontend demonstrates realistic success and failure paths without claiming persistence or hardware execution.

### Phase F6 — Quality and handoff gate

1. Keep typecheck, tests, coverage, and production build green.
2. Add a lint configuration and root workspace scripts for typecheck, test, coverage, and build.
3. Add CI when this branch is ready for shared integration.
4. Add repository contract tests that can later run against both in-memory and API adapters.
5. Keep browser automation outside the current gate; select a reliable E2E workflow separately if needed.

**Exit gate:** frontend behavior is stable, repository-driven, and ready for API integration.

**Status:** complete. Current web and API validation runs in CI; use the CI workflows and `docs/guide/verification-gates.md` instead of the original test counts from this historical handoff.

### Phase B1 — Backend handoff (completed)

FastAPI, the memory and PostgreSQL adapters, `ApiRepository`, Alembic migrations,
validated telemetry, durable command/ACK handling, and a simulator-facing MQTT
worker are implemented. Authentication was kept behind the production guard;
the selected account model is app-managed email/password. See the linked current
phase plan for the remaining sequence and gates.

## 11. Verification gates

### Current frontend and API gates

    pnpm lint
    pnpm --filter eggcelerate-ui typecheck
    pnpm --filter eggcelerate-ui test
    pnpm --filter eggcelerate-ui coverage
    pnpm --filter eggcelerate-ui build
    apps/api/.venv/bin/ruff check apps/api
    apps/api/.venv/bin/ruff format --check apps/api
    (cd apps/api && .venv/bin/mypy)
    apps/api/.venv/bin/python apps/api/scripts/verify_migrations.py
    apps/api/.venv/bin/python -m pytest -q apps/api/tests --require-database
    apps/api/.venv/bin/python apps/api/scripts/verify_live_contract.py

Also run:

    git diff --check

### Remaining release and hardware gates

    API health check succeeds
    database migrations succeed
    mock and API repositories expose the same behavior
    auth and role checks protect data fetches
    REST hydration and WebSocket reconnect work
    commands expose ACK, reject, timeout, and rollback states
    simulator telemetry is persisted at the research interval
    device safety remains autonomous during broker/backend loss

## 12. Open decisions and documentation maintenance

Resolve these before the corresponding implementation phase:

- publish or commit the accepted ADRs so backend decisions are available beyond this local checkout;
- implement app-managed email/password sessions, revocation, and farm authorization before a public service;
- choose secure broker authentication/TLS and deployment secrets before connecting remote hardware;
- define telemetry retention/downsampling and WebSocket reconnect behavior before enabling those features;
- record a successful backup restore and restart/outage drills;
- verify firmware safety values and actuator behavior on the selected hardware;
- select browser E2E coverage when a reliable workflow is agreed;
- publish the local ADR set if the wider team needs decision records.

When a new architectural decision is made, update the decision record, this guide, and the relevant implementation plan together. Keep current, simulated, planned, and unresolved items visibly separate.

## 13. Current references

- [Project review and execution plan](refine/project-review-execution-plan-2026-09-23.md)
- [Backend guide](guide/backend-dashboard-first-guide.md)
- [Database setup guide](guide/database-setup-guide.md)
- [Auth and onboarding guide](guide/auth-onboarding-guide.md)
- [Mobile web refinement plan](refine/archive/mobile-web-refinement-plan.md)
- [B3 persistence exit review](guide/b3-exit-review.md)
- [Typography guidelines](guide/typography-guidelines.md)
- [Color guidelines](guide/color-guidelines.md)
- [UI control-size guidelines](guide/ui-control-size-guidelines.md)
- [Frontend restructuring guide](guide/frontend-restructuring-guide.md)
- [Firmware safety contract](guide/firmware-safety-contract.md)
- [Dashboard-first backend guide](guide/backend-dashboard-first-guide.md)

The review plans and phase handoffs in `docs/refine` are versioned. The local ADR
archive remains separate and is not a substitute for source-backed implementation
status.
