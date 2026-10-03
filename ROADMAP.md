# EGGCELERATE roadmap and timeline

Last updated: **2026-10-04**. M0 baseline: `experiment` at `cc188ea` plus the
uncommitted M0–M5, frontend-upgrade, and sizing-token changes; current evidence applies to this working tree.

This is the current entry point for project plans and progress. “Roadmap” and
“timeline” both refer to this document. Detailed plans and handoffs remain linked
as supporting records. Update this roadmap as work is implemented and verified.

**Overall status:** the dashboard and backend foundation are implemented. Release
readiness remains open. The API concurrency-test setup has been corrected and the
software baseline now passes. Physical
device production operation is not yet qualified.

Statuses: **Complete** = implemented with recorded evidence; **In progress** =
some work or verification completed; **Pending** = remaining work; **Needs fix** =
a current check fails. Historical passes do not imply a fresh passing baseline.

## Timeline so far

| Period | Delivered | Status |
| --- | --- | --- |
| August–early September 2026 | React/Vite dashboard, mock flows, domain/repository separation, data hooks, routing, and UI standards | Implemented; historical evidence |
| September 13–15 | PostgreSQL/TimescaleDB persistence for chambers, modes, preferences, cycles/history, candling journals, alerts, readings, and retry receipts; persistence exit review | Complete at the recorded checkpoint |
| September 15–24 | Simulator MQTT contracts/transport, durable commands and acknowledgments, telemetry projection/freshness, farm-scoped sessions, owner/device provisioning, and verification gates | Implemented; physical-device qualification remains open |
| September 23–24 | September review Phases 0–8 closed; Phase 9 software, restore, and isolated database restart evidence recorded | Phase 9 still in progress |
| October 2 | Dashboard refinements committed as `a470ab3`; next improvement plan prepared | Refinements committed; new improvement phases not started |
| October 3 | M0 concurrency-test setup corrected; web/API/live contracts, migrations, mobile and payload baseline verified | Technical checks pass; protected dashboard pilot selected, owners/environment pending |

| October 3 | M1 status mapping, accessible mobile help, navigation scroll/focus, skip link, narrow-screen and enlarged-text fixes | Complete locally; handoff recorded |

| October 3 | M2 fetch failures grouped in Notifications; one toast per outage with recurrence cooldown, recovery/read/dismiss behavior, and logout cleanup | Delivered locally; broader M2 work remains |

| October 3 | M2 feature isolation, stale-data recovery, automatic alerts/history refresh, app/screen boundaries, and session-expiry cleanup verified | Complete locally |
| October 3 | M3 durable alert lifecycle and automatic offline detection verified; migration 0015 | Complete locally |
| October 3 | M4 bounded telemetry charts, complete raw exports, slower historical refresh, and 1/12/100 chamber measurements verified | Complete locally |
| October 3 | M5 lazy Settings/Incubators, corrected vendor imports, local fonts, asset budgets, and single coverage CI run verified | Complete locally; GitHub execution remains unverified |
| October 3 | React 19.3/Vite 8.3 upgrade, compatible tooling, further route splitting and expanded regression checks | Complete locally; M6 remains next |
| October 3 | Mobile/tablet/desktop sizing audit and token cleanup: hairline borders, badge glyphs, focus rings, action controls, and shared geometry; direct pixel occurrences reduced from 537 to 409 | Token cleanup complete locally; full breakpoint/long-label visual QA remains |
| October 4 | Representative responsive QA: 77 route/viewport cases, long chamber names, short-screen dialogs; corrected Trends header overlap and toolbar wrapping | Complete locally for tested scope; broader M9 cross-browser/operator qualification remains |

## What is already implemented

| Area | Available behavior | Remaining boundary |
| --- | --- | --- |
| Web dashboard | Overview, incubator list/detail, live monitoring, trends, candling logs, alerts, settings, and onboarding UI | M1 mobile/navigation and M2 recovery/refresh delivered; later milestones pending |
| Incubation workflows | Chamber/mode management, cycle start/stop/complete/reset, hatch history, candling records and ordered photo references | Photo references do not establish a photo-upload service |
| Data architecture | Domain helpers, memory/API repositories, transport validation, React Query, lazy-loaded routes, and enforced asset budgets | Large screens/hooks still need focused extraction in M6 |
| Persistence | Farm-scoped PostgreSQL state, Timescale telemetry, atomic retry receipts, deletion markers, migrations through `0015`, bounded chart queries and paginated raw exports | Retention and broader mutation/collection scale remain M6/M7 work |
| Authentication | Farm-scoped sessions, cookie/CSRF protections, production guards, persistent per-email login throttling | Email verification/self-service recovery unfinished; production registration remains closed |
| Provisioning | Operator owner creation/password reset and globally registered device IDs with farm routing | Registry assignment does not authenticate a physical device |
| Simulator transport | MQTT telemetry validation, projection, command outbox/status, ACK handling, and TLS/credential client support | Bundled worker is simulator-only and refuses production |
| Verification and recovery | Web/API CI definitions, live repository contracts, migration checks, disposable backup/restore and database restart drills | Deployment-host evidence and required GitHub checks still need confirmation |

