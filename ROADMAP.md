# EGGCELERATE roadmap and timeline

Last updated: **2026-10-06**. Saved checkpoint: local tag
`checkpoint-2026-10-06-papers` on `experiment`, following `493f051`
(`oct 4 frontend test`). Includes M6 extractions, UI refinements, profile-photo
support with migration `0016`, and restored frontend verification gates.
Earlier baseline evidence remains tied to its recorded checkpoints.

This is the current entry point for project plans and progress. “Roadmap” and
“timeline” both refer to this document. Detailed plans and handoffs remain linked
as supporting records. Update this roadmap as work is implemented and verified.

**Overall status:** the dashboard and backend foundation are implemented. Release
readiness remains open. The October 6 preparation review found frontend regression and asset-budget
failures; the follow-up repair restored the **local frontend baseline: 356 tests,
coverage gates, and asset budgets pass**. API/database and live-contract checks
also passed during the review. M6 remains in progress. Physical
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
| October 3 | M0 concurrency-test setup corrected; web/API/live contracts, migrations, mobile and payload baseline verified | Historical technical checks pass; protected dashboard pilot selected, owners/environment pending |

| October 3 | M1 status mapping, accessible mobile help, navigation scroll/focus, skip link, narrow-screen and enlarged-text fixes | Complete locally; handoff recorded |

| October 3 | M2 fetch failures grouped in Notifications; one toast per outage with recurrence cooldown, recovery/read/dismiss behavior, and logout cleanup | Delivered locally; broader M2 work remains |

| October 3 | M2 feature isolation, stale-data recovery, automatic alerts/history refresh, app/screen boundaries, and session-expiry cleanup verified | Complete locally |
| October 3 | M3 durable alert lifecycle and automatic offline detection verified; migration 0015 | Complete locally |
| October 3 | M4 bounded telemetry charts, complete raw exports, slower historical refresh, and 1/12/100 chamber measurements verified | Complete locally |
| October 3 | M5 lazy Settings/Incubators, corrected vendor imports, local fonts, asset budgets, and single coverage CI run verified | Complete locally; GitHub execution remains unverified |
| October 3 | React 19.3/Vite 8.3 upgrade, compatible tooling, further route splitting and expanded regression checks | Complete locally; M6 remains next |
| October 3 | Mobile/tablet/desktop sizing audit and token cleanup: hairline borders, badge glyphs, focus rings, action controls, and shared geometry; direct pixel occurrences reduced from 537 to 409 | Token cleanup complete locally; full breakpoint/long-label visual QA remains |
| October 4 | Representative responsive QA: 77 route/viewport cases, long chamber names, short-screen dialogs; corrected Trends header overlap and toolbar wrapping | Complete locally for tested scope; broader M9 cross-browser/operator qualification remains |
| October 4 | M6 first frontend batch: extracted Trends panels, state models, tooltip, and CSV helper; preserved tab state and coverage scope | Trends batch complete locally; M6 in progress |
| October 4 | M6 Incubators batch: separated toolbar, list, creation dialog, and list/create/harvest state; verified list retention, pending writes and harvest persistence | Incubators batch complete locally; M6 in progress |
| October 4 | Approved Overview top-summary adaptation: charcoal Today panel, desktop four-column/mobile two-column stats and Start checks; reused existing tokens | Complete locally; lower overview layouts retained |
| October 4 | Sparse Trends shading, dashed estimated connections and recorded points; plain notes moved below content in Trends, Monitor and Hardware preferences; warning banners retain contextual positions | Complete locally; clarified bottom-note convention documented |
| October 4 | Notification Center restored to All, Unread and Important; three filters fit mobile width; active/resolved status remains on notification entries | Complete locally; lifecycle regression and typecheck passed |
| October 4 | Reviewed demo defaults, simulator boundaries, inferred actuator status, unavailable hardware preferences, provisional delivery, and release evidence | Testing/production boundary inventory added below; M6–M9 gates remain open |
| October 5–6 | Branded empty states/404, hatch-history and settings consistency, candling photo picker/loading, calendar/journal/notes refinements, and bounded profile photos with migration 0016 | Implemented locally; current review records verification limits |
| October 6 | Project preparation review, fresh migration checks and candidate verification | Initial failures diagnosed; follow-up restores baseline below; M6 remains in progress |
| October 6 | Frontend baseline repair: updated stale behavior assertions, retained official Font Awesome paths without the runtime renderer, and reran coverage/build budgets | Complete locally: 356 tests and all frontend gates pass; M6 remains in progress |

## Project review — demo, testing and production boundaries

