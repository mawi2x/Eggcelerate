# Project review and improvement plan — 2026-10-02

Review baseline: `a470ab3`, clean working tree before this document was added.

Implementation tracking: [phase-by-phase execution plan](project-improvement-execution-plan-2026-10-02.md).

EGGCELERATE has a credible dashboard and persistence foundation. The highest-value
next step is to make daily operation reliable on phones, finish the release gates,
and bound the cost of telemetry and database work as farms grow.

## Scope and confidence

This is a static review of the main repository: application structure, representative
API and web code, storage and MQTT paths, CI, deployment configuration, and existing
review records. No application changes, deployments, hardware operations, or test runs
were performed. Findings below describe code evidence and its implications; they do
not claim a new runtime reproduction or a fresh passing test baseline.

The September 23 execution plan records Phases 0–8 as complete. The September 24
Phase 9 checkpoint records local software verification while explicitly leaving
deployment and hardware qualification open. Treat those results as historical
evidence. This plan extends that work; resolved September findings should not be
reopened without current evidence.

References:

- [Previous execution plan](project-review-execution-plan-2026-09-23.md)
- [Phase 9 checkpoint](project-review-handoff-2026-09-24-phase9-progress.md)
- [Previous mobile audit](mobile-page-by-page-audit-2026-09-24.md)

## What to retain

- The React/Vite web app and FastAPI API have clear deployment boundaries.
- Repository interfaces and memory/API adapters provide a useful contract boundary.
- Domain helpers and selectors already separate substantial business logic from UI.
- PostgreSQL stores farm-scoped state and atomic idempotency receipts; retries can
  recover lost responses without intentionally repeating an operation.
- Session resolution binds requests to farm membership; cookies, CSRF checks,
  production startup guards, and operator provisioning already exist.
- The command outbox and command status distinguish acceptance from device execution.
- CI includes frontend behavior coverage, API database tests, migration checks, and
  a live API/frontend contract runner. Disposable database drills are available.
- Detail, Trends, Candling Logs, and later onboarding steps already load lazily.

## Current findings

Priority definitions: P0 blocks physical-device production operation; P1 materially
affects reliable operation or release preparation; P2 improves scale or maintenance.
Effort estimates below are planning estimates, not measured commitments.

