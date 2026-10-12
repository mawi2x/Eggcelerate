# EGGCELERATE roadmap and timeline

Last updated: **2026-10-12**. Current working progress and the explicit
next-session audit reminder are saved in
[the October 12 checkpoint](docs/current-progress-2026-10-12.md).

**Next review: frontend audit plus backend, firmware/hardware and deployment
audit. Pending, not completed.** See the checkpoint checklist before resuming.

Historical saved checkpoint: local tag
`checkpoint-2026-10-06-papers` on `experiment`, following `493f051`
(`oct 4 frontend test`). Includes M6 extractions, UI refinements, profile-photo
support with migration `0016`, and restored frontend verification gates.
Earlier baseline evidence remains tied to its recorded checkpoints.

This is the current entry point for project plans and progress. “Roadmap” and
“timeline” both refer to this document. Detailed plans and handoffs remain linked
as supporting records. Update this roadmap as work is implemented and verified.

**Current pilot:** real DHT22 readings reach the VPS dashboard; Charles Farm has
EGG-001 paired with short code EGG01. Preparation is implemented with manual
equipment control. LCD/OLED firmware is prepared and compiled; relay/MOSFET
control remains unimplemented. Recent UI cleanup is deployed. Current edits are
local/uncommitted and deployed as staging images, not a new published Git release.

**Historical October 6 baseline:** the dashboard and backend foundation are implemented. Release
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

This section records the earlier repository-default review. The deployed pilot
has since moved to real accounts, PostgreSQL and hardware sensor data; use the
[October 12 checkpoint](docs/current-progress-2026-10-12.md) for current status.

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
without confirmed uploads, permanent device identity with a fixed pairing code,
OLED status/setup, LCD readings, physical setup fallback, and persistent bounded
offline storage with confirmed, deduplicated batch uploads. These are planned M8
capabilities with API/web support. Queue capacity, code format, setup hardware,
and retry/session timing remain design details.

October 11 update: local DHT22 communication on GPIO4 demonstrated by the user's
Serial Monitor screenshot (11 successful reads, zero failures). This is not sensor
calibration or VPS qualification. A connectivity checker and local sensor sketch
now exist. The user selected one fixed pairing code per incubator; dashboard code
rotation is outside the current scope. Follow the [phase plan](apps/firmware/phase-plan.md):
identity/code persistence → protected Wi-Fi AP → VPS enrollment → dashboard pairing
→ confirmed telemetry → recovery → displays/offline queue → bench acceptance.
Initial local identity/AP firmware is now in [wifi-setup](apps/firmware/wifi-setup/README.md),
including fixed-code persistence, protected local portal, saved-network rollback,
and GPIO4 sensor sampling. Compilation and hardware acceptance remain pending.
Next: upload and record local AP/persistence behavior; VPS enrollment and cloud
pairing remain open.

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

### October 11 sensor cloud integration

Main Eggcelerate firmware now integrates verified TLS MQTT temperature/humidity
uploads with the existing GPIO4 sensor and saved Wi-Fi setup. Added operator
fixed-code enrollment (migration 0017), farm-scoped dashboard code resolution,
server-side chamber routing, database receipts, and a sensor-only hardware broker
Compose overlay. NodeMCU-32S compilation, web type checking, Python syntax
compilation, and changed Python source lint passed. VPS access/configuration,
migration execution, configured firmware upload, and end-to-end hardware
acceptance remain pending; M8 is not complete.

### October 11 local-first VPS pilot deployment

Built and rehearsed an isolated local PostgreSQL/HTTPS/MQTT stack, fixed readiness
to require migration 0017, then loaded the same checked API/web images into a
separate VPS project `eggcelerate-hardware`. PostgreSQL migrated to 0017;
public HTTPS readiness passed and the sensor worker connected to MQTT. Added
trusted IP dashboard TLS and eight-hour certificate renewal scheduling. The
original HTTP demo/Git checkout remain intact; deployment is an unpublished
working-source snapshot under `/opt/eggcelerate/hardware-pilot-20261011`.

Prepared private cloud settings and compiled the main NodeMCU-32S firmware;
no firmware upload or synthetic readings were performed. Azure inbound TCP 8883,
owner details, existing-code enrollment, and physical sensor-to-dashboard
acceptance remain outstanding. Certificate future renewal and database backup
operations are not yet qualified. See infrastructure/https/README.md for operations.

### October 11 local account administration

Azure TCP 8883 is now reachable, and EGG-001's MQTT authentication succeeds.
Added a local `/admin` page matching the existing theme to create farm owner
accounts and list registered users. Migration 0018 adds explicit platform admin
permission; admin routes require authenticated sessions and CSRF protection for
writes. The initial administrator is provisioned through the operator command
with a database password hash, without browser or environment credentials.
This page is local only; the VPS remains on its previous snapshot and migration
0017. Real device enrollment, firmware upload, and live readings remain pending.

