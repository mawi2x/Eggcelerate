# System review and refinement backlog

**Review date:** 2026-09-22  
**Baseline:** `f8f40a3`, including the existing working-tree settings changes  
**Status:** Review complete; refinements below are proposed, not implemented.

**Execution plan:** [Phase-by-phase system refinement plan](system-refinement-execution-plan-2026-09-22.md).

## Assessment

EGGCELERATE has a solid dashboard/API foundation for a protected team preview. Repository adapters, validated transport contracts, transactional persistence, durable replay records, and alert dismissal tombstones are useful foundations. It is not yet a complete live device-control system or a public production service: identity, continuous telemetry delivery, device state projection, and command acknowledgement remain unfinished.

Scope: React repository/query layers and hardware settings behavior; FastAPI routes, services, configuration and storage; MQTT boundary; Compose deployment; CI and existing tests. This is a source review with local checks, not a visual/accessibility audit, penetration test, live hardware test, database restart proof, or load benchmark. Existing settings edits were reviewed as found and left unchanged.

## Verification performed

| Check | Result |
|---|---|
| `pnpm --filter eggcelerate-ui typecheck` | Passed |
| `pnpm --filter eggcelerate-ui test` | 35 files, 293 tests passed |
| `pnpm --filter eggcelerate-ui build` | Passed; main JS chunk 556.02 kB / 151.45 kB gzip, above Vite's 500 kB warning threshold |
| `pnpm lint` | Failed: 5 errors across 4 files; no fixes applied |
| `apps/api/.venv/bin/python -m pytest -q apps/api/tests` | Outside-sandbox rerun: 29 passed, 50 skipped, 2 dependency deprecation warnings |

The initial sandbox API run stalled; the bounded outside-sandbox rerun completed. PostgreSQL tests were skipped because `TEST_DATABASE_URL` was not supplied. These results do not revalidate database migrations, restart durability, or the live frontend/API contract. Historical proofs in the guides are not fresh verification from this review.

## Findings and acceptance criteria

### SYS-01 — Authentication remains a public-release blocker

**Priority:** P1 before public exposure. **Classification:** Known B6 gap.

Evidence: [`config.py`](../../apps/api/src/eggcelerate_api/config.py) accepts only disabled authentication and rejects production startup; [`auth-context.tsx`](../../apps/web/src/app/providers/auth-context.tsx) defaults to an authenticated mock user. [`compose.production.yaml`](../../compose.production.yaml) explicitly runs in development mode with auth disabled, as documented for protected previews. Removing direct API host ports does not authenticate the web container's API proxy.

Refinement: complete B6 identity, sessions, membership and server-side farm authorization. Keep the existing protected-preview boundary until then; clarify the preview purpose wherever the production-named overlay is referenced.

Acceptance: unauthenticated requests cannot read or mutate farm data; cross-farm object access is rejected; logout/session expiry work end to end; authenticated production startup works without bypassing the environment gate.

### SYS-02 — Turn acceptance updates the last-turn timestamp before execution

**Priority:** P1 before enabling device commands. **Classification:** Existing staged behavior with misleading execution semantics.

