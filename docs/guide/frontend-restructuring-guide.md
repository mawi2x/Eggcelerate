# EGGCELERATE Frontend Restructuring Guide

> **Status:** Frontend closure complete; backend handoff pending
> **Started:** 2026-09-03
> **Scope:** Restructure the existing mock frontend without redesigning it or starting the backend.
> **Authority:** Current source defines implemented behavior. The System Architecture Guide defines the target boundaries.

## 1. Objective

Prepare the completed frontend for backend integration by separating domain rules, fixture data, mutable mock state, React data access, and routing.

This is an incremental refactor, not a rewrite. Existing screens, responsive behavior, simulated flows, and visual design remain the acceptance baseline unless a verified defect requires a correction.

## 2. Frontend freeze policy

While this guide is active:

- do not add product features or redesign screens;
- allow defect, accessibility, and regression-test fixes;
- keep the application usable after every phase;
- do not add the API, database, MQTT broker, or hardware integration;
- do not extract shared workspace packages until there is a second consumer;
- do not use Playwright as a validation gate;
- do not move a file and change its behavior in the same step unless a test proves the defect.

## 3. Required checks

Every implementation checkpoint must pass:

```sh
pnpm lint
pnpm --filter eggcelerate-ui typecheck
pnpm --filter eggcelerate-ui test
pnpm --filter eggcelerate-ui coverage
pnpm --filter eggcelerate-ui build
git diff --check
```

Focused Vitest/jsdom tests replace browser automation for this restructuring. Manual browser review may be performed separately when a reliable workflow is available, but it does not block the current phases.

## 4. Contracts that must remain stable

- A chamber is addressed by its stable `id`; its display name is not an identifier.
- Device IDs and record IDs remain distinct from chamber IDs.
- Farms create `farmId`; identity creates `userId`; the application creates `incubatorId`, `cycleId`, candling-entry IDs, and hatch-record IDs; provisioning assigns `deviceId`; mode and alert services assign their own IDs.
- Existing query-string links continue working until the routing phase replaces them deliberately.
- The domain/UI turning interval is measured in hours.
- The future API/device wire turning interval is measured in minutes.
- Conversion between hours and minutes occurs only in the transport mapper.
- Operations return the structured result shape:

```ts
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };
```

- Invalid domain counts must not produce percentages above 100% or mutate history.
- Connection status, cycle phase, condition severity, and automatic-turn state must be derived through shared domain commands rather than recreated by screens.

## 5. Migration map

| Current responsibility | Target location | Migration rule |
|---|---|---|
| Entity interfaces in `data/mockData.ts` | `domain/types.ts` | Move types first; keep compatibility exports temporarily. |
| Fertility, hatchability, cycle reset, and status calculations | Focused files under `domain/` | Add regression tests before moving. |
| Chamber, mode, alert, and history seed arrays | `data/fixtures/` | Export immutable seed values only. |
| Mutable hatch, abort, candling, alert, mode, and chamber state | `data/repositories/in-memory-repository.ts` | Repository owns copies of seeds. |
| Repository contracts and commands | `data/repositories/repository.ts` | No React imports. |
| Screen data loading and mutations | `features/*/queries.ts` or focused hooks | Screens consume hooks; leaf UI stays prop-driven. |
| Farm-domain state and mutations in `App.tsx` | Repository-backed providers/hooks | Keep only providers, shell, routes, and overlays in `App.tsx`. |
| Query-string parsing and synchronization in `App.tsx` | Routing module, then wouter routes | Migrate only after the data boundary is stable. |
| API-shaped validation in `data/dto.ts` | `data/transport/` | DTO names include wire units; mappers convert to domain models. |

Expected shape after the frontend phases:

```text
src/app/
├── app/
│   ├── AppProviders.tsx
│   ├── AppRoutes.tsx
│   └── router.ts
├── domain/
│   ├── types.ts
│   ├── cycle.ts
│   ├── fertility.ts
│   └── commands.ts
├── data/
│   ├── fixtures/
│   ├── repositories/
│   │   ├── repository.ts
│   │   └── in-memory-repository.ts
│   └── transport/
│       ├── dto.ts
│       └── mappers.ts
└── features/
    ├── incubators/
    ├── candling/
    ├── alerts/
    ├── modes/
    └── history/
```

This is a responsibility map, not a requirement to create empty folders.

## 6. Execution phases

### S0 — Stabilize the frozen frontend

