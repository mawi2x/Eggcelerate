# System refinement: phased execution plan

**Date:** 2026-09-22  
**Source:** [System review](system-review-2026-09-22.md)  
**Status:** Phase 5 verification in progress.

**Latest handoff:** [Phase 5 handoff — 2026-09-23](system-refinement-handoff-2026-09-23-phase5.md).

**Current review and remediation plan:** [Project review and phase-by-phase execution plan — 2026-09-23](project-review-execution-plan-2026-09-23.md)
(re-verified baseline, corrected gate numbers, and the remaining phases). Phases 6–8 below
are carried forward there as Phases 8–9.

## Objective and boundaries

Move from a protected dashboard preview to a verified live simulator-backed system, then establish the authentication and operational evidence needed for production readiness. Each phase produces a reviewable change and evidence before the next dependent phase starts.

This plan covers SYS-01 through SYS-08. It preserves the existing B4/B5/B6 boundaries: B4 integrates the simulator, B5 covers a separate LED harness, and B6 adds identity and authorization. Physical actuator enablement is outside this plan. Existing visual refinement plans remain separate.

## Phase map

| Phase | Outcome | Review findings | Depends on |
|---|---|---|---|
| 1 | Green web checks and mandatory backend CI | SYS-05, SYS-06 | Current baseline |
| 2 | Hardware settings communicate real persistence | SYS-04 | 1 |
| 3 | Focused reads with measured concurrency | SYS-07 | 1; scheduled after 2 |
| 4 | Durable, truthful command outcomes | SYS-02 | 1, simulator contract reconciliation |
| 5 | Continuous telemetry and fresh dashboard data | SYS-03 | 3, 4 broker/worker foundation |
| 6 | Authenticated, farm-scoped application | SYS-01 | 4, 5 |
| 7 | Measured mobile startup improvements | SYS-08 | 6 for final bundle baseline |
| 8 | Deployment, recovery and release evidence | Cross-cutting review limits | 1–7 |

Default execution is sequential. Dependencies allow phase 4 preparation after phase 1, but no extra parallel work is required. Phase numbers here do not replace the backend guide's B-stage names.

## Phase 1 — Restore and enforce the verification baseline

**Outcome:** regressions in either application are caught before merging subsequent work.

### Work

- [x] Recheck the working tree and record the current revision, test totals and existing edits; the review's totals are historical evidence, not fixed targets.
- [x] Fix import ordering in `CandlingJournalTab.tsx` and formatting in `Timeline.tsx` and `TrendsScreen.tsx`.
- [x] Resolve the pagination semantic findings in `TrendsScreen.tsx` and `pagination-bar.tsx`, preserving accessible names and keyboard behavior.
- [x] Add an API CI workflow covering API source/tests/migrations, its own workflow, relevant Compose files and shared contract inputs. Ensure relevant web contract changes trigger the cross-application check too.
- [x] Provision a disposable Timescale/PostgreSQL service and require `TEST_DATABASE_URL` in the integration job. Retain the disposable-database guard in fixtures.
- [x] Run Python tests, Ruff and mypy, fresh-database migrations, populated-database upgrades and the existing shared live repository contract suite. Fail the required integration job if the database is missing or expected integration tests are skipped.
- [x] Document local equivalents and record the external branch-protection step in the handoff.

**Primary areas:** `.github/workflows/`, `apps/api/tests/conftest.py`, API migration/test configuration, the four web files above.

**Exit gate:** web lint/typecheck/tests/build pass; an API-only change triggers backend checks; database tests actually execute; fresh and populated upgrade paths pass; live adapter contracts pass against an isolated farm. Record warnings separately from failures.

**Recovery:** keep lint cleanup and CI changes in separate reviewable commits. Do not weaken assertions or suppress integration jobs to obtain a green baseline.

## Phase 2 — Make hardware settings behavior truthful

**Outcome:** “Saved” means the supported setting was persisted, and device application has its own status.

### Work

- [x] Classify polling interval, battery saver, LED indicators and calibration as unsupported device configuration controls and record their scope, units, defaults and preview bounds.
- [x] Remove success-only local Save behavior and disable unsupported writes with concise availability text.
- [ ] For supported application preferences, extend the existing repository/DTO/API persistence path only where fields are missing. Support load, dirty state, save, discard and failure recovery.
- [ ] For device settings, keep desired configuration distinct from confirmed applied configuration. Leave application disabled until the simulator supports a validated configuration command and acknowledgement; phase 4's turn command alone does not establish that support.
- [x] Preserve current settings layout and unrelated working-tree edits.

**Primary areas:** `HardwarePanel.tsx`, settings models, repository interface and both adapters, transport contracts, API preference storage where applicable.

