# EGGCELERATE — System Architecture Guide

> **Status:** Working implementation guide
> **Last reviewed:** 2026-09-04
> **Scope:** Frontend-first delivery, the current repository, and the planned API/device system.
> **Validation note:** This guide was cross-referenced against source and local documentation. Browser automation is not a current validation gate.

This guide describes what EGGCELERATE has today, what the implementation plan proposes, and the boundary that lets frontend work finish before backend work begins. Current source code is the authority for implemented behavior. The implementation plan is the authority for the proposed delivery sequence, not proof that a component exists.

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
2. The consolidated plan: [docs/plan/2026-08-25-eggcelerate-consolidated-plan.md](plan/2026-08-25-eggcelerate-consolidated-plan.md).
3. Focused plans and guides that are present in this checkout:
   - [docs/plan/chunk-fix-plan.md](plan/chunk-fix-plan.md)
   - [docs/guide/auth-onboarding-guide.md](guide/auth-onboarding-guide.md)
   - [docs/screens/auth-and-onboarding-plan.md](screens/auth-and-onboarding-plan.md)
   - [docs/refine/mobile-web-refinement-plan.md](refine/mobile-web-refinement-plan.md)
   - the reports in [docs/audit/](audit/README.md)
   - the design and accessibility guides in [docs/guide/](guide/README.md)
4. Historical reviews are context only and must be checked against the current source.

The local workspace contains the ADR set under `docs/archive/adr/`, but those local-only files are outside this frontend closure commit. Accepted stack decisions are summarized in `apps/api/README.md`; backend work must make the authoritative decision records available to every contributor before implementation begins.

## 2. Delivery strategy

The agreed delivery shape is:

    Finish frontend with realistic mock behavior
              ↓
    Stabilize domain contracts and repository boundary
              ↓
    Connect the same UI to FastAPI and persistence
              ↓
    Connect backend to simulator, MQTT, and hardware
              ↓
    Harden realtime, safety, permissions, and operations

Backend implementation is intentionally deferred while the frontend is completed. The frontend must still establish the data contracts and service boundary now. That prevents the future API from becoming a rewrite of the screens.

The frontend phase is successful when the user can complete the dashboard flows against a deterministic mock repository, with realistic loading/error/empty states and API-shaped data. It does not require a live database, broker, or ESP32.

## 3. Current system snapshot

| Area | Status | Current reality |
|---|---|---|
| Web dashboard | **Implemented** | Vite + React application in apps/web. |
| Shared UI primitives | **Implemented** | Tailwind 4, Radix-based primitives, project tokens, responsive shell, charts, dialogs, tables, and form controls. |
| Incubator, cycle, candling, alert, trend, and settings flows | **Simulated** | Farm data hydrates from an asynchronous in-memory repository into the TanStack Query cache; reload resets repository-owned changes. |
| Domain helpers | **Implemented / expanding** | Entity types, candling, fertility, incubator calculations, dates, cycle helpers, and condition derivation now live under apps/web/src/app/domain. |
| Mock repository boundary | **Implemented** | `EggcelerateRepository` and `InMemoryEggcelerateRepository` own fixture copies, mutable farm records, and deterministic reading queries. Screens do not import fixtures. |
| Navigation | **Implemented** | Wouter 3.10 owns canonical paths, Back/Forward updates, legacy-query migration, and safe parameter redirects through the routing module. |
| Server-state layer | **Implemented for mocks** | TanStack Query 5 and farm feature query/mutation hooks wrap the injected repository. |
| Auth and onboarding | **Simulated with boundary** | `/login` and `/onboarding/:step` are public mock routes. `MockAuthProvider` and `RequireAuth` guard dashboard navigation; there is no server session or real authorization. |
| API contract | **B0A implemented; runtime paused** | Strict frontend transport schemas and the result/error envelope are tested. FastAPI and `ApiRepository` are not present; resume at B0B in the dashboard-first backend guide. |
| API runtime, database, and broker | **Planned** | apps/api, infrastructure, and Compose contain placeholders or web-only configuration. |
| Device firmware and simulator | **Planned** | No ESP32 firmware or MQTT simulator exists in the repository. |
| Web deployment | **Implemented/configured** | Docker multi-stage build and Nginx SPA serving; Compose currently runs only web. |
| Automated checks | **Implemented for the frontend boundary** | Typecheck, 159 Vitest tests, scoped coverage, production build, clean Biome lint, diff validation, and web CI are present. API tests, rendered component/accessibility coverage, and a reliable browser E2E workflow remain future work. |

