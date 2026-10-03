# Phase-by-phase improvement execution plan — 2026-10-02

Status (2026-10-03): M0 technical baseline verified and protected dashboard pilot
selected; capstone group ownership and Azure VPS hosting recorded; firmware/inventory provisional.
M1–M5 complete locally; M6–M9 pending.
Evidence: [M0 baseline](m0-baseline-2026-10-03.md), [M1 handoff](m1-handoff-2026-10-03.md),
[M3 handoff](m3-alert-lifecycle-2026-10-03.md), [M4 handoff](m4-telemetry-scale-2026-10-03.md).

Source: [project review and findings R01–R13](project-improvement-plan-2026-10-02.md).
Baseline reviewed: `a470ab3`. This document makes the review actionable and does not
replace the historical September verification records.

## Execution rules

- Deliver each phase through small changes with its completion evidence recorded.
- Keep farm isolation, atomic writes, replay safety, telemetry freshness, and command
  acceptance versus execution semantics intact throughout implementation.
- Use disposable environments for database and outage validation.
- Treat effort ranges as engineering-day estimates for one experienced contributor;
  environment access and hardware availability can extend elapsed time.
- Record each phase as pending, in progress, complete, or blocked, with revision,
  remaining tasks, relevant validation, and the next action.
- No tests, service changes, or deployment operations were performed while preparing
  this plan. The validation steps below apply to future implementation.

## Roadmap

| Phase | Outcome | Depends on | Estimated effort | Status |
| --- | --- | --- | --- | --- |
| 0 | Current baseline and release scope recorded | — | 0.5–1 day | In progress; group ownership and Azure VPS hosting recorded; firmware/inventory pending |
| 1 | Correct status and usable mobile navigation | 0 | 2–3 days | Complete locally, October 3 |
| 2 | Recoverable dashboard failures and fresh shared data | 1 | 2–4 days | Complete locally, October 3 |
| 3 | Durable alerts from actual monitoring conditions | 2 | 3–5 days | Complete locally, October 3 |
| 4 | Bounded chart queries and complete exports | 2 | 3–5 days | Complete locally, October 3 |
| 5 | Measured loading performance and efficient CI | 4 | 2–3 days | Complete locally, October 3 |
| 6 | Clear frontend ownership and smaller database transactions | 3, 4, 5 | 5–10 days | Pending |
| 7 | Documented deployment, recovery, and operational diagnostics | 0; final drill after 3–6 | 4–7 days | Pending |
| 8 | Commissioned authenticated physical devices | 0; operational support from 7 | Hardware dependent | Pending |
| 9 | Release decision supported by current evidence | Relevant gates from 1–8 | 1–2 days plus soak | Pending |

Default software order: **0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 9**.
Phase 7 documentation and operational preparation can start after Phase 0.
Firmware discovery and protocol work in Phase 8 can also start after Phase 0.
Physical production dispatch requires Phase 8 completion. A dashboard-only release
must explicitly describe its supported device behavior and disabled dispatch boundary.

## Phase 0 — Establish the current baseline

**Purpose:** establish current evidence and define the intended first release.

Tasks:

- [x] Record revision, working-tree state, toolchain, migration head, and configuration.
- [x] During implementation, run the existing web/API checks and live repository
      contract against disposable services; distinguish passes, failures, and skips.
- [x] Recheck the reported mobile issues and record current bundle/payload sizes.
- [x] Choose the release scope: protected dashboard pilot; physical dispatch gated by M8.
- [x] Assign owners for frontend, API, deployment, firmware, and release decisions: capstone research group.
- [ ] Record available firmware source, test devices, and deployment environment.

Deliverable: a baseline checkpoint and scope/ownership table.

Completion gate: baseline failures have a concrete disposition; measurements are
dated and tied to a revision; hardware/deployment dependencies have named owners.

## Phase 1 — Fix status presentation and mobile operation

