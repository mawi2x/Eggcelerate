# Eggcelerate UI — Project Review (meta)

**Date:** 2026-08-21 · **Scope:** working tree (`src/`, `package.json:1`, `tsconfig.json:1`, `vite.config.ts:1`, `docs/`, `flow/`) · **Reviewer:** Muse Spark (code-verified)  
**Build verification:** `npm run typecheck` + `npm run build` — see §9

---

## 1. Executive summary

Eggcelerate UI is a **polished React 18 SPA prototype** for small-scale poultry incubation monitoring (6 screens, state-driven navigation, mock data only). Visual quality and domain modeling are strong; production readiness is not — persistence, auth, real-time, and tests are absent.

| Verdict | Detail |
|---|---|
| **Strength** | Consistent brand, strict TS (`tsconfig.json:15`), isolated domain logic (`src/app/domain/cycle.ts:1`), responsive nav (`src/app/components/AppSidebar.tsx:48`), well-decomposed detail tabs |
| **Risk** | All operational data is in-memory mock (`src/app/data/mockData.ts:1`); no API, no tests, no state library; bundle eagerly loads all screens (per `docs/codex/README.md:126`) |
| **Recommendation** | Stabilize contracts + tests (Phase 1) before any backend wiring — see `docs/meta/roadmap.md` |

---

## 2. Tech stack (source of truth: `package.json:11`)

| Layer | Technology | Evidence |
|---|---|---|
| Framework | React 18.3.1 | `package.json:43` peer |
| Build | Vite 6.3.5 + `@vitejs/plugin-react:4.7.0` | `package.json:40`, `vite.config.ts:19` |
| Lang | TypeScript 5.6.3, `strict:true`, `noUnusedLocals` | `tsconfig.json:15` |
| Styling | Tailwind CSS 4.1.12 (`@tailwindcss/vite`) + CSS vars | `package.json:33`, `src/styles/theme.css:3`, `src/styles/tailwind.css` |
| UI | shadcn/ui pattern on Radix (alert-dialog, dialog, select, switch, etc.) — 9 primitives actually imported | `package.json:12`, `src/app/components/ui/` (11 files) |
| Icons | lucide-react 0.487.0 | `src/app/components/screens/OverviewScreen.tsx:1` |
| Charts | recharts 2.15.2 | `src/app/components/screens/TrendsScreen.tsx:1` |
| Toast | sonner 2.0.3 | `src/app/App.tsx:2` |
| Animation | motion 12.23.24 + tw-animate-css 1.3.8 | `package.json:25` |
| Routing | **None** — `useState<ScreenId>` + query-string sync | `src/app/App.tsx:36` |
| State | **None** — root `useState` in `App.tsx:70`, local `useState` per screen | `src/app/App.tsx:70` |
| HTTP | **None** — `src/app/data/mockData.ts:1` is the sole source | `src/app/App.tsx:13` |
| Theming | `next-themes` + `.dark` class | `package.json:26`, `src/styles/theme.css:46` |
| Fonts | Baloo 2 (display), Nunito (body) via `src/styles/fonts.css` | `src/styles/theme.css:5` |
| Assets | `figma:asset/` resolver → `src/assets/` | `vite.config.ts:7` |

**Note — docs drift:** `docs/tech-stack.md:12` lists react-hook-form, react-dnd, date-fns, embla, cmdk, vaul, etc. None appear in current `package.json:11`. `docs/frontend-review.md:18` similarly overstates retained libs. `package.json` is authoritative; `docs/meta/` corrects this.

---

## 3. Project structure (verified via `glob src/**/*`)

```
src/
├── main.tsx                          # entry — createRoot(<App />)
├── styles/
│   ├── index.css                     # aggregator → tailwind.css + theme.css + fonts.css
│   ├── theme.css                     # brand tokens + @theme inline + dark vars
│   ├── tailwind.css
│   └── fonts.css
├── app/
│   ├── App.tsx                       # composition root, nav, state, derivations
│   ├── domain/cycle.ts               # isolated domain rules (phase, severity)
│   ├── data/mockData.ts              # types + fixtures + generators + history
│   ├── data/account.ts               # Account type + localStorage for contacts
│   ├── components/
│   │   ├── ui/                       # 11 primitives (button, dialog, card, select, etc.)
│   │   ├── screens/ (6)              # Overview, Incubators, Detail, Trends, Alerts, Settings
│   │   ├── detail/ (8)               # LiveMonitor, CandlingJournal, DeviceSettings, Timeline, …
│   │   ├── settings/ (4)             # FarmAccount, Hardware, Notifications, ModeLibrary
│   │   ├── alerts/                   # NotificationPopover, alertStyle
│   │   ├── candling/                 # EggIcons
│   │   ├── AppSidebar.tsx            # 64px rail / 256px panel + mobile bottom nav
│   │   ├── PageHeader.tsx            # title/subtitle/badges + back + bell
│   │   ├── GaugeDial.tsx / StatusBadge.tsx / PowerIndicator.tsx / …
│   │   └── figma/ImageWithFallback.tsx
│   └── imports/                      # logo-app.png
```