## Current verification — October 4

| Check | Result |
| --- | --- |
| Frontend tests and coverage gate | Latest sizing cleanup: **327 tests passed** across 42 files; coverage gate and all seven screen modules verified at the dependency-upgrade checkpoint |
| Asset guard tests and budgets | **2 Node tests passed**; initial/shared/lazy asset budgets passed locally |
| Frontend typecheck, Biome lint, production build | **Passed** |
| Sizing-token cleanup | **Verified locally**; 409 direct px occurrences, 69 distinct values; all 159 source hashes and audit rollups pass; browser token checks at 393/900/1280px |
| Responsive QA | **77 route/viewport cases passed**; corrected Trends overlap checked at 10 widths; long-name/dialog checks at 4 widths; 17 targeted tests passed after the fix |
| API integration suite with required disposable database | **126 passed**, zero skipped tests at the M4 checkpoint |
| Concurrency-test fix | Initialize separate API apps before racing turn, device-assignment, and alert-dismissal requests; warning filters remain strict |
| Live API/frontend repository contract | **30 passed** after the frontend upgrade; isolated API readiness approximately **1.2 seconds** |
| API Ruff lint/format and mypy | **Passed** at the M4 checkpoint |
| Main JS chunk | October 4 local build: **429,659 bytes / 119,574 gzip bytes**; total initial JS gzip **188,222 bytes**; largest JS chunk **437,107 bytes**; asset budgets pass after responsive fixes |
| Frontend Docker build | API-mode Node 22 Alpine/Nginx image built locally; no deployment performed |
| Migrations | Fresh and populated upgrades passed; head `0015`; no schema drift |
| Deployment and hardware | No deployment, fresh restore/outage drill, or physical-device qualification performed |

The local API and main database were stopped when inspected. The disposable test
database was started for checks and stopped afterward. These results describe
this checkout and local tests, not a deployed service or GitHub runner result.
Latest frontend sizing checks: [sizing audit and implementation](docs/refine/sizing-audit-2026-10-03/README.md).
Live-contract and coverage checkpoint: [dependency upgrade](docs/refine/frontend-upgrade-2026-10-03.md).
Full backend suite and migration-drill evidence remains the [M4 checkpoint](docs/refine/m4-telemetry-scale-2026-10-03.md).

## Remaining roadmap

Milestones below map to the **October improvement plan**, not the historical
September phase numbers. The order is a delivery sequence; no calendar deadlines
are committed. Estimates are inherited planning ranges for one experienced
contributor and exclude hardware delays and the final pilot soak.

| Milestone | Work to finish | Status | Estimate / dependency |
| --- | --- | --- | --- |
| M0 — Baseline and scope | Technical checks complete; pilot selected; capstone group owns all four roles; Azure VPS hosting confirmed; ESP32 platform and partial hardware inventory recorded | In progress; firmware source and remaining inventory pending | Group to confirm source availability and remaining inventory; server setup/access are M7 work |
| M1 — Mobile and status | Connection mapping, mobile Help via More, keyboard dialog, scroll/focus policy, skip link, narrow-screen and enlarged-text checks delivered | Complete locally | October 3; user authorized work while M0 external details remain open |
| M2 — Recovery and refresh | Feature isolation and Retry, stale-data labels, app/screen recovery, quiet alerts/history refresh, session cleanup, and bounded fetch notifications delivered | Complete locally | October 3; handoff and current checks recorded |
| M3 — Alert lifecycle | Durable temperature/humidity/water/offline episodes, recovery and recurrence, independent read/dismiss state, periodic offline checks and UI lifecycle labels delivered | Complete locally | October 3; migration 0015 and lifecycle checks recorded |
| M4 — Telemetry scale | Bounded sparse chart contract, extrema/gap preservation, complete snapshot-scoped raw exports, 1/12/100 chamber measurements, and slower historical refresh delivered | Complete locally | October 3; telemetry scale handoff and benchmarks recorded |
| M5 — Loading and CI | Lazy Settings/Incubators, corrected vendor matching, local fonts, shared/route asset budgets, recovery checks, and single coverage CI run delivered | Complete locally | October 3; measured handoff recorded; GitHub runner evidence remains external |
| M6 — Maintainability and writes | Extract large feature modules/hooks, measure concurrency, narrow database transactions, paginate growing collections | Pending | 5–10 days; after M3–M5 |
| M7 — Operations | Current HTTPS/auth/provisioning runbook, metrics/diagnostics, source/aggregate login limits, safe retention, scheduled encrypted backups, deployment-like recovery drills | Pending | 4–7 days; preparation after M0, final drills after relevant software changes |
| M8 — Physical devices | Actual firmware, device credentials/TLS/ACLs, commissioned worker, approved AP/pairing/display/offline-queue plan, hardware safety and restart/outage qualification | Pending; connection/recovery scope approved, implementation and hardware verification pending | Hardware dependent; discovery after M0, operational support from M7 |
| M9 — Release decision | Current release-candidate checks, operator journeys, mobile/performance validation, restore/outage evidence, pilot soak, rollback and release sign-off | Pending | 1–2 days plus soak; after applicable milestones |

