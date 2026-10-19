# EGGCELERATE roadmap and timeline

Last updated: **2026-10-18**. Current work: integrated automatic preparation →
confirmed incubation climate control and timed tray scheduling with local Docker recording. See the
[preparation guide](docs/guide/incubator-preparation-guide.md).
**Resume/next phases:** [October 15 capstone handoff](docs/guide/capstone-next-phases-2026-10-15.md).
The October 14 handoff remains historical.
**Start locally:** [local startup guide](docs/guide/local-startup-guide.md) covers
the existing Docker dashboard, hardware connection and optional mock UI.
**Preferred moving-incubator workflow:** [VPS-connected local development](docs/guide/vps-connected-local-development.md).
Edit the frontend with `pnpm dev:vps` at **https://127.0.0.1:5174** using VPS
accounts/data. VPS API/worker/dashboard rollout and schema 0024 are installed;
VPS-targeted firmware is compiled but upload remains pending. Home computer no longer needs to travel with the
incubator under this planned connection arrangement.
The [October 12 checkpoint](docs/current-progress-2026-10-12.md) remains the
historical sensor/deployment record and broader audit reminder.

**Next review: frontend audit plus backend, firmware/hardware and deployment
audit. Pending, not completed.** See the checkpoint checklist before resuming.

**October 17 incubation-control audit completed (read-only):** production fans
use ON/OFF GPIO commands; variable PWM is absent from the main control path and
disabled in the standalone bench. Hardware speed-control qualification and fixes
remain pending. See the October 17 findings at the end of this roadmap. The wider
project audit above remains open.

**October 18 improvement plan:** [Incubation-control plan](docs/guide/incubation-control-improvement-plan-2026-10-18.md).
Sequence: durable control evidence → hardware/sensor/airflow qualification →
production PWM and fault policy → coordinated climate tuning → stage profiles
and dashboard/history → integrated acceptance. Initial local source implementation
has begun; see the October 18 PWM implementation entry and guide below.
Latest instruction supersedes physical validation gates in that sequence:
complete planning without validation or code edits. Use the confirmed arrangement;
prior proposed qualification/soak runs are deferred, not completed.
User confirms the installed wiring is already verified and pin allocation is
unchanged. Accept the current pins; remaining fan qualification concerns speed,
startup and airflow rather than repeating wiring verification.
Latest clarification: user previously tested adjusting fan power successfully.
Accept adjustable operation as established by that test; the remaining production
gap is firmware integration. Recover working settings and characterize only
missing startup/run limits rather than repeating basic compatibility checks.
Fan roles are now explicitly user-confirmed: upper GPIO18 faces the heater and
circulates heat internally; lower GPIO19 exhausts chamber air. Chicken temperature
reference is CPU's 37.5–37.8°C, used for both internal control and display in the
current plan. The earlier 37–38°C display proposal is withdrawn.

**Current hardware checkpoint (October 15): manual relay and fan MOSFET controls
reported working by the user.** See [mosfet-bench](apps/firmware/mosfet-bench/README.md)
and [relay-bench](apps/firmware/relay-bench/README.md). The complete current pin
allocation is recorded below. Main firmware now integrates preparation/incubation
climate control and acknowledged local website commands. PWM, physical tray
control and physical qualification remain pending.

**Current phase sequence:** follow the [October 15 handoff](docs/guide/capstone-next-phases-2026-10-15.md).
First accept the locally implemented climate owner flow, then identify and implement
the tray interface, scheduled turning and verified home before lockdown, followed
by power recovery and release review. The earlier
[actuator plan](apps/firmware/vps-actuator-control-plan.md) is supporting history.

**Current mode scope:** three built-in choices — **Chicken, Duck and Quail** —
plus user-created custom modes.
[Catalog details](apps/firmware/mode-catalog-reference.md). Source changes are
local; VPS rollout remains pending.

Historical saved checkpoint: local tag
`checkpoint-2026-10-06-papers` on `experiment`, following `493f051`
(`oct 4 frontend test`). Includes M6 extractions, UI refinements, profile-photo
support with migration `0016`, and restored frontend verification gates.
Earlier baseline evidence remains tied to its recorded checkpoints.

This is the current entry point for project plans and progress. “Roadmap” and
“timeline” both refer to this document. Detailed plans and handoffs remain linked
as supporting records. Update this roadmap as work is implemented and verified.

## Current ESP32 pin allocation — October 15, 2026

User confirms all three relays and both fan MOSFET controls are working together
with the combined relay-bench sketch and its local test page on October 15.
This includes the revised mist IN3/GPIO14, upper fan GPIO18 and lower fan GPIO19
allocation. Sensor/display/cloud services remain in the separate main firmware.

| ESP32 GPIO | Current connection | Status | Original schematic / change |
| --- | --- | --- | --- |
| **4** | DHT22 DATA | Used by main firmware; real readings recorded | Replaces schematic GPIO2 |
| **14** | Relay IN3 — mist maker | User confirms working in combined bench test | Same GPIO; moved from IN4 to IN3; original relay channel IN2 |
| **18** | Upper heat-distribution fan MOSFET trigger | User confirms working in combined bench test | Swapped from the lower-fan slot per latest user instruction |
| **19** | Lower exhaust fan MOSFET trigger | User confirms working in combined bench test | Swapped from the upper-fan slot per latest user instruction |
| **21** | Shared I²C SDA — LCD/OLED/time-module bus | Allocated in main firmware; full physical acceptance remains unrecorded | Same SDA pin as schematic |
| **23** | Shared I²C SCL — LCD/OLED/time-module bus | Allocated in main firmware; full physical acceptance remains unrecorded | Same SCL pin; do not substitute default GPIO22 |
| **25** | Relay IN2 — 220 V AC tray motor enable | User confirms working in combined bench test | Replaces schematic GPIO12 / old IN1 |
| **27** | Relay IN1 — heater | User confirms working in combined bench test | Same GPIO; original relay channel IN3 |
| **26** | Unassigned | Former LED allocation removed; no relay output assigned | GPIO26 is vacated |

Former GPIO2 and GPIO12 assignments are superseded. Neither is a qualified
spare output; confirm any old wire is removed before reusing a pin. Relay
controls use LOW-on/HIGH-off; fan MOSFET controls use HIGH-on/LOW-off. Supply
PWM remains disabled. Current relay channel order is heater (IN1), tray (IN2),
mist (IN3), with IN4 vacant. GPIO26 is unassigned; the LED output was removed.
The revised mist-maker channel assignment is included in the user's successful
combined bench confirmation. The unused two-channel relay board is spare.

**Power connections are not GPIO assignments:** ESP32 GND and the confirmed
PSU DC negative provide the common reference; the relay board requires 5 V and
the DeepCool fans require 12 V. Peripheral supplies/logic levels must follow
their specific module wiring records. During USB flashing, external +5 V to
ESP32 5V/VIN is disconnected while common DC ground remains connected.

Permanent details: [hardware pin map](apps/firmware/hardware-pin-map.md),
[fan reference](apps/firmware/hardware/fan-reference.md),
[relay reference](apps/firmware/hardware/relay-reference.md).

**Current pilot:** real DHT22 readings reach the VPS dashboard; Charles Farm has
EGG-001 paired with short code EGG01. Automatic preparation/incubation climate
control is implemented locally; LCD/OLED and main firmware were compiled at the
recorded checkpoint. Manual relay/MOSFET bench control is user-confirmed. Updated
main-firmware upload and integrated physical acceptance remain unconfirmed. Latest
local API/worker/web rebuild includes one-minute readiness; VPS climate rollout
remains pending. Recent UI cleanup was deployed as staging images, not a new
published Git release.

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
| M8 — Physical devices | Real sensor/TLS delivery implemented; display firmware compiled; local two-fan MOSFET bench drafted; actuator integration, offline queue, hardware safety and restart/outage qualification remain | In progress; sensor pilot works, physical actuator/display qualification pending | October 12 checkpoint and October 14 bench draft; hardware dependent |
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

### October 14 — local two-fan MOSFET bench drafted

User selected checking both fan MOSFETs and requested a local control page first.
Prepared [mosfet-bench](apps/firmware/mosfet-bench/README.md), a separate ESP32
NodeMCU-32S sketch with a responsive, ESP32-hosted Wi-Fi page. Upper/lower control
uses GPIO19/GPIO18 as the draft pin map. Each fan has Off/Full on and optional
PWM duty controls; All off disarms both. Boot is disarmed, sessions end after
120 seconds, and a ten-second browser-heartbeat timeout requests shutdown.
Timeout checks run in the main loop; exact timing during stalled network calls
is still unqualified. The page reports applied GPIO duty, not measured fan RPM,
current, power or confirmed physical switching.

User confirmed the USB flashing power arrangement: external +5 V disconnected
from ESP32 while keeping the shared PSU DC ground. Actual GPIO connections,
3.3 V active-HIGH trigger support, module labels and fan ratings remain to be
confirmed. The sketch gates output initialization/arming on kWiringConfirmed.
Supply PWM is independently disabled until fan/module compatibility and a usable
frequency are established; there is no assumed PWM frequency.

The local computer preview is http://127.0.0.1:18719/?preview=1 with controls
disabled. After upload, real control uses the ESP32's protected local AP and
http://192.168.4.1. A random AP password is printed over Serial on each boot.
No Internet service is required. The bench does not access project identity or
pairing storage; flash erasure must stay disabled. Sensor/cloud/display services
pause while this separate sketch runs; restore the main sketch after testing.

Recorded checks: local preview HTTP **200**, JavaScript syntax check passed,
and Git diff whitespace check passed. Browser visual review was unavailable.
ESP32 compilation/upload and all physical ON/OFF, combined-load, boot/reset,
heartbeat/session timeout and PWM acceptance remain pending. No board was
flashed, no outputs were operated, and no VPS changes were made. M8 remains
in progress; the saved broader frontend/system audit also remains pending.

### October 14 — purchased MOSFET module identified

User supplied the Wangzm purchase image and description for a blue dual-MOSFET
**HW-517** board: seller-stated DC 5 to 36 V load input, DC 3.3 to 20 V digital
trigger, and PWM input up to 20 kHz. Advertised 15 A / 400 W capacity remains a
seller claim, not bench qualification. Recorded the specifications in the
actuator/bench guides and limited the optional PWM configuration to at most
20 kHz. No PWM frequency was selected and no outputs were enabled.

The module listing supports a 3.3 V trigger interface; actual terminal labels,
HIGH-on polarity, boot/reset off behavior, GPIO19/18 wires and fan voltage,
current, model/wire count remain pending. Fan supply-PWM compatibility must be
established separately. Next: identify the fan and received-board terminals,
then compile/upload the isolated ON/OFF bench after wiring confirmation.

### October 14 — recovered existing fan schematic information

Rechecked the saved prototype schematic after the user asked about existing fan
data. It already labels both fans **12 V DC FAN** and represents each with
PWR, GND, Tach and PWM terminals. Only the power path is connected through the
MOSFET; Tach/PWM are unused. Recorded this in the pin map and bench guide.
Earlier requests for fan voltage/wire count overlooked this available design
information. The actual purchased fan model/current/wires and supported control
method still need confirmation; the schematic does not qualify supply PWM.

### October 14 — actual fan model identified

Permanent reference: [DeepCool XFAN 120 fan record](apps/firmware/hardware/fan-reference.md).

User identified the fans as **DeepCool XFAN 120**, P/N **DP-FDC-XF120**, and
supplied specifications matching the manufacturer's product page: 120 × 120 ×
25 mm, 12 V DC, operating 10.8 to 13.2 V, starting 7 V, rated 0.07 A ±10% / 0.84 W,
1300 RPM ±10%, maximum 43.56 CFM, hydro bearing. Two fans total nominally 0.14 A /
1.68 W; startup/maximum current has not been measured. Updated the pin map,
bench documentation, configuration comments and local page's fan identification.

Purchase thumbnail appears to show three fan wires plus a peripheral power
connector; verify received connectors before assigning pins. The schematic's
four-terminal symbol is not confirmation of a dedicated PWM wire on these fans.
Start with full 12 V MOSFET ON/OFF switching. Manufacturer specifications do not
qualify supply PWM or provide a supported frequency/duty range; PWM remains
disabled. The 7 V starting threshold is not a calculated minimum PWM percentage.
Any alternate power connector must not bypass the MOSFET. Actual GPIO wiring,
module polarity/default-off behavior, compile/upload and physical acceptance
remain pending; no outputs were enabled or operated.

### October 14 — fan trigger connections ready for bench upload

User reports both MOSFET triggers connected to GPIO18 and GPIO19 and is ready
for testing. Enabled kWiringConfirmed in the separate mosfet-bench sketch for
manual ON/OFF bring-up. Expected assignment is GPIO19 upper / GPIO18 lower;
confirm which physical fan each operates. Module HIGH-on/default-off behavior
remains a bench observation, not an established pass. PWM stays disabled.
Upload entry point is apps/firmware/mosfet-bench/mosfet-bench.ino; use NodeMCU-32S,
flash erasure disabled, load power off during upload, and Serial at 115200 for
the test AP password. No upload or physical test was performed by the agent.

### October 14 — simple fixed bench Wi-Fi password

User requested a simple password using five words/fruits for future bench use.
Changed only the mosfet-bench AP password to apple-mango-pear-plum-kiwi and
recorded it in BenchConfig.h and the bench guide. This supersedes the random
per-boot AP password for this test sketch. The per-boot command token remains
random. Re-upload the revised bench sketch to apply; the already flashed version
still uses its Serial-printed password. Main pilot Wi-Fi/cloud credentials are
unaffected. No upload or new hardware check was performed.

### October 14 — shorter bench password and fan-not-spinning observation

User requested a five-letter password and reported that the MOSFET LED glows
but the fan does not spin. Protected ESP32 softAP requires at least eight
characters; shortened the bench password to mango123 (eight characters).
Re-upload is required; this supersedes the earlier five-fruit password.
Recorded the reported LED observation only: fan switching has not passed.
Next check: use Full on (100%), inspect module VIN/OUT polarity and fan power
wires, and measure the 12 V supply/output if a meter is available. The module LED
alone does not prove load power delivery. No outputs were operated by the agent.

### October 14 — fan test working and current pin allocation

User reports the MOSFET/fan test is working after flashing the separate bench
and connecting triggers to GPIO18/19. This records user-reported functional
success. Individual channel identity, combined-load, boot/reset, timeout and
module-temperature observations were not separately supplied. PWM remains
disabled; integration into main firmware remains pending.

| Function | Original schematic | Current pin / allocation | Status |
| --- | --- | --- | --- |
| DHT22 DATA | GPIO2 | **GPIO4** | Used by main firmware; user corrected wiring and real readings recorded |
| Upper fan MOSFET trigger | GPIO19 | **GPIO18** | User updated slot assignment: GPIO18 is upper; fan test reported working |
| Lower fan MOSFET trigger | GPIO18 | **GPIO19** | User updated slot assignment: GPIO19 is lower; fan test reported working |
| Shared I²C SDA | GPIO21, time module | **GPIO21** for shared LCD/OLED/time-module bus | Used in main display code; physical display/time-module acceptance remains unrecorded |
| Shared I²C SCL | GPIO23, time module | **GPIO23** for shared LCD/OLED/time-module bus | Used in main display code; retain GPIO23 rather than default GPIO22 |
| Heater relay | GPIO27 → old IN3 | **GPIO27 → two-channel A IN1** | Proposed revised channel; physical connection/test pending |
| Mist maker relay | GPIO14 → old IN2 | **GPIO14 → two-channel A IN2** | Proposed revised channel; physical connection/test pending |
| DC tray motor relay | GPIO12 → old IN1 | **GPIO25 → four-channel B IN1** | Proposed replacement; physical adoption not confirmed |
| 12 V LED light relay | No original assignment | **GPIO26 → four-channel B IN2** | Proposed; connection/test pending |
| Former DHT pin | GPIO2 | No current planned assignment | DHT moved to GPIO4; not a qualified spare output |
| Former motor pin | GPIO12 | Legacy assignment; avoided in revised plan | Old wire removal not confirmed; preserve boot-strapping context |

GPIO4/21/23 remain reserved for the main sensor/display program, even while the
fan bench replaces it. Shared PSU DC negative/ESP32 GND is a reference connection,
not a GPIO assignment. The user-confirmed USB arrangement disconnects external
+5 V from ESP32 while retaining common DC ground. Board B IN3/IN4 are reserved
without GPIO assignments. Proposed relay pins are not confirmed or tested outputs.

Canonical reference: [hardware pin map](apps/firmware/hardware-pin-map.md).
Fan data: [fan reference](apps/firmware/hardware/fan-reference.md).
M8 remains in progress. Automatic environmental control remains unimplemented.

### October 14 — relay testing selected; interface confirmation pending

After the reported MOSFET/fan success, user selected relay testing. Prepared
[the relay reference and initial bench sequence](apps/firmware/hardware/relay-reference.md)
with known two-/four-channel MakerLab 5 V board allocation, proposed GPIO27/14
and GPIO25/26, and a coils/isolated-contacts-first sequence. Requested board
selection, actual IN-to-GPIO wiring and HIGH/LOW trigger setting. GPIO18/19 remain
allocated to the fan MOSFETs; GPIO4/21/23 remain reserved for sensor/display work.