Reviewed **2026-10-04** against source and checked-in configuration. This is a code
and documentation review, not a new deployment, hardware test, or full test run.
“Implemented” and “complete locally” do not mean deployed or verified on an ESP32.
The defaults below describe the repository; private environment overrides and the
Azure host were not inspected.

| Area | Current mode or limitation | Work needed / roadmap location |
| --- | --- | --- |
| Dashboard data | `.env.example`, base Compose and frontend environment parsing default to `VITE_DATA_SOURCE=mock`. Fixture chambers, alerts, history and synthetic two-hour readings use an in-memory repository with simulated latency. | Keep mock mode for development/tests; build the VPS dashboard in API mode and verify persistence and real data journeys — M7/M9. |
| Demo sign-in | Mock auth starts with Farmer Juan and accepts local sign-in/registration state; it is not real credential verification. API-mode session auth is implemented separately. | Verify the deployed API-mode session, logout, farm isolation and operator accounts — M7/M9. |
| API storage and auth | Development defaults are `STORAGE_BACKEND=memory`, `APP_ENV=development`, `AUTH_MODE=disabled`. PostgreSQL/session implementations exist; the production overlay forces them and production guards reject disabled auth. | Use the production overlay, migrations and provisioned accounts; verify on Azure — M7. |
| Monitoring and charts | Without telemetry, sensor values can be development previews; stale readings are historical. Dashed chart links and soft shading across gaps are visual estimates, not additional measurements. | Qualify fresh/stale/offline behavior using actual sensors and outages — M8/M9. |
| Actuator status | Heater, fan and mist tiles are inferred from temperature/humidity targets when telemetry is fresh; the telemetry schema does not report actual actuator states. With unverified telemetry they show Unavailable. | Add reported actuator states across firmware, transport and UI, or explicitly label them as estimates before physical qualification — M8; frontend clarity can be handled during M6. |
| Hardware preferences | Hardware controls/calibration are unavailable; displayed preferences are previews, not confirmed device settings. | Implement an acknowledged device-configuration contract and verify settings on hardware — M8. |
| Physical commands | Durable command/outbox/status/ACK handling is implemented, but acceptance or a pending command is not physical execution. The memory adapter mirrors pending state. | Verify actual actuator execution, ACKs, timeouts and retries with ESP32 — M8/M9. |
| MQTT | Bundled broker is anonymous, non-TLS, loopback-only simulation infrastructure. Worker has TLS/credential support but refuses production; dispatch defaults off. | Commission device authentication, broker TLS/ACLs and an approved production worker — M8 with M7 operations support. |
| ESP32 | Firmware folder contains plans and prototype schematic only; no build/flash tooling or controller source. AP setup, pairing code, displays and offline queue are approved plans. | Confirm source/board/inventory — M0; implement and qualify firmware, wiring, local safety and offline recovery — M8. |
| Notifications | In-app bell, bounded fetch-error toasts and durable environmental/offline episodes exist. SMS/email delivery is explicitly provisional research-demo functionality. | Integrate and verify delivery providers if required; record a scope decision before M9 rather than treating saved preferences as delivery. |
| Account recovery | API sessions and operator password reset exist. Self-service recovery is disabled; email verification is unfinished and production signup is closed. | Retain operator-managed pilot accounts; decide whether public signup/recovery is required before release — M7/M9. |
| Candling photos | Ordered photo references are stored; that does not establish an uploaded-image storage service. | Confirm upload/storage/access/deletion scope before claiming photo-upload support — M9 scope decision. |
| Deployment and documentation | Azure VPS hosting is confirmed; deployment evidence is not recorded. Root README still incorrectly says API auth is disabled pending B6, contradicting the production overlay. | Correct runbook, configure HTTPS, deployment, diagnostics, retention and scheduled encrypted backups; record recovery drills — M7. |
| Qualification | Local automated checks and historical database/restore drills exist. October 6 repair passes 356 frontend tests, coverage/scope gates and asset budgets; earlier failed preparation results are preserved in the linked review. GitHub runner evidence, Azure restore/outage drills, physical testing and pilot acceptance remain open. | Finish M6, then deployment and device gates; rerun candidate checks, test real touch devices, perform pilot soak and release approval — M7/M8/M9. |
| Native mobile app | `apps/mobile` is a reserved directory only. Responsive web UI exists. | Future capability outside current milestones; select framework and implement separately if approved. |

Review evidence and follow-up details: [Testing and production boundaries](docs/refine/project-mode-review-2026-10-04.md).
This roadmap's editable source is **`ROADMAP.md` (Markdown)**. No roadmap PDF is
checked into this repository; a PDF would be a dated export of this source.

## What is already implemented