**Findings:** R03, R04. **Primary files:** `DeviceSettingsTab.tsx`,
`statusPresentation.ts`, `HelpWidget.tsx`, `use-app-router.ts`, `App.tsx`.

Tasks:

- [x] Derive connection text, icon, and color from one state mapping, including paired
      offline, connecting, connected, and unpaired states.
- [x] Reposition mobile help into navigation or a reserved area based on the current
      overlap reproduction; keep its access predictable across screens and dialogs.
- [x] Define scroll reset on primary navigation, restoration on browser Back, and
      detail-tab behavior; implement that policy in routing.
- [x] Add a skip-to-content link and appropriate destination focus handling.
- [x] Review essential status text and form controls at narrow widths and 200% zoom.

Deliverable: a consistent device-status presentation and usable mobile shell.

Completion gate: offline status never uses the connected presentation; help does not
cover controls at 320px/393px through the full scroll range; keyboard navigation,
zoom, primary destination changes, and Back follow the documented behavior.

## Phase 2 — Make failures recoverable and shared data fresh

Evidence: [M2 completed handoff](m2-handoff-2026-10-03.md).

**Findings:** R05 refresh behavior, R06. **Primary files:** `use-farm-data.ts`,
`App.tsx`, `AppProviders.tsx`, screen status components and query hooks.

Tasks:

- [x] Add session-local fetch-failure notifications and a bounded toast policy:
      aggregate related failures, suppress repeated polling/retry toasts, retain
      read/dismiss behavior, record recovery, and clear on logout. Evidence:
      [M2 fetch-notification checkpoint](m2-fetch-notifications-2026-10-03.md).

- [x] Separate critical monitoring queries from alerts, history, and settings queries.
- [x] Render feature-level loading/error/retry states without replacing healthy
      chamber monitoring when a secondary query fails.
- [x] Add application and route recovery boundaries for render and lazy-load errors.
- [x] Refresh alerts periodically while authenticated and visible; refresh on tab
      return, and define history refresh/invalidation on route activation.
- [x] Preserve usable stale data with an explicit freshness/error label.
- [x] Preserve logout/session-expiry cache clearing and prevent background refresh
      after authentication ends.

Deliverable: recoverable feature states and a documented refresh policy.

Completion gate: an alerts/history failure leaves monitoring usable; another client's
alert action appears within the agreed interval; route failures offer recovery;
session expiry removes farm data and stops authenticated polling.

## Phase 3 — Implement the alert lifecycle

**Finding:** R05 alert generation. **Primary areas:** API services, alert storage,
telemetry ingestion, periodic evaluation, notification settings, Alerts screen.

Tasks:

- [x] Define threshold sources, persistence duration, severity, condition identity,
      recovery, acknowledgment, dismissal, and recurrence for each alert type.
- [x] Start with temperature, humidity, water, and offline episodes; document how
      user preferences interact with mode settings and mandatory conditions.
- [x] Persist episodes with farm/device ownership and duplicate-safe identities.
- [x] Evaluate offline transitions periodically without requiring device telemetry.
- [x] Expose active/resolved/acknowledged state and consistent counts in the UI.
- [x] Preserve dismissed identities so retry or seed cannot revive old episodes.

Deliverable: alert lifecycle contract, storage/service changes, and UI integration.

Completion gate: duplicate telemetry creates one episode; recovery and recurrence
are distinct; offline episodes appear without new device messages; acknowledgment
and dismissal survive restarts and remain isolated by farm.

Local completion evidence and lifecycle contract: [M3 handoff](m3-alert-lifecycle-2026-10-03.md).

## Phase 4 — Bound telemetry and preserve export completeness

**Finding:** R07. **Primary files:** `database/readings.py`, incubator routes,
transport schemas, repositories, `use-incubator-readings.ts`, `TrendsScreen.tsx`.

Tasks:

- [x] Measure query latency, sample counts, payloads, and browser work for realistic
      24-hour, 7-day, and full-cycle windows at 1/12/100 chambers.