Relay polarity, 3.3 V input compatibility, supply/jumper arrangement and actual
relay wires remain unconfirmed. No relay-specific outputs/sketch were enabled,
no relay was actuated, and no load test occurred. First acceptance is manual
channel click/contact checking with all real loads disconnected; real heater,
mist, tray/light operation remains separate pending work. The MOSFET sketch is
not a relay tester. M8 remains in progress.

### October 14 — current relay decision: one four-channel board

User selected the purchased **MakerLab 5 V four-channel SPDT board** for all
relay loads; the purchased two-channel board is spare. This supersedes the
October 12 two-board allocation and earlier October 14 relay channel tables.
Saved purchase/specification details in the permanent
[relay reference](apps/firmware/hardware/relay-reference.md) and updated the
[current pin map](apps/firmware/hardware-pin-map.md).

| Four-channel input | Intended load | Proposed ESP32 GPIO | Original schematic |
| --- | --- | --- | --- |
| IN1 | DC tray motor enable | **25** | Motor IN1 / GPIO12; pin move still proposed |
| IN2 | Mist maker | **14** | Same channel and pin |
| IN3 | Heater | **27** | Same channel and pin |
| IN4 | 12 V LED light | **26** | Previously unused channel; new light |

Channel order is a proposed implementation choice preserving the original
motor/mist/heater order, not a statement about actual connected wires. This
supersedes the previous proposed light-at-B-IN2 and heater/mist-on-board-A plan.
GPIO18/19 remain used for the fan MOSFETs; GPIO4/21/23 remain reserved for the
sensor/display program. All four relay channels have proposed assignments;
motor reversal needing extra contacts would require revisiting the driver plan.

Seller's four-channel specifications: four individually controlled SPDT relays,
optocouplers, LEDs, 5 V control, contact rating 10 A at 250 V AC / 28 V DC.
The 10 A specification is per relay at the stated conditions, not a qualified
40 A board rating; real load/inrush, contact model, terminals/wiring and power
supply still need checking. Seller explicitly claims 3.3 V compatibility only
for the eight-channel variant, so that claim is not evidence for this board.
Actual four-channel input polarity, ESP32 interface compatibility and GPIO wires
remain pending. No relay sketch/output was enabled and no contact/load test ran.

### October 14 — user-corrected relay channel sequence (historical allocation)

User corrected the four-channel order to **heater → tray → empty/reserved LED
→ mist maker**, interpreted as IN1 through IN4. This supersedes the assistant's
previous proposed motor/mist/heater/light sequence. Updated the permanent relay
reference, current pin map and actuator guide.

| Four-channel input | User allocation at this point in the timeline | GPIO plan | Connection status |
| --- | --- | --- | --- |
| **IN1** | **Heater** | **GPIO27 proposed** | Channel allocation confirmed; GPIO wire not yet confirmed |
| **IN2** | **DC tray motor** | **GPIO25 proposed** | Channel allocation confirmed; replacement for old GPIO12 remains proposed |
| **IN3** | **Empty — reserved for LED light** | **GPIO26 reserved/proposed** | Leave unconnected and disabled until light is added |
| **IN4** | **Mist maker** | **GPIO14 proposed** | Channel allocation confirmed; GPIO wire not yet confirmed |

At this point in the timeline, GPIO18/19 remained fan MOSFET triggers and
GPIO4/21/23 remained sensor/shared-I²C allocations. Trigger polarity and safe
ESP32 input compatibility remained open. No relay code was enabled, wiring
changed or load operated by the agent. This relay order was later superseded by
the latest allocation update at the end of this roadmap.

### October 14 — relay connections reported and gated click bench prepared

User reports the relay modules are now connected. Exact IN-to-GPIO confirmation
and four-channel board trigger polarity/safe 3.3 V interface information remain
pending; requested those details before enabling outputs.
Prepared [relay-bench](apps/firmware/relay-bench/README.md) with the user's order:
IN1 heater/GPIO27, IN2 tray/GPIO25, IN3 empty/reserved LED (GPIO26 not driven),
IN4 mist/GPIO14. These GPIO wires remain draft values until explicitly confirmed.

Separate ESP32-hosted page on Eggcelerate-Relay-Test, password mango123, provides
Arm, two-second pulses one unloaded relay at a time, and All off. Software
bounds: one-second off interval per channel, 120-second session, ten-second
heartbeat timeout. Timing under stalled WebServer calls remains unqualified.
GPIO18/19 fan triggers are held LOW; GPIO4/21/23 remain untouched. Contact loads
must stay disconnected for this initial click/contact test. Main services pause
while the separate sketch runs; flash erasure remains disabled.

kWiringAndInterfaceConfirmed is false and kRelayActiveLevel is -1: no relay pin
initialization/arming until confirmed interface/polarity is configured. Reserved
IN3 has no callable control. Page JavaScript syntax check passed; firmware
compile/upload and physical contact/boot/timeout checks remain pending.
No relay output was operated by the agent; M8 stays in progress.

### October 14 — individual relay On/Off controls

User requested individual On/Off options. Replaced relay pulse-only controls
with separate On and Off buttons for heater IN1/GPIO27, tray IN2/GPIO25 and mist
IN4/GPIO14. IN3 remains reserved/disabled. Each relay independently cuts off
nominally after ten seconds, repeated ON cannot extend that limit, and a
one-second off interval prevents immediate repeated energizing. Individual OFF
is accepted while disarmed; All off switches all inactive and disarms. Existing
session/heartbeat bounds and interface/polarity gates remain. Main-loop timing
under stalled network calls still needs qualification. Revised sketch must be
uploaded after wiring/interface/polarity confirmation; no hardware was operated.

### October 14 — relay control enabled after user correction

User stated hardware had already been confirmed and requested working controls
following unsuccessful troubleshooting with the gated sketch. Corrected the
relay-bench configuration: kWiringAndInterfaceConfirmed=true and
kRelayActiveLevel=LOW for the pictured board's apparent optocoupler circuit.
GPIO27/25/14 now initialize HIGH/inactive; ON drives LOW. The web page can arm
and command heater IN1, tray IN2 and mist IN4 after this version is uploaded.
IN3/GPIO26 stays disabled. Per-channel ten-second cutoff, All off, heartbeat and
session timeouts remain. Prior gated firmware cannot operate relays and its
lack of clicks/LEDs is not evidence of hardware failure.

User confirmation supports enabling this bench; physical channel click/contact,
reset/off behavior and actual input circuit verification are still unrecorded.
LOW-trigger is the configured circuit interpretation, not a new measured result.
No firmware upload or relay actuation was performed by the agent. Re-upload
relay-bench.ino with flash erase disabled, then verify isolated contacts first.

### October 14 — relays and MOSFETs working (latest user confirmation)

User confirms **all relays and MOSFETs are working** following manual testing
with the separate bench sketches. Record this as user-reported functional
success, superseding earlier disabled/pending manual-control status. Updated
permanent relay/fan references, hardware pin map and both bench READMEs.

| Function | Channel / ESP32 GPIO | Current status |
| --- | --- | --- |
| Heater relay | IN1 / **GPIO27** | Working manual bench control; LOW-on/HIGH-off |
| DC tray relay | IN2 / **GPIO25** | Working manual bench control; LOW-on/HIGH-off |
| Mist maker relay | IN3 / **GPIO14** | Reassigned from IN4 per latest instruction; previous assignment was working; new mapping not retested |
| Vacant relay channel | IN4 / no GPIO | Unassigned; LED output removed |
| Upper fan MOSFET | **GPIO18** | Working manual bench control; HIGH-on/LOW-off |
| Lower fan MOSFET | **GPIO19** | Working manual bench control; HIGH-on/LOW-off |
| DHT22 | **GPIO4** | Main-program sensor allocation retained |
| Shared display/time-module bus | SDA **GPIO21**, SCL **GPIO23** | Main-program allocation retained |

Success is reported by the user, not agent-measured. Separate bench sketches
have not yet been combined into the main sensor/display/cloud firmware. PWM,
actual load/contact/current measurements, sustained operation, reset/fault and
network-timeout qualification remain open. Automatic environmental control and
bounded tray motion remain future work; M8 stays in progress. Next implementation
can combine confirmed manual outputs with the main program after defining the
load-specific safeguards and motor stop behavior. No automatic integration or
firmware upload was performed in this update.

### October 14 — next plan: VPS manual controls, local thresholds and tray home

User requested manual controls hosted on the existing VPS, automatic threshold
control, and tray movement to an angle on its first turn and back to base on its
last turn. Saved [the integrated actuator/VPS plan](apps/firmware/vps-actuator-control-plan.md).
Actuator UI will live in the existing HTTPS dashboard; the ESP32 retains only
its Wi-Fi setup/recovery portal. Commands travel through authenticated API,
durable outbox, commissioned TLS MQTT hardware dispatch, device validation and
correlated outcomes/state. Current sensor-only worker and receipt-only firmware
need extension; simulator dispatch flags are not a physical-control shortcut.

Environmental thresholds/hysteresis execute locally on ESP32 using valid mode
profiles, with bounded manual override leases, independent fault handling and
continued Auto operation through Internet loss. Existing safety values remain
provisional. Five-minute real-reading preparation and loaded-cycle start rules
remain; automatic equipment control is new implementation. Fan supply PWM stays
disabled. Report applied GPIO state, not fabricated contact/RPM feedback.

Tray plan requires target angle, meaning of last turn, motor/mechanism and actual
position/limit feedback. One tray relay is power enable only; it does not measure
angle or guarantee return/reversal. Plan home/tilt/return states with bounded runs
and feedback-confirmed completion; no guessed motor duration or new GPIOs.
Requested those missing details while planning independent environmental/VPS work.

Sequence: integrated actuator service → physical command/ACK/worker contract →
VPS manual controls → threshold Auto/preparation → qualified tray angle/home →
pilot/release evidence. All stages remain planned; no firmware, VPS or hardware
was changed/operated by this planning update. M8 remains in progress.

### October 14 — agreed level/home position before lockdown; plan prepared

User accepted the recommendation and requested planning only. Updated
[the integrated VPS/threshold/tray plan](apps/firmware/vps-actuator-control-plan.md)
with the agreed final movement: return to **level base/home**, verify actual
arrival, stop motor and keep turning disabled throughout lockdown. Normal turns
are inhibited when final return begins; failure does not re-enable them. The
species profile determines the cutoff (chicken day 18 is guidance, not a shared
constant for all species). Temperature/humidity phase control continues even
if a tray position fault prevents confirmed home arrival.

Plan covers position feedback, bounded travel, pending/moving/completed/failed
VPS states, duplicate/reboot/reconnect behavior, persisted turning inhibition,
missed-cutoff handling and explicit operator recovery. It includes hardware and
end-to-end acceptance checks. Target tilt angle, normal turning pattern, motor
model/linkage/direction, home/angle sensors and measured travel time remain open;
no new GPIOs or guessed motor duration were assigned. GPIO26/IN3 stays reserved.

Manual controls remain hosted on the VPS; threshold/hysteresis and motor stop
rules run locally on ESP32. Existing bench and main firmware are unchanged.
No firmware upload, physical movement, test run or deployment was performed.
M8 and this integrated implementation remain in progress/planned, respectively.

### October 14 — three built-in Philippine pilot modes

User requested removing other mode choices and keeping three common Philippine
egg types. Selected **Chicken, Duck and Quail**; recorded source rationale and
existing profile values in [the mode catalog reference](apps/firmware/mode-catalog-reference.md).
This is a practical locally relevant selection, not a verified national ranking.
Chicken retains the internal ID broiler for existing references, with Chicken
as the current display name. The other retained IDs are duck and quail.

Local web/API defaults now contain three built-in presets; removed the other
built-in and demo custom presets, and remapped development chamber fixtures to
the supported set. Onboarding offers only these species. Settings and new mode
selection use the current catalog; Add/Import/Duplicate custom actions are hidden,
extra-mode creation is rejected in API/mock repositories, and built-ins cannot
be deleted. Numeric profile editing and existing layout/export behavior remain.
Retired modes referenced by existing chambers remain readable for accurate
current display; new preparation/cycles cannot select them. Historical records
and persisted physical chamber assignments are not silently rewritten.

Existing profile temperature/humidity/duration/interval values are retained;
automatic control boundaries, stage-specific settings and physical qualification
remain pending. No schema migration is required. Web typecheck and Python
syntax compilation passed; production build result follows. No regression suite,
browser review or deployed database mutation/rollout occurred. Tests expecting
ten presets/custom-mode creation need review before a full baseline claim.

Three-mode change final recorded checks: web typecheck **passed**, production
build **passed**, Python syntax compilation **passed**. Preserved the existing
Mode Library layout, numeric profile editing, candling summaries and export;
removed custom creation/import/duplication controls from user reach. Updated
the actuator plan to use the three-mode scope. No new full regression or live
VPS verification is claimed.

### October 14 — custom modes retained; three built-ins remain the focus

User clarified that users must still be able to create custom profiles. Restored
Add/Import/Duplicate actions and API/mock custom creation/editing/deletion, with
customs selectable during preparation and cycle setup. Built-in defaults remain
exactly **Chicken, Duck and Quail**. Other supplied built-ins and the two demo
custom presets remain retired; old referenced rows/history remain readable.
Built-in names stay fixed; custom names and numeric settings can be edited.
Reserved/retired preset IDs cannot be used to invent extra built-ins through
custom creation. Existing in-use deletion protection remains.

Updated the catalog reference and actuator plan; current automatic-control
qualification focus remains the three built-ins. This supersedes the earlier
three-built-ins-only custom-creation restriction. Local source change only;
no VPS rollout or database purge occurred. Current checks are recorded below.

Custom-mode clarification checks: web typecheck **passed**, production build
**passed**, Python syntax compilation **passed**. No full regression suite,
browser review or live VPS deployment was performed.

## October 14 — session close and resume handoff

**Paused at the user's request.** This section is the current handoff and
supersedes intermediate decisions above where they differ. Work is saved in
local files; no commit/tag, Docker rebuild or VPS rollout was made today.

### Completed today

| Area | Final result | Evidence / limitation |
| --- | --- | --- |
| Fan inventory | DeepCool XFAN 120, DP-FDC-XF120; 12 V, nominal 0.07 A / 0.84 W per fan | User listing and manufacturer reference saved in hardware/fan-reference.md; startup current not measured |
| MOSFET inventory | HW-517 dual-MOSFET module, seller lists 5 to 36 V load input, 3.3 to 20 V trigger, up to 20 kHz | Listing recorded; advertised 15 A / 400 W is not project qualification |
| Fan bench | Separate ESP32-hosted manual On/Off sketch on GPIO19/18 | User flashed/tested and reports working; PWM disabled |
| Relay inventory/allocation | MakerLab 5 V four-channel board, actual SONGLE SRD-05VDC-SL-C markings; two-channel board spare | Current requested order: IN1 heater, IN2 tray, IN3 mist, IN4 vacant |
| Relay bench | Separate On/Off sketch using GPIO27/25/14; LOW-on/HIGH-off, All off and nominal ten-second per-channel cutoff | User reports all relays working after enabled revision; no independent load/fault/timeout measurements |
| Troubleshooting record | Earlier relay draft had outputs gated, causing unsuccessful control attempts; final config is enabled with LOW trigger | Do not diagnose damage from behavior of the old gated sketch. Continuity belongs to isolated unpowered circuits; COM–NC is closed while coil inactive |
| Bench access | Fan AP Eggcelerate-Fan-Test; relay AP Eggcelerate-Relay-Test; both use mango123; page http://192.168.4.1 | Applies to revised uploaded sketches; these are temporary bench UIs |
| Pin/context records | Current-vs-schematic table and permanent fan/relay records saved | GPIO2 DHT and GPIO12 tray assignments superseded; GPIO26 unassigned; revised mist/fan allocation confirmed working in combined bench on October 15 |
| Next implementation plan | Integrated main firmware, VPS manual commands/ACKs, local threshold/hysteresis, automatic preparation, feedback-based tray motion | apps/firmware/vps-actuator-control-plan.md; planning only |
| Lockdown decision | Final tray movement returns to level/home, verifies arrival, motor OFF and turning disabled throughout lockdown | Requires position/stop mechanism; never infer home from relay OFF. Species determines cutoff |
| Mode catalog | Exactly three built-in presets: Chicken, Duck and Quail; custom mode creation/import/duplication/edit/delete remains supported | Local web/API changes; other supplied built-ins/demo customs retired from new selection. Chicken retains ID broiler |
| History compatibility | Referenced retired profiles remain readable; physical chambers/cycle history were not reassigned or purged | New selections restricted to supported built-ins or eligible user-created customs |
| Local software checks | Web typecheck, final production build and Python syntax compilation passed | No full regression suite, browser review or live database/VPS verification |

### Current pin allocation to retain

| GPIO | Current function | Status |
| --- | --- | --- |
| **4** | DHT22 DATA | Main-program allocation |
| **14** | Relay IN3 — mist | User confirms working in combined bench test on October 15 |
| **18** | Upper fan MOSFET trigger / upper fan slot | User-reported working bench control |
| **19** | Lower fan MOSFET trigger / lower fan slot | User-reported working bench control |
| **21** | Shared I²C SDA | Main-program LCD/OLED/time-module bus allocation |
| **23** | Shared I²C SCL | Main-program bus allocation; not GPIO22 |
| **25** | Relay IN2 — DC tray enable | User-reported working bench control; replaces old GPIO12 assignment |
| **27** | Relay IN1 — heater | User-reported working bench control |
| **26** | Unassigned | Former LED allocation removed |