Default software sequence: **M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M9**.
Operational preparation and firmware discovery can begin after M0. Physical
production dispatch additionally requires M8. The selected first scope is a protected dashboard pilot using existing dashboard
and simulator capabilities; physical production dispatch remains gated by M8.
Deployment, operator acceptance, and release approval remain M7/M9 work.

Approved October 3: [ESP32 connection, pairing, and offline recovery plan](apps/firmware/provisioning-plan.md).
Scope includes protected AP setup after 30 seconds of Wi-Fi loss or 15 minutes
without confirmed uploads, permanent device identity with changeable pairing code,
OLED status/setup, LCD readings, physical setup fallback, and persistent bounded
offline storage with confirmed, deduplicated batch uploads. These are planned M8
capabilities with API/web support. Queue capacity, code format, setup hardware,
and retry/session timing remain design details.

## Next implementation batch

- [x] Diagnose and resolve the repeatable concurrent-turn test failure, then rerun
      the full API suite and relevant live contracts. Determine whether the defect
      is in app construction, the test setup, or the dependency interaction.
- [ ] Finish M0: protected dashboard pilot selected; record owners, environment,
      hardware availability, and outstanding baseline measurements.
- [x] Implement M1: one connection-state mapping, mobile help placement, and
      navigation scroll/focus behavior; verify keyboard, narrow widths, and zoom.
- [ ] Correct the root deployment guidance early in M7: it still says production
      authentication is disabled, although the production overlay requires sessions.
- [x] Add grouped fetch-error notifications and a bounded toast policy.
- [x] Complete M2 failure isolation, recovery, and shared-data refresh.
- [x] Complete M3 durable alert episodes and lifecycle semantics.
- [x] Complete M4 bounded telemetry queries and complete exports.
- [x] Complete M5 loading measurements, asset budgets, and CI deduplication.
- [x] Upgrade React/Vite and compatible tooling, preserving coverage floors and initial asset limits.
- [x] Audit mobile/tablet/desktop sizing and implement role-preserving token cleanup;
      verify lint, typecheck, 327 frontend tests, production build and audit consistency.
- [x] Complete representative frontend visual QA at integer breakpoint edges,
      with long chamber names and short-screen dialogs; fix confirmed Trends overlap.
- [ ] Broaden M9 visual qualification to zoom/text scaling, fractional edges,
      nested states and real touch devices; preserve documented typography tiers.
- [ ] Start M6 feature-module and database-write maintainability/scale work.

## Additional future capabilities

These are outside the current improvement milestones and have no committed dates.

- **Native Android/iOS app:** `apps/mobile` is reserved; framework and build workflow
  have not been selected.
- **Hardware configuration controls:** sampling, battery saver, sensor offset, and
  status LEDs remain unavailable until configuration commands, persistence, ACK
  behavior, and actual firmware support are established.
- **Public self-registration and self-service recovery:** require an agreed scope,
  email verification, and an implemented recovery flow. Operator-managed account
  creation/reset is the existing path.

## Progress updates and supporting records

For each completed batch, update its milestone status and record the date,
revision, delivered behavior, validation results (including failures/skips),
remaining dependencies, and next action. Preserve historical evidence; close a
milestone only when its completion gates are met.

- [October findings and improvement scope](docs/refine/project-improvement-plan-2026-10-02.md)
- [October detailed tasks and completion gates](docs/refine/project-improvement-execution-plan-2026-10-02.md)
- [M0 baseline, verification, and pending decisions](docs/refine/m0-baseline-2026-10-03.md)
- [M1 implementation and verification handoff](docs/refine/m1-handoff-2026-10-03.md)
- [M2 fetch-notification checkpoint](docs/refine/m2-fetch-notifications-2026-10-03.md)
- [M2 completed recovery/refresh handoff](docs/refine/m2-handoff-2026-10-03.md)
- [September execution and completed phases](docs/refine/project-review-execution-plan-2026-09-23.md)
- [September Phase 9 release/hardware checkpoint](docs/refine/project-review-handoff-2026-09-24-phase9-progress.md)
- [Local and CI verification commands](docs/guide/verification-gates.md)
- [Frontend sizing audit and token implementation](docs/refine/sizing-audit-2026-10-03/README.md)
- [Mobile, tablet and desktop findings and remaining visual checks](docs/refine/sizing-audit-2026-10-03/screen-size-findings.md)
- [October 4 responsive QA, reproduced fixes and scope](docs/refine/responsive-qa-2026-10-04.md)
- [Device provisioning](docs/guide/device-provisioning-guide.md)
- [Firmware safety contract](docs/guide/firmware-safety-contract.md)

M3 rules, verification and rollout notes: [alert lifecycle handoff](docs/refine/m3-alert-lifecycle-2026-10-03.md).
M4 measurement, chart/export contracts and verification: [telemetry scale handoff](docs/refine/m4-telemetry-scale-2026-10-03.md).
M5 loading measurements, budgets and CI verification: [loading and CI handoff](docs/refine/m5-loading-ci-2026-10-03.md).