**Exit gate:** supported preferences survive remount, refresh and API restart; failures preserve edits and allow retry; unsupported controls cannot claim success; any “Applied” state is backed by an actual device confirmation. Add behavior tests for these transitions.

**Recovery:** unsupported capabilities remain explicitly unavailable. Schema changes, if needed, must preserve existing saved preferences and defaults.

## Phase 3 — Separate reads from broad mutation transactions

**Outcome:** dashboard refreshes no longer serialize through the farm write lock.

### Work

- [x] Capture a repeatable baseline for list/detail/history reads under concurrent writes: dataset size, client count, request rate, query counts, lock waits and latency percentiles.
- [x] Agree and record a local latency/load budget from that baseline before changing behavior.
- [x] Introduce focused read queries for Store-dependent GET endpoints, loading only required records. Use the existing readings query path as a local reference.
- [x] Remove `FOR UPDATE` and mutation snapshots from read-only paths while preserving a consistent response snapshot where multiple queries are necessary.
- [x] Keep mutation atomicity and durable idempotency intact; narrow mutation scope only where coverage demonstrates equivalent behavior.
- [x] Exercise concurrent reads, cycle completion, configuration updates and replay across separate API instances.

**Primary areas:** `api/v1/dependencies.py`, read routes, `database/store.py`, focused database repositories, transaction tests.

**Exit gate:** list/history reads do not acquire the farm write lock; adapter parity and rollback/replay tests pass; the same workload demonstrates improvement and meets the recorded budget. No lost updates or inconsistent completed-cycle records.

**Recovery:** retain the previous adapter path until the focused queries pass parity; revert the query change if consistency regresses. Do not remove write locks globally.

## Phase 4 — Complete durable command handling with the simulator

**Outcome:** request acceptance and confirmed execution are separate, durable states.

### Work

- [x] Reinspect the separate simulator repository and reconcile its current revision with the [B4 contract](../guide/b4-mqtt-contract.md); historical simulator results are not a current gate.
- [x] Finalize command and ACK envelopes: unique server dispatch ID, client replay identity, farm/device correlation, schema version, requested time and expiry. Define legal state transitions and terminal-outcome precedence.
- [x] Add durable command/outbox, attempt and ACK storage in migration `0008`.
- [x] Change turn acceptance to record a request without advancing confirmed turn timestamps. Expose pending, acknowledged, rejected and timed-out outcomes through repository contracts and dashboard feedback.
- [x] Implement simulator validation, durable deduplication and original-outcome replay before enabling command publishing. Cover restart during execution and after execution but before ACK.
- [x] Add the broker/worker deployment profile, durable dispatch recovery, bounded retries, deadlines and correlated ACK handling. Expired or terminal commands do not execute again.
- [x] Define trustworthy execution timestamps: successful simulator ACK observation time updates the confirmed cursor; receipt time remains separate.

**Primary areas:** API command services/routes/models, database migrations, MQTT worker, repository adapters and command UI; separate simulator command handlers and persistence.

**Exit gate:** success updates confirmed state once; duplicate requests/ACKs do not repeat simulator execution; rejection, expiry and missing ACK leave confirmed timestamps unchanged; late/conflicting ACKs follow the documented state machine; API, worker and simulator restart scenarios pass. Preserve original acceptance replay independently from current command status.

**Recovery:** disable dispatch while retaining command records for reconciliation. Do not automatically replay expired commands during rollback or restart. Physical actuation remains disabled.

## Phase 5 — Deliver live telemetry to an already-open dashboard

**Outcome:** new observations arrive continuously, and stale data is visibly stale.

### Work

- [x] Connect the broker worker to the existing validated telemetry ingestion boundary using trusted device-to-farm lookup.
- [x] Persist the latest device projection, including supported battery/power and observation/receipt timestamps; establish boot-aware ordering before using sequence numbers as durable order.
- [x] Isolate malformed messages so one invalid payload cannot stop consumption or mark a device healthy. Define bounded diagnostics for rejected messages.
- [x] Define freshness thresholds and recovery rules using server receipt time for liveness. Late historical samples may be stored without replacing newer device state.
- [x] Replace infinite readings freshness with a documented refresh strategy. Bounded 15-second polling is used while the dashboard is visible; WebSockets remain deferred.
- [x] Pause polling in hidden views through the query library and avoid overlapping requests through React Query's interval scheduler.
- [x] Set the live target against the existing 15-second telemetry cadence, separating the display target from five-minute research aggregation.
- [x] Show observation age and stale/offline states in overview and monitoring views.

**Primary areas:** MQTT telemetry/worker, device projection storage, farm/readings queries, `AppProviders.tsx`, monitoring status presentation.