Relay IN4 is vacant. The user confirmed the new IN3 mist-maker allocation and
both fan controls working with the combined sketch on October 15.

Shared PSU DC negative/ESP32 GND is the reference connection. Relay coil supply
is 5 V; fan supply is 12 V. User confirmed external +5 V is disconnected from
ESP32 while USB powers it for flashing, retaining common DC ground.

### State to remember at resume

- The user last reported successfully testing the combined relay/fan bench.
  Restoration of main Eggcelerate firmware was not reported. Confirm which sketch is running;
  do not assume sensor/cloud/display services are currently running on the board.
- Bench relay and fan controls are now combined in relay-bench as of October 15,
  with user-confirmed functional success. They are not yet available on the VPS.
  Main pilot firmware remains sensor/display/setup/cloud code; physical worker
  remains sensors-only.
- User wants **future manual controls on the existing VPS dashboard**, not an
  ESP32-hosted actuator page. Keep local Wi-Fi setup/recovery as a separate service.
- Temperature/humidity control is planned threshold + hysteresis. Retained mode
  ranges are existing app values, not physically qualified actuator settings.
  Relay dwell/max-on/fault values and stage-specific targets remain unresolved.
- Fan supply PWM remains disabled. GPIO26 is unassigned; relay IN4 is vacant.
  The mist maker on IN3/GPIO14 is user-confirmed working in the combined bench.
  Do not apply bench ten-second cutoffs as production environmental-control
  settings.
- pnpm build generated local production assets only. Docker runs that build
  inside an image and packages Nginx; no current API/web image was rebuilt,
  restarted or copied to the VPS for today's mode changes.
- Existing tests assuming ten supplied presets need review. Full regression,
  browser, deployment, backup/restore and broader audits remain open.

### Next actual steps

1. Review saved source changes and current running firmware/services; preserve
   pairing/settings and historical data. Update relevant existing assertions and
   run suitable verification when authorized; record current results.
2. Confirm motor model/voltage, direction/linkage, target tilt angle, normal
   turning pattern, home/angle feedback and measured maximum travel. No guessed
   run duration or extra feedback/driver GPIO allocation yet.
3. Define qualified mode control boundaries, hysteresis, relay switching limits,
   fan policy and sensor/over-temperature/water/motor fault behavior.
4. Integrate manual actuator service into main firmware while retaining DHT22,
   LCD/OLED, Wi-Fi recovery, identity and telemetry. Report applied outputs honestly.
5. Extend physical hardware MQTT command/ACK/worker contracts and add bounded
   manual overrides in VPS chamber controls. Requests are pending until device
   outcomes; simulator dispatch flags are not a hardware enable shortcut.
6. Add local threshold Auto and device-acknowledged preparation, preserving the
   existing five-minute real-reading stability check and loaded-cycle start.
7. Add feedback-confirmed tray tilt/final home, lockdown turning inhibition and
   restart/duplicate/network-loss recovery. Environmental phase control continues
   even if tray home confirmation fails.
8. Qualify the integrated hardware, then rebuild API-mode Docker images and use
   the established local/staging/VPS rollout and rollback workflow. Complete
   the saved frontend/system audit and release gates; M8/M9 are not complete.

Supporting records: [fan reference](apps/firmware/hardware/fan-reference.md),
[relay reference](apps/firmware/hardware/relay-reference.md),
[hardware pin map](apps/firmware/hardware-pin-map.md),
[fan bench](apps/firmware/mosfet-bench/README.md),
[relay bench](apps/firmware/relay-bench/README.md),
[mode catalog](apps/firmware/mode-catalog-reference.md),
[VPS/threshold/tray plan](apps/firmware/vps-actuator-control-plan.md).

### October 14 — mist maker reassigned to IN3; LED allocation removed

User requested moving the mist maker from relay IN4 to IN3 and removing the
LED assignment. Current requested relay order is **IN1 heater / GPIO27, IN2
tray / GPIO25, IN3 mist maker / GPIO14, IN4 vacant**. GPIO26 is unassigned.
The previous IN4 mist-maker control was reported working; the new IN3 channel
mapping has not yet been bench-confirmed. This supersedes the earlier relay
channel tables above.

Updated the relay-bench configuration comments, startup Serial mapping, source
page and embedded page for the new allocation. The page now offers heater IN1,
tray IN2 and mist IN3, with IN4 unused and no LED controls. GPIO14 remains the
mist output: move its relay input wire from IN4 to IN3 before testing. GPIO26
is not initialized or driven; fan GPIO18/19 stay LOW. LOW-on/HIGH-off, arming,
All off and the existing timeout limits remain enabled. The bench README has
the revised wiring and upload instructions. Embedded-page consistency and page
JavaScript syntax checks passed. Arduino CLI was unavailable; no firmware
compile, upload or physical relay test was performed by the agent.

### October 15 — combined relay and fan MOSFET bench ready for testing

User reported the IDE issue resolved and requested testing relays and MOSFETs
together. Extended `apps/firmware/relay-bench/relay-bench.ino` and its embedded
page to control five outputs independently: heater IN1/GPIO27, tray IN2/GPIO25,
mist IN3/GPIO14, upper fan GPIO18 and lower fan GPIO19. IN4 is unused and GPIO26
is unassigned. Relays are LOW-on/HIGH-off; fan MOSFETs are HIGH-on/LOW-off with
full ON/OFF only. Multiple outputs can run together; no supply PWM was enabled.

All five outputs initialize off. Shared Arm/All off, two-minute session expiry,
ten-second heartbeat timeout and page-hide stop cover relays and fans. Relays
retain the ten-second per-channel cutoff and one-second minimum off interval;
fans remain on until switched off or the session stops. Existing bench Wi-Fi
remains `Eggcelerate-Relay-Test`, password `mango123`, page `http://192.168.4.1`.
Updated the bench README and firmware entry point. Main sensor/display/cloud
firmware integration and VPS actuator control remain pending.

Located Arduino CLI inside the running IDE AppImage and successfully compiled
the combined sketch for NodeMCU-32S using installed ESP32 core 3.3.11. Software
GPIO simulation passed for mapping/polarity, authorization/arming, concurrent
outputs, relay cutoff/minimum-off, All off, heartbeat/session expiry and timer
rollover. Page checks passed for embedded-source consistency, JavaScript syntax,
all five controls, relay/fan endpoint routing, states, All off, page-hide stop
and preview isolation. These are software checks; no firmware upload or physical
combined-output test was performed by the agent. Upload with flash erasure
disabled and confirm the new mist/fan slot mapping during the user's bench test.

### October 15 — combined relay and MOSFET test working (user confirmation)

User reports **all outputs working** after testing the combined relay/fan bench
and asks to save this progress. Record user-confirmed functional success for
all three relays and both fan MOSFET controls in one sketch and local page:

| Output | Confirmed allocation | Result |
| --- | --- | --- |
| Heater relay | IN1 / GPIO27 | User reports working |
| DC tray motor relay | IN2 / GPIO25 | User reports working |
| Mist maker relay | IN3 / GPIO14 | User reports working with revised channel allocation |
| Upper fan MOSFET | GPIO18 | User reports working with revised upper slot allocation |
| Lower fan MOSFET | GPIO19 | User reports working with revised lower slot allocation |

IN4 remains vacant, GPIO26 is unassigned and the LED allocation is removed.
This supersedes the pending combined physical-test and mist-channel confirmation
status recorded earlier. The main firmware has not been reported restored;
the latest reported running sketch is the combined relay-bench program.

The result is the user's functional bench confirmation. Individual timeout,
reset/fault, electrical load/current and sustained-operation measurements were
not supplied. Main sensor/display/cloud integration, VPS manual commands,
automatic environmental control and feedback-confirmed tray positioning remain
future work; M8 remains in progress.

### October 15 — smaller connected mock web demo

User requested keeping `pnpm dev:web` on mock data, reducing the demo chambers
and mode choices, and correcting the Offline indicators on the overview.
The application's mock repository now selects a dedicated demo fixture set:
three active paired chambers, one each for the existing Chicken, Duck and Quail
built-ins. Polling and detail reads renew simulated telemetry receipts so the
demo remains connected throughout a presentation. Extended fixtures remain
available for regression scenarios; the shared freshness resolver and API
adapter continue to require actual device receipt timestamps.

Demo alerts/history are scoped to those three chambers; historical demo Broiler
labels display as Chicken. The overview fills a three-column desktop row when
three active chambers are visible. Custom profile support remains available.
The demo is in memory and resets on reload. No VPS rollout or database mutation
was performed for this change.

Inspection confirmed chamber renaming is supported by the mock repository and
the live profile API, but no user-facing rename control currently invokes it.
Whole-incubator deletion is not implemented in either repository/API or UI.
Those management actions remain separate work.

Validation: 29 selected demo/repository/freshness/overview/live-monitor tests
passed, web typecheck passed and production build passed. Updated two existing
live-monitor assertions from Unavailable to the current Not reported wording
for unknown actuator states. Browser verification at localhost:5173 showed three
active cards with progress rings and zero offline chambers, including after
several polling intervals. Screenshot: `output/playwright/demo-overview.png`.

### October 15 — battery/power monitoring removed; binary equipment status

User removed battery-percentage and power-source monitoring from the project
scope. Removed the incubator-card battery indicator, monitor Power/Battery tiles,
device-settings battery gauge, hardware-list power badges, battery-saver option
and battery/power notification rules. Removed simulated battery/power alerts
from web and API memory seeds. Legacy power fields remain accepted for existing
API/firmware compatibility, but no longer affect chamber severity or issue text;
the existing sensor pilot values are not battery measurements.

The mock demo now supplies explicit simulated heater, mist and circulation-fan
states, displayed only as On or Off. These states are not inferred from
temperature/humidity. Added optional output-state report parsing with a receipt
timestamp. The UI displays binary states only while both telemetry and the
output report are fresh; stale/missing output reports are hidden and show
Waiting for output status. Main firmware still does not send actuator state to
the live dashboard, so live output reporting remains pending. No output controls
or automatic controller were added by this UI change.

Validation: 84 selected web tests and seven API tests passed; web typecheck and
production build passed; targeted API Ruff checks passed. Updated related test
expectations for retired battery/water monitoring and the Chicken display name.
Browser checks confirmed no battery indicator on chamber cards and a compact
monitor row showing Off / Off / On plus Live telemetry for the Quail demo.
Screenshot: `output/playwright/chamber-status-simplified.png`. Changes are local;
the VPS has not been rebuilt or redeployed for this update.

### October 15 — local Candling Journal camera capture

Replaced the Open camera placeholder with a browser camera dialog shared by
new inspections and existing journal entries. Added rear-camera preference,
egg framing guide, JPEG capture, preview, retake and Use photo. Captures feed
into the existing photo attachment/save flow; this does not classify eggs.
Camera tracks stop on close, including when permission resolves after closing.
Permission/device/start failures show actionable messages and retain upload as
an alternative. Camera access requires localhost or HTTPS. Inspection submission
now releases its loading state and retains the form when submission throws.

Local source changes only. Camera behavior has not yet been tested on a physical
device; no tests were run for this update. No VPS deployment performed.

### October 15 — admin-provided accounts in demo and API UI

Removed the remaining self-service farm setup entry point from sign-in. Legacy
/register and /onboarding URLs redirect to sign-in or the dashboard according
to the current session. Both auth providers disable public registration; the
sign-in screen explains that the administrator provides accounts and farm
access. API configuration now defaults public registration off in development
as well as production. Administrator account provisioning remains available.
Local changes only; no tests run or live deployment performed for this update.

### October 15 — mock admin account management

Enabled /admin in the pnpm mock demo with the existing Users interface.
Seed demo administrator: admin@eggcelerate.demo / DemoAdmin123!.
Owners created there can sign in at /login with their assigned credentials.
Created demo accounts persist in localStorage using salted PBKDF2 hashes;
per-tab sessions use sessionStorage. Duplicate emails are rejected and mock
admin operations require the demo administrator session. Public registration
remains disabled. Original sample login: farmer@example.test / DemoFarmer123!.

Each created owner gets a separate empty in-memory farm and their own farm
name/profile. The original sample retains its three connected chambers.
Accounts survive reload; demo farm changes reset on reload, as documented in
the interface and README. API mode still uses the existing server admin client.
No Docker is required for this demo. Changes are local only; tests were not run
and no VPS deployment was performed.

### October 15 — demo admin sign-in copy and password

Updated the local demo admin password to eggcelerate_admin (superseding the
initial demo password above). Admin sign-in now previews the admin email and
uses administrator-specific help text. The live server password is unchanged.

### October 15 — admin user modals, edit and delete

Replaced the permanent Create user sidebar form with a modal opened from the
user list. Added per-owner Edit and Delete actions. Edit supports full name,
farm name, email and an optional new password; blank password fields retain the
existing password. Retained the password character count. Delete confirms the
selected name/email and explains that existing farm records remain. Submission
errors retain the modal/form and successful actions refresh the list.

Implemented mock persistence for updates/deletes, including the seeded sample
farmer, while protecting administrator accounts. Added corresponding local API
PATCH/DELETE user routes under the existing administrator/CSRF guards. API edits
revoke user sessions; deletion cascades memberships/sessions while retaining the
farm and its records. Administrator accounts cannot be edited or deleted here.
Web typecheck and targeted API Ruff checks passed. No behavioral tests run;
all changes remain local with no live deployment.

### October 15 — consolidated local progress and latest UI cleanup

Current local demo entry points:
- Run `pnpm dev:web`; farmer sign-in is `/login`, administrator sign-in is `/admin`.
- Current demo admin: `admin@eggcelerate.demo` / `eggcelerate_admin`.
- Admin email starts empty with `Email` as its placeholder. Removed the helper
  text below Sign in and the informational banner above the user list.
- Sign-in supports Enter, reads submitted field values (including browser
  autofill), trims the email, and displays validation beside the correct field.
  Successful mock admin sign-in reloads `/admin` using its saved tab session.
  The user subsequently reached the Users page, as shown in their screenshot.
- Create user opens a modal. User rows offer Edit and confirmed Delete;
  administrator accounts remain protected. Password guidance was replaced by
  a live character count; editing with a blank password retains the old one.
- Public farm setup/registration remains removed from both UI modes. Admins
  provide accounts. New demo owners start with separate empty farms; the
  original sample account retains the three-chamber demo.
- Demo accounts persist in this browser/origin. Farm changes remain in memory
  and reset on reload; these limitations remain documented in README.
- Candling camera capture, preview, retake and attachment are implemented;
  physical-camera acceptance is still pending. Checkpoint dropdown trigger and
  menu now share the same font size and weight.

Web typecheck and targeted API Ruff checks passed for the latest account
management implementation. Behavioral tests for the new camera/admin flows
have not been run. Earlier battery-removal test results apply only to that
previous update. All current changes are saved locally, uncommitted, and have
not been deployed to the live server. Deployment remains deferred until the
user explicitly requests it.

### October 15 — fan functions confirmed for climate regulation

User confirms the lower fan is the exhaust fan (GPIO19). The upper fan faces
the heater to distribute heat through the chamber (GPIO18). Heater relay is
IN1/GPIO27 and mist maker is IN3/GPIO14. These are distinct circulation and
exhaust functions, not interchangeable fan roles.

Automatic temperature/humidity regulation is the next requested task. The main
firmware still only monitors/publishes sensor readings. Controller design must
command the upper fan whenever the heater is energized, and treat the lower
fan as ventilation/exhaust. Whether any fan failure feedback is available has
not been established; commanding a fan on does not prove airflow. Target
setpoints and whether the first test is in an empty chamber remain unconfirmed.
No automatic actuator behavior has been added or energized by this note.

### October 15 — local Docker recorder rebuilt for empty-chamber testing

User confirmed the first climate test is in an empty incubator and requested
using the current modes plus Docker to record temperature/humidity. Confirmed
selectable built-ins from web fixtures and API presets:
- Chicken (stable ID broiler): 37.5–37.8 C, 55–60% RH, 21 days, turns every 4 h.
- Duck: 37.4–37.6 C, 62–68% RH, 28 days, turns every 6 h.
- Quail: 37.5–37.8 C, 55–60% RH, 18 days, turns every 4 h.
These are the application's current preset ranges, not new biological guidance.
Legacy built-ins remain stored for history and are not current selectable modes.

Restored the existing egg-hardware-local database container without deleting or
reseeding its volume. Rebuilt api, web and hardware-telemetry images, ran Alembic
upgrade head (database at 0019), and recreated the local services. API/web/db
health checks pass; HTTPS /readyz reports ready with PostgreSQL up. MQTT worker
logs confirm hardware-sensors-only mode connected. Added hardware-local-compose.sh
so subsequent builds no longer depend on the missing temporary Compose overlay.
Local hardware dashboard: https://127.0.0.1:18443; pnpm mock demo remains separate.

