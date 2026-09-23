# Project review and phase-by-phase execution plan — 2026-09-23

**Review session:** independent code review of the current working tree, run after the
Phase 4/5 handoffs were written. **Base:** `experiment` @ `e391a1e`, 61 uncommitted
entries (44 modified, 17 untracked) containing refinement Phase 4 (durable device
commands, migration `0008`) and Phase 5 (telemetry projection/freshness, migration
`0009`). Sibling repository `eggcelerate-simulate` @ `e112a25` with 4 modified files.

**Execution status (updated 2026-09-24):** Phases 0–8 are complete; Phase 9's code and
disposable-environment verification are in place, but its release gates remain open.
Phase 9 closes production self-registration, adds email-keyed login throttling and
operator-provisioned device routing, and configures the local simulator API to require
sessions. Database restore, migration, and software gates have now passed. Phase 8's
implementation checkpoint is `0709075` (`feat: add farm-scoped account sessions`); its
verification record is in the [Phase 8 handoff](project-review-handoff-2026-09-23-phase8.md).
Phase 9's in-progress implementation checkpoint is `4c5c095`
(`feat: harden owner and device onboarding`); its current limits and evidence are in the
[Phase 9 progress checkpoint](project-review-handoff-2026-09-24-phase9-progress.md).
Phase 7's implementation checkpoint is `8d5252b` (`fix: make dashboard states truthful and actionable`);
its verification record is in the [Phase 7 handoff](project-review-handoff-2026-09-23-phase7.md).
Phase 6's implementation checkpoint is `fc6e353` (`test: harden verification gates and UI behavior coverage`);
its verification record is in the [Phase 6 handoff](project-review-handoff-2026-09-23-phase6.md).
Main
repository checkpoints are `6fd0869` (earlier UI refinements), `0db4a94`
(command outbox), `6b53341` (telemetry), `d5f6b44` (CI/migration gates), and the Phase 1
commit `5221ca4`, Phase 2 API commit `b4bbc7e`, and simulator commits `5746c94` (Phase 0)
and `2b85e15` (Phase 2), plus Phase 3 API commit `5703ceb`.
Phase 4 documentation and refinement-record commit: `a6dbc99`.
Phase 5 deployment/CI hygiene commit: `10e32e5`.

**Scope of this review:** `apps/api` source/migrations/tests, `apps/web` source and
tests, Compose/Dockerfiles/CI/`.env.example`/`.gitignore`, and the tracked documentation
that claims to describe them. Every finding below carries `path:line` evidence and was
re-derived by reading the code; the gate table was produced by executing the gates; the
live transport gate was re-run independently; and the two load-bearing defects (adapter
status divergence, ACK clock tolerance) were reproduced with throwaway scripts against
the disposable `eggcelerate-db-test` database.