### October 11 VPS administration rollout

Deployed the locally built admin API/web images as `admin-20261011`, applied
migration 0018, and created the initial platform administrator on the VPS.
API/web readiness and MQTT worker connectivity are healthy. HTTP now redirects
to the real HTTPS dashboard; ACME challenge routing remains reachable. Saved
pre-admin database/source/config backups in the active snapshot. The local test
owner was not copied. Create the real farm owner at `/admin`, then enroll the
existing EGG-001 code and upload the configured firmware; physical acceptance
remains pending.

### October 11 phantom reminder fix

Fixed PostgreSQL read projections to disable the demo store reminder generator.
The durable evaluator remains responsible for real chamber reminders. The VPS
Charles Farm had zero persisted incubators and alerts; the 12 visible reminders
were generated only in the response from demo fixtures. Deployed the corrected
API as `alerts-fix-20261011`; the admin web image remains `admin-20261011`.

### October 11 empty-farm navigation

Removed the full-screen empty-farm shortcut. Every dashboard page now keeps
the shared sidebar/header and uses its own empty state. Settings remain
accessible before adding a chamber; Incubators keep their full toolbar; Overview
provides a pairing-code onboarding action. Invalid empty-farm detail links return
to Incubators. Web build and type checking passed; deployed the same image as
`empty-farm-20261011` to the VPS.

### October 11 empty-farm Trends fix

The newly reachable Trends route dereferenced a missing incubator in its readings
hook. Empty farms now produce no reading IDs or raw-reading groups and display
an environmental empty state while keeping the header and both tabs. The focused
Trends state suite passed all three tests, including the new empty-farm regression.
Web build and type checking passed; deployed `trends-fix-20261011` to the VPS.

### October 11 preparation before incubation

Added a persisted preparation stage (migration 0019) while the chamber remains
idle: select a mode, monitor real readings for five minutes inside both ranges,
then load 1–38 eggs and confirm Start cycle. Only that confirmation starts Day 1.
The server checks continuous samples, freshness and matching mode; changing
mode/cancelling resets preparation. Idle/preparing chambers stay out of Active
Incubators. Heater/mist/fan states now say Not reported rather than inferring
physical state from a sensor value. Control remains manual in this phase.

API lint, web type checking and API/web image builds passed. Local and VPS
databases upgraded to 0019, services deployed as preparation-20261011. A database,
source and Compose backup was saved before rollout. Full physical preparation
and start acceptance remains to be exercised with equipment; no synthetic sensor
data was inserted. See docs/guide/incubator-preparation-guide.md.

### October 12 hardware wiring context and next additions

Recorded the user's schematic and DHT22 wiring correction in
[the hardware pin map](apps/firmware/hardware-pin-map.md). Use this as the
starting point for future firmware work; physical wiring and module details
still need confirmation before outputs are enabled.

- DHT22 DATA is **GPIO4**, replacing the schematic's GPIO2.
- Relay IN1 / motor is GPIO12; IN2 / mist maker GPIO14; IN3 / heater GPIO27.
- Upper fan MOSFET control is GPIO19; lower fan MOSFET control GPIO18.
- The time module's I²C bus is **SDA GPIO21 / SCL GPIO23** as drawn.
- Planned four-pin LCD and OLED share that bus after confirming models,
  addresses, supply voltages, and safe logic levels. Explicitly configure
  `Wire.begin(21, 23)`; GPIO22 is not the drawn clock connection.
- Planned LED light uses spare relay channel 4 / IN4. **GPIO26 is proposed**,
  not a confirmed physical connection. Confirm relay polarity and light ratings.

Next hardware steps:

1. Identify both screens and the time module; check I²C addresses and pull-up
   voltage. Confirm relay active levels, including GPIO12's boot behavior.
2. Add nonblocking LCD/OLED display services to the main Eggcelerate firmware,
   reusing current DHT22 readings. Show temperature/humidity, EGG-001, setup
   pairing code, and connectivity as screen space permits.
3. Add the relay-controlled light with an explicit safe startup state after
   its wiring is confirmed. Preserve existing sensor and cloud transport.
4. Continue heater/mist/fan/turning control and local safeguards as separate
   hardware work. Displays/light do not imply those controls are implemented.

See [the firmware phase plan](apps/firmware/phase-plan.md) and
[display integration](apps/firmware/display-integration.md). This checkpoint
records context only; it does not change firmware or require a reflash.

### October 12 — 1602 LCD firmware prepared

User identified the first display as a blue 1602 16×2 HD44780 LCD with an I²C
backpack. Added `Eggcelerate/LcdDisplay.h` to the main sketch and installed Bill
Perry's hd44780 1.3.2 library locally. It detects the compatible backpack address,
uses SDA21/SCL23, displays existing temperature/humidity samples, writes only
changed rows, and reports stale/failed sensors. Missing/failed display handling
does not halt the sensor/cloud loop; OLED and light control remain deferred.