Recording is NOT yet underway: this local database contains no paired device or
incubator. Main firmware CloudConfig still targets the VPS MQTT endpoint. The
local broker currently binds loopback (127.0.0.1:18883), and its existing TLS
certificate does not cover the laptop LAN address. Connecting ESP32 to this local
recorder requires a LAN-accessible, certificate-matching broker endpoint and local
EGG-001 enrollment/pairing. Automatic actuator control is also still unimplemented
in main firmware. No firmware was flashed, no outputs energized, no synthetic
readings inserted, and no VPS changes/deployment were made by this Docker build.

### October 15 — selectable sensor reporting interval

Enabled farm-wide Sensor Reporting Interval choices of 5, 10, 15 and 30 seconds
under Hardware & Devices → Device preferences. Selection participates in Save
Changes/Discard. Added compatible web/API preference fields with a 15-second
default, matching the firmware's previous upload cadence; migration 0020 stores
and constrains the preference. Longer intervals were not offered because the
current dashboard freshness threshold is 45 seconds. DHT22 reads remain at
2.5 seconds and research logging remains fixed at five minutes.

The hardware worker sends a non-retained reporting configuration message on the
existing worker-only receipt topic after telemetry commits. Updated main firmware
accepts only supported values bound to its current boot ID/latest sequence;
older/stale messages cannot change its interval. It resets to 15 seconds at boot
until the next server update. Existing database receipt acknowledgements remain
unchanged. This configures upload timing only, not actuators.

Web typecheck and targeted API Ruff checks passed. Main NodeMCU-32S firmware
compiled successfully (1,108,769 bytes flash, 51,620 bytes RAM). Firmware has not
been flashed or physically verified. Rebuilt local Docker web/API/worker and
migrated the existing local database to 0020 without reseeding or deleting data.
Also corrected missing empty-panel sizing hook references found during typecheck.
No behavioral tests run; no VPS changes. Device enrollment, local broker LAN/TLS
connection and automatic heater/mist/fan regulation remain pending.

Post-rebuild verification: updated database readiness checks to migration 0020;
local HTTPS /readyz returns ready=true/database=up, and the rebuilt MQTT worker
reports connected. The ESP32 still uses its existing uploaded firmware until the
new main sketch is manually flashed; no physical interval application claimed.

### October 15 — dedicated branded error pages

Added a shared full-height ErrorPage with the Eggcelerate mascot, a 4–mascot–4
illustration and "Eggs not found" for unknown routes. Screen/app recovery uses
the same design with "This egg didn’t hatch" and retry/reload/dashboard actions.
Download/chunk failures prompt a reload; runtime failures retain retry behavior.
Actual missing-page 404s and loading failures keep distinct copy. Rebuilt and
recreated the local Docker web; web typecheck passed. No live deployment.

### October 15 — climate-control roles and coupled effects

User requested these rules for the upcoming empty-incubator regulation test:
- Heater (IN1/GPIO27) adds heat. The upper fan (GPIO18), facing the heater,
  distributes that heat and must be commanded on whenever the heater is on.
- Mist maker (IN3/GPIO14) adds moisture to raise humidity.
- Lower exhaust fan (GPIO19) exchanges chamber air with outside air to remove
  excess heat/moisture when ambient conditions permit. Exhaust is not guaranteed
  to lower temperature or humidity if incoming air is hotter or wetter.
- Shut off heater and mist maker on sensor failure/stale readings or overheating.
  Define fault fan behavior explicitly when implementing the controller; do not
  assume an energized fan proves airflow.

Clarification: the heater does not reduce heat. Heating generally lowers relative
humidity when the water-vapor content remains unchanged. Temperature and humidity
must therefore be regulated together: reheating after ventilation can lower RH,
and misting can affect temperature. Avoid treating the actuators as independent
controls or running mist against humidity-driven exhaust. These are recorded
controller requirements; automatic regulation remains unimplemented/unverified.

### October 15 — main firmware built for supervised empty-chamber regulation

Implemented ClimateControl.h and ClimateRuntime.h in the main Eggcelerate sketch.
Boot leaves heating/misting stopped; explicit serial start requires two fresh
valid DHT22 readings. Three selectable normal-incubation presets match Chicken,
Duck and Quail mode ranges. Mode changes require stopping. Tray relay IN2/GPIO25
is held off; GPIO26/IN4 remain unused. Existing LCD/OLED, identity/pairing, Wi-Fi,
MQTT receipts and selectable upload cadence remain integrated.

Upper circulation fan GPIO18 runs during testing with a three-second lead before
heat. Heater IN1/GPIO27 uses the preset temperature bounds. Above the upper
bound, heater and mist are off and both fans run until temperature reaches the
midpoint. High RH uses lower exhaust GPIO19 for ten seconds followed by twenty
seconds mixing; heat may compensate only within its target. Warm-up happens
before humidity-driven exhaust. Low RH uses mist IN3/GPIO14 for at most three
seconds followed by twenty seconds off once near operating temperature. Mist
cannot oppose drying/cooling. Automatic operation ends after sixty minutes.

Invalid/stale sensor readings while running, >=39 C, or ten minutes continuous
heater command latch a fault: heat/mist off, both fans on. Reset requires recovery
and stays stopped. Normal stop provides fan cooldown. Dedicated FreeRTOS control
keeps sensing/GPIO control independent of networking/display calls, with an
explicit six-second panic/reset task watchdog. Commands are queued in order;
stop takes priority. No airflow/contact/low-water feedback exists. Independent
thermal protection and supervised physical acceptance are still required.

Prepared separate LOCAL TLS CA/certificate, LAN binding 192.168.1.115:18883,
and ignored LocalCloudConfig.h, which overrides but does not modify the existing
VPS CloudConfig.h. Original VPS certificate material is preserved. Added a
repeatable prepare-local-recorder.py helper and local-only broker configuration.
Enrolled EGG-001 / EGG01 under the sole local owner farm `test`; user still needs
to Add Incubator in the dashboard to assign a chamber before ingestion succeeds.
Local TLS/EGG-001 authentication confirmed without publishing synthetic readings;
MQTT worker connected and HTTPS /readyz confirms PostgreSQL up.

Final NodeMCU-32S compile passed: 1,114,329 bytes flash (85%) and 51,684 bytes RAM
(15%). Private binaries saved under output/firmware/empty-chamber-test. No hardware
was flashed or energized, and behavioral/physical tests have not been performed.
See apps/firmware/climate-test.md for upload, serial commands, recording and
limitations. Dashboard mode/control/state synchronization and tray motion remain
pending; test control is via Serial Monitor. No VPS deployment or remote changes.


### October 15 — local Docker website controls for the empty incubator test

Added a dedicated Empty incubator test panel on the incubator detail page:
Start test, Stop test and Reset fault, with supervised empty-chamber confirmation.
The selected unchanged Chicken/Duck/Quail preset is sent with start. The ESP32
reports running/stopped, faults and all four output commands. Pending, stale and
unknown states remain explicit; a click alone never confirms execution.

Authenticated farm-scoped/CSRF-protected API requests persist in a separate
climate_tests table (migration 0021). Local API/worker explicitly enable the
feature; it is disabled by default elsewhere. The worker uses the existing
per-device TLS/ACL receipt channel, non-retained QoS1, 90-second deadlines,
boot/sequence binding and monotonic request ordering. Firmware acknowledges only
after the control task processes the request; duplicate/older commands cannot
restart or extend a test. Stop takes priority over queued starts. Sensor failures
still publish controller status without manufacturing environmental readings.
Configuration/mode/egg-cycle mutations are blocked while testing or awaiting a
stop confirmation. Tray dispatch remains separate and disabled for this test.

Requires one new USB upload of the complete Eggcelerate sketch; subsequent test
start/stop is from https://127.0.0.1:18443. Keep chamber Ready/empty and use its
detail page, rather than starting a batch with fictitious eggs. Regulation remains
limited to a supervised 60-minute empty test, with the existing local fault stops
and cooldown. No physical upload, actuator start or live-server deployment was
performed by the agent. Physical regulation and website-to-device acceptance
remain pending the user's upload and supervised test.

Local integration build: web TypeScript check and Docker API/worker/web builds
passed; migration 0021 applied to the existing local database. HTTPS readiness
reports PostgreSQL up and the worker connects in hardware-climate-test mode.
Final firmware compile: 1,116,221 bytes flash (85%), 51,804 bytes RAM (15%); private
upload artifacts refreshed. Ruff passes for changed Python modules. Full API
mypy still reports the pre-existing optional-password override in platform_admin.py
line 137; no new mypy errors. No behavioral tests or physical actions were run.
At handoff, the local database has zero chambers and zero device projections:
user must Add incubator with EGG01, upload the updated firmware, and wait for real
readings before Start test becomes available.


### October 15 — explicit Stop turns every actuator off

User requested Stop Cycle leave only sensing/displays/connectivity/recording active.
Firmware explicit Stop now latches heater IN1/GPIO27, mist IN3/GPIO14, upper fan
GPIO18, exhaust fan GPIO19 and tray IN2/GPIO25 off. It overrides manual-stop fan
cooldown and fault ventilation; outputs remain off through subsequent sensor
readings, mode changes and fault reset until a new accepted Start. Automatic
fault handling during a running test still removes heat/mist and ventilates.

Local Stop Cycle now queues the same hardware Stop atomically with its archive
transaction; Stop Test uses it too. Pending status remains until a current ESP32
acknowledgement reports running=false and heater/mist/upper/exhaust all false.
Updated firmware advertises stop_all capability; older builds must be uploaded
before hardware controls or hardware-backed Stop Cycle can proceed. DHT22 reads,
LCD/OLED, Wi-Fi, TLS MQTT reporting and database recording continue after Stop.
No live-server deployment or physical actuator operation performed.

All-output Stop build completed: NodeMCU-32S firmware 1,116,313 bytes flash (85%),
51,804 bytes RAM (15%); web typecheck, local Docker API/worker/web builds and
changed Python lint passed. Updated private upload artifacts refreshed. Existing
unrelated platform_admin.py mypy issue remains. Physical shutdown confirmation
is pending upload of this updated firmware and the user's supervised test.

### October 15 — preparation workflow audit and user clarification

User reaffirmed the existing preparation-first workflow. The saved guide is
`docs/guide/incubator-preparation-guide.md`; migration 0019 and the current UI/API
already retain preparation start, selected mode and five minutes of continuous
fresh in-range temperature/humidity before egg loading and Day 1. A newly added
chamber's `ready` phase means idle/available, not thermally stable.

Audit: physical DHT22 readings and LCD/OLED run before dashboard pairing, but the
current authenticated MQTT ingester requires a device-to-farm/chamber assignment
before accepting web records. Pairing is not needed for the sensor to operate;
it is needed to associate website readings with the correct chamber.

The separate Empty incubator test panel added today is a bench path, not the
normal preparation flow. Begin Preparation still changes persisted monitoring
state only and its UI explicitly says equipment control is manual. The bench
start currently rejects preparation, and its configuration guard also prevents
normal preparation/cycle handoff while running. No dedicated preparation-ready
notification was found in the durable alert evaluator; readiness is a page banner.

Required next integration: use existing Prepare -> select mode -> Begin
Preparation to command acknowledged automatic climate regulation, retain the
five-minute real-sample stability gate, notify Ready to load eggs, confirm 1-38
eggs and start Day 1 only after owner confirmation. Regulation must continue
through the preparation-to-incubation handoff. Cancel/Stop must command all
actuators off while sensing, screens and recording remain active. Do not treat
the independent 60-minute bench session as completed production integration.
This entry records the audit and intended workflow; no further actuator commands
or behavior changes were made during this audit. Browser inspection was unavailable
because the browser tool returned no connected browser surfaces.

### October 15 — simpler setup Wi-Fi password requested

User requested the setup AP password `egg123`. This is six characters; the ESP32
password-protected soft AP requires at least eight. Requested value recorded,
not applied. Proposed simple alternative: `egg12345`, pending the user's choice.
The existing stored AP password and firmware remain unchanged for now. This
request concerns setup Wi-Fi, not the home/router Wi-Fi or administrator password.


### October 15 — approved short setup Wi-Fi credentials

User approved setup AP name **Eggcelerate-001** and password **egg12345**.
Applied to the main Eggcelerate firmware: SSID derives its numeric suffix from
EGG-001; fresh commissioning uses the approved password. Valid existing NVS
identities migrate their saved AP password on boot with write/read-back
verification. Validation/restore accept 8-16 printable characters within the
unchanged 17-byte password field, retaining old valid 16-character records for
migration. Device ID, pairing code EGG01 and router Wi-Fi settings are preserved.
Send `setup`, connect to Eggcelerate-001, open http://192.168.4.1; serial `status`
shows the effective AP credentials. Supersedes the earlier pending password
request. Requires uploading the rebuilt firmware; no board flashed by the agent.

Short setup credentials firmware compiled successfully for NodeMCU-32S:
1,116,461 bytes flash (85%), 51,804 bytes RAM (15%). Private upload artifacts
refreshed. Saved-password migration and AP connection await physical upload.


### October 15 — memorable setup IP and captive portal

User requested the setup page open when connecting to the ESP32 AP and changed
its address to **10.10.10.10**. Main firmware AP IP/gateway now use 10.10.10.10/24;
all active setup links, redirects, host checks and serial instructions use
http://10.10.10.10. SSID Eggcelerate-001 and approved password egg12345 remain.
Added bundled ESP32 DNSServer wildcard resolution, DHCP captive portal hint and
unknown HTTP probe redirects (Android/Apple/Windows) to the canonical setup page.
Supported clients may show a sign-in/open-network prompt; automatic browser launch
is OS dependent and manual HTTP entry remains supported. HTTPS interception is
not attempted. Credential POSTs still require canonical AP host and CSRF token;
web listener remains bound to AP address. DNS stops with the existing setup AP
idle closure. No climate-control or dashboard behavior changes in this update.
Firmware upload and real phone/laptop captive portal acceptance remain pending.

Captive portal build passed for NodeMCU-32S: 1,123,961 bytes flash (85%),
51,940 bytes RAM (15%). Private upload artifacts refreshed. No board upload or
phone/laptop connection test performed by the agent.


### October 15 — EGG01 blocked by stale frontend pairing validation

User reported Add Incubator rejected EGG01. Read-only local database lookup
confirmed EGG-001 is enrolled/enabled for the test farm and EGG01 resolves
correctly. Root cause: useCreateIncubator still required ten-character legacy
codes despite the shared onboarding/API schemas supporting five-character EGG01.
Added a reusable PairingCodeSchema and used it for Add Incubator and onboarding;
removed the redundant legacy-only onboarding check. Demo repository also recognizes
short hardware codes and preserves its connected-server requirement rather than
pretending to pair hardware. Legacy codes remain supported. No farm/device
assignments or hardware configuration were changed to fix this UI validation bug.

Pairing validation fix: web TypeScript check and local Docker web build passed;
local web container recreated. Owner can refresh and retry EGG01 (zero, then one).
End-to-end pairing awaits the user's retry; no chamber was added by the agent.


### October 15 — replace separate Start Test with the existing owner lifecycle

User requested the capstone's existing preparation and confirmation flow rather
than the extra test feature. Removed ClimateTestPanel, test selector/start/stop UI
and public /climate-test endpoint. Current source uses /climate-control for existing
Chamber status/recovery; no alternate start path. Old internal table/MQTT field
names remain transport-compatible, with lifecycle capability metadata distinguishing
new firmware. Replaced CLIMATE_TEST_ENABLED with CLIMATE_CONTROL_ENABLED locally.

Begin Preparation persists configuration and selected unchanged Chicken/Duck/Quail
mode plus an expiring, boot-bound Prepare command atomically. The independent
ESP32 climate task regulates targets and acknowledges only after validating and
persisting authorization. Real sensor samples must stay within both mode ranges
for five minutes after controller acceptance, without >45s gaps; fresh running
controller, matching mode/boot and no fault are required. The evaluator adds one
durable Ready to load eggs notification per preparation generation. Starting Day 1
still requires the owner to load 1-38 eggs and confirm, with readiness checked again.
Incubation confirmation queues a phase handoff that preserves ongoing regulation;
the former 60-minute bench timer is removed. Cancellation, Stop Cycle, completion
and reset-to-idle queue all-equipment Stop with their lifecycle transaction.

Existing Live Monitor Chamber status now receives real heater/mist/upper/exhaust
commands; pending, rejected, stale and unknown command states remain explicit.
Fault reset and explicit regulation resume use the existing context. No output
states are inferred from temperature/humidity. Automatic settings cannot silently
mutate an active mode. Edited/custom presets remain unsupported by this firmware.

Firmware saves checksummed run authorization/phase/mode separately from pairing
and Wi-Fi. On a normal power restart, all outputs initialize off, then authorized
preparation/incubation may resume after two fresh valid readings and fan lead.
Manual Stop remains stopped; saved faults and crash/watchdog restart require
recovery. Storage failure blocks operation. Server reconciliation retries committed
intent across connection/boot changes, but suspends restart for faults or a local
manual Stop. Reset alone does not resume. The laptop-USB/UPS EN-button symptom is
not diagnosed/fixed, and physical boot/Stop/regulation acceptance is still required.
Tray relay remains held off: this is climate workflow integration, not commissioned
tray motion, PWM, calibration, new lockdown profiles or proof of production safety.
Existing 10-minute continuous-heater and 39°C fault limits remain. No live-server
deployment or physical actuator command/upload was performed by the agent.


