# Project review remediation plan — 2026-09-23

> **Superseded 2026-09-23** by [project-review-execution-plan-2026-09-23.md](project-review-execution-plan-2026-09-23.md),
> which re-verified every finding below against the tree and corrected the baseline table.
> Keep this file as the finding list it produced; one finding (6, `GET /incubators/{id}`
> 404 parity) is refuted there and finding 16 is only partly reproducible.

**Author:** Claude Code review session
**Base:** `experiment` @ `e391a1e`, 59 uncommitted files (44 modified, 15 untracked)
**Scope:** remediation of the findings in the 2026-09-23 project review, ordered by
risk, executed one phase at a time. Each phase is independently verifiable and
independently revertable.

> **Tracking note:** at the time this superseded plan was written, `docs/refine` was
> ignored. Phase 4 applied D-2 by adding `!docs/refine` to `.gitignore`; the review
> record and handoffs are now versioned.

## Verified baseline (commands actually run, 2026-09-23)

| Gate | Result |
|---|---|
| `ruff check apps/api` + `ruff format --check apps/api` | pass, 68 files |
| `mypy` (from `apps/api`) | pass, 35 source files |
| `biome check .` | pass, 174 files |
| `pnpm --filter eggcelerate-ui typecheck` | pass |
| `pnpm --filter eggcelerate-ui test` | 298 passed / 36 files |
| `pnpm --filter eggcelerate-ui coverage` | 90.87% lines / 82.79% branches / 89.01% funcs |
| `pytest apps/api/tests --require-database` | **87 passed, 0 skipped**, 4 warnings |

The disposable `eggcelerate-db-test` container is running on `127.0.0.1:55432`, so
every database-backed gate in `docs/guide/verification-gates.md` is runnable
locally without bringing anything new up. The "87 passed, zero skips" handoff
claim is now verified rather than assumed.

## Findings → phases

| # | Finding | Severity | Phase |
|---|---|---|---|
| 1 | Correct turn can be reported `timed_out` (zero ACK clock tolerance) | High | 1 |
| 2 | Rebooted device stuck stale/offline despite publishing | High | 2 |
| 3 | Entire Phase 4/5 work uncommitted, including CI and migrations | High | 0 |
| 4 | Evidence trail gitignored; tracked docs link into it | High | 4 |
| 5 | `SYSTEM_ARCHITECTURE_GUIDE.md` materially false | High | 4 |
| 6 | `GET /incubators/{id}` returns 200+empty instead of 404 | Medium | 3 |
| 7 | Optimistic-patch routing keyed on exact key set | Medium | 6 |
| 8 | `GET .../commands/{id}` has no frontend consumer | Medium | 6 |
| 9 | Documented `VITE_LIVE_REFRESH_ENABLED` switch not wired for deploys | Medium | 5 |
| 10 | Coverage gate excludes every screen and component | Medium | 6 |
| 11 | Python version drift (3.11 declared / 3.13 image / 3.14 CI) | Low | 5 |
| 12 | API container runs as root | Low | 5 |
| 13 | Simulator profile not end-to-end usable from this checkout | Low | 5 |
| 14 | `database-setup-guide.md` migration list stale | Low | 4 |
| 15 | `api.yml` has no `concurrency` group | Low | 5 |
| 16 | Unexplained Pydantic `UnsupportedFieldAttributeWarning` | Open | 6 |

---

## Phase 0 — Preserve the work (do first, needs owner approval)

**Why:** every other phase is worthless if this working tree is lost. It contains
two completed phases (4 and 5), two migrations, the API CI workflow, and the
untracked test files that evidence them.

**Actions**
1. Confirm the intended commit boundary. Recommendation: one commit for the
   Phase 4 command closure, one for Phase 5 telemetry/freshness, and a separate
   commit for `api.yml` + `scripts/verify_migrations.py` so a CI regression is
   revertable without unwinding feature work.
2. `git add` the untracked files that must not be lost — at minimum
   `.github/workflows/api.yml`, both migrations, `database/queries.py`,
   `mqtt/commands.py`, `mqtt/worker.py`, `database/schema.py` additions, the new
   tests, `infrastructure/mosquitto.conf`, `compose.simulator.yaml`.