---

## 4. Screens (6) — behavior & evidence

### 4.1 Overview — `src/app/components/screens/OverviewScreen.tsx:149`
- 4 KPI cards (Incubators, Eggs, Upcoming Hatch, Needs Attention) with watermark icons.
- Priority grid shows **top 4 chambers** sorted `alert → warning → optimal` (`OverviewScreen.tsx:182`), each a ring-progress button.
- Stats derived memo: `units.length`, `totalEggs`, `needsAttention`, `nextHatch.remaining` (`OverviewScreen.tsx:152`).

### 4.2 Incubators — `IncubatorsScreen.tsx:1`
- Grid/list toggle, search, status filter, Add Incubator dialog, pairing simulation, cycle start flow.
- Receives `onAddIncubator`, `onUpdateUnit` from `App.tsx:168`.

### 4.3 Detail — `DetailScreen.tsx:1` + `detail/`
- Tabbed: LiveMonitor (`LiveMonitorTab.tsx:1`), CandlingJournal (`CandlingJournalTab.tsx:830`), DeviceSettings, Timeline, Calendar.
- Inline badges: `Day X of Y` + `Normal/Needs Attention` (`App.tsx:198`).
- AutoTurn forced off in lockdown/hatching/awaiting_finish (`mockData.ts:342`).

### 4.4 Trends — `TrendsScreen.tsx:149` (825 lines — largest file)
- Dual view toggle: Environmental vs Hatch History (`TrendsScreen.tsx:149`).
- Environmental: toolbar (chamber select, compare toggle, metric temp/humidity, range 24h/7d/full), `ComposedChart` with `ReferenceArea` bands, auto-scaled `domain` (`TrendsScreen.tsx:217`), compare multi-select popover (>=2 chambers enforced, `TrendsScreen.tsx:261`), CSV export (`TrendsScreen.tsx:277`).
- Hatch History: KPIs (cycles, avg hatchability, hatched), search + species filter, paginated table (10 rows, `TrendsScreen.tsx:96`), `calculateHatchabilityRate` coloring.
- History generated by `buildHistory()` per unit: `stepHours=2`, `elapsedDays = dayOfIncubation`, wobble + alert excursions (`mockData.ts:352`).

### 4.5 Alerts — `AlertsScreen.tsx:1`
- Filterable feed by severity, acknowledge/dismiss, mark-all-read, clear-read, navigate to unit via `onOpenUnit` (`App.tsx:371`).

### 4.6 Settings — `SettingsScreen.tsx:1`
- ModeLibraryPanel: CRUD + JSON import/export + delete protection (`App.tsx:182`).
- NotificationsPanel, FarmAccountPanel (`localStorage` for contacts), HardwarePanel.

---

## 5. Navigation & URL contract — `src/app/App.tsx:26`

- **No router.** `getInitialNavState()` parses `?screen=&unit=` (`App.tsx:26`), validates against `validScreens: ["overview",…]`.
- `syncUrl(newScreen, newUnit, replace)` pushes `history.pushState` or `replaceState` (`App.tsx:42`); `popstate` listener restores state (`App.tsx:60`).
- `detail` is a sub-view of `incubators` in sidebar (`AppSidebar.tsx:53`); page header shows back button only on detail (`App.tsx:319`).
- **Finding:** query-string sync is well implemented; recommended to replace with `wouter`/`TanStack Router` + lazy loading when routes stabilize (see roadmap).

---

## 6. Domain truth — verified

All below is authoritative and cited; see `docs/meta/domain.md` for full contracts.

- **CyclePhase** 7 states, display labels in `cycle.ts:18`; derived via `cyclePhaseFromDay({day, incubationDays, lockdownDay})` (`cycle.ts:80`).
- **ConditionSeverity** 3 levels, farmer labels `Urgent/Needs Attention/Reminder` (`cycle.ts:28`); derived via `deriveConditionSeverity()` with hysteresis for temp (±0.5 critical) + humidity (±5) + battery thresholds (`cycle.ts:40`).
- **Status synonym:** `optimal/warning/alert` ↔ `info/warning/critical` via `unitStatusFromConditionSeverity` (`cycle.ts:34`).
- **Candling:** 3 checkpoints proportional to duration (`CANDLE_PROPORTIONS [6/21,13/21,18/21]` in `mockData.ts:52`), first = Fertile/Clear/Uncertain, later = Developing/Clear/Uncertain/StoppedDeveloping (`mockData.ts:73`). Lockdown checkpoint blocks save if `uncertain>0` (`CandlingJournalTab.tsx:872`).
- **Hatchability = hatched ÷ fertile ×100**, fertility = fertile ÷ set ×100, null if denominator ≤0 or null (`mockData.ts:562`). `getKnownFertileEggs` prefers `fertileEggs` then earliest log entry (`mockData.ts:572`).

---

## 7. What is working well