Preparation/incubation build handoff: web TypeScript and changed Python lint
passed; API/worker/web Docker builds passed; migration 0022 applied to the
existing local database. Latest NodeMCU-32S compile passed at 1,125,465 bytes flash
(85%) and 51,932 bytes RAM (15%). Private artifacts are in
output/firmware/preparation-incubation; upload the current main Eggcelerate sketch
with flash erasure disabled. Local worker connects in hardware-climate-control
mode. Read-only handoff audit confirms existing device still reports old lifecycle
capability 0, no committed lifecycle intent and zero queued control packets:
updated firmware upload is required before Begin Preparation, and no new hardware
start was issued by the agent. Full API mypy retains the previously known
platform_admin.py optional-password override error (line 137), with no new errors.
No behavioral test suite or physical commissioning was run. Actual warm-up,
five-minute readiness alert, continuous confirmation handoff, all-equipment Stop
and UPS/boot recovery remain physical acceptance items; no production-safety claim
or live-server rollout is implied by build/readiness checks.


### October 15 — next-phase handoff saved before usage limit

User requested a durable next-phase plan. Saved
`docs/guide/capstone-next-phases-2026-10-15.md` covering current implemented state,
build evidence and physical gaps; authoritative pins/presets; the unanswered tray
motor behavior question; bounded tray motion; real scheduling and verified home
before lockdown; laptop-USB/UPS EN diagnosis; and later authorized release/deployment.
It preserves the normal preparation/confirmation flow and explicitly forbids
reintroducing the rejected Start Test panel or treating simulator dispatch as
real tray control. Current work remains uncommitted and physical acceptance is
pending. No additional runtime or hardware behavior changed while writing this plan.

### October 15 — preparation stability shortened to one minute

Preparation now requires 60 seconds of fresh, in-range temperature and humidity
readings, replacing five minutes. Updated readiness enforcement, owner-facing
messages, notification copy and current guides. Existing sample-gap resets and
controller acknowledgement requirements remain in effect. Source change only;
no deployment or physical acceptance performed for this update.

### October 15 — Phase 1 local rebuild and device checkpoint

Rebuilt and recreated local API, hardware-telemetry and web. Web typecheck and
Docker builds passed; API/web healthy, HTTPS health check passed, worker connected
in hardware-climate-control mode. Runtime API confirms STABILITY_SECONDS=60;
database remains at 0022. No migrations or data resets required. No pending
climate commands were present before restart; no new actuator command issued.

Physical acceptance remains open: latest device report at this check was about
11 minutes old, lifecycle=0, sensor_valid=false, running=false, fault=0. No serial
device was available. Upload the complete current main sketch with flash erasure
disabled, then verify fresh lifecycle=1 and valid sensor reports before the owner
preparation check. Phase 2 awaits the motor stop/direction/endpoint details. No VPS
action or hardware upload was performed.

### October 15 — Phase 2 desired tray rocking motion clarified

User requests back-and-forth tray rocking, approximately -45 degrees to +45
degrees from vertical (90 degrees total arc), describing one rotation as a
back-and-forth operation. Recorded this intended motion in the current handoff.
Actual linkage, motor stop/reversal behavior, measured endpoints, dwell pattern
and home detection remain unconfirmed. Asked whether continuous IN2 power drives
repeated crank rocking, one-way travel requiring reversal, or a self-stopping
cycle. Tray GPIO25 remains off in the main firmware pending the hardware facts.

### October 15 — purchased tray listing supplied; motor type unresolved

User supplied a yellow 56-egg, roughly 42 x 42 cm automatic tray listing advertised
as 220 V, with a round motor and linked egg rows. This conflicts with the earlier
DC-tray-motor assumption; actual label voltage/type and wiring must be confirmed.
Rocking through a mechanical linkage is plausible, not yet demonstrated. Do not
choose motor reversal, on-time, completed-turn or home detection from the seller
image. Phase 2 next evidence is the actual motor label/linkage and any switches
or controller. No tray output or hardware configuration was changed.

### October 15 — confirmed 220 V AC tray motor and 90-degree rocking arc

User confirms the installed tray motor uses **220 V AC** and rocks through a
**90-degree total arc**. This supersedes earlier DC motor assumptions and the
listing-only voltage uncertainty. Relay IN2 / GPIO25 remains the control signal;
the main firmware still holds the tray off. The requested nominal endpoints were
-45/+45 degrees; measured endpoints, cycle duration, continuous-power/self-stop
behavior, dwell pattern and level/home feedback remain unresolved. Updated the
current handoff, pin-map note, actuator guide and control plan. Documentation
only: no electrical wiring, firmware output or running service changed.

### October 15 — separate local motor timing bench implemented

User requested a motor-only local page with a seconds input to establish rocking
cycle timing. Added [motor-bench](apps/firmware/motor-bench/README.md): 1–120 whole
seconds (default 2), Start timed run, Stop motor, reported relay duration/remaining
time and browser-saved observation notes. Only IN2/GPIO25 can turn on; heater,
mist and both fan outputs initialize/stay off. Independent task enforces cutoff
and 5-second browser heartbeat loss; no bench run resumes on boot. Duplicate IDs
cannot restart/extend a run; one-second off interval and 32-run session bound.
No motor angle, completed rocking or home position is inferred from the timer.

Separate sketch uses AP Eggcelerate-Motor-Test and http://192.168.4.1; it pauses
main sensor/display/cloud services without erasing main configuration. Laptop
preview at http://127.0.0.1:8766/?preview=1 has controls disabled. No main dashboard
Start Test feature was restored. No firmware upload, motor activation or VPS
change was performed. Physical cutoff/contact/motion observations remain pending.

Verification: host C++ timer checks passed (bounds, overlapping starts, cutoff,
heartbeat loss, manual Stop, off interval, 120-second run and millis wraparound).
Embedded-page generation, JavaScript syntax and localhost HTTP 200 passed.
NodeMCU-32S compile passed: 934,976 bytes flash (71%), 47,592 bytes RAM (14%).
Firefox mobile preview inspected at 390x844; desktop preview captured at 1280x900.

### October 15 — user-reported physical tray timing observations

The user reports the following motor-bench observations for the **220 V AC**
tray motor on **relay IN2 / GPIO25**. Base means the user's level/base reference;
angles below are relative to that base. These are observed results, not automatic
position feedback or a calibrated positioning rule.

| Run duration | Starting position | Reported motion and resting position |
| --- | --- | --- |
| **5 seconds** | Base | Tray rocks and stays at **45°** from base |
| **10 seconds** | Base | Tray rocks back and forth and returns to **base** |
| **15 seconds** | Base | Tray rocks back and forth and rests at **45°** from base |
| **15 seconds** | 45° | Tray rocks back and forth and rests at **base** |
| **20 seconds** | 45° | Tray rocks back and forth and rests at **45°** from base |
| **10 seconds** | 45° | Tray rocks and stays at **−45°** from base |

Keep both 15-second observations: their starting positions differ. The reported
10-second runs also have different starting positions and results. Do not infer
that ten seconds always completes a full rocking cycle or returns home. Exact
motor/linkage phase, initial motion direction, repeatability, loaded-tray behavior
and home/endpoint feedback remain unestablished. These observations provide
physical timing evidence for Phase 2; reliable bounded positioning and automatic
turning acceptance remain open. No firmware or timing settings changed in this
documentation update.

### October 15 — repeated opposite-side movement confirmed by user

In response to the requested repeated **+45° → −45° / 10-second** check, the
user confirms it consistently reaches the opposite side. Record repeatability
for that starting position and duration only. Repetition count, loaded-tray
conditions, long-term holding after switch-off, reverse transfer and level/home
arrival were not separately reported. Phase 2 now has repeatable observed timing
for this movement. This supports planning Phase 3 bounded timed movement;
verified home positioning and integrated preparation acceptance remain open.
No firmware, motor output or running service changed in this update.

### October 15 — opposite-side and base-return timings clarified

User confirms the following observed movements, with angles relative to level/base:

| Starting position | Motor ON duration | Observed ending position |
| --- | --- | --- |
| **+45°** | **10 seconds** | **−45°** (previously reported consistently reaching) |
| **+45°** | **5 seconds** | **Base / level (0°)** |

These are candidate durations for Phase 3 bounded timed movement from the stated
starting position. The five-second base return is user-observed arrival, not
sensor-confirmed homing. A rocking mechanism can pass the same angle in different
motion phases; do not assume either duration works from an unknown position or
after interrupted movement/reboot. Reverse movement, repeated base-return checks,
loaded behavior and any home feedback remain unrecorded. No firmware or actuator
settings were changed.

### October 15 — Phase 3 bounded tray movement implemented locally

Added main-firmware `TrayMotion.h` and integrated it into the independent climate
control task. Explicit Serial commissioning supports **+45° → −45° / 10 seconds**
and **+45° → level / 5 seconds**, with an operator-confirmed +45° starting position
valid for 30 seconds. Main controls require healthy confirmed-incubation climate
phase; no movement while idle/preparing. Separate empty-tray motor bench now has
the same fixed-duration presets and a starting-position checkbox; firmware chooses
the preset duration. Normal website remains unchanged.

Main-firmware movement uses one pending tray request, a one-second off interval,
and positive increasing IDs stored/read back before energizing. Repeated IDs
cannot replay across reboot. Motion/known position are never resumed on boot.
Explicit tray Stop preserves climate services; all-equipment Stop cancels tray
motion and queue. Faults, invalid/stale sensing or leaving incubation phase stop
motion. Timer completion reports **check actual position**, not confirmed endpoint
or home. Main commissioning status is Serial-only; schedule, MQTT tray commands,
full lifecycle/lockdown permission and remote acknowledgement are Phase 4 work.

Recorded checks: host tray-state assertions pass for unknown/expired starts,
fixed 5/10-second durations, overlapping requests, Stop, off interval, replay,
restored ID high-water mark, unconfirmed ending position and clock rollover.
Existing bench timer checks and JavaScript syntax pass; fixed-preset form requires
starting-position confirmation and locks its duration in Firefox. Local preview
returns HTTP 200. NodeMCU-32S builds pass: main **1,128,921 bytes flash (86%),
51,996 bytes RAM (15%)**; bench **936,716 bytes flash (71%), 47,592 bytes RAM (14%)**.

**Phase 3 remains in progress:** source implementation is ready for supervised
acceptance, but no new firmware upload, actuator command or live-server deployment
was performed. Reverse movement, repeated level returns, loaded behavior and
verified home/endpoint feedback remain open. Phase 1 owner-flow acceptance is
also still unconfirmed. See the updated main and motor-bench READMEs for use.

### October 15 — proceed with confirmed timings; Phase 4 tray integration

User states the motor timing has already been tested sufficiently and requests
implementation without more timing tests. Accepted the existing observations and
implemented the scheduled/manual hardware path. No additional behavioral, browser
or physical motor tests were run for this batch.

- Added migration **0023** and durable tray schedule/request state on climate_tests.
- Existing manual Turn and scheduled turns use the same real hardware worker path,
  separate from simulator dispatch; boot/sequence/expiry/increasing-ID protection.
- Main firmware accepts bounded requests and reports tray capability, running,
  correlated acceptance and estimated position. Used/rejected IDs persist before
  energizing; reboot leaves motion stopped and position unknown.
- Ten seconds changes sides; five seconds returns toward level. An observed level
  start uses five seconds to tilt toward +45°, based on the earlier observation.
  Symmetric reverse-side timing is an implementation assumption, not new evidence.
- Existing automatic-turn setting and Chicken/Quail 4h, Duck 6h defaults apply.
  At most one missed due turn is scheduled, with the next interval after completion;
  no catch-up burst. Cursors advance on matching device timed-run completion.
- No idle/preparation or regular lockdown/hatching turns. Normal turns stop two
  minutes before the UTC-date lockdown boundary; an authorized tray returns toward
  level for five seconds, then stays paused pending owner level confirmation.
  Explicit Stop/fault/unknown position prevents automatic recovery motion.
- Added normal Live Monitor tray status, Stop/pause, return toward level and current
  position controls. Saving an observed position resumes normal automatic turning
  when enabled. New firmware/healthy confirmed incubation is required.

Compilation/type checking and targeted Python lint passed. Main NodeMCU-32S build:
**1,130,405 bytes flash (86%), 52,020 bytes RAM (15%)**. Behavioral/end-to-end suites
were not run under the user's instruction. Firmware was not uploaded; no motor
command or VPS rollout was performed by the agent.

Current guide: [timed tray turning](docs/guide/tray-turning-guide.md). Phase 4
implementation is local; runtime installation status is recorded in the next
entry. Next substantive phase is the separate power/restart reliability issue.

### October 15 — Phase 4 local installation complete

Final API/worker/web images rebuilt and recreated in egg-hardware-local. Migration
**0023** applied successfully to the existing database; API/web are healthy and
MQTT worker connected. HTTPS proxy reloaded after container replacement. Local
tray opt-in is enabled for API/worker; old firmware reports no tray capability,
and no tray command was queued. Existing farm/chamber data was preserved.
A full local pre-migration dump was saved privately; restore was not exercised
(pg_dump noted TimescaleDB circular foreign-key restoration considerations).

Latest firmware compilation is **1,130,405 bytes flash (86%), 52,020 bytes RAM
(15%)**. Final web typecheck and targeted Python lint pass. No additional timing,
behavioral, browser or physical motor tests were run. The agent did not flash
firmware, start equipment, create incubation records or change the VPS.

To activate: upload the complete current Eggcelerate main sketch with flash erasure
disabled, then use normal incubation and save the current observed tray position
in Live Monitor. This is operational initialization, not another timing test.
Phase 5 intake began: asked about the existing LCD/OLED behavior before EN; source
review notes existing 25-ms I²C timeout and 6-second control-task watchdog. The
power/EN cause remains unknown; no speculative reset/power changes were made.

### October 16 — AP setup UI simplified; phase work paused

User requested pausing phase work and removing the marked blocks from the AP
setup page. Removed visible device ID/fixed pairing code and its now-orphaned
pairing hint, temperature/humidity summary and its DOM update, and the footer
privacy/recovery/auto-close/Serial-command notes. Kept Wi-Fi name/password, password
help, connection/cloud status and Connect and save. Identity, pairing, sensor
readings, Wi-Fi recovery and AP timing behavior are unchanged. Main firmware source
only; no upload, equipment command, service restart or VPS deployment performed.
Resume only when requested; Phase 5 power/EN diagnosis remains open.

### October 16 — setup AP password corrected to eggcelerate

User clarified the expected setup network password is **eggcelerate**. Updated
the main firmware constant and current setup/handoff notes, superseding the earlier
egg12345 choice. Existing verified NVS password migration preserves device ID,
pairing and router Wi-Fi. AP remains **Eggcelerate-001**, **http://10.10.10.10**.
Wildcard DNS, DHCP captive-portal hint and HTTP connectivity-probe redirects are
already implemented. Automatic prompt appearance depends on the client device;
manual URL remains available. Source change only; no board upload performed.
Phase work remains paused under the user's prior request.

### October 16 — continuous-heating timeout increased to 30 minutes

User explicitly requested increasing the latched continuous-heating timeout
from 10 to **30 minutes** after observing timeout during preparation warm-up.
Updated kHeaterLimitMs and the firmware fault text, plus current guides. The
39°C overheat and sensor-fault safeguards, fault latching and explicit reset/resume
behavior remain unchanged. Firmware upload is required to apply the new limit;
no existing fault was cleared and no equipment command was issued by the agent.

### October 16 — equipment warnings moved to Notifications

Controller faults now appear in the existing Notifications/Alerts feed with
guidance to stop the cycle or cancel preparation and inspect the chamber before
resetting and resuming. Delayed equipment reports, unsupported controller firmware,
unconfirmed commands, unexpected heater/mist operation and tray movement/level
warnings use the same feed. Active episodes suppress duplicate notifications;
recovery resolves them. Dashboard fetch/action failures also use notifications.
Removed inline warning prose while preserving reset, resume and stop controls.

API, hardware worker and web images rebuilt and installed locally; web typecheck,
targeted Python lint and image builds passed. No schema migration or firmware
upload is needed for this notification change. No fault reset, equipment command
or VPS deployment was performed. Phase work remains paused.

### October 16 — equipment action buttons rounded

Matched Reset controller fault, Resume regulation, Stop equipment, Return toward
level, Stop tray / pause turning and Save current position to the fully rounded
button style. Web build/typecheck passed; local dashboard updated. Equipment
behavior is unchanged.

### October 16 — daily progress checkpoint

- Dashboard refinements completed locally: mode selector placeholder shortened to
  **Mode**, healthy preparation regulation sentence removed, Cancel preparation
  moved to the right and fully rounded, and equipment/tray action buttons matched
  to the same rounded style.
- Equipment faults and related warnings now use Notifications/Alerts with
  stop/cancel-and-inspect guidance. Recovery controls remain available; active
  warning episodes suppress duplicates. API, MQTT worker and dashboard rebuilt
  and installed locally; HTTPS proxy reloaded. Startup logs show successful API
  requests and MQTT connection with no observed evaluator error. The current
  report had fault 0, so no live fault notification was triggered during review.