| ID | Priority | Evidence | Impact and proposed improvement |
| --- | --- | --- | --- |
| R01 | P0 for hardware release | `infrastructure/mosquitto.conf:1–4` enables anonymous local MQTT; `mqtt/worker.py:133–136` refuses production. Phase 9 records missing broker ACL provisioning and physical firmware qualification. | Preserve the local simulator boundary. Commission an authenticated broker and device protocol before physical production dispatch. This is a known release gate, not a regression. |
| R02 | P1 | Root `README.md:54–70` uses the production overlay but still says authentication is disabled pending B6. `compose.production.yaml` requires session auth, HTTPS CORS, and an auth rate-limit secret. | A fresh operator cannot reliably follow the root guide. Replace the stale preview instructions with current setup, owner/device provisioning, HTTPS requirements, upgrades, and recovery. |
| R03 | P1 | `DeviceSettingsTab.tsx:606–628` chooses the success color and Wi-Fi icon from `unit.paired`, while the text independently uses `connectionState`. | A paired offline device can show green “Connection Lost.” Derive text, icon, and color from one connection-state presentation function. |
| R04 | P1 | `HelpWidget.tsx:134–139` remains fixed above the mobile bottom navigation. The September mobile audit records overlapping controls. `use-app-router.ts` has no destination scroll policy. | Recheck the recorded overlaps on the current UI, integrate help into navigation or a reserved area, and define scroll behavior for destination changes and Back. Runtime overlap measurements have not been repeated in this review. |
| R05 | P1 | `use-farm-data.ts:85–109` polls incubators but not alerts or hatch history. `AppProviders.tsx` disables focus refetch. Alert reads return persisted rows via `services.py:466–467`; MQTT ingestion does not create alert rows. | Another session's alert actions can remain stale. Monitoring conditions and durable notifications are separate today. Define and implement alert creation, refresh, recovery, and acknowledgment semantics together. |
| R06 | P1 | `use-farm-data.ts:110–141` aggregates all initial query errors; `App.tsx` returns a whole-app failure view for `farmDataError`. No React error boundary was found under `apps/web/src`. | An initial history or alerts failure can replace otherwise usable monitoring, and a render/lazy-load exception has no application recovery boundary. Isolate feature failures and add recoverable route boundaries. |
| R07 | P1 before sustained telemetry rollout | `database/readings.py:92–196` reads all raw samples in a window; `chamber_readings` never selects its existing research aggregation. `use-incubator-readings.ts` repeatedly fetches full windows for selected chambers. | Payload and browser work grow with device reporting frequency and cycle length. Add bounded chart resolution and explicit raw export behavior. |
| R08 | P2, earlier if load measurements justify it | `database/store.py:203–274` enters the shared memory transaction, locks the farm row, and hydrates farm-wide modes, chambers, cycles, journals, and alerts before writes. | Mutation cost grows with retained history; the shared in-process lock also warrants a concurrency measurement across farms. Replace broad units of work gradually with resource-specific transactions while preserving replay and rollback guarantees. |
| R09 | P1 for operational readiness | API exposes `/healthz` and `/readyz`; worker logs some queue drops and rejections. No application request correlation, operational metrics endpoint, or scheduled production backup configuration was found in the reviewed files. | Health probes alone cannot explain delayed commands or stale readings. Add diagnostics, actionable monitoring, and scheduled backup/restore operations. Existing disposable restore drills remain useful. |
| R10 | P2 | `auth_sessions` has expiry/revocation fields; no session deletion job was found. Telemetry migration `0007` explicitly adds no retention policy. Replay receipts and dismissed alerts persist. | Define storage lifetimes, archive requirements, and cleanup jobs. Never delete replay receipts or tombstones indiscriminately: doing so can change retry and reseed behavior. |
| R11 | P1 for public access | Login throttling is keyed by email, limits attempts in a fixed 15-minute window, and cleans old buckets during each login (`api/v1/auth.py:43–99`). Recovery remains operator managed in the Phase 9 record. | Per-email throttling protects one account but does not bound attempts across arbitrary emails. Add deployment-level source and aggregate limits; document recovery and intentional account lockout behavior. |
| R12 | P2 | `TrendsScreen.tsx` is 1,813 lines; Incubators 985; Candling Logs 964; Detail 869. `use-farm-data.ts` combines query coordination and many mutation flows. | Split by feature responsibility to reduce change coupling. File size alone is not proof of a bug; extraction should improve ownership and behavior clarity. |
| R13 | P2 | September Phase 9 recorded an entry chunk of 155.43 kB gzip. Several dashboard screens and Settings are still eager imports. Web CI runs both `test` and `coverage`, which each execute Vitest; no enforced bundle budget appears in the workflow. | Measure the current bundle, reduce initial imports, enforce a measured budget, and remove duplicate test execution where coverage supplies the same gate. Historical bundle measurements are not current measurements. |

Paths in the table are relative to `apps/api/src/eggcelerate_api` or
`apps/web/src/app`, unless explicitly rooted elsewhere.

## Delivery sequence

Use small reviewable changes. Each phase has a defined outcome; hardware commissioning
can proceed in parallel after the release boundary and protocol are agreed.

### Phase 1 — Correct operator guidance and visible state

Priority: P1. Estimated effort: 2–4 engineering days. Findings: R02–R04.

1. Update the root README with the actual production overlay variables, HTTPS entry
   point, migration steps, operator account creation, and device provisioning.
   Separate development fixture seeding from onboarding a real farm. Document an
   upgrade sequence with expected downtime and a rollback/recovery decision.
2. Use one shared mapping for connecting, connected, offline, and unpaired device
   text, icon, and color. Pairing must not imply a live connection.
3. Recheck help placement, then give mobile help a location that does not cover
   working controls. Support keyboard access if dragging remains available.
4. Reset scroll on primary destination changes; explicitly define restoration for
   browser Back and returning to a chamber list. Handle detail tab changes separately.
5. Add a keyboard skip link and review route focus placement. Recheck essential text
   at 200% zoom and mobile sizes before changing typography tokens globally.

Completion criteria:

- An operator can follow the guide from a clean checkout without using old handoffs
  to discover required secrets or account setup steps.
- A paired offline chamber has consistent offline wording, icon, and color.
- Help clears controls through the full scroll range at 320px and 393px; dialogs and
  menus remain usable with keyboard and zoom.
- Destination changes and Back follow the documented scroll/focus policy.

### Phase 2 — Make monitoring and notifications reliable

Priority: P1. Estimated effort: 4–7 engineering days. Findings: R05–R06.

1. Define a condition-to-alert lifecycle: thresholds, sustained breach duration,
   recovery, severity, stable episode identity, and acknowledgment/dismissal behavior.
   Cover offline, water, temperature, and humidity conditions first. Decide explicitly
   whether alerts use farm preferences, incubation mode settings, or both.
