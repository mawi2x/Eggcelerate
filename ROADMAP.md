# EGGCELERATE roadmap and timeline

Last updated: **2026-10-03**. Baseline: `experiment` at `a470ab3` (2026-10-02).

This is the current entry point for project plans and progress. “Roadmap” and
“timeline” both refer to this document. Detailed plans and handoffs remain linked
as supporting records. Update this roadmap as work is implemented and verified.

**Overall status:** the dashboard and backend foundation are implemented. Release
readiness remains open, and one API concurrency test currently fails. Physical
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
| October 3 | Fresh web/API checks and live contract verification; current baseline recorded below | Web and contract checks pass; API concurrency test needs fix |

## What is already implemented

| Area | Available behavior | Remaining boundary |
| --- | --- | --- |
| Web dashboard | Overview, incubator list/detail, live monitoring, trends, candling logs, alerts, settings, and onboarding UI | Further mobile, accessibility, and recovery improvements |
| Incubation workflows | Chamber/mode management, cycle start/stop/complete/reset, hatch history, candling records and ordered photo references | Photo references do not establish a photo-upload service |
| Data architecture | Domain helpers, memory/API repositories, transport validation, React Query, and lazy-loaded routes | Large screens/hooks still need focused extraction |
| Persistence | Farm-scoped PostgreSQL state, Timescale telemetry, atomic retry receipts, deletion markers, and migrations through `0014` at the recorded checkpoint | Retention, query bounds, and mutation scale need work |
| Authentication | Farm-scoped sessions, cookie/CSRF protections, production guards, persistent per-email login throttling | Email verification/self-service recovery unfinished; production registration remains closed |
| Provisioning | Operator owner creation/password reset and globally registered device IDs with farm routing | Registry assignment does not authenticate a physical device |
| Simulator transport | MQTT telemetry validation, projection, command outbox/status, ACK handling, and TLS/credential client support | Bundled worker is simulator-only and refuses production |
| Verification and recovery | Web/API CI definitions, live repository contracts, migration checks, disposable backup/restore and database restart drills | Deployment-host evidence and required GitHub checks still need confirmation |

## Current verification — October 3

| Check | Result |
| --- | --- |
| Frontend tests and coverage gate | **241 passed** across 32 files; coverage-scope check passed |
| Frontend typecheck, Biome lint, production build | **Passed** |
| API integration suite with required disposable database | **114 passed, 1 failed**, no skipped tests |
| Failing API test | `test_postgres_turns.py::test_concurrent_turn_replay`; failed again in an isolated rerun with a FastAPI/Pydantic `UnsupportedFieldAttributeWarning` during concurrent app/schema construction |
| Live API/frontend repository contract | **28 passed**; temporary API readiness measured 645 ms locally |
| API Ruff lint/format and mypy | **Passed**; mypy checked 42 source files |
| Main JS chunk | 573.02 kB / 155.40 kB gzip; Vite's 500 kB chunk warning remains |
| Deployment and hardware | Not verified in this check; no new migration, restore, outage, or physical-device qualification drill performed |

The local API and main database were stopped when inspected. The disposable test
database was started for checks and stopped afterward. These results describe
this checkout and local tests, not a deployed service or GitHub runner result.

## Remaining roadmap

Milestones below map to the **October improvement plan**, not the historical
September phase numbers. The order is a delivery sequence; no calendar deadlines
are committed. Estimates are inherited planning ranges for one experienced
contributor and exclude hardware delays and the final pilot soak.

| Milestone | Work to finish | Status | Estimate / dependency |
| --- | --- | --- | --- |
| M0 — Baseline and scope | Resolve the failing concurrency gate; confirm release scope, owners, firmware/device availability, mobile/payload baseline, and deployment environment | In progress; API gate needs fix | 0.5–1 day for baseline/scope; defect resolution unestimated |
| M1 — Mobile and status | Consistent connection presentation, accessible help placement, navigation scroll/focus, skip link, narrow-screen and zoom checks | Pending | 2–3 days; after M0 |
| M2 — Recovery and refresh | Feature-level query failures, route/app error boundaries, alert/history refresh, usable stale data, and session-expiry cleanup | Pending | 2–4 days; after M1 |
| M3 — Alert lifecycle | Generate durable temperature/humidity/water/offline episodes; define threshold, recovery, acknowledgment, dismissal, and recurrence semantics | Pending | 3–5 days; after M2 |
| M4 — Telemetry scale | Measure 1/12/100 chambers, bound chart points/payloads, preserve gaps/extremes, provide complete raw exports, reduce repeated full-window downloads | Pending | 3–5 days; after M2 |
| M5 — Loading and CI | Reduce measured eager-import costs, enforce asset budgets, retain route recovery, remove duplicate test execution | Pending | 2–3 days; after M4 |
| M6 — Maintainability and writes | Extract large feature modules/hooks, measure concurrency, narrow database transactions, paginate growing collections | Pending | 5–10 days; after M3–M5 |
| M7 — Operations | Current HTTPS/auth/provisioning runbook, metrics/diagnostics, source/aggregate login limits, safe retention, scheduled encrypted backups, deployment-like recovery drills | Pending | 4–7 days; preparation after M0, final drills after relevant software changes |
| M8 — Physical devices | Actual firmware, device credentials/TLS/ACLs, commissioned production protocol/worker, hardware safety and restart/outage qualification | Pending; external dependencies unresolved | Hardware dependent; discovery after M0, operational support from M7 |
| M9 — Release decision | Current release-candidate checks, operator journeys, mobile/performance validation, restore/outage evidence, pilot soak, rollback and release sign-off | Pending | 1–2 days plus soak; after applicable milestones |

Default software sequence: **M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M9**.
Operational preparation and firmware discovery can begin after M0. Physical
production dispatch additionally requires M8. A protected dashboard pilot needs an
explicit scope describing supported device behavior and dispatch restrictions.

## Next implementation batch

- [ ] Diagnose and resolve the repeatable concurrent-turn test failure, then rerun
      the full API suite and relevant live contracts. Determine whether the defect
      is in app construction, the test setup, or the dependency interaction.
- [ ] Finish M0: choose the first release scope and record owners, environment,
      hardware availability, and outstanding baseline measurements.
- [ ] Implement M1: one connection-state mapping, mobile help placement, and
      navigation scroll/focus behavior; verify keyboard, narrow widths, and zoom.
- [ ] Correct the root deployment guidance early in M7: it still says production
      authentication is disabled, although the production overlay requires sessions.
- [ ] Continue with M2 failure isolation and shared-data refresh.

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
- [September execution and completed phases](docs/refine/project-review-execution-plan-2026-09-23.md)
- [September Phase 9 release/hardware checkpoint](docs/refine/project-review-handoff-2026-09-24-phase9-progress.md)
- [Local and CI verification commands](docs/guide/verification-gates.md)
- [Device provisioning](docs/guide/device-provisioning-guide.md)
- [Firmware safety contract](docs/guide/firmware-safety-contract.md)