- Preparation notice sizing reviewed against current theme tokens: desktop title
  16px/body 14px/button label 14px; phone title 14px/body 12px/button label 12px.
  Cancel preparation uses the shared 36px default button height on both. Source
  conforms to these roles; mobile rendering was not visually verified today.
- Continuous-heating latch changed in firmware source from 10 to **30 minutes**;
  compile passed. This requires uploading the updated main sketch. The agent did
  not upload firmware or verify which revision is currently on the board.
- Web typecheck/build, targeted Python lint and diff whitespace checks passed.
  No additional physical motor timing tests, fault reset, equipment command or
  VPS deployment was performed.

**Resume state:** Phase 4 implementation is installed locally. Phase work remains
paused at the user's request; Phase 5 power/EN restart diagnosis is still open.
The reported inability to open **http://10.10.10.10** while connected to the AP
also remains unresolved pending device/network evidence. AP source
configuration is **Eggcelerate-001**, password **eggcelerate**, with captive-portal
support. Firmware still targets one MQTT broker at a time; simultaneous local and
VPS publishing is not implemented.

### October 16 — Delete incubator option

Added **Device Settings → Device & Connection → Delete incubator** for the
connected dashboard. A confirmation dialog requires the current incubator name
and explains that deletion permanently removes associated cycle history, candling
logs, readings and notifications. Successful deletion returns to the incubator
list and refreshes cached farm data. Buttons use fully rounded styling and shared
responsive typography.

The authenticated, CSRF-protected DELETE endpoint scopes removal to the current
farm and runs relational cleanup in one transaction under the farm lock. It
rejects active cycles/preparation, pending equipment or turn commands, active
control intent, and current-firmware equipment without a fresh all-off report.
Hardware provisioning remains available for pairing the same device again.
This feature does not send motor/heater commands or reset firmware credentials.

Six isolated PostgreSQL integration cases passed: confirmation, farm isolation,
deletion/re-pairing, preparation/active-cycle guards and fresh/off equipment
requirements. No existing user incubator was deleted. Phase work remains paused;
this is the separately requested dashboard addition.

Targeted frontend checks also passed (7 mobile-operation cases), along with web
typecheck, Python lint and API/web image builds. Removal testing included a stopped
cycle with history and candling/photo references, using a disposable database
that was removed afterward. No firmware upload or schema migration is required.
API/web installed locally, API healthy, HTTPS proxy reloaded and dashboard
responding successfully.

### October 17 — incubation-control audit: chicken targets, humidity and fans

Completed a read-only audit of the ESP32/DHT22 climate path, hardware records,
dashboard output reporting, the supplied October 16 graph, downloaded CSV and
local database records. No control-code changes, firmware upload, actuator
commands or physical qualification were performed. This audit does not resume
the separately paused implementation phases or establish the deployed firmware
revision.

**Conclusion: fan-speed control is not currently implemented in production.**
The ESP32 and selected MOSFET arrangement offer a possible route to adjustable
speed, but the installed fan/module combination has not been qualified for it.
Do not treat the fans as inherently ON/OFF-only or assume supply PWM will work.

#### Confirmed control path and configuration

- DHT22 GPIO4 is sampled every 2.5 seconds. Raw readings pass finite/range checks
  directly into the regulator; no smoothing or calibration correction is applied.
  The control task applies outputs approximately every 50 ms independently of
  cloud connectivity. See `apps/firmware/Eggcelerate/ClimateRuntime.h:206` and
  `ClimateControl.h:62`.
- Main outputs are Boolean (`ClimateControl.h:33`). `ClimateRuntime.h:28` writes
  heater GPIO27 and mist GPIO14 active-low, upper circulation fan GPIO18 and lower
  exhaust GPIO19 active-high. Production has no PWM attachment, frequency,
  resolution or intermediate duty; `applyOutputs()` uses `digitalWrite()`.
- Upper circulation stays commanded full on during regulation. Temperature
  cooling requests full exhaust. Humidity drying pulses exhaust 10 seconds on /
  20 off. Mist is limited to 3 seconds on / 20 off and inhibited during exhaust,
  drying demand and temperature cooling (`ClimateControl.h:147–176`).
- Chicken firmware targets are 37.5–37.8°C / 55–60% RH. Heat demand starts at
  <=37.5°C and clears at >=37.8°C; temperature cooling starts above 37.8°C and
  clears at <=37.65°C. Mist demand starts below 55% and clears at >=57.5%; drying
  starts above 60% and clears at <=57.5%. Humidity actuation requires at least
  37.0°C. Preparation and incubation use the same targets; no lockdown climate
  profile is implemented (`ClimateControl.h:11,109,148–173`).

#### Findings and pending remedies

| Severity | Finding / evidence | Practical impact and recommended next action |
| --- | --- | --- |
| High | Missing production duty calculation and PWM output: `ClimateControl.h:33,147–176`; `ClimateRuntime.h:28–40` | Only off/full-on commands exist. After hardware qualification, add numeric requested/applied duties, temperature/humidity arbitration and one PWM output owner with explicit fault overrides. |
| High | Hardware supply PWM unqualified; standalone bench has `kSupplyPwmConfirmed=false`, frequency 0, draft 8-bit resolution (`mosfet-bench/BenchConfig.h:14–20`) | Establish actual connector functions, MOSFET terminals/topology, common ground, polarity and reset behavior. Measure frequency compatibility, start/run duty, RPM, current and airflow. The recorded 7 V DC start rating is not a PWM minimum. |
| High | Old standalone MOSFET bench labels GPIO19 upper / GPIO18 lower, reversing current production (`mosfet-bench/BenchConfig.h:7`; `ClimateRuntime.h:12`) | Physically trace both channels and reconcile obsolete bench/document labels before qualification. Current authoritative mapping is upper GPIO18, lower GPIO19. |
| High | Full-power threshold heating/cooling lacks thermal-inertia compensation (`ClimateControl.h:150–169`) | Can contribute to overshoot and cycling. Measure thermal response and tune heater cutoff/exhaust demand together; the graph alone does not prove actuator causation. |
| High | No independently specified fresh-air minimum; humidity exhaust may run alongside heat (`ClimateControl.h:158–173`) | Qualify passive ventilation and loaded-chamber exchange. Define ventilation separately from temperature/RH correction and coordinate drying with heating. |
| High | One invalid reading latches a fault; running faults command both fans on indefinitely, without rotation feedback (`ClimateControl.h:62–76,129–145`) | Heat/mist shut down, but sensor-loss exhaust can sustain cooling. Define separate sensor-loss/overheat ventilation policies, verify circulation and independent heater protection. Explicit Stop intentionally overrides all fans off. |
| High | No stage-dependent climate targets; graph mode provenance incomplete (`ClimateControl.h:11,109`; API `database/climate_control.py:47`) | Preserve effective mode/targets/stage with each sample and implement an approved chicken stage profile before claiming full-cycle climate control. Stored dashboard hysteresis fields do not drive the compiled regulator. |
| Medium | Raw DHT22 control, no calibration/filtering; fixed fan lead proves elapsed time, not airflow (`ClimateControl.h:62,166`) | Verify egg-level temperature against a calibrated reference, spatial uniformity and sensor placement. Any filtering must preserve prompt raw overheat protection. |
| Medium | Dashboard reports Boolean commands, not measured fan operation (`database/incubators.py:128`; web `LiveMonitorTab.tsx:632`) | Existing freshness suppression is useful, but 15-second reporting/polling can miss short pulses. Add command timestamps, applied duty and feedback availability; distinguish command from observed operation. |
| High for diagnosis | Climate reports/requests overwrite latest state; historical samples/CSV lack actuator history (`database/climate_control.py:384`; `database/schema.py:495`; web `features/trends/raw-export.ts:9`) | Persist output transitions, control decisions, commands and boot/fault events to reconstruct causes. Current records cannot establish every heater/mist/fan action in the graph. |

#### October 16 graph: confirmed observations and limits

Evidence inspected: `/home/mawi/Downloads/raw-readings-7d.csv` (679 total rows of
readings) and local PostgreSQL telemetry, alerts and latest climate state. All
times below are Asia/Manila (UTC+8). The displayed 15:28–17:26 selection contains
383 readings beginning at 15:40:30. Temperature ranges from 35.2°C to 38.2°C;
289/383 samples are outside current chicken temperature targets and 102/383
outside chicken RH targets. These counts are not duration-weighted exposure.

- Sensor-failure alert recorded at 15:44:01; historical output transitions were
  not retained. The first temperature maximum of 38.2°C is at 15:50:02 (CSV line 320).
- A 191-second reading gap spans 16:24:17–16:27:28 (CSV lines 457–458), with
  stale/offline alerts. Latest reported boot time is 16:27:21; unexpected-operation
  and command-confirmation alerts followed. A restart is supported near this gap,
  but its cause and full output sequence are not established.
- From 16:27:28 to 16:42:30, temperature falls 36.7→35.2°C while RH rises
  57.0→61.4%. Rising relative humidity during cooling does not prove misting.
- A 236-second gap spans 16:42:30–16:46:26; readings change 35.2→38.0°C
  (CSV lines 514–515). The intervening trajectory is missing.
- Cooling begins around 17:00 and reaches about 35.6°C near 17:05. Heater loss,
  exhaust, door opening and other disturbances remain hypotheses without output
  history. The retained Stop was requested at 17:15:22 and acknowledged around
  17:15:27, so it cannot explain the earlier start of cooling.
- User identifies the graph as chicken mode, but screenshot targets are
  37.4–37.6°C / 55–60% RH, matching neither current complete preset. The last
  stored chamber assignment/report is Duck (mode 1), stopped with all outputs off
  and fault 0 at 17:27:41. This establishes only the final reported state; it does
  not prove which mode controlled the earlier graph. Log historical effective
  targets/mode before attributing the trace to chicken firmware behavior.

#### Required evidence and verification before implementing speed control

1. Confirm physical channel identity, circulation/exhaust direction, fan connector
   functions, switched supply wiring, MOSFET topology and default-off behavior.
   Measure GPIO and load waveforms, stable RPM/airflow across candidate duties,
   minimum reliable start/run duties and any required startup boost. Use a
   frequency supported by the measured fan/module combination; do not infer it
   from a generic fan symbol or the module's seller-stated 20 kHz ceiling.
2. Persist every 2.5-second sample and every output/command/fault transition:
   UTC sample/receipt time, monotonic time, boot/reset identity, firmware hash,
   sequence, raw/filtered T/RH, validity/sample age, mode/day/stage/effective
   targets, demand flags, inhibition reasons and timers, relay commands/on-time,
   requested/applied fan duty, GPIO/frequency/resolution/clamps/boost and available
   RPM/current/airflow feedback. Retain issued/accepted/rejected/expired/applied
   commands, ambient T/RH, door openings and power/manual interventions.
3. In supervised qualification, compare physical outputs with synchronized logs
   and dashboard status. Check startup/stall, temperature overshoot/cycling,
   humidity recovery, continuous circulation/fresh-air exchange, invalid/stale
   samples, faults, explicit Stop and power/crash restart behavior. Acceptance
   must use representative loading and egg-level reference measurements.

These are pending recommendations, not completed tests or authorization to flash,
energize equipment or deploy changes. The next climate implementation decision
should follow this evidence; the separate power/EN investigation remains open.

### October 18 — incubation-control improvement plan recorded

Created the [phased improvement plan](docs/guide/incubation-control-improvement-plan-2026-10-18.md)
from the October 17 audit, including implementation boundaries, dependencies,
fault/output priorities and measurable acceptance evidence. First slice is
firmware/configuration identity, effective targets and durable sample/output/
command history so the next graph can explain control behavior.

Fan qualification must establish the actual frequency, minimum start/run duties,
boost and airflow before automatic PWM is enabled, accounting for any existing
results supplied by the user. Wiring and unchanged pin allocation are already
user-confirmed verified; correct obsolete bench labels against that allocation.
Production changes then introduce one PWM output owner, coordinated
temperature/humidity/fresh-air demands and local stage profiles. Baseline required
ventilation must remain compatible with safe misting; circulation and exhaust
have distinct roles. Dashboard duty represents an electrical command unless
rotation/airflow feedback is actually present.

The plan includes representative loading, reference-sensor measurements,
fault/Stop/restart/offline checks, an initial 24-hour stability qualification and
rollback preparation. Exact tuning, PWM and stage parameters require measured
or approved evidence; full-cycle performance is not established by that soak.
Documentation only: no implementation, tests, firmware upload, actuator command
or deployment performed. Separate power/EN diagnosis remains open.

### October 18 — wiring verification accepted; fan questions narrowed

User confirms wiring is already verified and pin allocation has not changed.
The improvement plan now accepts this as established rather than requesting
repeat continuity or pin checks. Current mapping remains DHT22 GPIO4, heater
GPIO27/IN1, mist GPIO14/IN3, upper fan GPIO18 and lower fan GPIO19.

Asked about prior intermediate-speed results, actual circulation/exhaust roles,
installed fan/MOSFET models and any RPM feedback. Await those answers before
assuming PWM is untried, selecting speed parameters or finalizing the airflow
policy. Existing wiring confirmation alone does not establish those properties.

Follow-up: user believes current fan operation is ON/OFF only, consistent with
the production source audit. Intermediate-speed operation has not been
established. Keep PWM frequency, minimum reliable start/run duties and boost
undetermined; this does not establish an inherent ON/OFF hardware limitation.
Airflow roles, installed component identity and RPM feedback remain unanswered.

### October 18 — prior adjustable fan operation confirmed

User clarifies that adjusting fan power was previously tested and worked. This
supersedes the earlier uncertainty about basic adjustable operation. Accept the
installed arrangement's successful adjustment and verified unchanged wiring as
the starting point; no repeat basic compatibility test is required by the plan.

The production source still commands only ON/OFF. Focus the improvement on
integrating the working control method into production, recovering prior settings
where available, recording missing start/run limits and coordinating temperature,
humidity and airflow. Exact prior frequency/duty settings and feedback capability
have not been supplied. No hardware replacement is assumed or planned as a
prerequisite. Documentation updated; no control-code change or equipment action.

### October 18 — fan roles confirmed; chicken temperature references reviewed

User explicitly confirms upper fan GPIO18 faces the heater and circulates heat
inside the chamber; lower fan GPIO19 is the exhaust. Treat both roles as
established for the improvement plan. User also confirms the earlier successful
adjustment used an ESP32 PWM slider through the MOSFET. Current saved bench
settings do not retain that working frequency/duty configuration; this does not
negate the user's test result.