- [x] Review the latest responsive changes without browser automation.
- [x] Correct the TypeScript failures introduced by unused status styling.
- [x] Restore responsive ownership of `FilterBar` width.
- [x] Correct mobile scroll-listener lifecycle and reduced-motion behavior.
- [x] Improve focus state and target sizes for the new mobile navigation controls.
- [x] Run and record the complete frontend gate: typecheck, 91 tests, build, and diff validation pass.

**Exit:** all four required checks pass before architecture files move.

### F0 — Freeze contracts with regression tests

- [x] Record domain hours versus wire minutes.
- [x] Retain the structured `Result<T>` contract.
- [x] Test fertility and hatchability bounds and invalid denominators.
- [x] Test harvest validation before history mutation.
- [x] Test mode updates recalculating affected chamber severity.
- [x] Parse every mode fixture through the domain-to-wire mapper and DTO schema.
- [x] Record stable ID ownership in this guide and `domain/types.ts`.

**Exit:** high-risk domain behavior is explicit and green before extraction.

### F1 — Separate domain code from fixtures

- [x] Move entity types to `domain/types.ts`.
- [x] Move calculations and commands to focused domain modules.
- [x] Move seed arrays into `data/fixtures/`.
- [x] Make fixture definitions immutable or factory-owned and verify fresh copies.
- [x] Keep `mockData.ts` as a temporary compatibility barrel.
- [x] Migrate domain and type imports in small batches; only five temporary data/mutation imports remain for F2–F3.

**Exit:** domain modules own rules, fixture modules own only immutable examples, and behavior remains unchanged.

Checkpoint: F1 passed typecheck, 91 Vitest tests, the production build, and `git diff --check` on 2026-09-03.

### F2 — Introduce the in-memory repository

- [x] Define the repository interface and operation input types.
- [x] Implement an in-memory adapter owning mutable copies of seeds.
- [x] Move all writes behind repository commands.
- [x] Add adapter contract tests for success, validation, missing IDs, immutable IDs, and write-then-read behavior.
- [x] Keep optional latency/failure simulation inside repository configuration.

**Exit:** screens cannot mutate or import fixtures, and repository round trips are deterministic.

Checkpoint: F2 passed typecheck, 102 Vitest tests, the production build, and `git diff --check` on 2026-09-03. Fixture imports are private to the in-memory adapter; the two remaining `mockData.ts` imports expose only deterministic generated history and are scheduled for F5.

### F3 — Integrate React data access

- [x] Inject the repository through `AppProviders`.
- [x] Add TanStack Query and feature-level query/mutation hooks.
- [x] Move farm-domain state and mutations out of `App.tsx`.
- [x] Keep leaf components prop-driven.
- [x] Preserve loading, empty, error, and retry contracts.

**Exit:** swapping repository implementations does not change screen APIs.

Checkpoint: F3 passed typecheck, 104 Vitest tests, the production build, and `git diff --check` on 2026-09-03. `main.tsx` selects the repository, TanStack Query owns server-like cache state, and application screens no longer import the repository singleton.

### F4 — Stabilize routing and simulated auth

- [x] Introduce wouter unless an architecture decision explicitly changes the router.
- [x] Define stable route paths and parameter validation.
- [x] Add Vitest/jsdom tests for direct links, Back/Forward, unknown IDs, and onboarding steps.
- [x] Introduce a mock `AuthProvider` boundary.

**Exit:** navigation no longer depends on multiple synchronization functions in `App.tsx`.

Canonical routes: `/`, `/incubators`, `/incubators/:id`, `/incubators/:id/:tab`, `/candling`, `/trends`, `/trends/:id`, `/alerts`, `/settings`, `/login`, and `/onboarding/:step`. Invalid tabs, steps, IDs, and paths replace to a safe canonical route. Legacy `?screen=...` links are translated once and replaced rather than maintained as a second router.

Checkpoint: F4 passed typecheck, 110 Vitest tests, the production build, Docker image build, and `git diff --check` on 2026-09-03. Wouter 3.10 owns location updates; `MockAuthProvider` and `RequireAuth` provide a replaceable navigation guard without claiming server authorization.

### F5 — Complete frontend integration states

- [x] Add realistic stale, offline, pending, rejected, timeout, and rollback presentations where required.
- [x] Make settings save/reset behavior honest against the repository.
- [x] Move history generation behind a cached repository query.
- [x] Extract selectors and hooks from large screens one responsibility at a time.
- [x] Finish focused keyboard and responsive checks.

**Exit:** the mock frontend exercises the states the API and device workflow will later provide.

Checkpoint F5A: deterministic readings now enter through `listReadings({ incubatorId, window })`, share a repository-owned timestamp anchor, and are cached by TanStack Query. Detail and Trends no longer generate fixture history, `mockData.ts` has been removed, and the checkpoint passed typecheck, 113 Vitest tests, the production build, Docker image build, and `git diff --check` on 2026-09-03. The remaining F5 state, settings, decomposition, and focused UI checks stay open.