2. Persist alert episodes through a service that tolerates duplicate telemetry.
   Evaluate offline transitions through a periodic evaluator because a disconnected
   device cannot send the event that proves it has gone offline.
3. Refresh alerts while authenticated and visible. Start with bounded polling and
   refresh on tab return; introduce event streaming only if measured needs justify it.
   Refresh history on route activation or appropriate invalidation.
4. Separate monitoring's critical initial data from history, settings, and notification
   panels. Keep each failure and retry close to the affected feature.
5. Add an application recovery boundary and route-level handling for render and lazy
   chunk failures. Retain readable monitoring states and avoid reload loops.

Completion criteria:

- A sustained condition produces one durable alert episode; duplicate messages and
  retries do not create duplicates. Recovery and a later new episode are distinguishable.
- Another client's acknowledgment becomes visible within the agreed refresh interval.
- Offline alerts are generated without requiring more telemetry from the device.
- An alerts/history failure does not remove healthy chamber monitoring.
- A failed route chunk shows an accessible recovery action.

### Phase 3 — Bound telemetry queries and browser work

Priority: P1. Estimated effort: 3–6 engineering days. Findings: R07, R13.

1. Measure payloads, query time, rendering time, and network cost for 1, 12, and 100
   chambers. Use realistic sample cadence and full-cycle history.
2. Add an explicit chart resolution or maximum point contract. Reuse the existing
   sparse aggregation foundation, returning min/max or equivalent information so an
   average cannot silently hide dangerous excursions. Preserve gaps and UTC bounds.
3. Keep raw exports explicit and complete through pagination or streaming; document
   the distinction between chart aggregates and exported samples.
4. Avoid downloading unchanged full-cycle arrays every polling interval. Introduce
   incremental reads, validators, or slower historical refresh based on measurement.
5. Measure initial JS and lazy-route costs. Consider lazy loading Settings, Alerts,
   and Incubators; check eager Overview dependencies and icon imports before selecting
   a bundling change. Keep existing lazy routes.

Completion criteria:

- Chart endpoints enforce a documented point/payload bound; full-cycle charts remain
  responsive with realistic high-frequency telemetry.
- Time ranges, sparse gaps, outliers, and export completeness retain explicit semantics.
- CI fails when an agreed measured bundle budget regresses. The old 160 kB gzip
  guardrail is a starting proposal, not a production performance guarantee.
- Mobile-network measurements cover the total initial load, not only one JS chunk.

### Phase 4 — Finish deployment operations and account protection

Priority: P1. Estimated effort: 4–7 engineering days. Findings: R09–R11.

1. Add structured request logs with correlation IDs, latency, response status, and
   safe actor/farm identifiers. Do not log passwords, cookies, CSRF tokens, or MQTT secrets.
2. Expose metrics for database latency, telemetry age, worker connection/queue depth,
   dropped messages, command retries, and command terminal outcomes. Define alerts
   tied to specific operator actions.
3. Schedule encrypted backups to storage independent of the application host; define
   retention and ownership. Propose recovery targets, then measure them with an
   isolated restore on deployment-like infrastructure.
4. Add deployment-level login limits across sources and aggregate traffic, retaining
   the persistent per-email limit. Define trusted proxy handling and test lockout and
   recovery behavior under concurrent attempts. Move rate-bucket cleanup to a job if
   measurements show login-path cleanup adds contention.
5. Keep operator-managed account creation/recovery as the initial release policy, or
   implement verification and self-service recovery as a separately accepted scope.
6. Define session, telemetry, command, replay, and alert retention individually. Add
   bounded cleanup and archival jobs. Preserve replay safety and alert tombstones.

Completion criteria:

- An operator can diagnose stale telemetry and a stuck command from logs/metrics.
- Loss of the application host does not lose the only backup; a restored environment
  recovers owners, registry, farm state, telemetry, and required replay receipts.
- Login attempts across arbitrary emails are bounded, and legitimate account recovery
  has an explicit operator procedure.
- Storage growth has a documented budget and cleanup does not re-execute old commands
  or resurrect dismissed notifications.

### Phase 5 — Commission physical devices

Priority: P0 for physical production. Effort: depends on firmware availability and
hardware access; do not estimate from the Python simulator alone. Finding: R01.

1. Locate or establish the actual firmware repository and owner. Map its telemetry,
   command acknowledgment, device clock, boot identity, and replay behavior to the
   checked-in MQTT and firmware safety contracts.