| Area | Available behavior | Remaining boundary |
| --- | --- | --- |
| Web dashboard | Overview, incubator list/detail, live monitoring, trends, candling logs, alerts, settings, and onboarding UI | M1 mobile/navigation and M2 recovery/refresh delivered; later milestones pending |
| Incubation workflows | Chamber/mode management, cycle start/stop/complete/reset, hatch history, candling records and ordered photo references | Photo references do not establish a photo-upload service |
| Data architecture | Domain helpers, memory/API repositories, transport validation, React Query, lazy-loaded routes, asset budgets, and extracted Trends/Incubators modules | Farm query and mutation hooks remain next in M6 |
| Persistence | Farm-scoped PostgreSQL state, Timescale telemetry, atomic retry receipts, deletion markers, migrations through `0016`, bounded chart queries and paginated raw exports | Retention and broader mutation/collection scale remain M6/M7 work |
| Authentication | Farm-scoped sessions, cookie/CSRF protections, production guards, persistent per-email login throttling | Email verification/self-service recovery unfinished; production registration remains closed |
| Provisioning | Operator owner creation/password reset and globally registered device IDs with farm routing | Registry assignment does not authenticate a physical device |
| Simulator transport | MQTT telemetry validation, projection, command outbox/status, ACK handling, and TLS/credential client support | Bundled worker is simulator-only and refuses production |
| Verification and recovery | Web/API CI definitions, live repository contracts, migration checks, disposable backup/restore and database restart drills | Deployment-host evidence and required GitHub checks still need confirmation |

## Historical verification — October 4

| Check | Result |
| --- | --- |
| Frontend tests and coverage gate | Trends shading and bottom notes: **334 tests passed** across 45 files; coverage gates passed, including the summary component, seven screens, six Trends modules and seven Incubators modules |
| Asset guard tests and budgets | **2 Node tests passed**; initial/shared/lazy asset budgets passed locally |
| Frontend typecheck, Biome lint, production build | **Passed** |
| Sizing-token cleanup | **Verified at the pre-extraction checkpoint**; 409 direct px occurrences, 69 distinct values; 159 source hashes and audit rollups passed then. The audit is historical after M6 file extraction; browser token checks were at 393/900/1280px |
| Responsive QA | **77 route/viewport cases passed**; corrected Trends overlap checked at 10 widths; long-name/dialog checks at 4 widths; 17 targeted tests passed after the fix |
| M6 extraction browser checks | Trends: 8 cases; Incubators grid/list/Add dialog: 11 cases at 320/768/900/1440px; no page overflow or runtime errors; Add dialog fits 480px-height screens |
| Overview summary | Nine widths from 320–1440px and 200% text size at 375px passed; no overflow/page errors; all summary text contrast exceeds 4.5:1 |
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
Latest extraction checks: [M6 Incubators handoff](docs/refine/m6-incubators-extraction-2026-10-04.md) and [M6 Trends handoff](docs/refine/m6-trends-extraction-2026-10-04.md).
Latest overview layout checks: [Overview summary](docs/refine/overview-summary-2026-10-04.md).
Latest chart and notice checks: [Trends shading and bottom notes](docs/refine/trends-shading-and-notes-2026-10-04.md).
Live-contract and coverage checkpoint: [dependency upgrade](docs/refine/frontend-upgrade-2026-10-03.md).
Full backend suite and migration-drill evidence remains the [M4 checkpoint](docs/refine/m4-telemetry-scale-2026-10-03.md).

## Remaining roadmap

**Confirmed deployment approach:** rent an Azure VPS, install Docker and Docker
Compose, and run the existing container stack there. No Azure-specific managed
application platform is planned. M7 covers configuring and verifying that VPS
deployment, including domain/HTTPS, production environment, persistent database
storage and backups; it does not require redesigning the app for Azure services.

Milestones below map to the **October improvement plan**, not the historical
September phase numbers. The order is a delivery sequence; no calendar deadlines
are committed. Estimates are inherited planning ranges for one experienced
contributor and exclude hardware delays and the final pilot soak.