- [x] Define an explicit chart resolution/point bound and additive API contract.
- [x] Reuse sparse aggregation while exposing extrema so averages do not hide
      short temperature or humidity excursions.
- [x] Preserve UTC range semantics, sparse gaps, late arrivals, and compare-mode scope.
- [x] Provide complete raw exports using pagination or streaming with stable ordering.
- [x] Reduce repeated full-window transfers with measured incremental/conditional
      retrieval or slower refresh for historical portions.

Deliverable: bounded chart API and separate complete raw export behavior.

Local completion evidence: [M4 telemetry scale handoff](m4-telemetry-scale-2026-10-03.md).

Completion gate: response size remains within the chosen bound as sample frequency
increases; raw exports cover the requested scope exactly; charts preserve gaps and
extremes; memory/API contracts reflect the new semantics.

## Phase 5 — Improve initial loading and CI

**Finding:** R13. **Primary files:** `App.tsx`, `vite.config.ts`, web scripts and CI.

Tasks:

- [x] Record current initial and lazy-route bundles, total transferred assets, and
      loading behavior under a representative mobile network profile.
- [x] Identify heavy eager dependencies; split Settings/other routes where this
      reduces initial loading without creating excessive request chains.
- [x] Review image/font/icon imports and remove measured unnecessary initial cost.
- [x] Add CI budget checks for initial assets and important lazy routes.
- [x] Execute Vitest once with coverage when it supplies the same behavior gate;
      retain coverage-scope checks and publish useful CI artifacts.

Deliverable: measured loading improvements and enforced regression budgets.

Completion gate: agreed budgets pass; direct route navigation and failed-chunk
recovery work; CI retains required checks without duplicate suite execution.

## Phase 6 — Improve maintainability and mutation scale

Phase 5 completion evidence: [M5 loading and CI handoff](m5-loading-ci-2026-10-03.md).

**Findings:** R08, R12. **Primary areas:** large screens, farm hooks,
`api/v1/dependencies.py`, database store and resource modules.

Tasks:

- [ ] Extract Trends charts/history/export orchestration, Incubators list/create
      flow, and other large components along clear responsibility boundaries.
- [ ] Split farm query coordination from alert, mode, cycle, and command mutations.
- [ ] Replace repeated route-string replay branching with explicit operation policy.
- [ ] Measure concurrent mutations across chambers/farms and archived-data growth.
- [ ] Introduce resource-specific transactions, starting with isolated small writes;
      retain atomic receipts, rollback, ownership, and lifecycle guards.
- [ ] Add pagination for growing history/alert collections with stable ordering.
- [ ] Record architectural decisions explaining transaction and state ownership.

Deliverable: smaller feature modules and measured reductions in broad database work.

Completion gate: routes, retry keys, exports, terminal cycle behavior, and farm
isolation remain correct; new transaction paths avoid unrelated history hydration
and demonstrated shared-lock contention. Avoid arbitrary file-size targets.

## Phase 7 — Complete deployment and operational readiness

**Findings:** R02, R09–R11. **Primary areas:** README/guides, Compose/proxy,
auth endpoints, diagnostics, backup/restore scripts, retention jobs.

Tasks:

- [ ] Correct root deployment/auth guidance early; document required secrets,
      HTTPS, migrations, owner/device provisioning, upgrades, and recovery.
- [ ] Separate development fixture seeding from real-farm onboarding.
- [ ] Add structured request/worker diagnostics and correlation IDs with secret redaction.
- [ ] Add actionable metrics for telemetry age, queues/drops, command outcomes,
      database latency, and backup freshness.
- [ ] Configure source/aggregate login limits and trusted proxy behavior alongside
      the existing persistent per-email throttling.
- [ ] Document operator-managed recovery for the initial release; add verification
      and self-service recovery only if included in the accepted release scope.
- [ ] Define retention separately for sessions, telemetry, commands, replay receipts,
      and alert tombstones; implement safe bounded cleanup where appropriate.