**Exit gate:** a simulator observation appears on an already-open dashboard within the recorded target without navigation; broker disconnect visibly transitions to stale/offline; reconnect catches up; duplicate/out-of-order messages cannot regress current state; phase 3's load budget still passes at the selected refresh rate.

**Recovery:** disable live subscription/refresh through configuration while retaining REST reads and explicit stale state. Never substitute fixture data for failed live data without identifying it.

## Phase 6 — Add real identity and farm authorization

**Status:** complete in project-review Phase 8; see the [Phase 8 handoff](project-review-handoff-2026-09-23-phase8.md).

**Outcome:** production mode uses authenticated sessions and enforces ownership on the server.

### Work

- [x] Reconcile the auth/onboarding guide. App-managed email/password is selected; the first registrant is the sole farm owner; new accounts create an empty farm.
- [x] Add user, membership, and session persistence (migration `0012`), expiry/revocation, secure cookie transport, and CSRF protection.
- [x] Derive request farm context from authenticated membership and enforce it on HTTP reads, mutations, history, readings, command status, and replay lookup. No WebSocket/subscription route exists in the current API.
- [x] Replace default mock authentication in API mode with session hydration, sign-in, sign-out, and expiry handling; clear private query state.
- [x] Preserve explicit mock development behavior and refuse disabled auth in production.
- [x] Configure sessions-mode production startup and update protected-preview/production instructions.

**Primary areas:** API context/dependencies/configuration, identity migrations, auth provider/routes, query cache scope, Compose and deployment documentation.

**Exit gate:** passed for HTTP farm data; tests reject unauthenticated requests and cross-farm reads, writes, command status, history, and idempotency replay; logout/expiry deny access and clear client cache; production refuses disabled auth and requires HTTPS origins. MQTT/device identities and physical hardware remain outside B6.

**Recovery:** roll back to the protected preview boundary if authentication fails. Never restore public service by disabling authentication.

## Phase 7 — Measure and improve mobile startup

**Outcome:** initial loading meets a recorded performance budget.

### Work

- [ ] Measure the post-auth production bundle and startup on a reproducible device/network profile; record transfer size, startup timing and test conditions.
- [ ] Inspect heavy dependencies in the entry bundle and identify features suitable for lazy loading. Avoid speculative component rewrites.
- [ ] Set concrete bundle and startup targets before optimization; use the review's 556.02 kB main chunk as historical context, not the new baseline.
- [ ] Implement the smallest useful split/import changes and verify route loading, error boundaries and loading states.

**Exit gate:** repeatable measurements meet the documented targets; route navigation and existing tests remain green; the 500 kB warning is addressed through actual bundle changes or a documented measured tradeoff, not merely a raised warning limit.

**Recovery:** revert individual splits if they introduce request waterfalls or navigation regressions.

## Phase 8 — Verify deployment and recovery readiness

**Outcome:** a reproducible release candidate with operational evidence and explicit remaining limits.

### Work

- [ ] Run all required CI jobs and live contracts against the exact candidate revision and isolated test resources.
- [ ] Upgrade both an empty database and a populated prior-version database; verify data, constraints and replay records after migration.
- [ ] Restart API, database, broker and worker while preserving volumes; confirm settings, cycles, journals, alert tombstones, readings and command outcomes survive.
- [ ] Restore a backup into a separate empty environment and verify representative data and replay behavior. Record recovery time and recoverable data age against agreed recovery objectives.
- [ ] Exercise API/database/broker outages and recovery; verify readiness, stale-state reporting, actionable logs and bounded retries.
- [ ] Verify the deployed authentication boundary, secrets handling, database isolation and browser-to-API routing. Document deploy, rollback and restore commands.
- [ ] Record a release decision with completed gates, remaining issues and owner for each accepted limitation. Keep B5 hardware qualification separate.

**Exit gate:** evidence identifies revision, configuration, commands and results; restore and restart drills pass; no unresolved authentication or command-integrity blocker remains. This phase establishes readiness; publishing/deploying to a public service is a separate action.

## Completion tracking

For every phase, append its completion date, revision, changed areas, checks and results, known limitations, and next eligible phase. Mark it complete only after its exit gate passes. If a dependency fails, retain the phase as blocked with concrete evidence rather than carrying a silent exception forward.

The review findings are closed as follows: SYS-05/06 after phase 1; SYS-04 after phase 2's truthful supported/unsupported behavior is verified; SYS-07 after phase 3; SYS-02 after phase 4; SYS-03 after phase 5; SYS-01 after phase 6; SYS-08 after phase 7. Phase 8 supplies the operational evidence that the original review explicitly did not establish.
