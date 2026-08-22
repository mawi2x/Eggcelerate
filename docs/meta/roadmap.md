# Eggcelerate — Gaps, Risks & Roadmap

> Derived from code-verified findings in `docs/meta/review.md:8` + `docs/codex/README.md:146` + `docs/review-adr.md:19`. Phases are sequential; each exits with a gate.

---

## 1. Risk matrix

| # | Risk | Severity | Likelihood | Where | Mitigation |
|---|---|---|---|---|---|
| R1 | Thermal runaway on network/server loss (heater stuck ON) | **Critical** — kills hatch | High if ESP32 stays stateless | `docs/review-adr.md:19` | Adopt local-first ESP32: NVS setpoints + watchdog + hardware cutoff before any device rollout |
| R2 | Derived-state drift after mode edit (severity stale) | High — wrong Urgent/Optimal | Certain on mode patch | `src/app/App.tsx:172` | Bulk recalc or pure derive in render |
| R3 | All data lost on reload (no persistence) | High — demo/data loss | Always | `src/app/data/mockData.ts:1` | Phase 1 repository boundary + local + server persistence |
| R4 | Bundle eager loads all screens (956 KB) | Medium — slow on farmer 3G | Always | `src/app/App.tsx:6` | `React.lazy` + chunk budget |
| R5 | No tests — hatchability/status regressions silent | High — wrong farmer decisions | High | `package.json:6` | Phase 1 vitest over `cycle.ts:1` + `mockData.ts:562` |
| R6 | Dark palette unbranded, contrast un-audited | Medium — a11y | Ship-time | `src/styles/theme.css:46` | Token pass + axe audit |
| R7 | 12 chambers always shown vs single real device | Medium — misrepresentation in eval | Demo | `mockData.ts:219` vs spec §3 | Single-chamber demo flag |
| R8 | Hard-coded colors bypass tokens | Low — drift | Ongoing | `TrendsScreen.tsx:58` etc. | Token consolidation |

---

## 2. Gap analysis vs spec (38-section final spec)

| Spec § | Requirement | Current | Gap |
|---|---|---|---|
| §1 Positioning | Small-scale prototype, scalable arch | Tray 38 (`mockData.ts:41`) correct; multi-arch kept | Paper wording still says medium-scale in some docs — fix manuscript per spec |
| §2 Capacity | Mode does NOT set capacity; tray 38 | Mode has no capacity field — correct | Future: `Installed Tray Capacity` device setting (not needed now) |
| §3 Multi-incubator | Add Incubator kept; demo shows only real device | Shows 12 always | Add demo flag to filter to 1 |
| §4 Terminology | Card = Incubator/EGGCELERATE 01, not Chamber | Still `Chamber One` (`mockData.ts:221`) | Rename display label, keep id |
| §5 Overview KPIs | Active, Eggs, Upcoming Hatch, Needs Attention (remove Top Mode) | Matches (`OverviewScreen.tsx:195`) | None |
| §6 Phase vs condition | Separate; compact display `Lockdown · Optimal` | `cyclePhase` + `conditionSeverity` separate (`App.tsx:198`) | OK |
| §7 Lockdown | Guidance `Do Not Open · Turning Stopped`, autoTurn off | `autoTurn: false` in lockdown (`mockData.ts:342`); guidance present in Detail | Done |
| §8 Finish | Only `Chicks Hatched` input; display read-only fertile/clear/stopped | `HarvestModal.tsx` + `calculateHatchabilityRate` (`mockData.ts:567`) | Verify modal asks only hatched |
| §9 Hatchability | `hatched/fertile*100`, else Not Available | Implemented (`mockData.ts:567`, `TrendsScreen.tsx:703`) | None |
| §10–12 Cycle flow | Hatching→Awaiting Finish→Completed; overtime Day 22+; early stop = Stopped Early | `cyclePhaseFromDay` (`cycle.ts:80`) + aborted record (`mockData.ts:532`) | UI for Stop Cycle under Advanced — confirm path exists |
| §13–18 Candling | First Fertile/Clear/Uncertain, later Developing/…/Stopped, cumulative, resolve before lockdown, show previous | Enforced (`CandlingJournalTab.tsx:915`, `mockData.ts:73`) | None |
| §22 Water | Binary Normal/Low + alert, float sensor in paper | `waterOk: boolean` (`mockData.ts:101`), `waterState` (`mockData.ts:122`) | Add sensor to BOM/schematic/manuscript |
| §23 Battery | Keep UI, mark provisional | Present (`PowerIndicator.tsx`) | Manuscript must not claim validated % |
| §24 SMS/Email | Toggles future, in-app only now | Toggles present | Paper must not claim delivery |
| §28 Hysteresis | Heater/mist with hysteresis, not target-max | Not wired (no actuator control yet) — future ESP32 PID | Define hysteresis values in ModeDTO |
| §30 Logging | Sampling configurable, research fixed 5 min | Mock 2h steps (`mockData.ts:356`) | Add dual intervals in settings + docs |
| §32 Reconnect | Connecting… → Connected / Failed flow | `ConnectionState` enum has `connecting/failed` (`cycle.ts:12`) but UI still binary | Implement real flow |

---

## 3. Phased roadmap

### Phase 1 — Stabilize the prototype (1–2 weeks) — **Gate: typecheck+tests+lint+build green**