Evidence: [`services.py:226`](../../apps/api/src/eggcelerate_api/services.py#L226), `request_turn`, immediately updates `last_turned_at` and `next_turn_at`, then returns `accepted`. The route does not dispatch a device command or await an ACK. Durable acceptance/replay does not establish physical execution. The [B4 contract](../guide/b4-mqtt-contract.md) already documents command reconciliation as unfinished.

Refinement: separate requested, dispatched, acknowledged, rejected and timed-out states. Advance confirmed turn timestamps only from a validated successful device outcome; retain a separate requested timestamp.

Acceptance: rejected, timed-out and undelivered commands leave confirmed turn time unchanged; duplicate requests and ACKs do not repeat execution; restart, delayed ACK and expiry cases pass against the simulator before hardware enablement.

### SYS-03 — Mounted dashboards do not continuously refresh incoming data

**Priority:** P1 before describing monitoring as live. **Classification:** Integration gap.

Evidence: [`use-incubator-readings.ts:20`](../../apps/web/src/app/features/farm/use-incubator-readings.ts#L20) uses `staleTime: Infinity`. [`AppProviders.tsx`](../../apps/web/src/app/providers/AppProviders.tsx) disables refetch on window focus; farm queries have no polling interval. No WebSocket consumer was found in the application. Manual refetch and mutation invalidation are not a continuous external-update channel. The MQTT implementation is a callable ingest boundary, not a running subscriber, per the [B4 contract](../guide/b4-mqtt-contract.md).

Refinement: complete the broker/worker and device projection path, then add bounded polling or push invalidation with reconnect recovery. Make last observation time and stale/offline state explicit.

Acceptance: a newly ingested reading appears on an already-open dashboard within the agreed live cadence without navigation or manual refresh; broker loss marks data stale; reconnect catches up; old or duplicate samples cannot overwrite newer device state.

### SYS-04 — Hardware preferences report local state as saved

**Priority:** P1 for truthful settings behavior. **Classification:** Confirmed implementation gap in the reviewed working tree.

Evidence: [`HardwarePanel.tsx`](../../apps/web/src/app/components/settings/HardwarePanel.tsx) stores polling interval, battery saver, LED indicators and calibration in component `useState`. Calibration Save only calls `setCalibrationSaved(true)` and renders “Saved”; it does not call a repository mutation. These values reset when the component remounts and do not configure a device.

Refinement: persist supported preferences through the repository/API and distinguish stored desired configuration from device-confirmed configuration. Until supported, identify these controls as preview-only or disable saving with clear availability text.

Acceptance: Save cannot claim persistence without a successful response; supported values survive remount and refresh; failure retains edits and offers retry; device application has separate confirmation where applicable.

### SYS-05 — Backend changes have no checked-in CI gate

**Priority:** P1 for regression prevention. **Classification:** Confirmed automation gap.

Evidence: [`.github/workflows/web.yml`](../../.github/workflows/web.yml) is the only checked-in workflow. Its path filters cover web/workspace files, and its jobs do not run Python tests or migrations. [`tests/conftest.py`](../../apps/api/tests/conftest.py) skips PostgreSQL integration tests without `TEST_DATABASE_URL`; this review consequently skipped 50 tests.

Refinement: add an API workflow triggered by API, migration, relevant deployment and workflow changes, with a disposable Timescale/PostgreSQL test service; run API tests, lint/type checks, migration checks and shared live repository contracts.

Acceptance: an API-only PR triggers the gate; missing test database fails the required integration job rather than silently skipping it; a clean database migrates and the durability/transaction suite executes. Never target a development or preview farm for destructive integration tests.

### SYS-06 — The current lint gate fails

**Priority:** P2. **Classification:** Reproduced check failure.

Evidence: `pnpm lint` reports import ordering in `CandlingJournalTab.tsx`, formatting in `Timeline.tsx` and `TrendsScreen.tsx`, and two `useSemanticElements` violations in `TrendsScreen.tsx` and `pagination-bar.tsx`. These are outside the four initially modified settings files. The web workflow runs lint before its other checks.

Refinement: fix formatting/import order and evaluate the two pagination group semantics without changing interaction or layout unintentionally.

Acceptance: `pnpm lint` passes; existing tests and typecheck remain green; pagination retains its accessible name and keyboard behavior.

### SYS-07 — Read requests take a broad write transaction and farm lock

**Priority:** P2 before scaling polling or farm size. **Classification:** Source-confirmed bottleneck risk; no measured latency claim.

Evidence: [`dependencies.py`](../../apps/api/src/eggcelerate_api/api/v1/dependencies.py) routes Store-dependent reads through the same transaction as writes. [`database/store.py:189`](../../apps/api/src/eggcelerate_api/database/store.py#L189) locks the farm row with `FOR UPDATE`, hydrates modes, chambers, cycles, journals, preferences and alerts, and performs change comparison around the handler. [`store.py:644`](../../apps/api/src/eggcelerate_api/store.py#L644) also serializes requests with a process lock and deep-copies state. The readings endpoint already has a separate query path.

Refinement: introduce focused read repositories without write locks; narrow mutation transactions while preserving cross-process consistency and exact replay. Measure current behavior before selecting a latency budget.

Acceptance: concurrent list/history reads do not take the farm write lock; query work is proportional to requested data; parallel reads and mutations pass consistency tests; a recorded load comparison demonstrates improvement without weakening replay or rollback guarantees.

### SYS-08 — Initial bundle exceeds the existing warning threshold

**Priority:** P3. **Classification:** Measured build warning; user-visible performance not measured.

Evidence: the production build emits a 556.02 kB main JS chunk, while Trends is already a separate 419.94 kB chunk. Build success does not establish acceptable mobile startup cost.

Refinement: profile initial dependency inclusion and split additional heavy features only where measurements justify it; establish a startup/bundle budget.

Acceptance: record transfer size and startup timing under a reproducible mobile profile; meet the agreed budget without hiding the warning by raising its threshold.

## Suggested execution order

1. Restore lint (SYS-06) and add backend CI (SYS-05) to protect subsequent work.
2. Correct hardware Save semantics (SYS-04).
3. Complete B4 command outcomes and live telemetry delivery (SYS-02, SYS-03), following the existing simulator contract; profile transaction contention before increasing update frequency (SYS-07).
4. Complete B6 authentication before any public rollout (SYS-01).
5. Measure and optimize startup performance (SYS-08).

Before a production-readiness sign-off, separately rerun database restart/migration tests, perform a backup restoration drill, and verify the real deployment boundary. Backup/restore is already an unchecked requirement in the [database setup guide](../guide/database-setup-guide.md); this review does not claim it is operationally proven.

Existing [semantic section](semantic-sections-standardization-plan.md), [mobile density](mobile-density-execution-plan.md), and [nested radius](nested-border-radius-remediation-plan-2026-09-18.md) refinements remain separate. This review adds system-level work rather than reopening their completion status.