The current web checks are:

    pnpm --filter eggcelerate-ui typecheck
    pnpm --filter eggcelerate-ui test
    pnpm --filter eggcelerate-ui coverage
    pnpm --filter eggcelerate-ui build
    pnpm lint
    git diff --check

The current repository has 22 test files and the B0A contract checkpoint passes 159 tests. Passing tests establish a healthy frontend baseline; they do not prove API, device, persistence, or realtime behavior.

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
      │     └── placeholder README
      ├── apps/mobile
      │     └── placeholder README
      ├── packages
      │     └── reserved until a real second consumer exists
      └── compose.yaml
            └── web only, host port 80, /healthz

Current implementation measurements:

- App.tsx is 547 lines and combines account/onboarding UI state with screen composition. Farm-data ownership, repository mutations, path parsing, history listeners, and auth state have moved out.
- mockData.ts has been removed; application imports from the old compatibility barrel are zero, down from 24 before F1.
- CandlingJournalTab.tsx is 2,475 formatted lines, TrendsScreen.tsx is 1,178 lines, and IncubatorsScreen.tsx is 953 lines. Pure incubator filter/natural-order sort, trends filtering/KPIs, candling timing/feed merge, and tally validation have moved to focused selectors under `features/` with regression tests.
- there is no runtime frontend environment contract or .env.example;
- there is no API client or real auth adapter; the in-memory repository, TanStack Query integration, Wouter routing, Biome lint config with root scripts, and web CI (`.github/workflows/web.yml`) are implemented.

Large file size is an indicator, not the acceptance criterion. Refactoring is complete when ownership and dependencies are clear, not when a file reaches an arbitrary line count.

### 3.2 Current data and control flow

1. `main.tsx` selects the singleton `InMemoryEggcelerateRepository` and injects it through `AppProviders`; the adapter creates private mutable copies of fixture data.
2. Farm feature hooks execute repository queries and commands. TanStack Query owns modes, incubators, alerts, and hatch-record cache state and synchronizes successful mutations.
3. Incubator and mode writes recalculate affected chamber condition and status through the shared domain helper.
4. The repository validates mode references, preserves entity IDs during updates, normalizes connection state, and returns structured validation, conflict, missing-ID, simulated-failure, and unexpected-failure results.
5. Hatch and aborted-cycle histories are private repository state. Screen-level cycle-history hooks update or invalidate the relevant query keys after commands; write-then-read behavior and copy isolation are covered by adapter tests.
6. `listReadings({ incubatorId, window })` deterministically synthesizes aligned telemetry behind the repository boundary. TanStack Query caches `24h`, `7d`, and `full` windows by incubator; relevant incubator and mode writes invalidate those keys.
7. Wouter owns location observation and browser history. The routing module parses canonical paths, validates tabs/steps/incubator IDs, migrates old query links, and exposes intent-level navigation functions. Dashboard output is wrapped by the mock auth guard.
8. Repository mutations return confirmation to screen workflows. The in-memory adapter can apply bounded latency or return offline, rejected, and timeout results without screen-specific timers. Incubator updates are optimistic in the TanStack Query cache and roll back to the captured unit snapshot when confirmation fails; other writes remain pessimistic.
9. Pending controls prevent duplicate submissions and announce busy state. Failed writes retain form input and expose a retry action. Cached background failures remain rendered with a stale-data warning, while browser disconnection exposes an offline warning over the last loaded data.
10. Completing or stopping a cycle updates the chamber and its corresponding history as one in-memory repository operation. A rejected or timed-out command changes neither collection, avoiding partial writes and duplicate history on retry.