The NodeMCU-32S build with LCD support passed (1,094,149 bytes / 83% flash,
51,276 bytes / 15% static RAM). No upload was performed. The LCD's actual power
wiring and I²C level converter are still unconfirmed; resolve 5 V backpack
pull-ups before exposing ESP32 GPIO to the bus. Then upload with flash erasure
disabled and confirm both physical LCD readings and ongoing cloud delivery.
See [LCD setup](apps/firmware/lcd-1602.md).

### October 12 — OLED purpose and model recorded

User identified a LAFVIN 0.96-inch four-pin I²C **128×64 blue OLED**. The intended
screen split is LCD for temperature/humidity, OLED for online/offline status.
Reuse the main firmware's Wi-Fi and cloud receipt state: distinguish no Wi-Fi,
Wi-Fi connected but server delivery pending, and recent server-confirmed reading
delivery. OLED controller, actual I²C address and supply/logic voltage are still
unconfirmed; the purchase title does not identify the controller. OLED code has
not been added or flashed. Resolve LCD address explicitly before adding another
device in its backpack auto-detection address range on the shared SDA21/SCL23 bus.

### October 12 — agreed LCD/OLED switching implemented

Updated the main firmware to the user's final display layout:

- **Setup AP open:** 16×2 LCD shows the fixed pairing code as XXXXX-XXXXX;
  OLED shows Online/Offline plus current temperature and humidity.
- **Normal operation:** LCD shows temperature/humidity; OLED shows Online/Offline.
- Online requires connected Wi-Fi/MQTT and a matching database receipt within
  45 seconds. Opening setup does not itself force an Offline state.
- Both LCD rows are overwritten when setup closes; no passwords are shown.
- The common I²C bus stays SDA21/SCL23 at 100 kHz. LCD probes 0x27/0x3F only,
  avoiding the OLED's 0x3C/0x3D addresses; ambiguous OLED addresses disable it.

Added `OledDisplay.h` using the locally installed Adafruit SSD1306 driver as a
provisional choice. The LAFVIN listing does not confirm its controller or voltage;
physical module/wiring confirmation remains required. Missing screens do not
halt sensor/cloud operation. The NodeMCU-32S build passed with both services:
1,108,629 bytes (84% flash), 51,620 bytes (15% static RAM). Not flashed; wiring,
level conversion, visible OLED output and physical acceptance remain pending.
See [display setup](apps/firmware/lcd-1602.md). Keep flash erasure disabled on upload.

### October 12 — display readability revision (current layout)

User prefers the larger LCD for environmental readings at all times. Updated
the main firmware: **LCD always shows temperature/humidity**, while **OLED
always shows fixed pairing code and Online/Offline**. Setup only changes the
OLED header to SETUP; it no longer replaces LCD readings. The OLED's full
XXXXX-XXXXX code uses size-1 text to fit the 128-pixel width; status uses size-2
text. This supersedes the preceding AP-dependent screen split.

NodeMCU-32S compile passed: 1,107,769 bytes (84% flash), 51,620 bytes (15% static
RAM). No upload performed for this revision. User should re-upload the main
sketch with flash erasure disabled to apply it; saved pairing/Wi-Fi are retained.

### October 12 — revised relay boards and actuator guide

User supplied purchase screenshots and revised the physical allocation:

- MakerLab **5 V two-channel relay board:** heater and mist maker.
- MakerLab **5 V four-channel relay board:** DC egg-tray rotation and **12 V LED
  light**; remaining channels reserved pending the motor's direction requirements.
- Two advertised **15 A / 400 W MOSFET trigger/PWM modules:** fan switching/control
  from the original schematic. Trigger compatibility and fan PWM behavior are
  not yet qualified.

This supersedes the single-board relay grouping and 220AC tray-motor label in
the old drawing. Current intent is a DC tray motor; its voltage/current,
direction, position/limit feedback and maximum run duration remain to be recorded.

Prepared [the actuator integration guide](apps/firmware/actuator-integration-guide.md)
and updated [the pin map](apps/firmware/hardware-pin-map.md). **Proposed** layout:
two-channel A IN1 heater GPIO27, IN2 mist GPIO14; four-channel B IN1 tray GPIO25,
IN2 light GPIO26; upper/lower fan MOSFETs GPIO19/GPIO18. GPIO25 replaces the old
GPIO12 motor assignment only if the physical change is adopted. The light's B
IN2 proposal replaces the earlier unused-IN4 plan. DHT22 GPIO4 and shared I²C
GPIO21/GPIO23 remain unchanged.