**This document supersedes** `project-review-remediation-2026-09-23-claude.md` as the
execution plan. That plan's 16 findings were re-verified rather than inherited: one is
refuted, one is only partly reproducible, and five of its recorded baseline numbers are
wrong. The verdict table is in [§3](#3-verdicts-on-the-previous-remediation-plan).
Refinement phases 1–5 of `system-refinement-execution-plan-2026-09-22.md` are treated as
implemented; phases 6–8 of that plan are carried forward here as Phases 8–9.

> **Tracking note — resolved in Phase 4.** `.gitignore` now explicitly includes
> `!docs/refine`, so project reviews, implementation handoffs, and referenced plans are
> present in a fresh clone. Citations to old archive paths were corrected where needed.

---

## 1. Verified baseline (executed 2026-09-23, this review)

Toolchain: node v22.22.1, pnpm 9.12.3, `apps/api/.venv` Python 3.14.4, disposable
`eggcelerate-db-test-1` healthy on `127.0.0.1:55432` (Timescale `2.30.0-pg17`, same
pinned digest as `compose.yaml` and `.github/workflows/api.yml`).

| Gate | Command | Result |
|---|---|---|
| Web lint | `pnpm lint` | **green**, `Checked 175 files` |
| Web typecheck | `pnpm --filter eggcelerate-ui typecheck` | **green** |
| Web tests | `pnpm --filter eggcelerate-ui test` | **green**, 298 passed / 36 files (memory adapter only — see GATE-03) |
| Web coverage | `pnpm --filter eggcelerate-ui coverage` | **green**, 90.87 lines / 82.78 branches / 89.01 functions |
| Web build | `pnpm --filter eggcelerate-ui build` | **green** with `index` chunk 558.04 kB (152.18 kB gzip) over the 500 kB warning limit |
| API lint/format | `ruff check` + `ruff format --check apps/api` | **green**, 68 files |
| API types | `(cd apps/api && .venv/bin/mypy)` | **green**, 35 source files |
| Migrations | `apps/api/scripts/verify_migrations.py` | **green**, fresh + populated to head `0009` |
| API tests | `pytest -q apps/api/tests --require-database` | **green**, 87 passed, 0 skipped, 2–3 warnings |
| Live transport contract | `apps/api/scripts/verify_live_contract.py` | **RED — exit 1, 27/28** |

**Initial-review finding: the red gate.** It was reproduced independently three times by
the gate slice and once by this session; Phase 1 below records the fix and passing rerun.
The two throwaway reproducers kept under `docs/refine/repro/`
(`probe_adapter_divergence.py`, `probe_ack_clock.py`) re-run against the disposable
database and are the executable form of the §1 and Phase 2 evidence:

```
FAIL  src/tests/repository-contract.test.ts > repository contract (http) > reconnects a chamber to connected
AssertionError: expected 'offline' to be 'connected'
 ❯ src/tests/repository-contract.test.ts:78:64
Tests  1 failed | 27 passed (28)
```

The memory target of the same case passes in the same run. `.github/workflows/api.yml:44`
runs this script, so the API CI job would fail the moment it is committed and required.
At the initial-review baseline, the Phase 5 handoff's `Shared live repository contract: 28/28 passed`
(`system-refinement-handoff-2026-09-23-phase5.md:58`) is **not reproducible on this tree**.

Root cause (GATE-02), reproduced with a throwaway `TestClient` probe against a freshly
seeded Postgres farm:

```
memory:   units=12  connection_state={'connected':10,'offline':2}  telemetry_status={'fresh':12}
          status={'optimal':5,'alert':7}  condition_severity={'info':5,'critical':7}
postgres: units=12  connection_state={'offline':12}  telemetry_status={'offline':12}
          status={'alert':12}  condition_severity={'critical':12}   alerts=12
```

`domain.py:110-112` marks `connection_state == connected` only when
`telemetry_status == "fresh"`; `domain.py:55-65` returns `critical` when
`telemetry_status == "offline"`; `database/incubators.py:143` derives that status from
`telemetry_freshness(row["telemetry_last_seen_at"], now)` and
`database/readings.py:39-40` returns `offline` for a null `last_seen_at`. The seed
creates no `device_telemetry_state` row, while the memory fixture seeds
`connection_state="connected"` directly (`store.py:492`). One fixture, two answers — and
the answer the running preview shows (`docker exec eggcelerate-api-1 printenv
STORAGE_BACKEND` → `postgres_incubators`) is *twelve critical chambers and twelve alerts
for a farm nobody has plugged in*.

Corrections to previously recorded numbers (details in GATE-07):

| Recorded | Actual |
|---|---|
| `biome check .` 174 files | 175 files |
| coverage branches 82.79% | **82.78%** |
| `pytest` 4 warnings | 2–3 warnings, non-deterministic (GATE-06) |
| `(cd apps/api && ../.venv/bin/mypy)` | exit 127; correct form is `(cd apps/api && .venv/bin/mypy)` |
| "298 passed" cited as frontend contract coverage | the HTTP half of the shared contract is *not* in that run (GATE-03) |

---

## 2. Findings register

Severity is operator impact, not effort. `already known` marks findings that the
2026-09-22 review (`SYS-xx`) or the superseded remediation plan already stated.

| ID | Sev | Area | Finding | Evidence |
|---|---|---|---|---|
| GATE-01 | High | verification | Live HTTP contract is red; recorded 28/28 is not reproducible | `verify_live_contract.py` exit 1, `repository-contract.test.ts:78` |
| GATE-02 | High | API + web | Seeded Postgres farm reports 12 offline/critical chambers and 12 alerts; memory reports connected/fresh | probe output above; `domain.py:55-65,110-112`, `database/incubators.py:143`, `database/readings.py:39-40`, `store.py:492` |
| GATE-03 | Med | verification | `pnpm test` runs the shared contract as 14 memory-only tests; the transport half (28) runs only via the API script | `repository-contract.test.ts:8-15`; vitest reporter 14 vs 28 |
| GATE-04 | Med | verification | Coverage thresholds (75/55/65) sit 16–34 pp below measured; nothing diffs against a baseline | `vitest.config.ts:17-24` |
| GATE-05 | Med | tests | 85 of 298 web tests (13 files) assert production source text via `fs.readFileSync` | e.g. `typography-batch-c.test.ts:5-10`, `alerts-responsive-layout.test.ts:42` |
| GATE-06 | Med | tests | Pydantic `UnsupportedFieldAttributeWarning` varies 2↔3 warnings and is attributed to a different test each run; source not identified | 4 runs; alias `Idempotency-Key` and `incubator_id` |
| GATE-07 | Low | docs | Recorded baseline table has 3 wrong numbers and contradicts the Phase 5 handoff | §1 corrections |
| GATE-08 | Low | docs | The plan's mypy command cannot execute (exit 127) | `apps/.venv` does not exist |
| GATE-09 | Low | docs | `verification-gates.md` omits `pnpm --filter eggcelerate-ui test`, which CI runs | `web.yml:20-25` vs guide |
| GATE-10 | Low | tests | `test_postgres_incubators.py:143` pins seed size with a literal `13` | also `repository-contract.test.ts:23` |
| GATE-11 | Info | environment | Preview containers unhealthy; API container does not publish the port `compose.yaml` declares (stale container), `/readyz` 503 because `db` is down | `docker inspect` / `docker exec` output |
| API-01 | High | API | Worker drops QoS1 ACKs when its bounded queue is full; paho has already acknowledged them, so a correct turn expires `timed_out` | `mqtt/worker.py:27,37-46`; `mqtt/commands.py:33-42` |
| API-02 | High | API | A device reassignment would wedge telemetry: `device_telemetry_state` is unique on `(farm_id, incubator_id)` but keyed on `(farm_id, device_id)`, and no code path clears the old row | `0009_device_telemetry_state.py:43-45`; `database/incubators.py` `save_incubators` |
| API-03 | Med | API | `booted_at` is unbounded against receipt time; one future-dated boot poisons boot ordering for that device | `mqtt/telemetry.py:53-61,129-148` |
| API-04 | Med | API | `CommandAck.boot_id`/`booted_at`/`seq` are parsed and then never used; a stale-boot ACK inside the expiry window still advances the confirmed cursor | `mqtt/commands.py:18-30,89-162` |
| API-05 | Med | API | Migration `0008` has no index for the claim query (`farm_id`, `status`, `next_attempt_at`) and no incubator FK | `0008_device_commands.py:14-38` |
| D1 | Med | web | Error envelopes are trusted without Zod validation (`ErrorEnvelopeSchema` is defined but unused) | `api-repository.ts:165-198`, `contracts.ts:37-39` |
| D2 | — | web | *Refuted:* `incubatorFromDTO` etc. re-parse data already validated by the same schema in `request()`, so the `.parse()` cannot throw on that path | `api-repository.ts:201-219` vs `contracts.ts:319-320` |
| D3 | Med | web | Memory adapter emits `simulated_failure`, a code outside `ApiErrorCodeSchema`/`KNOWN_CODES` | `in-memory-repository.ts:100-105` |
| D4 | High | web | Manual turn is POST + dependent GET; a failed follow-up GET reports failure for an accepted command, and success shows no feedback for up to 15 s | `api-repository.ts:331-346`, `use-farm-data.ts:355-359` |
| D5 | Med | web | Candling id cache keyed by idempotency key is reused without revalidation; complete/stop return the refresh GET error on partial success; `abortedCycles` key is invalidated but never subscribed | `api-repository.ts:367-393,704-758`, `use-farm-data.ts:56-90` |
| D6 | High | web | Freshness rendering splits by adapter: API defaults `telemetry_status` to `offline`, memory fixtures leave it `undefined`, which the UI resolves to `fresh` when paired | `contracts.ts:108`, `telemetry.ts:8-18`, `use-farm-data.ts:103-108` |
| D7 | Med | web | Memory mode writes skip validation; `dto.ts` maps unknown exceptions to code `unknown`, which no consumer recognises | `in-memory-repository.ts:621-668`, `dto.ts:36-44` |
| WS-1 | High | web | A paired chamber with no telemetry is badged **Live** (`telemetryStatus ?? paired → "fresh"`) in Overview and LiveMonitor | `telemetry.ts:17`, `OverviewScreen.tsx:307`, `LiveMonitorTab.tsx:643-647` |
| WS-2 | High | web | Actuator tiles assert `Heating`/`Misting`/`Active` inferred from sensor values with no freshness branch; stale only appends "Showing last known readings." | `LiveMonitorTab.tsx:479-482,505-510,562-605` |
| WS-3 | Med | web | Banner ages `telemetryObservedAt`, the tile ages `telemetryLastSeenAt`, `telemetryReceivedAt` is never rendered, and Overview labels receipt freshness as observation age | `LiveMonitorTab.tsx:505-510,643-647`, `contracts.ts:347-349`, `OverviewScreen.tsx:305` |
| WS-4 | Med | web | History section returns `null` while loading, on error and when genuinely empty; `isLoading`/`error`/`retry` are discarded | `DetailScreen.tsx:116`, `LiveMonitorTab.tsx:208`, `use-incubator-readings.ts:30-34` |
| WS-5 | Med | web | Timeline keys and `journal-entry-{day}` anchors can collide on duplicate candling days; a collapsed target makes the click a silent no-op | `Timeline.tsx:116-126,254,438`, `domain/candling.ts:10-12` |
| WS-6 | High | web | "Turn request accepted" toast fires whenever the mutation resolves, while the live adapter discards the command response — a rejected or timed-out turn can look confirmed | `DetailScreen.tsx:823-839`, `api-repository.ts:331-347`, `DeviceSettingsTab.tsx:507-518` |
| F1 | High | web | Trends environmental view ignores `isLoading`/`error`/`retry`; an API failure renders as an empty chart that looks loaded | `TrendsScreen.tsx:390`, `use-incubator-readings.ts:56-68` |
| F2 | High | web | Trends ignores telemetry freshness entirely; stale/offline series render with live chrome | `TrendsScreen.tsx:393-409,780-800` |
| F3 | High | tests | Source-text tests pass while the covered property is broken (chart title uses `--type-heading-sm`; the test asserts `--type-heading-md` exists elsewhere in the file) | `typography-batch-c.test.ts:5-10` vs `TrendsScreen.tsx:801-802,1636-1637` |
| F4 | Med | verification | Coverage gate excludes `src/app/components/**`, so render/a11y regressions in the touched files are unenforceable | `vitest.config.ts:23-33` |
| F5 | Low | web a11y | Two co-rendered pagers for one page state with inconsistent names and `aria-current` (`true` vs `page`) | `pagination-bar.tsx:100-112`, `TrendsScreen.tsx:1213-1228` |
| F6 | Med | web | Compare-mode CSV export and the readings dialog cover only the single selected chamber while the toast implies completeness | `TrendsScreen.tsx:412,520-535,1655-1720` |
| INFRA-01 | Med | docs | `infrastructure/README.md:1-5` denies that broker config exists while `infrastructure/mosquitto.conf` and `compose.simulator.yaml` mount it | both files |
| DOC-02 | Med | docs | `apps/api/README.md:36-37,58-64` is stale on migrations (stops at 0006), test count (69) and MQTT status | file vs `migrations/versions/` |
| DOC-04 | Med | docs | `docs/guide/database-setup-guide.md:158-172` describes a schema that was never built | real mapping: 0003 preferences, 0004 alerts, 0005 cycles, 0006 candling, 0007 telemetry, 0008 commands, 0009 projection |
| DOC-05 | Low | docs | Tracked B4 proof cites simulator behaviour from a dirty sibling tree at `e112a25` | `git -C ../eggcelerate-simulate status --short` |
| ENV-03 | Med | config | Documented `MQTT_URL` is not read by the worker, which uses `MQTT_HOST`/`MQTT_PORT`/`MQTT_USERNAME`/`MQTT_PASSWORD`/`SIMULATOR_DISPATCH_ENABLED`; `.env.example` names none of them | `mqtt/worker.py:30-56` vs `backend-dashboard-first-guide.md:439-440`, `.env.example:16` |
| SYS-01/02/03/04/05/06/07/08 | — | — | Prior review's items: SYS-01 (auth) and SYS-08 (bundle) remain open; SYS-02/03/05/06/07 closed by phases 4/5 and phase 1 of the prior plan; SYS-04 closed for unsupported controls (verified: `HardwarePanel.tsx:155-161,301-418` genuinely disables them) | prior docs |

---

## 3. Verdicts on the previous remediation plan

`project-review-remediation-2026-09-23-claude.md` findings, re-verified:

| Its finding | Verdict | Note |
|---|---|---|
| 1 ACK clock tolerance | **confirmed** | Reproduced: a device clock only **+1 s** ahead is rejected (`validation_error`, command stays `dispatched`); an ACK received 1 s after `expires_at` with execution 5 s before it becomes `timed_out` |
| 2 Boot-aware projection recovery | **confirmed** | `newer` gates every branch on `observed_at > current.observed_at` (`mqtt/telemetry.py:129-148`) |
| 3 Work uncommitted | **confirmed** | 61 entries; sibling repo dirty at `e112a25` |
| 4 Evidence trail gitignored | **confirmed** | `.gitignore:46-47`; tracked citations listed in the header note |
| 5 `SYSTEM_ARCHITECTURE_GUIDE.md` false | **confirmed** | stale status lines (`:66-68`, `:418-420`), test counts (`:70,81,517`), 4 dead links (`:24-30,581-582`) |
| 6 `GET /incubators/{id}` 200+empty | **refuted** | Both adapters return 404 (`dependencies.py:28-35` → `services.py:60-66`); `test_postgres_queries.py:67-68` already pins it; probe confirms 404 for `/incubators/missing`, `/modes/missing`, missing command status |
| 7 Key-set dispatch | **confirmed as latent** | No current collision (`RESET_PATCH_KEYS` has 12 keys, config keys disjoint); the fragility is real |
| 8 Unused command-status endpoint | **confirmed** | No consumer under `apps/web/src` |
| 9 `VITE_LIVE_REFRESH_ENABLED` unwired | **confirmed** | Source reads it (`telemetry.ts:5-6`); `apps/web/Dockerfile:12-15` declares no such ARG |
| 10 Coverage gate | **confirmed and worse** | Components excluded *and* thresholds 16–34 pp below measured |
| 11 Python drift | **confirmed** | 3.11 declared ×2, 3.13 image, 3.14 CI |
| 12 API container root | **confirmed** | No `USER` in `apps/api/Dockerfile` |
| 13 Simulator profile unusable | **confirmed** | `compose.simulator.yaml` defines only `broker` + `mqtt-worker`; no host port |
| 14 `database-setup-guide.md` migrations | **confirmed** | See DOC-04 mapping |
| 15 `api.yml` no `concurrency` | **confirmed** | `web.yml` lacks one too |
| 16 Pydantic warning | **partly / misattributed** | Not reproducible via `test_postgres_incubators.py`; appears with 2–3 counts and two different aliases; offending model not located |

Its "verified baseline" table is corrected in §1. Its Phase 6 prerequisite — "an
uninformed code review as its input" — is now satisfied by §2.

---

## 4. Decisions required before the dependent phases

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| D-1 | What should a **paired chamber that has never reported telemetry** look like? | (a) `offline` until proven live — change the memory fixture and the shared contract expectation; (b) keep a third "never reported" presentation and stop defaulting to `fresh`; (c) seed `device_telemetry_state` for the development seed so the preview mirrors the mock | **(b) + (a) for the API**: never-reported must not read as Live anywhere (WS-1), and the Postgres answer (offline) becomes the single truth. Option (c) alone is rejected: seeded rows age out after 180 s, so the preview returns to "12 critical" within minutes |
| D-2 | Does `docs/refine` become tracked? | (a) add `!docs/refine` to `.gitignore`; (b) move handoffs into `docs/guide/` and update citations | (a) — one line makes every existing citation honest and version-controls the evidence |
| D-3 | Python version policy | (a) declare what ships (3.13) and keep CI at the floor; (b) run CI on 3.14 and raise the floor; (c) matrix | Selected and applied in Phase 5: (b), with image, `requires-python`, and mypy aligned to 3.14 |
| D-4 | Is the HTTP transport contract a required local gate? | (a) wire `EGG_API_URL` into a documented `test:contract` script; (b) document `verify_live_contract.py` as the transport gate and stop citing 298 as contract coverage | (a) — otherwise the red gate in §1 stays invisible to `pnpm test` |
| D-5 | Simulator revision pin | (a) commit the sibling tree and record the SHA in the tracked guides; (b) keep citing a dirty tree | Selected and applied: clean sibling revision `2b85e15` is pinned in the integration guide |
| D-6 | Do the preview containers get rebuilt in this work? | (a) yes, as part of Phase 1 exit; (b) no, out of scope | (a) — GATE-11 means the preview currently lies about both health and chamber status |

---

## 5. Phase map

Dependencies are strict; phases run in order unless noted. Each phase is independently
revertable and independently verifiable.

```mermaid
graph LR
  P0[0 Preserve] --> P1[1 Truthful baseline]
  P1 --> P2[2 Turn outcomes]
  P1 --> P3[3 Telemetry projection]
  P1 --> P4[4 Documentation truth]
  P4 --> P5[5 Deploy and CI hygiene]
  P1 --> P6[6 Verification integrity]
  P2 --> P7[7 Frontend truthfulness]
  P3 --> P7
  P6 --> P7
  P7 --> P8[8 B6 authentication]
  P8 --> P9[9 Release readiness]
```

| Phase | Outcome | Findings closed | Depends on |
|---|---|---|---|
| 0 | The completed work exists in Git, with a revertable boundary | 3 | owner approval |
| 1 | A green baseline that is green because the system is truthful, not because the gate is blind | GATE-01, GATE-02, GATE-07, GATE-08, GATE-09, GATE-11, D-1 | 0 |
| 2 | A turn that physically happened is reported as executed, and a lost ACK cannot fake a timeout | API-01, API-04, prior finding 1 | 1 |
| 3 | A rebooted or reassigned device recovers its projection without a clock-dependent stall | API-02, API-03, API-05, prior finding 2 | 1 |
| 4 | Tracked documentation describes the system that exists | 4, 5, 14, INFRA-01, DOC-02, DOC-04, ENV-03 | 1, D-2 |
| 5 | Deployment configuration honours its documented switches and policy | 9, 11, 12, 13, 15 | 4, D-3, D-5, D-6 |
| 6 | The gates can detect the regressions they claim to cover | GATE-03, GATE-04, GATE-05, GATE-06, GATE-10, F3, F4, DOC-05 | 1, D-4 |
| 7 | The dashboard tells the operator the truth about freshness, outcomes and empty states | D1, D3, D4, D5, D6, D7, WS-1…WS-6, F1, F2, F5, F6 | 2, 3, 6, D-1 |
| 8 | Production uses authenticated, farm-scoped sessions | SYS-01 | 7 |
| 9 | Reproducible release candidate with recovery evidence and a startup budget | SYS-08 + operational evidence | 8 |

---

## Phase 0 — Preserve the work

**Outcome:** two completed phases and their evidence exist in Git history; nothing in
this plan depends on an uncommitted tree.

**Why:** the tree holds migration `0008`/`0009`, `mqtt/commands.py`, `mqtt/worker.py`,
`database/queries.py`, `test_device_commands.py`, `test_postgres_queries.py`,
`verify_migrations.py`, `api.yml`, `compose.simulator.yaml`, `infrastructure/mosquitto.conf`
and the Phase 4/5 test edits. The sibling simulator's dirty tree is worse: the API contract
now hard-requires `boot_id`/`booted_at`, so an unpushed sender is a broken deployment.

**Work**
- [x] Confirm the commit boundary with the owner. One commit for Phase 4 command
      closure, one for Phase 5 telemetry/freshness, and one for `api.yml` plus
      `scripts/verify_migrations.py` keep those changes independently revertable.
- [x] Commit the untracked files listed above; do not mix in `docs/refine` (D-2 decides
      that separately) or the `/tmp` review probes.
- [x] Commit the sibling simulator tree and record the main/simulator SHAs in both
      Phase 4/5 handoffs.
- [x] Note explicitly in the Phase 5 handoff that its historical `28/28` contract
      claim is superseded by GATE-01 until Phase 1 closes.

**Exit gate:** passed. `git status --short` is empty in both repositories; the
Phase 4, Phase 5, and CI commits appear in the main log; the simulator has its own
commit; and both SHAs are recorded in both handoffs. Temporary `.claude` settings
and generated egg-info stay local and are excluded through `.git/info/exclude`.

**Recovery:** commits are additive; no history rewrite.

---

## Phase 1 — Restore a truthful green baseline

**Outcome:** the transport gate is green, and both adapters report never-seen devices as
offline rather than connected. Offline remains safety-critical; the twelve seed chambers
therefore still show `offline` / `critical` consistently instead of one adapter implying
they are healthy.

**Why:** GATE-01/02 above. A dashboard must not call a paired device live until it has
received fresh telemetry. The freshness rule is correct and deliberate
(`readings.py:37-40` classifies liveness from server receipt time); the defect was adapter
divergence, where Postgres reported no telemetry as offline while the memory fixture
reported connected/fresh. Missing telemetry remains safety-critical because the chamber's
current conditions are unknown.

**Work**
- [x] Apply decision **D-1**. Implementation for the recommended option: resolve
      `telemetry_status` for a chamber with no projection row to `offline` consistently,
      stop the memory fixture from seeding `connected` for chambers that never reported
      (`store.py:492`), and make `resolvedTelemetryStatus` stop defaulting
      paired-and-unknown to `fresh` (`telemetry.ts:17`, also WS-1).
- [x] Update the shared contract expectation at `repository-contract.test.ts:78` **only
      together with** an API test that pins the new rule (`connection_state == connected`
      requires fresh telemetry), so the assertion is not merely weakened.
- [x] Convert the review probes into tests (they are preserved at
      `docs/refine/repro/probe_adapter_divergence.py` and
      `docs/refine/repro/probe_ack_clock.py`, and are throwaway review reproducers, not
      project tooling): per-farm state counts for a freshly seeded Postgres farm, and the
      404 parity cases (`/incubators/missing`, `/modes/missing`, missing command status)
      that the refuted finding 6 already covers.
- [x] Correct the gate documentation and the recorded baseline: `biome` 175 files,
      branches 82.78, warnings non-deterministic until GATE-06 closes; replace
      `(cd apps/api && ../.venv/bin/mypy)` with `(cd apps/api && .venv/bin/mypy)`;
      add `pnpm --filter eggcelerate-ui test` to the local block in
      `docs/guide/verification-gates.md`; probe the disposable database by image
      (`docker ps --filter ancestor=timescale/timescaledb:2.30.0-pg17`) instead of name.
- [x] Recreate the preview stack so the running containers match `compose.yaml` and
      `/readyz` is meaningful (`docker compose up -d --force-recreate`, database profile
      up). Record that the API container previously published no host port (GATE-11).

**Exit gate**
- [x] `verify_live_contract.py` exits 0 with `Tests 28 passed (28)`.
- [x] A freshly seeded Postgres farm reports the same chamber-level state as the memory
  fixture for the same inputs, and neither claims a healthy device that never reported.
- [x] `pnpm --filter eggcelerate-ui test` still green; new pins fail if the rule is reverted.
- [x] `docker ps` shows `eggcelerate-api-1` healthy publishing `127.0.0.1:8000`, and
  `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/readyz` returns 200.

**Recovery:** the contract expectation change is the only shared-contract edit; revert it
together with the API rule to return to the previous (divergent) behaviour.

**Execution record (2026-09-23):** full API suite `93 passed, 0 skipped` (2 dependency
deprecation warnings); shared HTTP contract `28/28`; web suite `299 passed / 36 files`;
web lint checked 174 files and typecheck passed; Ruff checked and formatted 68 files;
mypy passed for 35 API source files. Compose base services were rebuilt; API, web and
database are healthy, API publishes `127.0.0.1:8000`, and `/readyz` returns 200. The
preview uses the documented memory default while the database profile is running; its 12
seed chambers report offline/critical, matching the API/database parity tests. The stopped
`egg-api2` host-network probe had no mounts and had occupied port 8000. See
[`project-review-handoff-2026-09-23-phase1.md`](project-review-handoff-2026-09-23-phase1.md).

---

## Phase 2 — Turn outcome truthfulness

**Outcome:** a turn the device executed is recorded as executed, and a lost ACK can no
longer masquerade as a timeout.

**Why (reproduced):** with the current code, a device whose clock is **1 second** ahead of
the server has its ACK rejected as `validation_error` and the command later expires as
`timed_out`; an ACK received 1 s after `expires_at` whose execution happened 5 s before it
is also `timed_out`:

```
device clock +1s  (correct turn)                  : AppError code=validation_error; status=dispatched
device clock +10s (correct turn)                  : AppError code=validation_error; status=dispatched
device clock +60s (at tolerance boundary)         : AppError code=validation_error; status=dispatched
received 1s after expiry, executed 5s before it   : applied=False; status=timed_out
```

`mqtt/commands.py:124` expires on **receipt** time and `:134` demands
`requested_at <= observed_at <= now` — a zero-width window against the server clock —
while telemetry deliberately tolerates 5 minutes (`mqtt/telemetry.py:58`). The asymmetry
is the defect, not the telemetry tolerance.

**Work**
- [x] Introduce one shared tolerance constant (for example `DEVICE_CLOCK_TOLERANCE =
      60 s`) used by both the ACK plausibility window and the telemetry future check, so
      the two boundaries cannot drift apart again.
- [x] Judge the deadline by **execution**: `ack.observed_at > expires_at` → `timed_out`;
      receipt after the deadline with execution inside it → accept. The worker leaves a
      tolerance window before expiring a command so a late-arriving ACK can be processed.
- [x] API-01: make the worker's ACK path lossless or loss-aware — drain ACKs before
      QoS0 telemetry, or shed telemetry first, and count dropped ACKs. Today a dropped
      ACK has already been acknowledged to the broker (`worker.py:37-46`), so the
      outcome is lost permanently.
- [x] API-04: correlate ACKs with dispatch boot identity (or explicitly record and
      document that boot identity is not part of the ACK contract) so a stale-boot ACK
      cannot advance the confirmed cursor. The dispatch boot ID/time/sequence are now
      persisted with the command in migration `0010`.
- [x] Keep the existing terminal-precedence behaviour: a delayed older success must still
      not roll back a newer confirmed turn (`commands.py:153-156`).
- [x] New tests: ACK ~10 s in the future → `acked`; receipt after `expires_at` with
      execution before it → `acked`; execution after `expires_at` → `timed_out`; ACK
      beyond tolerance → rejected with no cursor change; queue-full behaviour → ACK not
      silently lost.

**Exit gate**
- [x] The five clock/queue probe cases above produce the intended outcomes
      (`docs/refine/repro/probe_ack_clock.py`), and stale boot/sequence ACKs do not move
      the confirmed cursor.
- [x] Fresh and populated migrations pass; the full database suite passes;
`test_durable_outcomes_and_terminal_precedence[timed_out]` still
yields `timed_out` (it sets `expires_at` in the past and ACKs with `observed_at = now`,
which remains a late execution under the new rule).

**Recovery:** revert the worker/ACK behavior and simulator contract together. Migration
`0010` is additive; leave it installed when reverting code, or downgrade only when no
command rows depend on its dispatch identity.

**Execution record (2026-09-23):** API database suite `102 passed, 0 skipped` (4
dependency/Pydantic deprecation warnings); live HTTP contract `28/28`; fresh and populated
migration upgrades passed through `0010`; Ruff check/format passed for 71 files and mypy
passed for 36 source files. Simulator suite `25 passed`; all contract examples passed.
The API now delays expiry by the 60-second device clock tolerance and records ACK receipt
time from MQTT ingress. No physical board or live broker-in-the-loop was available; the
simulator exercises the command contract. See
[`project-review-handoff-2026-09-23-phase2.md`](project-review-handoff-2026-09-23-phase2.md).

---

## Phase 3 — Telemetry projection robustness

**Outcome:** a device that reboots with a skewed clock, or is reassigned, recovers its
projection without operator intervention.

**Why:** `newer` requires `observed_at > current["observed_at"]` on **every** branch
(`mqtt/telemetry.py:129-148`), including a new `boot_id`, so a reboot with forward skew
(or an unsynchronised RTC) publishes telemetry that is newer by boot identity but older by
observation time: history accepts it, the projection never advances, `last_seen_at`
freezes, and a healthy chamber degrades to `stale` then `offline`. The Phase 5 handoff
documents only the backwards-clock case. Secondary: `booted_at` is unbounded against
receipt time (`telemetry.py:53-61`), so one future-dated boot poisons boot ordering for
that device; and `device_telemetry_state` is unique on `(farm_id, incubator_id)` while
keyed on `(farm_id, device_id)` (`0009_device_telemetry_state.py:43-45`), so any future
device-swap feature would fail with an integrity error on the first sample — currently
unreachable because no endpoint reassigns a device (`services.py:235-242` does not change
device identity), which is why this is a latent defect, not a live one.

**Work**
- [x] New `boot_id` with a strictly later `booted_at` replaces the projection regardless
      of `observed_at`; same-boot ordering keeps **both** gates (`seq` and `observed_at`).
- [x] Bound `booted_at <= received_at + DEVICE_CLOCK_TOLERANCE` (reuse Phase 2's constant).
- [x] Decide and implement the device-reassignment path: repoint or delete the stale
      projection row on reassignment (or upsert on `(farm_id, incubator_id)`), and cover
      it with a test that survives a device swap.
- [x] API-05: add the index the claim query needs (`farm_id`, `status`, `next_attempt_at`)
      and decide the incubator FK for `device_commands`; keep the existing status CHECK.
- [x] Correct `docs/guide/b4-mqtt-contract.md`, which currently claims the projection
      "orders messages by boot_id/booted_at and then seq" while the code additionally
      requires `observed_at` to advance — after this phase the doc must state the real
      precedence rule.
- [x] New tests: new boot, later `booted_at`, earlier `observed_at` → projection advances
      and status returns to `fresh`; new boot with earlier `booted_at` → unchanged;
      same boot, higher `seq`, earlier `observed_at` → unchanged; future `booted_at`
      → rejected.

**Exit gate:** `test_mqtt_telemetry.py` plus the full suite pass;
`test_restart_ordering_duplicate_and_offline_recovery` still asserts no regression for an
older boot arriving late; the reassignment test fails before the fix and passes after.

**Recovery:** projection precedence can be reverted independently if late-message
protection regresses. Migration `0011` is additive; retain it during a code rollback and
downgrade only when removing the command FK/index is safe for the stored command rows.

**Execution record (2026-09-23):** API suite `104 passed, 0 skipped` (2 Starlette/AnyIO
deprecation warnings); focused telemetry/migration tests `8 passed`; fresh and populated
migration upgrades passed through `0011`; `alembic check` reported no schema drift; Ruff
check/format passed for 68 files; mypy passed for 36 API source files; live HTTP contract
passed `28/28`. The reassignment test simulates changing the chamber's assigned device
and proves the first valid sample replaces the stale projection while preserving raw
history. No device-reassignment API or physical board was available. See
[`project-review-handoff-2026-09-23-phase3.md`](project-review-handoff-2026-09-23-phase3.md).

---

## Phase 4 — Documentation truth pass

**Outcome:** every tracked document describes the system that exists, and every citation
resolves in a fresh clone.

**Why:** `docs/guide/README.md` names `docs/SYSTEM_ARCHITECTURE_GUIDE.md` as the source of
truth, and the backend guide is the stated resume instruction — both currently misdescribe
the system, and the tracked guides cite files a fresh clone cannot open.

**Work**
- [x] Apply **D-2**, then make every citation resolve (`docs/refine/*` citations listed in
      the header note).
- [x] `docs/SYSTEM_ARCHITECTURE_GUIDE.md`: refresh the status lines at `:66-68` and
      `:418-420` (FastAPI, Postgres/TimescaleDB, Mosquitto and the simulator all exist),
      the B1 checklist, and the test counts at `:70,81,517` (159/155 → current totals, or
      drop the counts and point at CI). Fix the four dead links (`:24-30`, `:581-582`).
- [x] `docs/guide/database-setup-guide.md:158-172`: replace the DB2/DB3 checklists with
      the real mapping — 0001 farms/modes, 0002 chamber/device, 0003 preferences,
      0004 alerts, 0005 cycles, 0006 candling, 0007 telemetry hypertable, 0008 commands,
      0009 projection, 0010 command boot identity, 0011 claim index and chamber FK — and
      drop the `.env.example` names that do not exist.
- [x] `apps/api/README.md:36-37,58-64`: migrations through `0011`, test count corrected or
      replaced by a CI pointer, and the MQTT sentence qualified (worker/dispatch
      implemented; hardware still excluded).
- [x] `infrastructure/README.md:1-5`: describe `mosquitto.conf` and the loopback-only
      intent instead of denying that broker configuration exists.
- [x] `.env.example` and `docs/guide/backend-dashboard-first-guide.md:439-440`: replace
      `MQTT_URL` with the names the worker actually reads, and add the database variable
      names (ENV-03).
- [x] Record in `docs/refine` which review numbers were corrected (§1) so the next session
      diffs against real values.

**Exit gate:** a link check over `README.md`, `docs/SYSTEM_ARCHITECTURE_GUIDE.md`,
`docs/guide/*.md` and `apps/*/README.md` reports zero dead or ignored-target links; every
statement changed above is verifiable against `migrations/versions/`, `apps/*/src` or CI.

**Recovery:** documentation-only; revert per file.

**Execution record (2026-09-23):** D-2 is resolved by tracking `docs/refine` in Git.
The architecture, database, API, infrastructure, environment and onboarding guides now
describe the implementation through migration `0011` and distinguish local simulator
dispatch from physical hardware support. The initial-review number corrections remain
listed in §1; current runnable gates are linked from the architecture/API guides rather
than copied as stale totals. Markdown link checks passed for the user-facing guide set
(`57` local links across `19` files) and all refinement Markdown (`99` links across `52`
files); no dead or ignored targets were found. `git diff --check` and both base and
simulator-overlay Compose config validation passed. The broker remains private to the
Compose network, anonymous and without TLS; this phase does not qualify physical device
connectivity or production deployment.

See [`project-review-handoff-2026-09-23-phase4.md`](project-review-handoff-2026-09-23-phase4.md).

---

## Phase 5 — Deployment and CI hygiene

**Outcome:** the documented switches and version policy work as written, and the API
container runs unprivileged.

**Initial-review finding:** `docs/guide/b4-mqtt-contract.md:120-121` instructed operators to build with
`VITE_LIVE_REFRESH_ENABLED=false`, but `apps/web/Dockerfile:12-15` declares no such ARG,
so the documented rollback requires editing the image definition. Python is declared
3.11 (`pyproject.toml:8,33`), shipped as 3.13 (`apps/api/Dockerfile:1`) and tested as
3.14 (`.github/workflows/api.yml:32-33`). The API container runs as root. Neither workflow
cancels superseded runs, so a 15-minute Timescale job queues behind every push.
`compose.simulator.yaml` publishes no broker port, so the documented out-of-checkout
simulator cannot reach it.

**Work**
- [x] Add `ARG`/`ENV VITE_LIVE_REFRESH_ENABLED` to `apps/web/Dockerfile` and pass it from
      `compose.yaml`'s `web.build.args`.
- [x] Apply **D-3**: declare the shipped interpreter, keep CI on the tested version.
- [x] Add `USER` to `apps/api/Dockerfile` (and ensure the workdir is writable if any
      runtime path needs it).
- [x] Add `concurrency` groups to `.github/workflows/api.yml` and `web.yml`.
- [x] Document how the simulator is expected to reach `broker` (or publish a loopback
      port for the documented workflow), and pin the sibling revision per **D-5**.
- [x] Document the narrow guarantee of the web image's loopback guard
      (`apps/web/Dockerfile:16-21` catches only literal `http(s)://localhost` and
      `127.0.0.1` followed by `:` or `/`, and only when `VITE_DATA_SOURCE=api`).

**Exit gate:** `docker compose config` renders; a local web build with
`VITE_DATA_SOURCE=api VITE_LIVE_REFRESH_ENABLED=false` succeeds, and its incubator
summary query compiles with `refetchInterval: false` (the separate five-second local
freshness clock remains); the API image starts as a non-root user.

**Recovery:** each change is a single-file revert; none affect runtime data.

**Execution record (2026-09-23):** the web Docker image built in API mode with live
refresh disabled; its bundled query sets `refetchInterval` to false and has no Vite
switch left at runtime. Compose config passed for the base, production and simulator
overlays; the simulator publishes Mosquitto only at `127.0.0.1:1883`. The API image
built from Python 3.14 and served `/healthz` with UID/GID `10001:10001`. The declared
Python floor, mypy target and container now match CI's 3.14 runtime; Ruff formatting
was refreshed for 3.14 syntax. Both CI workflows now cancel superseded runs.

The simulator checkout was clean at pinned revision `2b85e15`; all 25 unit tests and
the payload contract gate passed. A host-run simulator published a valid EGG-1003
telemetry message to the Compose broker through `127.0.0.1:1883`. The PostgreSQL API
suite passed `104` tests with no skips and three warnings (two dependency deprecations
and the known Pydantic field-alias warning); Ruff passed on 72 files and mypy on 36.
The local simulator path does not qualify physical hardware or LAN reachability, and
the five-second UI freshness clock remains active when periodic polling is disabled.

See [`project-review-handoff-2026-09-23-phase5.md`](project-review-handoff-2026-09-23-phase5.md).

---

## Phase 6 — Verification integrity

**Status (2026-09-23): complete.** Implementation commit: `fc6e353`. See the
[Phase 6 handoff](project-review-handoff-2026-09-23-phase6.md) for gate results and
remaining limitations.

**Outcome:** the gates fail when the behaviour they name regresses.

**Why:** 85 of 298 web tests assert source text and demonstrably miss real defects — the
sharpest example is `typography-batch-c.test.ts:5-10`, which asserts
`var(--type-heading-md)` exists somewhere in `TrendsScreen.tsx` while the chart title it
names uses `--type-heading-sm` (`TrendsScreen.tsx:801-802` vs `:1636-1637`). The coverage
gate excludes every screen and component, and its thresholds sit 16–34 pp below measured.
`pnpm test` covers only the memory half of the shared contract. The Pydantic warning is
non-deterministic and unattributed.

**Work**
- [x] Apply **D-4** so the transport contract is either part of the documented local gate
      or explicitly named as its own gate; stop citing `298 passed` as transport coverage.
- [x] Purge source-text assertions: re-express the ones that encode a real contract
      against rendered or computed surfaces (`getByRole`, focus assertions,
      `getComputedStyle` tokens — `timeline-density.test.tsx:42-64` is the existing
      pattern) and delete the pure string pins. Do not re-pin them to new strings.
- [x] Extend `coverage.include` to the rendered components once render coverage exists and
      raise the thresholds to a frozen floor near measured values (lines ~90, branches
      ~81, functions ~88), keeping the raise-never-lower rule.
- [x] GATE-06: add a warning-as-error filter for Pydantic's
      `UnsupportedFieldAttributeWarning`, locate the offending alert header declaration,
      and express it as a direct `Header(default=None, alias=...)` parameter.
- [x] GATE-10: derive the expected chamber count from the seeded baseline instead of the
      literal `13` in `test_postgres_incubators.py:143`.
- [x] GATE-11/GATE-09 follow-ups are already Phase 1 work; record the gate block below as
      the single source of commands.

**Exit gate:** passed. Rendered filter and screen tests assert accessible markup, focus,
responsive classes, and computed typography; the chart title defect found by its former
source-string pin now has a rendered assertion. The coverage scope check requires all
seven screen modules. The Pydantic warning-as-error gate caught the alert-header warning;
after the declaration fix, all 104 API tests pass with only two dependency warnings. The
commands in §6 passed, including the live HTTP contract and fresh/populated migration
checks.

**Recovery:** test-only changes; revert per file. Thresholds may be raised again but never
lowered.

---

## Phase 7 — Frontend truthfulness and states

**Outcome:** the dashboard never presents unverified data as live, and a user action is
never silently lost. Completed in `8d5252b`; detailed behavior and verification are in
the [Phase 7 handoff](project-review-handoff-2026-09-23-phase7.md).

**Why:** the highest-impact items are the ones the operator would act on. A chamber that
has never reported is badged **Live** (`telemetry.ts:17`), stale chambers still assert
`Heating`/`Misting`/`Active` (`LiveMonitorTab.tsx:479-482`), the accepted-turn toast is not
backed by command status (`DetailScreen.tsx:823-839`), Trends renders an API failure as an
empty-but-loaded chart (`TrendsScreen.tsx:390`), and compare-mode export silently covers
one chamber while the toast implies all (`TrendsScreen.tsx:412,520-535`).

**Work**
- [x] Freshness truth: WS-1 (never-reported must not be Live), WS-2 (actuator tiles must
      not assert inferred states when telemetry is stale/offline), WS-3 (one freshness
      clock per surface, and either render or remove `telemetryReceivedAt`), D6 (make both
      adapters resolve freshness identically).
- [x] Turn feedback: WS-6 + D4 — surface the command response, poll or subscribe the
      command status, and keep the accepted toast only when pending status is actually
      reflected. Finding 8 is resolved by polling
      `GET /incubators/{id}/commands/{command_id}`.
- [x] States: WS-4 (history loading/error/empty), F1 (Trends loading/error/retry),
      F2 (Trends freshness), F6 (export scope), F5 (one pager, consistent `aria-current`).
- [x] Contract hygiene: D1 (validate error envelopes), D3 and D7 (one error-code
      vocabulary; no `simulated_failure`, no `unknown`), D5 (candling id cache scoping,
      atomic cycle finish reporting, subscribe or append the aborted-cycles key).
- [x] WS-5: key timeline nodes and journal anchors by a unique checkpoint identity and
      make a collapsed target a defined outcome instead of a silent no-op.
- [x] Replace the key-set patch router (`use-farm-data.ts:295`) with an explicit intent
      argument so a future screen patch can never issue a device turn (finding 7).

**Exit gate — passed:** never-reported telemetry does not render `Live`; stale/offline
fixtures do not assert actuator states; Detail and Trends provide retry paths after
readings failures; turn acceptance is reflected as a pending command and polled through
terminal status; repository contracts pass for both adapters. `pnpm lint`, UI typecheck,
all 234 tests across 30 files, coverage thresholds plus all seven screen modules, and the
production build passed. Vite retains its advisory that the main bundle exceeds 500 kB.

**Recovery:** per-screen reverts; the freshness rule change is shared with Phase 1 and must
be reverted with it.

---

## Phase 8 — Identity and farm authorization (B6)

**Outcome:** production mode uses authenticated sessions and enforces farm ownership on the
server.

Carried forward unchanged from `system-refinement-execution-plan-2026-09-22.md` Phase 6
(SYS-01). Requirements: reconcile `docs/guide/auth-onboarding-guide.md` with B6; add
identity/membership persistence and session lifecycle including expiry and revocation;
derive farm context from authenticated membership and enforce it on reads, mutations,
history, command status and replay lookup; replace the default mock auth in API mode; keep
mock development behaviour without letting it bypass the production gate.

**Account approach selected:** app-managed email and password, as requested. Password
hashing and session policy are implemented here; verified email and password recovery
remain Phase 9 release controls.

**Implementation decisions:** passwords use Argon2id (19 MiB, two iterations, one lane),
normalized email is the login key, and sessions use opaque 256-bit random values with
only SHA-256 digests persisted. Sessions expire after 12 hours or 30 days when remembered;
logout revokes the row. The first registrant is the sole `owner` of a fresh farm; invites,
extra roles, and farm switching are deferred. Signup does not verify email and there is
no password recovery or login throttling, so open registration is for a private preview
until Phase 9 closes those controls or changes registration policy. No chamber is seeded.
HTTP writes use a `HttpOnly`, `SameSite=Lax`, production-`Secure` cookie plus an in-memory
CSRF token; production origins must be HTTPS.

**Exit gate:** unauthenticated farm access is rejected; another farm's IDs cannot be read,
mutated or replayed; logout and expiry revoke access and clear cached private data;
production startup refuses disabled auth. Exercise through the HTTP API, not route guards.

**Status:** passed for authenticated HTTP access and farm isolation. Verification and
rollout limitations are recorded in the [Phase 8 handoff](project-review-handoff-2026-09-23-phase8.md).

**Recovery:** roll back to the protected-preview boundary; never restore public service by
disabling authentication.

---

## Phase 9 — Release readiness and measurement

**Outcome:** a reproducible release candidate with operational evidence and a measured
startup budget.

Carried forward from the prior plan's Phases 7–8: measure the post-auth production bundle
and startup on a recorded profile (Phase 8 build: main chunk 571.97 kB / 155.14 kB gzip);
set explicit bundle/startup targets; upgrade an empty
and a populated database and verify data after migration; restart API, database, broker and
worker while preserving volumes; restore a backup into a clean environment and record
recovery time and data age; exercise outages and recovery; verify the deployed auth
boundary and secrets handling; record the release decision with remaining limitations.

Phase 9 also closes the limits discovered while wiring real owner accounts. Current
implementation progress:

- Production refuses public self-registration until email verification is configured.
  Owners can be created and passwords manually reset with an interactive operator CLI;
  resetting a password revokes all sessions. Login attempts are limited to five per
  normalized email in a 15-minute window using an HMAC-keyed bucket and `Retry-After`.
- Migration `0013` adds a globally unique, operator-provisioned device registry and the
  persistent login buckets; `0014` adds the expiry-cleanup index. Session-mode API writes
  that assign or reassign a device require an exact registry entry. The simulator worker
  routes registered IDs across farms and claims only that farm's provisioned IDs.
- The worker refuses `APP_ENV=production` because the current anonymous broker and
  simulator messages have no per-device authentication. The sibling simulator and ESP32
  firmware have not been extended with a device credential or signed-message protocol.
  See the [device provisioning guide](../guide/device-provisioning-guide.md).
- The simulator overlay now configures both API and worker for session auth, PostgreSQL,
  and closed self-registration; the API waits for database readiness. Its broker stays
  loopback-only and dispatch remains opt-in.
- The clean-database restore drill passed with Timescale's required pre/post-restore
  hooks. Fresh and populated migration upgrades and the live API/web contract also pass.

See the [Phase 9 handoff checkpoint](project-review-handoff-2026-09-24-phase9-progress.md)
for the verification results, measured budgets, and the exact gates still open.

**Verification checkpoint (2026-09-24):** API 113 tests passed; web 241 tests passed and
coverage scope passed; API/web contract 28 tests passed; fresh and populated migrations
passed; `alembic check`, Ruff, mypy, Biome, and production/simulator Compose config checks
passed. The restore script recovered migration `0014`, farm configuration, one Timescale
telemetry sample, device routing, and owner membership; the isolated custom archive was
73,506 bytes and the dump/restore interval was 0.59 seconds. Session-mode local `/readyz`
startup measured 959 ms. The production-mode frontend build's main JavaScript chunk was
573.27 kB (155.43 kB gzip); provisional local guardrails are 160 kB gzip for the entry
chunk and 5 seconds for API readiness. These are development
measurements, not production SLOs. Reproduce them with
`apps/api/scripts/verify_backup_restore.py`,
`apps/api/scripts/verify_live_contract.py`, and
`apps/api/scripts/measure_session_startup.py`.

The phase is **in progress**, not release-ready. Email verification/self-service recovery,
commissioned hardware authentication and tests, database/broker/worker restart and outage
drills with retained volumes, and a production-environment restore exercise remain open.
The local bundle/startup guardrails passed the measured build and readiness smoke test;
they have not been observed on the deployment host. Existing farm-local serials duplicated
across farms are not auto-claimed; an operator must verify and provision a new globally
unique ID. Physical relay/motor/heater operation remains outside the authorization granted
here.

**Exit gate:** evidence identifies revision, configuration, commands and results; restore
and restart drills pass; no unresolved authentication or command-integrity blocker remains.

---

## 6. Gate block (corrected, runnable)

```sh
export TEST_DATABASE_URL=postgresql+asyncpg://eggcelerate:eggcelerate_test@127.0.0.1:55432/eggcelerate_test
# disposable database: docker compose --profile database-test up -d --wait db-test
# probe it by image, not by name: docker ps --filter ancestor=timescale/timescaledb:2.30.0-pg17

pnpm lint
pnpm --filter eggcelerate-ui typecheck
pnpm --filter eggcelerate-ui test
pnpm --filter eggcelerate-ui coverage
pnpm --filter eggcelerate-ui build

apps/api/.venv/bin/ruff check apps/api
apps/api/.venv/bin/ruff format --check apps/api
(cd apps/api && .venv/bin/mypy)
apps/api/.venv/bin/python apps/api/scripts/verify_migrations.py
apps/api/.venv/bin/python -m pytest -q apps/api/tests --require-database
apps/api/.venv/bin/python apps/api/scripts/verify_live_contract.py
```

The baseline results above are historical. Current warning counts and gate outcomes are
recorded in the phase handoffs; warnings must never obscure a failure, a skipped
integration test or a failed migration.

---

## 7. Sequencing rationale

The original order put Phase 1 first because the only gate that exercised the real
transport was red and the running preview reported a healthy-looking seeded farm as
twelve critical chambers; every other measurement was untrustworthy while that was true.
Phases 2 and 3 are the
correctness defects that produce "the system reports unhealthy while the device is fine" —
the exact scenario the product exists for — and Phase 3 depends on Phase 2's shared
tolerance constant. Phase 4 restores the decision record the handoffs depend on, and
Phase 5 depends on it because the documentation names the switches Phase 5 wires. Phase 6
comes after the fixes it must protect, because converting 85 source-text tests is only
worthwhile once the behaviour they should assert is settled. Phase 7 is the largest slice
and consumes the decisions from Phase 1 (D-1) and the constant from Phase 2. Phase 8 is
the product gate, and Phase 9 establishes readiness rather than performing a deployment.

## 8. Tracking and completion

For every phase record: date, revision, changed areas, checks and results, known
limitations, next eligible phase. Mark a phase complete only when its exit gate passes;
if a dependency fails, record the phase as blocked with evidence instead of carrying a
silent exception. Update the corrected baseline table in §1 whenever a gate number changes.

**Limits of the initial review:** static reading of the listed sources plus the executed
gates and the two preserved reproducers; no browser session, rendered-component run,
penetration test, load test, or GitHub-side verification of workflow or branch-protection
state. The simulator repository was subsequently tested in Phase 2. WS-5, F6, D5, D2 and
parts of API-02 were code-read and marked `likely` rather than reproduced.