1. **Strict TypeScript** — `tsconfig.json:15` enables `strict`, `noUnusedLocals/Parameters`, `noFallthroughCases`.
2. **Isolated domain** — `cycle.ts:1` is pure, testable, no React/Mock coupling.
3. **Consistent visual language** — 16px radius, `#A84323` rust, `#F9F6F0` card, progress rings, badges (`src/styles/theme.css:35`, `OverviewScreen.tsx:24`).
4. **Responsive shell** — collapsed rail (64px) ↔ expanded panel (256px) with animated edge toggle + mobile bottom tab (`AppSidebar.tsx:87`).
5. **Detail decomposition** — `detail/` split fixes prior monolith risk noted in `docs/codex/README.md:112`.
6. **URL deep-linking** — reload-safe nav with back/forward support (`App.tsx:60`).
7. **Spec alignment** — final spec 38-season flow (`flow/EGGCELERATE_Final_Dashboard_Specification.md:880`) is represented in code (see §8 for gaps).

---

## 8. Findings & risks (code-verified)

### 8.1 Critical — Mock wall (P0)
- `initialIncubators` is 12 fixtures (`mockData.ts:219`), `hatchHistory` 12 records (`mockData.ts:517`), `initialAlerts` 12 entries (`mockData.ts:394`) — all in-memory. `recordHarvest`/`recordAbortedCycle` mutate module arrays (`mockData.ts:551`); `App.tsx:79` copies via spread but `mockData.ts` mutation remains global. Page reload loses all edits except notification contacts (which use `localStorage`).
- **Spec risk:** `flow/EGGCELERATE_Final_Dashboard_Specification.md:11` says evaluate as small-scale prototype (38-egg tray `mockData.ts:41`) — currently shows 12 chambers always; recommend single-chamber demo mode per spec §3.

### 8.2 Derived-state drift — `App.tsx:134`
- `updateIncubator()` recalculates `conditionSeverity` from new mode targets (`App.tsx:142`) for the patched unit only. **Bulk mode edits** (`updateMode` in `App.tsx:172`) do **not** recalculate all units on that mode — severity can go stale until next per-unit update. Same risk if `initialModes` defaults change on reload.

### 8.3 Large files remain — cost of change
- `TrendsScreen.tsx:1` (825 lines), `CandlingJournalTab.tsx:1` (1189+), `mockData.ts:1` (645). Codex flagged this (`docs/codex/README.md:112`) and detail was split; trends/journal still benefit from extracting toolbar/chart/table/history and form/photo/validation modules.

### 8.4 Bundle & loading
- Codex reported 956 KB JS / 273 KB gzip with chunk warning (`docs/codex/README.md:126`). All screens eagerly imported in `App.tsx:6`. Add `React.lazy` + `Suspense` per screen before production.

### 8.5 No regression suite
- No test framework/script (`package.json:6` has only `build/dev/typecheck`). Pure functions in `cycle.ts:1` + `mockData.ts:562` are first test targets. Then candling validation, mode-delete guard, alert ack, nav restoration, offline.

### 8.6 Mixed persistence ownership
- `App.tsx:70` owns nav/account/units/modes/alerts/history; `mockData.ts:551` owns history mutation; components simulate hardware delays inline. Server sync will need a repository/hook boundary + server-state cache (TanStack Query per `docs/review-adr.md:140`).

### 8.7 Operational UX gaps (for live integration)
- No loading/empty/retry/auth/stale/partial-connectivity states (`docs/codex/README.md:132`). Prototype never fails; production must distinguish browser offline / backend down / device offline / stale telemetry / command pending/ack/reject.

### 8.8 Documentation drift (corrected by `docs/meta/`)
- `docs/tech-stack.md:12` & `docs/frontend-review.md:18` list libs not in `package.json:11`. `README.md:4` links to figma v2 bundle. Dark vars in `theme.css:46` are generic oklch vs customized light brand.

---

## 9. Verification snapshot

```bash
npm run typecheck   # tsc --noEmit — uses tsconfig.json:15 strict
npm run build       # vite build — checks 500 KB chunk warning, figmaAssetResolver
```

Prior run (`docs/codex/README.md:184`): both passed; only Vite chunk warning. Re-run after `docs/meta/` changes is required before PR (see `docs/meta/roadmap.md` Phase 1).

---

## 10. Immediate recommendations (to `roadmap.md`)

1. **Freeze contracts:** extract DTOs + `Result<T>` types before wiring API — see `domain.md` §7.
2. **Add vitest + cover `cycle.ts:40` + `mockData.ts:562`** — 20–30 unit tests block regressions in status/hatchability.
3. **Fix drift on mode edit:** recalc all units when a mode patches, or derive severity pure in render.
4. **Lazy-load screens** + set bundle budget in CI.
5. **Single-chamber demo flag** so research eval shows only real device per spec §3.

---

*Evidence: every claim cites `file:line`. If a cited line shifts, treat the doc as stale and re-verify from `src/`.*