3. Commit the sibling simulator repository (`/home/mawi/Projects/eggcelerate-simulate`)
   separately. The API contract now **hard-requires** `boot_id`/`booted_at`; an
   unpushed sender is a broken deployment waiting to happen.
4. Record the commit SHAs in the Phase 4/5 handoffs, replacing "All changes are
   currently uncommitted in both repositories."

**Verification:** `git status --short` shows no untracked work in either tree;
`git log --oneline -3` shows the new commits.

**Do not:** create a commit without explicit approval. Commit messages must end
with the repository's required `Co-Authored-By` attribution line.

---

## Phase 1 — ACK clock tolerance (finding 1)

**Why:** worst possible failure mode. A device that physically turned the eggs and
reported success has its ACK rejected as `validation_error` and the command expires
as `timed_out`. The dashboard then tells the operator the turn did not happen.

**Root cause** — `apps/api/src/eggcelerate_api/mqtt/commands.py`
- L124 `if now >= row["expires_at"]:` expires on **receipt** time, not execution.
- L134 `if row["attempts"] < 1 or not row["requested_at"] <= ack.observed_at <= now:`
  demands the device clock sit inside a zero-width window against the server clock.
  Telemetry deliberately allows 5 minutes of skew (`mqtt/telemetry.py:58`); ACKs
  allow none. The asymmetry is the bug.

**Design**
1. Introduce a shared tolerance constant, e.g. `DEVICE_CLOCK_TOLERANCE = timedelta(seconds=60)`,
   and use it for both the ACK window and the existing telemetry future check so
   the two boundaries cannot drift apart again.
2. Judge the **deadline by execution**: if `ack.observed_at > row["expires_at"]`
   the device executed too late → `timed_out`. Receipt after the deadline but
   execution inside it → accept.
3. Widen the plausibility window: `requested_at - TOL <= ack.observed_at <= now + TOL`.

**Must not regress**
- `test_durable_outcomes_and_terminal_precedence[timed_out]` sets `expires_at` in
  the past then ACKs with `observed_at = now`; under the new rule
  `observed_at > expires_at` → still `timed_out`. Confirmed by reading the test.
- Temporary ACK failures are still rejected: they raise, so `apply_ack` is not
  retried when the device clock is far off — that behaviour is unchanged and correct.

**New tests** (add to `apps/api/tests/test_device_commands.py`)
- ACK with `observed_at` ~10s in the future → `acked`, cursor advances.
- ACK received just after `expires_at` but with `observed_at` before it → `acked`.
- ACK with `observed_at` well past `expires_at` → `timed_out`.
- ACK with `observed_at` far in the future (beyond tolerance) → rejected, no cursor change.

**Verification:** `pytest apps/api/tests/test_device_commands.py --require-database`
then the full DB suite; `ruff` + `mypy`.

---

## Phase 2 — Boot-aware projection recovery (finding 2)

**Why:** a device that reboots with forward clock skew (or an unsynchronised RTC)
publishes telemetry that is *newer* by boot identity but *older* by observation
time. Raw history accepts it; the projection never advances; `last_seen_at` stays
frozen; the dashboard reports the healthy chamber as `stale` then `offline`.
The Phase 5 note covers the backwards clock but not this case, which is the more
likely one after a power cut — precisely when the operator needs the dashboard.

**Root cause** — `apps/api/src/eggcelerate_api/mqtt/telemetry.py:88-96`. The `newer`
predicate requires `observed_at > current["observed_at"]` for *every* branch,
including a new boot.

**Design**
- A different `boot_id` with a strictly later `booted_at` replaces the projection
  **regardless of `observed_at`** — observation time from a booted device is not
  trustworthy until its clock is established.
- Same-boot ordering keeps *both* gates (`seq > current.seq` **and**
  `observed_at > current.observed_at`) so late/replayed same-boot messages still
  cannot regress the projection.
- The existing conflicting-sequence rejection (L98-108) is unchanged.

**Must not regress** — `test_restart_ordering_duplicate_and_offline_recovery` sends
boot `"first"` with an older `observed_at` *after* boot `"second"` and asserts the
projection is unchanged. Under the new rule `first.booted_at < second.booted_at`
→ not newer. Confirmed by reading the test.

**New tests**
- New boot, later `booted_at`, earlier `observed_at` → projection advances, status
  returns to `fresh` (the fix).