- [ ] Add `vitest` + `jsdom` + `testing-library/react`; scripts `test`, `test:watch`, `coverage` in `package.json:6`. Cover:
  - `cycle.ts:40` deriveSeverity — all thresholds + precedence
  - `cycle.ts:80` cyclePhaseFromDay — all 7 phases + boundaries
  - `mockData.ts:562` calculateFertility/Hatchability — null edges, rounding
  - `getKnownFertileEggs`, `daysUntilHatch`, `getUnitIssues`
  - Candling validation (zero, over-capacity, uncertain on lockdown)
  - Mode delete guard (`App.tsx:182`)
  - Nav restoration (`App.tsx:26` round-trip `?screen=&unit=`)
- [ ] Fix derived-state drift: on `updateMode` bulk-recalc all units on that mode or move derive to render.
- [ ] Extract DTOs + `Result<T>` per `docs/meta/domain.md:7`; add `zod` validation.
- [ ] Add `Biome` or `ESLint` + `prettier`; gate in CI.
- [ ] Add `React.lazy` for `TrendsScreen` + `Detail/CandlingJournalTab`; set chunk budget 600 KB.
- [ ] Single-chamber demo mode flag (filter `initialIncubators` to 1 when `DEMO_SINGLE=true`).
- [ ] Adopt ESP32 local-first design (`docs/review-adr.md:42`) — sync_setpoints NVS flow.

**Exit gate:** `npm run typecheck && npm run test -- --coverage && npm run build` passes; coverage >80% on `domain/` + calcs.

### Phase 2 — Establish the application shell (2–3 weeks) — **Gate: routed + cached + auth-aware**

- [ ] Introduce real router (`wouter` or `TanStack Router`) preserving deep links (`?screen&unit` → `/incubators/:id` + redirect).
- [ ] Add server-state layer `TanStack Query` (`docs/review-adr.md:140`); feature hooks `useIncubators()`, `useModes()`, `useReadings(range)`, `useAlerts()`, `useHatchHistory()`.
- [ ] Implement global auth (JWT httpOnly cookie per `ADR-004`); `Account` from server, not hardcoded (`account.ts`).
- [ ] Loading / empty / stale / offline / retry / permission skeletons per screen.
- [ ] Lazy-load + prefetch; measure LCP/CLS; add `web-vitals`.
- [ ] Keep mock adapter behind `REPOSITORY=mock|api` switch.

**Exit gate:** app runs against mock *and* stubbed REST (MSW) with identical UI; no `mockData` import outside `data/` boundary.

### Phase 3 — Integrate safely (3–5 weeks) — **Gate: read-live, write-acknowledged**

- [ ] Read path first: `GET /api/v1/incubators` + `GET /history?from&to` replaces `buildHistory` (`TrendsScreen.tsx:198`) with paginated range query.
- [ ] Alerts stream: REST history + WS live inserts; `NotificationPopover` badge stays correct.
- [ ] Command ACK semantics before enabling actuator writes: `POST /devices/{id}/command` + optimistic update + 5s timeout + rollback toast (`docs/review-adr.md:185`).
- [ ] Cycle + candling + photo upload persistence (`multipart` or presigned S3); enforce photo 5 MB + image type server-side too.
- [ ] Harvest/abort persistence (`recordHarvest` → `POST /cycles/finish`).

**Exit gate:** farmer can pair device → start cycle → log 3 candlings → reach lockdown → finish with hatchability — all persisted server-side.

### Phase 4 — Production hardening (2–4 weeks) — **Gate: a11y, perf, chaos**

- [ ] E2E (Playwright) against test backend + device simulator — happy path + disconnect/reconnect, delayed telemetry, duplicate events, clock drift.
- [ ] Observability: error reporting, structured logs, perf monitoring, audit trail (who changed mode, who finished cycle).
- [ ] a11y: keyboard, screen-reader, contrast, `prefers-reduced-motion`, hit axe 0 violations.
- [ ] Authorization: RBAC, per-command server validation.
- [ ] Chaos: kill broker/backend/MQTT mid-incubation — verify ESP32 holds safe temp + recovers.

---

## 4. Production checklist (definition of done)

- [ ] No `mockData.ts` import outside `data/` boundary
- [ ] All screens lazy; initial JS <600 KB gzip total
- [ ] `vitest` coverage on `domain/` ≥80%
- [ ] `tsc --noEmit` strict; lint 0 errors
- [ ] WS reconnection pill + polling fallback visible
- [ ] Command pending/ack/reject/timeout states covered
- [ ] Dark palette branded or dark toggle removed
- [ ] Manuscript updated for 38-egg tray, float sensor, candling taxonomy, fertility/hatchability defs, hysteresis, 5-min research log
- [ ] ADRs 005/006 amended to local-first ESP32 (`review-adr.md:198`)

---

## 5. Next 3 PRs (concrete)

1. **PR #1 — Tests + DTOs:** add `vitest`, 25 unit tests, `src/app/data/dto.ts` + `Result` — no UI change.
2. **PR #2 — Derive fix + lazy:** fix `App.tsx:172` bulk recalc, `React.lazy(TrendsScreen)` + `CandlingJournalTab`, demo flag.
3. **PR #3 — Repo boundary:** extract `IncubatorRepository` interface, move `buildHistory`/`recordHarvest` behind it, add `MockRepository` vs `ApiRepository` stub.

Each PR runs `npm run typecheck` + `npm run build` in CI and updates the corresponding `docs/meta/*.md`.