The static SPA is deployable and well packaged for demonstration. That does not make the overall system production-ready because persistence, authentication, API behavior, device transport, and safety execution are not present.

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
| Client data | TanStack Query feature hooks over the injected in-memory repository | Preserve the hooks and swap in an API adapter after endpoint contracts exist. |
| Routing | Wouter 3.10 with focused path/parser hooks | Keep stable canonical routes; add future role-aware routes without duplicating URL state in components. |
| Server state | TanStack Query 5.102.8 | Keep it for REST hydration, cache, mutations, and future realtime patches. |
| Tests | Vitest + jsdom with domain, repository, and provider coverage | Add broader rendered component and shared adapter contract tests. |
| Lint | Biome 2.x recommended preset; `pnpm lint` is clean | Keep lint in the local and CI gates; add focused rules only when they preserve the established frontend behavior. |
| Browser E2E | Not configured | The plan names Playwright, but it is not required for the current frontend phase. Keep the E2E tool decision open until a reliable workflow is agreed. |

### 4.2 Planned backend and device stack

The consolidated plan proposes this target stack:

| Component | Planned responsibility | Status |
|---|---|---|
| FastAPI + Pydantic | Auth, REST validation, WebSocket bridge, command queueing, acknowledgements | **Accepted direction; not implemented**. Endpoint and auth contracts remain B1 prerequisites. |
| PostgreSQL + TimescaleDB | Users, devices, modes, cycles, alerts, telemetry, candling, and hatch history | **Planned; not configured**. |
| Mosquitto MQTT | Device transport; QoS 1 commands and QoS 0 telemetry | **Planned; not configured**. |
| ESP32 firmware | Local sensing, actuation, watchdog, NVS setpoints, and fail-safe control | **Planned; not present**. |
| Python simulator | Replace ESP32 during backend development | **Planned; not present**. |
| Docker Compose | Run web, API, database, and broker in development/deployment | **Partial**; only web is currently defined. |
| Nginx | Serve the built SPA and provide health checking | **Implemented for web**. |

These are accepted local architecture directions, not installed production infrastructure. The ADR files are local-only in this checkout; make them available to the team, and review endpoint, auth, persistence, realtime, and device contracts before infrastructure work is treated as final.

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

The plan currently calls the abstraction IncubatorRepository. If the interface also owns account, modes, alerts, candling, and hatch history, use a broader name such as FarmRepository or split it into domain-focused interfaces. Do not hide an application-wide service behind a misleading incubator-only name.

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
      apiRepository.ts only when API work begins
    hooks/
      feature query and mutation hooks
    providers/
      repository dependency and auth boundaries
    routing/
      route definitions and URL-state helpers

State ownership must remain explicit:

| State type | Owner |
|---|---|
| URL/navigation state | The selected router. The consolidated plan currently selects wouter. |
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
- the future API adapter replaces the in-memory adapter without creating a second set of screens.

Do not create an empty ApiRepository merely to satisfy the folder diagram. Add it when endpoint and authentication contracts are ready.

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

The current implementation has these concepts in mock data and UI validation, but persistence and server enforcement are not implemented.

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


## 9. Cross-reference with the implementation plan

The consolidated plan contains twelve tasks. Frontend restructuring is now active through the focused guide; the status below is based on the current repository rather than old unchecked plan boxes.

| Plan phase | Plan tasks | Current status | Next frontend-relevant exit |
|---|---:|---|---|
| Stabilize contracts and prototype | 1–5 | **Frontend complete** | F0–F6 established domain contracts, repository ownership, Query integration, routing/auth seams, realistic mock states, focused selectors, and quality gates. |
| Establish app shell | 6–7 | **Partial** | Wouter, TanStack Query, canonical routes, mock auth provider/guard, and demo onboarding exist. Real server auth, RBAC, and admin screens do not. |
| Backend without electronics | 8 | **Not started** | Add FastAPI in-memory endpoints, API contract tests, broker configuration, and simulator only after the frontend repository contract is stable. |
| Realtime read path | 9 | **Not started** | Add REST history, WebSocket patches, query-cache updates, reconnect, and offline status. |
| Commands and persistence | 10 | **Not started** | Add command ACK/timeout/rollback, candling persistence, harvest persistence, and aborted-cycle persistence. |
| Hardening | 11 | **Frontend source checks complete / integration pending** | Keyboard and responsive source contracts are tested. Manual browser/200% zoom review, rendered accessibility coverage, server permission checks, and integration failure paths remain. Browser E2E tooling is not a current gate. |
| Infrastructure and documentation | 12 | **Partial** | Web Docker/Nginx health behavior exists. API, database, broker, simulator, production secrets, and tracked architecture decisions remain. |