Researched the proposed chicken range 37–38°C around 37.5°C. This is ±0.5°C,
not ±5°C. It is not established as a universally advisable normal operating band.
[Brinsea's Mini Eco manual, section 5.6](https://www.brinsea.com/manuals/miniecous.pdf)
lists hens at 37.4–37.6°C.
[Mississippi State Extension](https://accessibility.extension.msstate.edu/agriculture/livestock/poultry/important-incubation-factors)
uses a different nominal value and states fluctuation guidance in Fahrenheit;
half a Fahrenheit degree converts to about 0.28°C. Do not misread that as 0.5°C.

The [improvement plan](docs/guide/incubation-control-improvement-plan-2026-10-18.md#chicken-temperature-reference-review--october-18)
proposes nominal 37.5°C with a reference regulation aim of 37.4–37.6°C, pending
calibrated egg-level performance and a later profile decision. Keep the desired
temperature, switching hysteresis, sensor accuracy, allowable excursions and
alarm/cutoff thresholds separate. Current chicken source remains 37.5–37.8°C
(midpoint 37.65°C). Documentation only; no control-code or target changes.

### October 18 — CPU chicken reference and display preference

User supplied [CPU Research Center for Philippine Native Chicken — Hatchery
Management](https://www.phlnativechicken.com/Hatchery-Management/) as their reference.
Its forced-draft temperature is 37.5–37.8°C, matching existing chicken firmware.
Use that source as the working reference in the plan rather than assuming the
earlier proposed 37.4–37.6°C alternative has been adopted.

Historical preference, superseded by the correction below: user wanted tight
actual control while displaying **37–38°C**. Record this as a
display preference; it does not authorize widening the regulator band or changing
readiness/alarms. Clarification remains whether this broader band is a simplified
label only or should also determine dashboard in-range status/colors. Preserve
precise effective targets in details/logs and decimal live readings. CPU does not
state the displayed 37–38°C band; do not attribute it to that source.

Updated planning documentation only. No firmware, dashboard code, target values,
mist settings, tray schedule or hardware outputs changed.

### October 18 — proceed with planning without validation

User explicitly requests proceeding without validation, retaining the earlier
planning-only/no-code-edits scope. The improvement plan now accepts the confirmed
setup without repeat wiring/PWM tests, reference-thermometer comparison, airflow
measurements or soak runs. Earlier validation checklists are deferred reference
material, not current prerequisites or claims that performance was measured.

Accepted setup: unchanged verified pins; upper fan faces the heater and circulates
heat; lower fan exhausts air; ESP32 PWM slider adjustment has worked. DHT22 is
above the egg tray near the rear intake side of the upper fan. User reports
food-delivery-bag-style insulation foam and similar upper/lower warmth by touch;
this is an observation, not a recorded thermometer comparison.

Initial future implementation slice: basic decision/output history, one PWM
output owner, full upper circulation and gradual lower-exhaust duty, startup
settings and existing Stop/fault priority. Keep internal chicken range
37.5–37.8°C based on CPU guidance and the latest correction uses the same range
on the display, in details and for status/readiness. Follow with
coordinated heater/mist/exhaust tuning and stage profiles. Sustained graph drops
near 35°C remain unexplained; PWM is not a proven cure.

No code changes, tests, validation runs, uploads, deployments or equipment actions
performed. Working PWM frequency/start/run settings remain parameters to recover
or select during implementation, not reasons to reopen basic compatibility or
block completion of the plan.

### October 18 — chicken display range correction

User withdraws the 37–38°C display proposal. The plan now uses **37.5–37.8°C
for both displayed chicken targets and internal control**, consistent with the
CPU reference. Updated active planning instructions and marked the earlier
display preference as historical. Planning-only scope and deferred validation
remain in effect. No firmware or dashboard code changed.

### October 18 — initial local climate PWM and control-history implementation

User requests starting optimization locally, superseding the planning-only scope.
Implemented the first source slice described in the
[local implementation guide](docs/guide/climate-pwm-local-implementation.md).
Prior instruction to proceed without validation remains in effect.

- Upper circulation GPIO18 remains full command; lower exhaust GPIO19 now has
  one LEDC output owner. Chicken requests variable duty from temperature or RH
  demand within the existing interlocks/pulse envelope. Duck/Quail retain their
  full-command policy. Explicit Stop/released demand bypass ramping to zero;
  faults/cooldown request full command. Heater/mist thresholds, chicken range
  37.5–37.8°C, mist pulse/rest and tray behavior are unchanged in this slice.
- Initial settings live in `FanConfig.h`: 1 kHz / 8-bit, 50% nonzero floor,
  100% startup for 1 second, 5%-point steps each 500 ms. These are explicit
  engineering defaults, not measured/recovered values from the successful slider.
  LEDC setup/write failure latches fault 7 and inhibits heat/mist. A failed PWM
  path falls back to digital full/off for fault/Stop handling; reset requires a
  successful restart if PWM remains unavailable.
- Reports include effective targets, build marker, sample age, control sequence,
  requested/applied duty, reason and PWM configuration. Serial logs sample/output
  changes; MQTT prioritizes changed snapshots at no more than 1 Hz. There is no
  durable offline event queue; intermediate states may be coalesced.
- API/worker accept the optional fields and fault 7. Migration **0024** adds
  durable received-report history with environmental context and a farm-scoped,
  bounded history endpoint. Readiness now expects 0024. Live Monitor shows
  commanded duty with legacy Boolean fallback and existing freshness handling.

Source changes only: no tests, firmware compile/upload, database migration,
container build/restart, hardware commands or VPS action performed. Existing
unrelated notification/auth UI edits were preserved. Current services and board
therefore still run their earlier revisions. Rollout must migrate/update API and
worker before the new firmware; the old strict report parser rejects new fields.
History retention cleanup, full event queue/export/UI, heater-inertia tuning,
stage profiles and the separate power/EN/LAN issues remain open. PWM alone is not
a confirmed explanation or fix for the sustained graph cooling.

### October 18 — local optimization builds completed

User requested building the initial PWM/control-history implementation. Local
Docker builds succeeded for API, hardware telemetry worker and web using the
existing `hardware-local-compose.sh` configuration. Dashboard TypeScript
compilation passed. Firmware compiled successfully with NodeMCU-32S and installed
ESP32 core 3.3.11: **1,141,204 bytes flash (87%), 52,236 bytes RAM (15%)**.
Used the Arduino CLI bundled in the installed IDE, extracted to a temporary
build-tools directory; no global toolchain installation was needed.

Private firmware output: `output/firmware/climate-pwm/`. Do not publish embedded
connection configuration. No tests, physical validation, firmware upload,
database migration, container restart or hardware command performed. Existing
running services still use their earlier images; schema 0024 and updated
API/worker installation remain necessary before activating new report fields.
No VPS changes. Build success does not establish fan/thermal performance.

### October 18 — pre-migration local database backup saved

User requested backing up the existing PostgreSQL database before local
installation. Saved a full custom-format dump from `egg-hardware-local-db-1`
to private `output/backups/pre-climate-0024-20261018-181426/eggcelerate.dump`
(94,338 bytes, owner-only permissions). Schema remains **0023**; recorded raw
telemetry count is 679. Persistent volume is
`egg-hardware-local_eggcelerate-db` and was preserved.

Archive listing parsed successfully with the container's `pg_restore --list`;
checksum, dump log and manifest are beside the dump. `pg_dump` recorded a
TimescaleDB `continuous_agg` circular-dependency warning; no restore rehearsal
was performed, so restoration is not claimed verified. No migrations, service
restart, hardware commands or VPS action performed.

PostgreSQL access uses the existing wrapper:
`sh ./hardware-local-compose.sh exec db psql -U eggcelerate -d eggcelerate`.
The DB currently exposes no host port; container access works without changing
the network configuration or printing credentials.

### October 18 — migration 0024 and local API/dashboard installed

User authorized installing the built local changes after the database backup.
Applied Alembic migration **0023 → 0024** using the built API image. Confirmed
`climate_report_history` exists. Recreated API/web from built images without
starting dependencies, then reloaded the existing HTTPS proxy.

API/web are healthy; **https://127.0.0.1:18443** returns HTTP 200 and proxied
readiness reports database up. Existing raw telemetry remains **679 readings**;
control history has zero records because no new hardware reports are being
received. The named database volume and pre-migration dump remain preserved.

Broker and telemetry worker remain stopped/Created with their earlier container
configuration, pending the known MQTT address/certificate/firmware endpoint
mismatch. No new equipment commands, worker activation, firmware upload,
physical validation, test suite or VPS changes performed. Next hardware step is
reconciling the local MQTT endpoint and installing the new worker before the new
firmware can publish its additional report fields.

### October 18 — VPS destination and local frontend preview prepared

User selects the existing VPS as the incubator's stable server because the home
computer will not move. The AP configures router Wi-Fi only; a hardcoded local
broker IP previously prevented connectivity after moving to school. Treat that
network destination issue separately from climate-control performance.

Implemented **pnpm dev:vps**, running Vite HTTPS on **127.0.0.1:5174** with hot
frontend updates and `/api` proxying to **https://4.193.224.4**. Uses the existing
private local TLS certificate, verifies upstream TLS and preserves session/CSRF
authentication. Checks local request Origin before forwarding the permitted VPS
Origin. A separate `egg_vps_dev_session` cookie avoids overwriting or forwarding
the existing local Docker session. This preview uses real VPS farm data/actions;
local Docker accounts/history remain separate.

Main firmware now selects private `CloudConfig.h` (VPS **4.193.224.4:8883**) by
default. Private `LocalCloudConfig.h` is used only with explicit
`EGG_USE_LOCAL_RECORDER`; its presence no longer silently redirects the board to
a LAN IP. Existing credentials, Wi-Fi NVS and device identity were preserved.
VPS-targeted NodeMCU-32S/core 3.3.11 compile passed: **1,141,172 bytes flash (87%),
52,236 bytes RAM (15%)**. Private output: `output/firmware/climate-pwm-vps/`.

Local preview returns HTTP 200; proxied readiness and unauthenticated session
reads succeeded. Dashboard TypeScript compilation passed. VPS MQTT port 8883
completed a TLS handshake with certificate/IP verification using the project CA.
Full user login and physical behavior were not exercised; no test suite, farm
mutation, hardware command, VPS deployment or firmware upload performed.

Remote API/worker revision and migration still need review/update before this
new PWM firmware is uploaded, because of added report fields/fault 7. Asked for
the VPS SSH username; saved project key is available, username is not recorded.
Prepare VPS source/database rollback backup before remote migration/deployment.
Do not mistake the local schema-0024 installation or live frontend proxy for a
VPS backend upgrade. See the linked guide for start/login/activation details.

### October 18 — VPS backup, migration and matching application release installed

User supplied SSH username **eggcelerate**, completing access needed for the
approved VPS connection workflow. Inspected the live snapshot at
`/opt/eggcelerate/hardware-pilot-20261011`: schema 0019, 561 readings, one stopped
cycle, no active preparation, and October 12 application images. No device run
was started to obtain deployment evidence.

Saved private pre-update database/source backups in
`/opt/eggcelerate/rollback-climate-pwm-20261018-FgXdgv/`: full custom DB dump
(85,532 bytes), source/configuration archive (4,228,999 bytes), container metadata,
archive listing, checksums and schema/readings record. Dump listing parsed;
TimescaleDB reported a `continuous_agg` circular-dependency warning. No restore
rehearsal or restored-data guarantee is claimed. Original image tags are retained.

Transferred checksummed source and matching locally built images tagged
`eggcelerate-api:climate-pwm-20261018` and
`eggcelerate-web:climate-pwm-20261018`. Preserved private environment, broker,
certificates, enrollment, database volume and existing HTTPS/ACME stage routing.
Added a release overlay and updated the existing wrapper to include it. Stopped
the old worker during schema migration, applied **0019 → 0024**, installed API/web,
reloaded HTTPS, then installed/started the new worker. Climate control is enabled
consistently on API/worker; tray control remains disabled.

API/web are healthy and **https://4.193.224.4** returns HTTP 200 with database-ready
status. Worker logs confirm MQTT connection in `hardware-climate-control` mode.
Existing readings remain **561**, the cycle remains stopped, control history is
empty and pending climate requests are **zero**. The local VPS frontend proxy
also reaches the updated readiness endpoint. Existing accounts were not copied,
reset or recreated, and the local 679-reading database remains separate.

No test suite, physical validation, user-login exercise, firmware upload or new
equipment command was performed. Next step: upload the compiled VPS-targeted
ESP32 firmware locally with flash erasure disabled. Server now accepts its new
duty/history fields and fault 7. Old API images require schema 0019; image-only
rollback is not sufficient after this migration, so preserve new data and use
the recorded schema/source backup plan if reverting.

### October 18 — persistent ESP32 offline recording plan prepared

User requested a plan for saving readings while disconnected and uploading them
when connectivity returns. Saved the
[offline storage and recovery plan](docs/guide/esp32-offline-storage-plan-2026-10-18.md)
and linked it from the guide index. This remains proposed work, not an installed
fallback. Existing firmware continues local regulation but has no durable
temperature/humidity upload queue.

Proposed first release: capture every 15 seconds into bounded flash storage,
target 48 hours within a 1 MiB queue budget subject to actual partition/record
size, and flush every 60 seconds or four records. Only committed flash records
are intended to survive power loss; recent RAM records may be lost. Preserve
credentials/run state and existing application partitions; never auto-format on
storage failure. Detailed actuator transition recording follows separately.

Plan phases cover stable record IDs and honest clock quality, assignment-safe
ownership, bounded journal recovery, dedicated historical ingestion, database
commit receipts, deduplicated background replay, and visible queue/loss status.
Current raw storage already permits late readings; replay still needs a separate
handler so old data cannot affect live freshness, preparation or control.
Server support precedes opt-in firmware and dashboard rollout. Acceptance checks
are documented for future implementation; physical validation remains deferred.

Planning/documentation only: no firmware/API/UI code edits, tests, firmware
upload, equipment command, local service change or VPS deployment in this step.

### October 18 — offline environmental history implementation and server rollout

Implemented the [offline storage plan](docs/guide/esp32-offline-storage-plan-2026-10-18.md)
in source. The [activation/recovery guide](docs/guide/esp32-offline-storage-implementation.md)
records the wire contract and limitations. Firmware adds a separate storage task,
64-byte CRC records every 15 seconds, four-record/60-second flush, alternating
metadata, reserved sequence IDs, clock anchors and bounded committed-receipt
replay. Capacity is 96 × 124 records (49 h 36 min at normal cadence before
partially filled segments and storage constraints). A full queue cancels an
obsolete in-flight batch before eviction; stale receipts cannot delete newer data.
Storage readiness does not gate live sensor timestamps or local regulation.

Server migration **0025** adds assignment generations, a replay journal,
quarantine/conflicts and recording status. Historical ingestion bypasses live
freshness, preparation/control, and current alert evaluation. Valid record IDs
with malformed measurement fields are retained individually for review. The
Monitor tab reports recording/queue/loss status; charts label historical uploads.
Existing user changes were preserved. Release builds used the previously deployed
public source plus an explicit 17-file offline-change overlay, so unrelated local
notification/authentication work was not included in this server rollout.

VPS backup: `/opt/eggcelerate/rollback-offline-storage-20261018-wUelsG/`, including
an 89,972-byte custom database dump and source/configuration archive. The archive
also contains older release files, making it larger than the previous backup.
Dump listing parsed; restore rehearsal is not claimed. Migrated **0024 → 0025**;
API/worker use `eggcelerate-api:offline-storage-20261018-r2`, web uses
`eggcelerate-web:offline-storage-20261018`. Existing 561 readings and stopped cycle
were preserved. Verified TLS readiness and HTTP 401 for the protected recording
endpoint; MQTT worker connected. `OFFLINE_REPLAY_ENABLED=false` is the worker
kill switch for replay without disabling live telemetry.

Software evidence: 25 selected PostgreSQL/MQTT/readings tests and 18 selected
frontend/transport/trend tests passed. Host C++ storage harness passed with
address/undefined-behavior sanitizers, covering restart, interrupted append and
metadata, committed ACK, overflow and stale receipts. An actual C++-serialized
packet passed Python SHA256/schema validation. Broader frontend readings-scale
checks exposed an existing CSV-header expectation for `Water OK`; current and
Git HEAD export code both omit that column. That unrelated assertion was not
changed. TypeScript, targeted Ruff and offline-module mypy checks passed.

User confirmed the incubator is **empty and stopped** for installation. Detected
ESP32-D0WD-V3, revision 3.1, 4 MiB flash on `/dev/ttyUSB0`. Initial long flash reads
were interrupted by serial errors; no firmware was overwritten. Switched to
resumable chunk reads with blank-region checks and a final full-chip comparison.
Read the actual partition table: it matches default NodeMCU-32S, including NVS,
two 1,310,720-byte application slots, and the 1,441,792-byte data region. Device
backup completion, safe filesystem initialization, firmware upload and actual
recording/receipt confirmation remain pending at this checkpoint. No actuator
command or physical acceptance test was performed.

### October 18 — offline storage installed and real reconnect replay confirmed

Completed the first offline environmental-history release. The ESP32 full
**4,194,304-byte flash backup passed a comparison against the chip** before upload.
The extracted 1,441,792-byte data region was an existing empty LittleFS filesystem
(confirmed with the listing tool); initialization created the queue without
formatting. Compiled and actual partition tables match. Uploaded at 115200 baud
with flash erasure disabled; esptool verified the written data. Final firmware:
**1,212,204 bytes flash (92%), 61,412 bytes static RAM (18%)**. Private binary and
source/artifact hashes: `output/firmware/offline-storage-vps/`.

Device initially remained offline and reported invalid DHT22 samples; it saved
explicit invalid/untimed records instead of fabricated values. DHT22 subsequently
returned valid readings. Observed committed queue recovery across Serial resets,
with zero reported drops/corruption. User configured home Wi-Fi through the setup
portal. The device then connected via verified TLS, obtained its assignment,
received PostgreSQL receipts, and drained the saved queue **23 → 8 → 0**. New
assigned historical captures imported successfully alongside live readings.

VPS evidence: all **561 original readings** remain; replay IDs are unique; marker
`climate-pwm-offline-v1` is reported; recording is `ready`, pending climate
requests zero, the cycle stopped and all actuator outputs off. **26 initial
records** captured before the first confirmed assignment were durably retained in
assignment quarantine, not silently attached to the current farm/chart. No
incubation or actuator activation was requested.

Final code verification remains 25 selected backend tests, 18 selected frontend
checks and the sanitizer-backed C++ recovery harness, plus cross-language packet
validation. Actual reconnect/committed-receipt behavior is now observed, not only
simulated. Power-cut/endurance, calibration and physical actuator acceptance
remain deferred as requested. Detailed actuator-event persistence remains the
subsequent release identified in the plan.

Full private VPS backup mirror completed and checksums matched:
`output/backups/vps-pre-offline-0025-20261018/`. Remote source/configuration backup
is 791,629,607 bytes (includes earlier release archives); DB dump 89,972 bytes.
ESP32 backup/logs are in `output/backups/pre-offline-storage-20261018-esp32/`.
The Serial observer was stopped before handoff; no future timed Serial close was
left running. Current activation and limitations are documented in the linked
implementation guide.


### 2026-10-18 — Settings password change and shared pairing rollout

- User clarified password scope: authenticated Settings → Farm & Account →
  Change password, requiring current/new/confirmation fields. No Forgot password
  or email recovery feature is requested.
- Implemented atomic password update and revocation of all sessions, current
  password verification, separate account/source request limits, CSRF/origin
  checks, and login/password-change concurrency locking.
- Included the existing interim same-code shared incubator pairing flow in the
  VPS release: farm-wide owner membership, no approval, reuse existing incubator,
  and most recently joined farm selected at sign-in.
- VPS database/config/source backup mirrored locally with matching hashes.
- Production builds and static checks passed; functional acceptance checks are
  not yet run. API and web are deployed and healthy on the VPS; public HTTPS
  readiness and deployed image/source identities were checked. MQTT worker and
  ESP32 were unchanged. See
  [last-minute changes](docs/guide/last-minute-change.md) for release details.

### 2026-10-18 — Live Monitor display cleanup

- Removed the equipment pause/resume panel and local-recording diagnostic panel
  from Chamber status at the user's request. Status tiles remain visible.
- This changes only the displayed panels; firmware regulation, local recording,
  and backend endpoints are unchanged.
- Web release: `eggcelerate-web:monitor-cleanup-20261018`. TypeScript and the
  production build passed; no functional tests were run.

### 2026-10-18 — Fan status wording

- Live Monitor upper circulation and lower exhaust fan tiles display only On or
  Off from reported output states, at the user's request. Duty percentages and
  “commanded” wording were removed from these tiles; PWM control is unchanged.
- Web release: `eggcelerate-web:fan-status-labels-20261018`. Production build and
  TypeScript check passed. No functional tests were run.

### 2026-10-18 — Inspection notice wrapping

- Added `text-wrap: pretty` to the empty inspection notice description to reduce
  isolated final words while preserving natural responsive wrapping and copy.
- Web release: `eggcelerate-web:inspection-wrap-20261018`. Production build and
  TypeScript check passed; no functional or visual tests were run. Browsers
  without support retain normal wrapping.

### 2026-10-18 — Rename chamber

- Added Chamber name and Save name in chamber Settings → Device & connection.
- Reuses the authenticated profile update endpoint and existing shared farm
  record. Names are trimmed, required, and limited to 30 characters; saving,
  error feedback, and a character counter are shown.
- Web release: `eggcelerate-web:chamber-rename-20261018`. Production build and
  TypeScript check passed.
  No functional tests were run for this change.

### 2026-10-18 — Combined preparation banner

- Merged the separate Preparation card into the top chamber preparation banner.
- Banner shows current waiting/stability/readiness state and species targets;
  Change mode, Cancel preparation, and Load eggs (when ready) stay available.
- Moved the one-minute stability, sensor-gap, automatic regulation and device
  confirmation explanation into expandable How readiness is checked details.
- Readiness rules and controller behavior are unchanged. Web release:
  `eggcelerate-web:preparation-banner-20261018`. No functional or visual tests
  were run for this layout change.

### 2026-10-18 — Custom From/To environmental trends

- Added From/To date-time controls with Apply beside the existing presets.
- Uses browser-local time with an explicit time-zone label, UTC transport,
  inclusive From/exclusive To, and validation of ordering and future dates.
- Added server-side bounded chart and raw-preview filtering; chamber comparison
  and raw CSV use the same selected dates. Historical exports include offline
  readings already uploaded by preview time with a fixed receipt cutoff.
- Existing presets, farm authorization, chart point limit and readiness logic
  are preserved. No schema migration or ESP32 update is required.
- VPS API and web deployed and healthy; public HTTPS readiness and image/source
  identities checked. Database/config/source backup mirrored locally. Production
  builds and static checks passed; functional/visual checks were not run.
  See [custom trend dates](docs/guide/custom-trends-date-range.md).

### 2026-10-18 — Date controls and banner typography alignment

- Removed local 44px minimum-height overrides from custom trend inputs and Apply.
  The secondary date controls now use the shared compact role (32px desktop,
  matching the shared small action's 36px mobile tier) and an outline Apply
  utility action. Existing preset chips retain their shared FilterBar sizing.
- Bounded custom-control width, matched white toolbar surfaces and 13px semantic
  control typography, and added a Quick range label to align group labels.
- Corrected chamber banner hierarchy: 16px bold heading, 12px caption, 13px
  semibold targets, 13px disclosure with 12px detail text. All use semantic tokens
  and the configured responsive scale. Shared banner styles also apply to the
  completion-state banners. Preparation actions use the 40px toolbar role.
- Release: `eggcelerate-web:control-polish-20261018`. Production build and
  TypeScript check passed. Functional and visual browser tests were not run.
  Filtering, readiness and controller behavior are unchanged.

### 2026-10-18 — Date-range helper cleanup

- Removed the persistent timezone/range helper sentence beneath From/To and
  its input description references at the user's request. Automatic browser
  timezone conversion, date validation, and Apply behavior are unchanged.
- Web release: `eggcelerate-web:date-helper-cleanup-20261018`.

### 2026-10-18 — Trends range row alignment

- Vertically centered the preset range group with the From/To control group.
- Web release: `eggcelerate-web:range-alignment-20261018`; filtering behavior is
  unchanged. No functional or visual browser tests were run.

### 2026-10-18 — Trends range palette

- Applied approved semantic colors to the range controls: soft rust selected
  preset and Apply action, darker rust text, quiet warm group surface, white
  date fields, warm input borders, and brown secondary labels.
- Added an opt-in brand tone to the shared FilterBar and enabled it only on the
  environmental time-horizon presets. Default filter styling is unchanged.
- Web release: `eggcelerate-web:range-palette-20261018`; sizes and filtering
  behavior are unchanged. No functional or visual browser tests were run.

### 2026-10-18 — Date field palette

- Applied the existing cream surface-muted background and brown text-secondary
  to From/To fields, with warm input-border and rust focus border/ring tokens.
- Compact sizing and native date/time behavior are unchanged. Web release:
  `eggcelerate-web:date-field-palette-20261018`. No functional or visual browser
  tests were run for this styling change.

### 2026-10-18 — Farmer-friendly preparation wording

- Changed the waiting banner to “Preparing the incubator for target conditions”.
- Removed middle-dot separators from preparation headings. Other states use
  “Waiting for new sensor readings” and “Checking that the conditions stay
  within range”. Use plain sentences for farmer-facing status messages.
- Web release: `eggcelerate-web:farmer-preparation-copy-20261018`. Local TypeScript
  check passed; production image built on the VPS to avoid the full local disk.
  No functional or visual browser tests were run. Readiness logic is unchanged.

### 2026-10-18 — Environmental chart footer cleanup

- Removed the chart-reading explanation below the environmental trend chart at
  the user's request, and removed its dangling accessibility description ID.
- Web release: `eggcelerate-web:chart-note-cleanup-20261018`. TypeScript check
  passed. No functional or visual browser tests were run; chart data is unchanged.

### 2026-10-18 — Automatic incubation run history

- Added Trends → Incubation History with chamber, mode, and status filters,
  ongoing/preparation-only runs, pagination, and View trends for a specific run.
- Preparation creates a durable run automatically; starting incubation extends
  that same run. Cancellation, mode replacement, stopping and completion retain
  the record with saved mode/target values and timestamps.
- Run-scoped temperature/humidity charts and raw CSV use server-validated farm,
  device and observation bounds, including preparation and late offline uploads.
- Additive schema 0026; one-time import labels legacy time/target precision as
  approximate. Cancelled preparation before this feature cannot be recovered.
- VPS schema 0026 and API/web release are active and healthy. Current preparation
  and an earlier stopped cycle were captured; sensor uploads remained active.
  Database/config/source backup and a compatible prior-application rollback image
  are saved. ESP32 and MQTT worker remain unchanged. Production builds and static
  checks passed; functional/browser tests were not run.
- See [incubation run history](docs/guide/incubation-run-history.md).

### 2026-10-19 — Local climate diagnostic logging before adaptive control

- User completed the firmware/configuration backup. Implemented the next logging
  step locally; no VPS deployment, flashing, or actuator commands were performed.
- Added raw sample slopes, demand latches and timing observations without changing
  thresholds, relay decisions, PWM settings or safety behavior.
- Control-loop events use a nonblocking queue and bounded CRC-protected LittleFS
  journal written by the existing storage task. Added serial export and an offline
  decoder; counters expose queue/write loss and journal rotation.
- Added an optional backend diagnostic report schema using existing JSONB history.
  Both API and telemetry worker must accept this schema before firmware installation.
  Full journal replay to the VPS is not part of this step.
- Closed reservoir confirmed by user; passive evaporation is an unconfirmed
  hypothesis, not an established cause. Prior audit corrected accordingly.
- Next: review diagnostic/device qualification, then implement anticipatory heating,
  coordinated adaptive drying/misting, and fan boost/ramp tuning in Chicken mode.
- See [control diagnostics](docs/guide/control-diagnostics.md). Device persistence,
  control timing, queue/rotation fault cases and functional tests remain outstanding.

### 2026-10-19 — Local coordinated adaptive Chicken control

- Added bounded, smoothed trend forecasts for early heater cutoff and cooling
  release; retained raw safety checks and existing relay-off/circulation timing.
- Humidity exhaust speed and duration adapt to error, trend and bounded drying
  effort, with thermal permission to pause drying before temperature falls low.
- Mist pulses/rests adapt to predicted deficit within the existing maximum pulse
  and minimum rest bounds. Upper circulation remains continuous during regulation.
- Chicken targets unchanged; Duck/Quail decisions remain unchanged. Settings are
  provisional, not physically qualified or automatically learned parameters.
- Local compilation/static checks only; no tests, flashing or VPS deployment.
  Next: empty-chamber response/physical qualification and monitored tuning.
- See [adaptive climate control](docs/guide/adaptive-climate-control.md).

### 2026-10-19 — Adaptive firmware installation and stopped-state verification

- Local checks: 16 control scenarios, 6 backend tests, 4 decoder tests and offline
  storage host harness passed. Seven database integration tests skipped.
- Deployed optional diagnostic schema to VPS API and telemetry worker with module,
  wrapper/image and database rollback backup; no schema migration required.
- Fixed a loopTask/TLS stack overflow exposed during first installation by moving
  network-only buffers to static storage. Corrected application upload hash verified
  after a serial-transfer retry; settings and environmental recording preserved.
- Cloud confirms new build and active local journal with no reported loss/errors.
  All actuators stopped. DHT22 readings are currently invalid; reset fault remains
  latched, so no preparation run was started. Normal power connection check pending.
- Resolve readings/reset first; select Chicken for the adaptive empty-chamber trial.
  Device is not yet qualified for sustained joint target compliance.

### 2026-10-19 — Local temperature/humidity optimization candidate v2

- Added predictive proportional/integral relay heat demand with anti-windup,
  20-second windows, 5-second minimum normal ON/OFF, and one start per window.
- Added temperature-compensated moisture decisions, sustained thermally derated
  drying, ineffective-drying backoff, and bounded mist response learning.
- Chicken targets unchanged; upper circulation and raw safety/fault gates retained.
- 21 control checks and 4 decoder checks passed; ten paired synthetic chamber
  scenarios show improved feasible-case target coverage, with remaining excursions
  and an intentionally unreachable humid-intake case recorded explicitly.
- Compile passed (93% flash, 20% static RAM). V2 remains local: no flashing, VPS
  change or physical run. Higher relay switching is a material qualification item
  before installation; tuning values are not measured chamber response parameters.
- See [optimization v2](docs/guide/climate-optimization-v2.md).

### 2026-10-19 — Sensor reliability phase 1 (local v3)

- Implemented immediate heater/mist hold on an invalid sensor attempt, retaining
  last-good values/time separately and requiring two consecutive valid readings
  before automatic continuation within a fixed six-second recovery window.
- Sustained failures and stale streams still latch; late arrivals cannot mask
  expired deadlines. Explicit Stop and serious faults cannot auto-resume.
- Added fault-injection coverage for all modes, deadlines, mist interruption,
  serious faults and millisecond rollover; adaptive regression checks passed.
- Local build only; no flashing or VPS changes. Full-exhaust latched-fault policy
  remains phase 2. See [sensor recovery phase 1](docs/guide/sensor-recovery-phase1.md).

### 2026-10-19 — Fault ventilation phase 2 (local v4)

- Replaced unconditional full exhaust during faults with fresh-temperature
  hysteresis and bounded last-known-hot cooling (60-second evidence age).
- Confirmed >=39°C overheat retains emergency exhaust until two fresh readings
  confirm cooling. PWM output failure no longer requests unavailable exhaust.
- Heater/mist stay off, faults stay latched and explicit Stop remains all-off.
- Added coverage for all modes, cold/hot/stale data, timeout boundaries, overheat
  precedence, Stop and rollover. Includes phase 1 sensor recovery; no normal
  humidity/temperature tuning changes, flashing or VPS deployment.
- See [fault ventilation phase 2](docs/guide/fault-ventilation-phase2.md).

### 2026-10-19 — Sensor-health diagnostics phase 3 (local v5)

- Added acquisition/recovery counters, last-good values/age, recovery-hold flag,
  fault/failure/recovery timestamps and ESP reset reason to local/cloud diagnostics.
- Version 2 journal records retain actuator context; dump/decoder support v1/v2,
  and version changes rotate safely before appending. Retention remains bounded.
- Added backward-compatible optional backend sensor-health schema and journal-v2
  acceptance. Deploy to both API and worker before installing v5; no DB migration.
- Sensor/journal fault-injection checks, seven decoder tests, ten API schema tests,
  phase 1/2 regressions and 21 adaptive scenarios pass; firmware compile succeeds.
- Local artifacts only. No VPS deployment, flashing or physical trial. Next is the
  compatible deployment and empty-chamber run needed to assess joint humidity /
  temperature behavior. See [phase 3](docs/guide/sensor-health-diagnostics-phase3.md).

### 2026-10-19 — V5 VPS rollout and application installation

- Backed up VPS module/wrapper, service image references and PostgreSQL custom dump;
  deployed the optional sensor-health schema to API and telemetry worker. Actual
  new firmware JSON and old report compatibility checked in both derived images.
- Confirmed old v2 uploads continued; HTTPS readiness healthy after service update.
- Backed up the installed application privately. First 460800-baud read failed;
  retry at 115200 succeeded. V5 application-only flash completed and hash verified,
  preserving settings, NVS and LittleFS. No Wi-Fi reprovisioning or FS erasure.
- Boot sensor valid, explicit Stop retained. Cleared the stored sensor fault only
  after valid readings; fault 0, all actuators off. No firmware crash observed.
- VPS stored six v5 reports by uptime 44s. Journal version 2 available with 21
  records, zero drops/write failures and the expected version-change rotation.
- Empty-chamber regulation trial remains pending. Initial stopped readings about
  33.1°C / 77.7% RH do not establish target compliance. See phase 3 guide and
  `output/releases/sensor-diagnostics-v5-20261019/installation.json`.

### 2026-10-19 — Revised humidity plan, coordinated-drying v6 candidate

- Saved extended mixed-mode v5 cloud baseline; isolated ~24.5 minutes of Chicken
  preparation and exported 727 local journal records before changes.
- Added internal heat/drying diagnostics, compatible journal v3/decoder/API model,
  qualified post-warm-up drying reviews and retained review evidence.
- Added bounded heater feed-forward during exhaust, shared prediction guards,
  thermally limited 50–100% drying and empty-preparation-only timed 60/100% trials.
- Software checks pass; synthetic outcomes are mixed, so physical improvement is
  not claimed. Live comparison and joint target qualification remain required.
- See [coordinated drying v6](docs/guide/coordinated-drying-v6.md) and release
  evidence under `output/releases/coordinated-drying-v6-20261019/`.

### 2026-10-19 — V6 installed; live qualification pending

- API/worker adaptive schema deployed with module/wrapper/image/database rollback
  backup; old and new reports accepted, HTTPS readiness healthy.
- V6 application hash verified on flash; previous installed v5 artifact retained
  privately for rollback. NVS/LittleFS preserved. Boot cloud check: fault 0, sensor
  valid, all outputs off; journal v3 available, no drops/write failures.
- Serial trial monitor opened before user start to avoid a mid-run USB reset.
  User was asked to begin empty Chicken preparation; fixed-duty requests wait
  for stability and retain safety overrides. This is not yet a completed trial.
- Installation evidence: `output/releases/coordinated-drying-v6-20261019/installation.json`.

### 2026-10-19 — Tray dispatch repair and bounded cancellation return

- Confirmed VPS tray control disabled in both services; last manual turn timed out
  with zero attempts and no controller ACK. Enabled API + worker dispatch with
  backups; existing position/healthy-incubation gates remain mandatory.
- Added v7 atomic cycle-cancel stop plus bounded return only from an established
  stationary side. Ordinary Stop stays all-off; unknown/interrupted/rebooted or
  unhealthy position cannot authorize motion. Owner confirmed current tray flat.
- Added matched-cancel acknowledgment handling, paused old requests and independent
  motion IDs. Timed completion remains estimated, never verified home.
- Targeted backend/firmware tests and UI typecheck pass; original v6 climate changes
  retained. Physical tray movement and the Chicken humidity comparison remain
  pending owner interaction; do not mark joint control qualified.
- See [tray turning guide](docs/guide/tray-turning-guide.md).

### 2026-10-19 — V7 stopped-state verification; owner-flow test pending

- V7 flash hash verified; NVS/LittleFS retained, source hashes match release.
  Cloud confirms cancellation capability, sensor valid, fault 0, all actuators off.
- API/worker tray flags and targeted module hashes verified; latest backend images
  `tray-return-v7-r2-20261019`. Public readiness and cached-script delivery healthy.
- Targeted status-message web image preserves the previously deployed frontend;
  no unrelated working-tree UI changes were deployed.
- Latest cycle state is Ready/prior cycle stopped. Tray physical test cannot run
  there by design; still requires healthy active incubation and observed reference.
- Reopened the climate monitor before user begins Chicken preparation. The v7
  bounded exhaust comparison and joint-target outcome remain pending actual start.