- New boot with an *earlier* `booted_at` → no change.
- Same boot, higher `seq`, earlier `observed_at` → no change (regression guard).

**Verification:** `pytest apps/api/tests/test_mqtt_telemetry.py --require-database`
plus the full suite. Consider a short note in `docs/guide/b4-mqtt-contract.md`
documenting the boot-identity-over-clock precedence rule.

---

## Phase 3 — `GET /incubators/{id}` 404 parity (finding 6)

**Why:** the API adapter is told "success" with no body for a chamber that does not
exist, while the mock adapter returns `not_found`. The two adapters are supposed to
satisfy one shared contract, and this divergence is untested.

**Root cause** — `database/queries.py`: for `incubators`/`modes` with a `public_id`,
the scoped query simply matches nothing and `load_incubators` yields an empty map.
The route then answers 200 with empty data. Memory mode raises `not_found`.

**Design** — in `read_state`, when `public_id is not None` and the resource is
`incubators` or `modes`, raise `AppError("not_found", ...)` if the scoped result is
empty. Keep the existing `offline` semantics for unseeded farms.

**New test** — extend `apps/api/tests/test_postgres_queries.py`: `GET /incubators/missing`
→ 404, matching the memory adapter's contract.

**Verification:** full DB suite; confirm `repository-contract.test.ts` still passes
against the live API (`scripts/verify_live_contract.py`).

---

## Phase 4 — Documentation truth pass (findings 4, 5, 14)

**Why:** `docs/guide/README.md` calls `SYSTEM_ARCHITECTURE_GUIDE.md` the source of
truth, and the tracked back-end guide is the stated resume instruction. Both
currently misdescribe the system, and the tracked docs link to files a fresh clone
cannot open.

**Decision recorded in Phase 4:** Option A was applied. `docs/refine` is tracked, and
local citations were corrected and checked against a fresh-clone file view.

**Actions**
1. Resolve the decision above, then make every citation resolve in a fresh clone.
2. Fix the four dead links in `docs/SYSTEM_ARCHITECTURE_GUIDE.md`
   (`refine/mobile-web-refinement-plan.md` and `audit/README.md` do not exist even
   on disk; two `docs/plan/*` targets are ignored).
3. Refresh the false status lines in `SYSTEM_ARCHITECTURE_GUIDE.md`:
   - L46 / L68 — FastAPI, Postgres/TimescaleDB, Mosquitto, and the simulator are
     described as "Planned; not configured" / "not implemented". All four exist.
   - L150-162 — "only web is currently defined", "No ESP32 firmware or MQTT
     simulator exists in the repository".
   - L526 — B1 checklist items 1-7 are largely complete; record what remains (B6).
   - Test-count references (159 / 155) → 298, or drop the counts and point at CI.
4. Fix `docs/guide/database-setup-guide.md:160-161`: "Migration 0003 creates command
   audit storage. Migration 0004 creates the empty telemetry hypertable" — actual
   history is 0004 = alerts, 0007 = telemetry, 0008 = commands, 0009 = projection.

**Verification:** re-run the link checker over `README.md`,
`docs/SYSTEM_ARCHITECTURE_GUIDE.md`, `docs/guide/*.md`, `apps/*/README.md` and
confirm zero dead or ignored-target links.

---

## Phase 5 — Deployment and CI configuration (findings 9, 11, 12, 13, 15)

Small, independent, low-risk edits; one commit.

1. **Wire the documented kill switch (9).** Add `ARG`/`ENV VITE_LIVE_REFRESH_ENABLED`
   to `apps/web/Dockerfile` and pass it from `compose.yaml`'s `web.build.args`.
   Today `docs/guide/b4-mqtt-contract.md:120` tells operators to "build with
   `VITE_LIVE_REFRESH_ENABLED=false`", but the Dockerfile never declares the
   variable, so the documented rollback requires editing the image definition.
2. **Python version policy (11).** Pick one: either raise `requires-python` and
   `[tool.mypy] python_version` to the shipped interpreter, or test the floor in CI.
   Recommend declaring what ships and adding a CI matrix only for the floor.
3. **Non-root API container (12).** Add a `USER` to `apps/api/Dockerfile`.
4. **Simulator profile note (13).** `compose.simulator.yaml` defines only `broker`
   and `mqtt-worker`; the broker publishes no host port and the simulator lives in
   another repository. Add a comment stating how the simulator is expected to reach
   the broker, or publish a loopback port for the documented workflow.