Checkpoint F5B: farm commands now return confirmation to their callers instead of using fire-and-forget callbacks. The in-memory adapter owns configurable latency plus offline, rejected, and timeout outcomes; incubator changes update optimistically and restore the previous cache value when confirmation fails. Cycle completion and early stop are atomic repository commands, preventing partial chamber/history writes and duplicate records on retry. Forms and command controls retain input, prevent duplicate submission, expose accessible busy states, and offer retry feedback. Cached background failures render as stale data, and browser disconnection renders an offline status without discarding loaded data. This is frontend simulation only, not proof of API persistence or device acknowledgement. The checkpoint passed typecheck, 119 Vitest tests, the production build, Docker image build, and `git diff --check` on 2026-09-03. Settings dirty/save/reset remains F5C.

Checkpoint F5C: mode add/edit/delete/import and settings save/reset now wait for repository confirmation before closing dialogs or showing success. A rejected save keeps the edited value and dirty state, while Discard restores the last confirmed snapshot. The checkpoint passed typecheck, 123 Vitest tests, the production build, and `git diff --check` on 2026-09-03. Remaining F5 work is selectors/hooks extraction and focused keyboard/responsive checks.

Checkpoint F5D: incubator filtering/natural-order sorting, hatch-history filtering/KPIs, candling checkpoint timing, feed-node merging, and tally validation now live in focused pure selectors with regression tests. Mobile dot navigation moves focus to the selected card, keeps status available as text, and bounds or hides its fixed track at narrow/zoomed layouts. Native `fieldset` and `button` replacements explicitly reset layout-affecting browser defaults. The source-level keyboard/responsive contract is complete; manual browser and 200% zoom review remains recommended before release and is not a Playwright gate.

### F6 — Quality and backend handoff

- [x] Add lint configuration and root quality scripts.
- [x] Add CI when the branch is ready for shared integration.
- [x] Run repository contract tests against the in-memory adapter.
- [x] Update the System Architecture Guide from planned to implemented for completed boundaries.
- [x] Document remaining API decisions and handoff requirements.

**Exit:** frontend behavior is stable, repository-driven, and ready for an API adapter.

Checkpoint F6: Biome 2.x recommended checks are clean through `pnpm lint`; root scripts cover lint, typecheck, tests, coverage, and build. Web CI (`.github/workflows/web.yml`) runs lint, typecheck, tests, scoped coverage, build, and `git diff --check` on `experiment`/`main` pushes and relevant pull requests. The scoped coverage ratchet covers domain, data, features, providers, and routing at 75% lines, 55% functions, and 65% branches; rendered screens remain outside the threshold until component coverage exists. Repository contract tests remain reusable for a future API adapter. The System Architecture Guide, API placeholder, and provisional firmware safety contract now record the backend handoff without implementing it.

## 7. Change discipline

For every phase:

1. Add or identify the test protecting current behavior.
2. Make the smallest responsibility move.
3. Keep a compatibility export while consumers migrate.
4. Run the focused test, then the complete frontend gate.
5. Review the diff for accidental UI or data changes.
6. Update this checklist and the System Architecture Guide.

Do not combine repository introduction, routing migration, large-screen decomposition, and visual cleanup in one patch.

## 8. Backend handoff boundary

Backend work starts only after F6. The first backend adapter must implement the same repository contract as the in-memory adapter. React screens must not know whether their data came from fixtures, HTTP, WebSocket hydration, or persisted storage.

The web application never connects directly to MQTT. Device reads and commands flow through the future API, and actuator commands require acknowledgement, rejection, timeout, rollback, and audit states before real hardware control is enabled.

Before creating `ApiRepository`, phase B1 must define and review:

- endpoint resources, DTOs, pagination, error codes, and idempotency rules;
- the server-session/authentication model, authorization boundaries, CSRF/CORS behavior, and local development origin;
- database ownership, migrations, telemetry retention/downsampling, and transaction boundaries for cycle/history commands;
- REST hydration, WebSocket event envelopes, reconnect/resume behavior, and cache invalidation;
- command IDs and the API → MQTT → device acknowledgement/rejection/timeout/audit lifecycle;
- simulator acceptance tests and hardware verification of the provisional firmware safety values.

The accepted stack direction is FastAPI/Pydantic, PostgreSQL/TimescaleDB, Mosquitto MQTT, and an ESP32-local safety controller. None of those runtime services is implemented by this frontend closure.