2. Provision unique broker identities with verified TLS and per-device topic ACLs.
   Cover credential rotation, revocation, and commissioning/reassignment procedures.
3. Establish a production worker configuration only after its device authentication
   and authorization protocol is implemented. Do not bypass the simulator-only guard.
4. Qualify local heater/motor protections, sensor failures, boot changes, duplicate
   commands, lost acknowledgments, clock skew, and network/broker/database outages.
   Cloud availability must not be required for firmware safety protections.
5. Restart API, broker, and worker with retained state in an isolated environment;
   verify pending, expired, rejected, and acknowledged command behavior.

Completion criteria:

- One authenticated physical device completes telemetry and command flows on the
  intended infrastructure; another device/farm cannot publish or consume its topics.
- Duplicate delivery and process restarts do not cause duplicate physical execution.
- Disconnect/reboot/fault behavior meets the firmware safety contract, with evidence
  recorded by the responsible hardware owner.
- Production dispatch is enabled through a documented commissioned configuration.

### Phase 6 — Refactor for measured scale and easier maintenance

Priority: P2. Estimated effort: 5–10 engineering days, split into several changes.
Findings: R08, R12.

1. Extract Trends environmental charts, hatch history, filters, and export orchestration.
   Extract Incubators filtering/list presentation and chamber creation flow. Split
   farm queries from alert, mode, cycle, and device mutation hooks.
2. Replace route-string branching for replay policy in `api/v1/dependencies.py` with
   explicit operation metadata or small operation-specific helpers. Preserve scopes,
   fingerprints, and same-key/different-body conflicts.
3. Measure mutation latency and lock contention across chambers and farms. Introduce
   operation-specific database transactions first for small isolated writes, then
   lifecycle operations. Avoid hydrating unrelated archived journals and history.
4. Introduce pagination for growing alert/history collections. Keep farm constraints,
   stable ordering, and totals/export semantics explicit.
5. Record short architecture decisions for transaction ownership, replay lifetime,
   alert identity, chart aggregation, and commissioning boundaries. Consolidate current
   onboarding guidance; keep old handoffs labeled as historical evidence.

Completion criteria:

- Extracted features have clear state ownership and preserve routes, retries, and exports.
- Unrelated farm mutations do not contend on one shared application lock in the new
  paths, and query work is proportional to the affected resource.
- Existing atomic rollback, concurrent same-key replay, farm isolation, and terminal
  cycle guards remain intact.

## Validation during implementation

No gates were executed for this planning review. During implementation, run the
repository's existing relevant gates and record the exact revision and environment.

- Frontend: Biome, TypeScript, behavior/coverage scope, production build, and focused
  browser flows for changes involving mobile layout, keyboard use, or routing.
- API: Ruff, formatting, mypy, disposable database integration tests, and live
  frontend/API contracts when endpoint or repository behavior changes.
- Database: fresh and populated migrations, schema drift, failure rollback,
  concurrency/replay behavior, and affected backup/restore scenarios.
- Devices: authenticated broker integration and physical fault qualification in the
  commissioned environment; simulator results alone do not qualify hardware.

Improve CI as these gates are added: run the web suite once with coverage when that
provides the same required behavior checks, upload useful reports, and add a separate
scheduled/manual operational drill workflow. Preserve a quick pull-request gate.

## Recommended first implementation batch

Start with Phase 1, then deliver Phase 2 and Phase 3. Establish the firmware owner and
deployment environment in parallel so Phase 5 has its required inputs. Phase 4 must be
complete before a public operational release; Phase 5 must be complete before physical
production dispatch. Perform Phase 6 incrementally using measured bottlenecks.

Initial backlog:

- [ ] Replace stale root deployment/auth guidance.
- [ ] Correct the paired-but-offline status presentation.
- [ ] Recheck and remove mobile help/control collisions.
- [ ] Implement destination scroll/focus behavior.
- [ ] Separate monitoring errors from secondary feature errors.
- [ ] Define and persist the alert episode lifecycle and refresh policy.
- [ ] Bound chart queries and establish complete raw export semantics.
- [ ] Measure current bundles and enforce a measured budget.
- [ ] Establish backup ownership, restore targets, and operational diagnostics.
- [ ] Assign firmware/commissioning ownership and finish authenticated device gates.

Defer a native mobile app until these browser workflows and the device protocol are
stable. The reserved `apps/mobile` and `packages` directories do not need implementation
merely to complete the monorepo structure; extract shared packages when a second real
consumer establishes the requirement.