5. **CI concurrency (15).** Add a `concurrency` group to `.github/workflows/api.yml`
   so superseded pushes stop consuming a 15-minute Timescale job.
6. **Note the loopback-check limit.** `apps/web/Dockerfile`'s "must not contain a
   loopback URL" guard greps for literal `localhost`/`127.0.0.1` only; it would not
   catch `[::1]` or a bare `0.0.0.0`. Document the narrow guarantee.

**Verification:** `docker compose config` renders; a local `docker build` of the web
image with `VITE_DATA_SOURCE=api VITE_LIVE_REFRESH_ENABLED=false` succeeds and the
flag is honoured.

---

## Phase 6 — Frontend completion (findings 7, 8, 10, and open item 16)

**Why this is last:** the frontend review was incomplete. Three delegated reviews
died on provider errors, so `LiveMonitorTab.tsx`, `HardwarePanel.tsx`,
`DeviceSettingsTab.tsx`, `Timeline.tsx`, and the `in-memory` vs `api` adapter
divergence were never examined. Do the review *before* changing that code.

1. **Complete the review** of the files listed above. Everything found feeds the
   same triage: fix now, or record as a known limitation.
2. **Finding 7 — key-set dispatch.** `use-farm-data.ts:144,295,356` routes a patch
   whose keys are exactly `["lastTurned","nextTurn"]` to `requestManualTurn`.
   `resetChamberToReady()` is safe today only because `RESET_PATCH_KEYS` is checked
   first at L265. Any future screen patch carrying exactly those two keys silently
   issues a device turn. Replace name-based dispatch with an explicit intent.
3. **Finding 8 — unused endpoint.** `GET /incubators/{id}/commands/{command_id}` has
   no frontend consumer; the UI relies on the 15s summary poll. Either wire it for
   faster pending→acked feedback or document it as integration-only.
4. **Finding 10 — coverage gate.** `vitest.config.ts:17-24` gates only
   `domain/data/features/providers/routing`, so the 619-line `TrendsScreen` rewrite
   and the `LiveMonitorTab` freshness work are unenforced, and `data/dto.ts` sits at
   57%/40% inside the gate. Add `components/**` as a frozen-floor ratchet once
   rendered coverage exists (the F6 note anticipates exactly this).
5. **Open item 16 — Pydantic warning.** `UnsupportedFieldAttributeWarning: The 'alias'
   attribute with value 'incubator_id' ... has no effect ... attached to a single
   member of a union type` fires only under
   `test_postgres_incubators.py::test_separate_instances_cannot_double_assign_device`
   (the threaded parametrization) and does not reproduce in isolation — suspected
   concurrent schema-build artifact, not a code defect. Time-box an investigation;
   if it is a genuine ignored `Field(alias=...)`, that is a correctness bug worth a
   separate finding.

**Verification:** full frontend gate (`typecheck`, `test`, `coverage`, `build`) plus
`pnpm lint`.

---

## Gate to run at the end of every phase

Per `docs/guide/verification-gates.md`, using the already-running test container:

```sh
export TEST_DATABASE_URL=postgresql+asyncpg://eggcelerate:eggcelerate_test@127.0.0.1:55432/eggcelerate_test
apps/api/.venv/bin/ruff check apps/api
apps/api/.venv/bin/ruff format --check apps/api
(cd apps/api && ../.venv/bin/mypy)
apps/api/.venv/bin/python apps/api/scripts/verify_migrations.py
apps/api/.venv/bin/python -m pytest -q apps/api/tests --require-database
apps/api/.venv/bin/python apps/api/scripts/verify_live_contract.py
pnpm lint && pnpm --filter eggcelerate-ui typecheck
pnpm --filter eggcelerate-ui coverage && pnpm --filter eggcelerate-ui build
```

## Sequencing rationale

Phases 1-2 are correctness defects that produce "healthy system reports unhealthy"
outcomes during a power event — the exact scenario the product exists for. Phase 3
is contract drift with a cheap fix. Phase 4 restores the decision record that
everything else depends on for handoff. Phase 5 is config hygiene. Phase 6 is last
because it needs an uninformed code review as its input, not a list of fixes.