- [ ] Schedule encrypted backups independent of the application host; assign ownership
      and recovery targets; restore into isolated deployment-like infrastructure.
- [ ] Exercise upgrade, outage, restart, and recovery procedures after software changes.

Deliverable: current runbook, deployed operational controls, and recovery evidence.

Completion gate: a fresh operator can provision the supported deployment; diagnostics
explain stale telemetry/stuck commands; backup restoration meets agreed targets;
cleanup preserves replay and dismissal behavior; account recovery is executable.

## Phase 8 — Commission authenticated physical devices

Approved scope: [ESP32 connection, pairing, and offline recovery plan](../../apps/firmware/provisioning-plan.md)
(October 3). Implementation and hardware verification remain pending.

**Finding:** R01. **Primary areas:** actual firmware repository, broker identities,
ACLs/TLS, device registry, MQTT worker, firmware safety contract.

Tasks:

- [ ] Confirm firmware ownership/source and map actual payloads to checked-in contracts.
- [ ] Implement protected AP/portal recovery (30-second Wi-Fi-loss and 15-minute
      unconfirmed-upload thresholds), physical setup fallback, and AP closure
      while preserving local control and ownership.
- [ ] Implement permanent identity plus changeable pairing code, dashboard entry/
      change/pending confirmation, claim protection, and authorized transfer.
- [ ] Implement OLED conditions/setup and LCD temperature/humidity/error display.
- [ ] Implement persistent bounded timestamped offline queue, clock validation,
      overflow handling, confirmed batch uploads, and end-to-end deduplication;
      verify power loss, restart, and backend chart/export integration.
- [ ] Implement unique broker credentials, verified TLS, and per-device publish/
      subscribe ACLs, including rotation, revocation, and reassignment procedures.
- [ ] Establish the production device-authentication protocol and commissioned worker
      configuration; retain the simulator boundary until this is implemented.
- [ ] Verify boot identity, command expiry, durable replay, and acknowledgment behavior
      on a physical device.
- [ ] Qualify sensor faults, heater/motor protections, clock skew, duplicate delivery,
      reboot, and network/broker/database outages with the hardware owner.
- [ ] Verify retained-state restart behavior across API, broker, worker, and device.

Deliverable: commissioned device protocol and physical qualification record.

Completion gate: authenticated telemetry and commands work on the intended hardware;
cross-device/farm topic access is denied; retries/restarts do not repeat execution;
local firmware protection works during cloud outages.

## Phase 9 — Validate and make the release decision

Tasks:

- [ ] Run the existing applicable software, migration, and live contract gates on
      the release candidate; record revision, environment, and failures/skips.
- [ ] Exercise operator journeys: sign in, provision/pair, monitor, candle, complete/
      stop a cycle, review history/export, acknowledge alerts, and recover a session.
- [ ] Validate mobile/keyboard/zoom behavior and selected performance budgets.
- [ ] Run the isolated restore/outage drills against release-like infrastructure.
- [ ] Run an agreed pilot soak period and review telemetry, alerts, queues, and errors.
- [ ] Record release scope, remaining limitations, rollback steps, and responsible owner.

Deliverable: release evidence matrix and explicit release decision.

Completion gate: every gate required by the chosen release scope has current evidence.
Physical production dispatch additionally requires Phase 8 qualification.

## Phase handoff template

For every phase record:

1. Status, revision, owner, and completed tasks.
2. User-visible behavior and relevant contract/schema changes.
3. Validation performed and results, including environment and skipped cases.
4. Remaining issues, external dependencies, and rollback/recovery notes.
5. Next phase and its ready-to-start tasks.

## First execution batch

Begin with Phase 0, then Phase 1. The first reviewable implementation batch should
contain the current baseline record, corrected connection-state presentation, mobile
help placement, and navigation scroll/focus behavior. Update the deployment guidance
in parallel. Continue into Phase 2 once those completion gates are satisfied.