The focused documentation aligns with the frontend-first sequence:

- the [frontend restructuring guide](guide/frontend-restructuring-guide.md) is the active execution checklist for phases S0 through F6;
- a local database setup guide is active WIP outside this frontend closure commit; review it with the API contract before provisioning;
- the auth guide explicitly describes mock-only onboarding and the future auth guard;
- the mobile refinement plan keeps mobile web as one responsive React app and records source implementation as complete with manual review pending;
- the chunk plan calls for lazy heavy screens and a repository boundary;
- the audit reports record UI consistency work separately from backend architecture.

## 10. Refined frontend-first execution plan

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

**Status:** complete. Biome lint, typecheck, 155 tests, scoped coverage, production build, and diff checks form the frontend handoff gate. This does not authorize or implement backend services.

### Phase B1 — Backend handoff

1. Confirm FastAPI/Pydantic, PostgreSQL/TimescaleDB, Mosquitto, and simulator decisions in architecture records.
2. Follow the dashboard-first backend guide: refine broad mock-era writes into explicit service commands before exposing HTTP.
3. Add the runtime environment contract and `.env.example` when the API URL and deployment shape are known.
4. Implement FastAPI read and dashboard mutation endpoints with in-memory data first.
5. Add `ApiRepository` and run the same observable-behavior tests against the API.
6. Add PostgreSQL/TimescaleDB persistence, then REST hydration before WebSocket patches.
7. Add MQTT simulation plus command acknowledgement, timeout, rollback, and audit persistence before real actuator writes.
8. Defer authentication and user administration: keep a local-only disabled-auth request context, preserve `farm_id` ownership, and refuse production startup until real authorization is implemented.

Do not add an empty API service, change the web host port, or extract shared packages during the frontend seam work unless a concrete deployment or second-consumer requirement appears. The device and hardware work follows the API contract and should not require rewriting React screens.

## 11. Verification gates

### Current frontend gate

    pnpm lint
    pnpm --filter eggcelerate-ui typecheck
    pnpm --filter eggcelerate-ui test
    pnpm --filter eggcelerate-ui coverage
    pnpm --filter eggcelerate-ui build

Also run:

    git diff --check

### Future integration gate

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
- define endpoint DTOs, pagination, structured error codes, command idempotency, and transaction boundaries;
- use the documented local-only disabled-auth request context for the dashboard milestone; choose server-session authentication, authorization, and CSRF behavior before any public deployment;
- define telemetry retention/downsampling, REST/WebSocket envelopes, reconnect/resume behavior, and cache invalidation;
- define command IDs and the MQTT acknowledgement/rejection/timeout/audit lifecycle before actuator writes;
- retain the implemented Wouter router unless a separate decision explicitly selects another router;
- use TanStack Query for server-like data before considering a second global state library;
- keep browser automation outside the current validation workflow; select an E2E tool only when a reliable workflow is agreed;
- verify the provisional firmware safety values on the selected hardware;
- keep the architecture guide, restructuring guide, and firmware safety contract versioned; other local documentation remains outside this closure commit.

When a new architectural decision is made, update the decision record, this guide, and the relevant implementation plan together. Keep current, simulated, planned, and unresolved items visibly separate.

## 13. Primary present references

- [Consolidated implementation plan](plan/2026-08-25-eggcelerate-consolidated-plan.md)
- [Plan index](plan/README.md)
- [Chunk and bundle plan](plan/chunk-fix-plan.md)
- [Auth and onboarding guide](guide/auth-onboarding-guide.md)
- [Auth and onboarding screen plan](screens/auth-and-onboarding-plan.md)
- [Mobile web refinement plan](refine/mobile-web-refinement-plan.md)
- [Audit index](audit/README.md)
- [Typography guidelines](guide/typography-guidelines.md)
- [Color guidelines](guide/color-guidelines.md)
- [UI control-size guidelines](guide/ui-control-size-guidelines.md)
- [Frontend restructuring guide](guide/frontend-restructuring-guide.md)
- [Firmware safety contract](guide/firmware-safety-contract.md)
- [Dashboard-first backend guide](guide/backend-dashboard-first-guide.md)

The local ADR and product documentation outside the versioned architecture guides is not included in the frontend closure commit. Backend work should first publish or replace the authoritative records it depends on.