| Milestone | Work to finish | Status | Estimate / dependency |
| --- | --- | --- | --- |
| M0 — Baseline and scope | October 6 local software baseline restored; pilot selected; capstone group owns all four roles; Azure VPS hosting confirmed; ESP32 platform and partial hardware inventory recorded | In progress; firmware source and remaining inventory pending | Group to confirm source availability and remaining inventory; server setup/access are M7 work |
| M1 — Mobile and status | Connection mapping, mobile Help via More, keyboard dialog, scroll/focus policy, skip link, narrow-screen and enlarged-text checks delivered | Complete locally | October 3; user authorized work while M0 external details remain open |
| M2 — Recovery and refresh | Feature isolation and Retry, stale-data labels, app/screen recovery, quiet alerts/history refresh, session cleanup, and bounded fetch notifications delivered | Complete locally | October 3; handoff and current checks recorded |
| M3 — Alert lifecycle | Durable temperature/humidity/water/offline episodes, recovery and recurrence, independent read/dismiss state, periodic offline checks and UI lifecycle labels delivered | Complete locally | October 3; migration 0015 and lifecycle checks recorded |
| M4 — Telemetry scale | Bounded sparse chart contract, extrema/gap preservation, complete snapshot-scoped raw exports, 1/12/100 chamber measurements, and slower historical refresh delivered | Complete locally | October 3; telemetry scale handoff and benchmarks recorded |
| M5 — Loading and CI | Lazy Settings/Incubators, corrected vendor matching, local fonts, shared/route asset budgets, recovery checks, and single coverage CI run delivered | Complete locally; current asset budgets pass | October 6 baseline-repair evidence below; GitHub runner evidence remains external |
| M6 — Maintainability and writes | Trends and Incubators extraction delivered; farm hooks, concurrency measurements, narrow transactions, and collection pagination remain | In progress — frontend first | Original estimate: 5–10 days; after M3–M5 |
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

## Pause and resume checkpoint

Paused at the user’s request on October 6 to focus on academic papers.
[Saved handoff](docs/refine/pause-checkpoint-2026-10-06.md). Resume with the remaining
M6 farm-hook separation when the user returns; no further implementation is active.

## Next implementation batch

October 6 preparation takes priority before the remaining M6 implementation:

- [x] Review recent working-tree changes and run current local verification;
      record results and limitations in the October 6 review below.
- [x] Restore frontend regression tests and complete the coverage/scope gates.
- [x] Restore initial JS, total initial assets, and per-chunk asset budgets without changing their limits.
- [x] Correct profile-migration readiness and historical fixtures; rerun the
      full API suite and live contract with profile-photo persistence coverage.
- [ ] Record fresh browser/mobile qualification for recent settings, photos,
      notes, empty states, and calendar changes during M9 preparation.


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
- [x] Start M6 with Trends panel/state/tooltip/CSV extraction and tab-state regression coverage.
- [x] Continue M6 frontend extraction with Incubators list/create/harvest flows.
- [ ] Split farm query coordination from alert, mode, cycle and command mutations.
- [ ] Clarify inferred actuator states in the UI before physical-device qualification;
      implement reported states with the M8 telemetry contract.
- [ ] Resolve scope for provisional SMS/email delivery and candling image uploads
      before M9 acceptance; implement or explicitly exclude each capability.
- [ ] Complete the remaining M6 mutation policy, database-write and collection-scale work.

## October 6 preparation and baseline repair

Current review details and next-action reasoning:
[Project preparation review](docs/refine/project-preparation-review-2026-10-06.md).
Follow-up repair and measurements:
[Frontend baseline repair](docs/refine/frontend-baseline-repair-2026-10-06.md).
Initial review failures are preserved in the first report; the table below records
the repaired frontend results. M6 remains in progress; deployment/hardware are
not qualified by these local checks.

| Check | Current result |
| --- | --- |
| Lint / web typecheck / API Ruff and mypy | Passed locally |
| Frontend suite and coverage | **356 passed** across 51 files; unchanged coverage thresholds and 23-module scope gate pass |
| Production build | Passed; no large-chunk warning |
| Asset budgets | **Passed**: initial JS 189,714 gzip bytes; initial assets 599,855 bytes; entry chunk 430,210 bytes |
| Migration upgrades | Fresh and populated upgrades to `0016` passed |
| API suite with required disposable database | **131 passed, zero skipped** after correcting readiness and historical migration fixtures |
| Live repository contract | **30 passed** after readiness correction |

Next: continue M6 farm-hook separation, narrower writes and collection-scale
measurements while retaining the repaired frontend and API gates. M7 runbook
corrections and M8/M9 external qualification remain open.

## Additional future capabilities

These are outside the current improvement milestones and have no committed dates.

- **Guided candling camera:** the current “Open camera” action is a placeholder.
  Future capture should guide egg framing with an on-screen border/overlay and
  camera permission handling. The capture and framing workflow has not been
  implemented or scheduled.
- **External notification channels — Telegram, SMS, and email:** potential additions
  for incubator alerts and cycle/candling reminders, with operator-selectable
  channels. SMS/email delivery is already recorded as provisional above; Telegram
  is an additional candidate. Provider selection, recipient setup, delivery/retry
  behavior, and costs remain to be assessed before implementation. No channel is
  committed or verified for production delivery.
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