Later implementation order: confirm interfaces and wiring → isolated channel
bring-up → light/fans → local heater/mist control → bounded tray motion → device
commands/ACKs and real output telemetry → automatic preparation integration.
Use the main firmware with separate phase fallbacks; retain sensor/display/cloud
operation. Relay active levels, logic compatibility, load limits and fault states
must be established before outputs are enabled. The current preparation feature
is monitoring/manual control; the server does not yet drive these outputs.

Guide/planning only: no actuator code enabled, no tests run, no board flashed.

### October 12 — short pilot pairing code and larger OLED text

User requested **EGG01** for the pilot to fit a larger OLED readout. Updated
firmware short/legacy validation, OLED formatting, website validation/help, API
validation/hash input and an operator-only code replacement command. Existing
hash storage/uniqueness support the new format without a schema migration;
legacy ten-character formats remain accepted for other enrolled devices.

Deployed API/web `short-pairing-20261012` after local builds and replaced this
pilot's enrolled code from its previous value to **EGG01** under Charles Farm.
Device ID remains EGG-001; provisioning, existing chamber, cycles/readings, Wi-Fi,
AP password, MQTT credentials/topics and server routing are unchanged. Short
sequential codes are friendly identifiers, not random secrets; authenticated
farm-bound enrollment/lookup remains enforced. Do not reuse codes; the format
covers EGG01–EGG99 while legacy format remains available.

The updated main firmware migrates EGG-001's existing ten-character saved code
to EGG01 through an atomic NVS save/readback without changing record size or
other settings. New commissions use the embedded kPairingCode. OLED renders the
five-character code at size 3 (90×24 px) alongside status; LCD readings remain.
Firmware compiled (1,108,325 bytes / 84% flash, 51,620 bytes / 15% static RAM), web
type checking/API lint and API/web builds passed. No firmware upload performed.
User must upload with flash erasure disabled and inspect status/OLED to complete
hardware acceptance. No re-pairing or new commissioning is needed.

Compatibility: old firmware that validates only ten-character codes will not
recognize the migrated short identity. Use the revised main for subsequent
uploads; a firmware rollback requires controlled restoration of the old code
and matching server enrollment using the private commissioning record. Server
source/database/Compose backups were taken in rollback-short-pairing-20261012.

### October 12 — OLED label consistency

Changed the pairing label to **PAIRING CODE**. SETUP/EGGCELERATE and PAIRING CODE
both use size-1 uppercase text; status stays size 2 and EGG01 stays size 3.
This is a firmware display-only revision, with no pairing/server/data changes.
Upload the updated main sketch with flash erasure disabled to apply it.

### October 12 — OLED heading alignment

Right-aligned SETUP/EGGCELERATE and PAIRING CODE with the same four-pixel inset,
using actual text bounds. Both remain uppercase/size 1; EGG01 remains centered
at size 3, with status unchanged. Firmware display-only revision; no upload
performed or pairing/server changes required.

### October 12 — readable range and summary wording

User reaffirmed numeric ranges must use **to** and summaries must read as
sentences instead of middle-dot-separated fragments. Fixed the shared
temperature range formatter (Celsius/Fahrenheit), preparation summary/profile
preview, trend tooltips/legends, timeline day ranges, admin counts/password help,
calendar captions, alert resolution labels, telemetry captions and settings help.
Server-generated alert ranges and chamber-selection validation use **to** too.
Older stored alert ranges are normalized for display without rewriting history.

Recorded the rule in docs/guide/ui-copy-guidelines.md and linked it from the
typography guide and guide index. Updated existing copy assertions without adding
new test cases. Web type checking/API lint and both Docker builds passed; no test
suite was run. Deployed readable-ranges-20261012 locally and on the VPS. Source
and Compose backups are in rollback-readable-ranges-20261012. This is copy only:
thresholds, unit conversion, sampling, preparation gating and firmware are unchanged.

### October 12 — OLED left alignment (current)

User requested all OLED lines left-aligned: EGGCELERATE/SETUP, ONLINE/OFFLINE,
PAIRING CODE and EGG01. Updated every line to x=0, retaining font sizes 1/2/1/3.
This supersedes the previous right-aligned labels and centered pairing code.
Firmware display-only change; apply by uploading the revised main with flash
erasure disabled. No server changes or firmware upload performed here.

### October 12 — preparation typography audit

Checked the highlighted preparation panel against active desktop/phone theme
tokens. Section/status headings and callout instructions already use shared
tokens. Replaced the target summary's fixed text-sm with Typography body and
the Cancel button's fixed size with --type-button-label. Headings are 16px
desktop/14px phone; body/instructions and action text are 14px desktop/12px phone
at their documented breakpoints. No global type scale change.

Web type checking and build passed. Updated local/VPS web to
preparation-type-20261012; API remains readable-ranges-20261012. No browser
viewport test or test suite run. Documented the panel's token roles in the
incubator preparation guide.
