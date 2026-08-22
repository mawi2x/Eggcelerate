# Eggcelerate — Architecture

> Scope: frontend (`src/`) + intended system (`docs/adr/ADR-005-system-architecture.md:1`). All statements cite `file:line`.

---

## 1. System context (intended)

```
┌──────────────┐   MQTT (Mosquitto)   ┌──────────────┐   REST+WS   ┌──────────────┐
│  ESP32       │◄────────────────────►│  FastAPI     │◄───────────►│  React SPA   │
│  device      │  telemetry / cmds     │  backend     │  DTOs       │  (this repo) │
│  + sensors   │   review-adr.md:19    │  + Postgres  │             │              │
└──────────────┘                      └──────────────┘             └──────────────┘
```

- **Per ADR-005/006** the ESP32 was designed stateless with server rules engine (`docs/adr/ADR-005-system-architecture.md:1`, `ADR-006-automation-strategy.md:1`). `docs/review-adr.md:19` flags this as **biologically unsafe** (thermal runaway on disconnect) and proposes local-first autonomy with NVS setpoint persistence + watchdog + hardware cutoff — adopt before hardware integration.
- **Frontend boundary today:** no HTTP/WS/MQTT (`src/app/data/mockData.ts:1` is the backend). `docs/review-adr.md:136` proposes dual-channel: `TanStack Query` for REST hydration + WebSocket cache patches. That is the target; nothing implements it yet.

---

## 2. Frontend architecture (actual)

### 2.1 Composition root

```
src/main.tsx:1 → createRoot(<App />)
                    │
                    └─ src/app/App.tsx:36  (composition root + nav controller + store)
                        ├─ useState<ScreenId> + query-string sync (App.tsx:26)
                        ├─ useState<Account> / Incubator[] / Mode[] / AlertEntry[] / HatchRecord[]
                        ├─ deriveConditionSeverity + unitStatusFromConditionSeverity (App.tsx:142)
                        └─ screens/* + AppSidebar + PageHeader + Toaster + HelpWidget
```

- **Routing:** none. `getInitialNavState()` parses `?screen=&unit=` and validates against `validScreens` (`App.tsx:26`). `syncUrl()` does `pushState/replaceState` (`App.tsx:42`); `popstate` restores (`App.tsx:60`). `detail` is treated as sub-view of `incubators` (`AppSidebar.tsx:53`).
- **State ownership:** all top-level state lives in `App.tsx:70`. Mutations are callbacks (`updateIncubator`, `addIncubator`, `updateMode`, `acknowledgeAlert`, etc.). No Context/Redux/Zustand.
- **Persistence:** only notification contacts touch `localStorage` (inside `account.ts`). Everything else resets on reload.

### 2.2 Data layer

```
src/app/domain/cycle.ts:1        — pure domain rules (no React)
        ▲
src/app/data/mockData.ts:1       — types + fixtures + generators + history mutation
        ▲
src/app/App.tsx:13               — imports initialIncubators/initialModes/initialAlerts
        ▲
screens/*                        — props + callbacks (no direct data import except Types)
```

| Module | Responsibility | Size | Testability |
|---|---|---|---|
| `domain/cycle.ts:1` | Phase, severity, status, connection, labels | 90 lines | High — pure functions |
| `data/mockData.ts:1` | `Mode`, `Incubator`, `Reading`, `AlertEntry`, `HatchRecord`, `CURRENT_TRAY_CAPACITY=38`, `buildHistory`, `getUnitIssues`, rate calcs, `recordHarvest` | 645 lines | Medium — mixed pure + mutable globals |
| `data/account.ts` | `Account`, initials/display helpers, localStorage | ~80 lines | Medium |

`mockData.ts:188` is the **mock wall** — replace behind a repository interface when integrating.

### 2.3 Screen map

```
App.tsx:332 → OverviewScreen   (KPI + priority 4-grid)
         340 → IncubatorsScreen (grid/list, add, pairing)
         350 → DetailScreen     (LiveMonitorTab, CandlingJournalTab, DeviceSettingsTab, Timeline, Calendar)
         361 → TrendsScreen     (environmental chart + hatch table)
         364 → AlertsScreen     (feed)
         377 → SettingsScreen   (ModeLibrary, Notifications, FarmAccount, Hardware)
```

All screens eagerly imported (`App.tsx:6`) → bundle pressure (see `review.md` §8.4). Target: `React.lazy` + `Suspense`.

### 2.4 Shared components

- **Layout:** `AppSidebar.tsx:48` (64px rail / 256px panel + bottom nav on mobile via `useIsMobile`), `PageHeader.tsx:1` (title/subtitle/badges/back/bell), `HelpWidget.tsx:1`.
- **Domain widgets:** `GaugeDial.tsx`, `StatusBadge.tsx`, `PowerIndicator.tsx`, `SegmentedBattery.tsx`, `WaterDroplet.tsx`, `AlertBanner.tsx`, `IncubatorCard.tsx`, `Mascot.tsx`.
- **Detail:** `detail/LiveMonitorTab.tsx`, `detail/CandlingJournalTab.tsx`, `detail/DeviceSettingsTab.tsx`, `detail/Timeline.tsx`, `detail/IncubationCalendar.tsx`, `detail/PhotoLightbox.tsx`, `detail/types.ts`, `detail/primitives.tsx`.
- **Settings:** `settings/ModeLibraryPanel.tsx`, `settings/NotificationsPanel.tsx`, `settings/FarmAccountPanel.tsx`, `settings/HardwarePanel.tsx`, `settings/tokens.tsx`.
- **UI primitives:** `ui/button.tsx`, `ui/card.tsx`, `ui/dialog.tsx`, `ui/select.tsx`, `ui/input.tsx`, `ui/table.tsx`, `ui/popover.tsx`, `ui/switch.tsx`, `ui/checkbox.tsx`, `ui/sonner.tsx`, etc. (11 files). All wrap Radix via `class-variance-authority` + `clsx` + `tailwind-merge` (`ui/utils.ts`).

---

## 3. Build & tooling

| Concern | Config | Detail |
|---|---|---|
| Bundler | `vite.config.ts:7` | `figmaAssetResolver()` maps `figma:asset/*` → `src/assets/*`; plugins: `react()`, `tailwindcss()` |
| Alias | `vite.config.ts:30` | `@` → `src/` |
| Assets | `vite.config.ts:35` | `assetsInclude: ['**/*.svg','**/*.csv']` |
| Dev server | `vite.config.ts:36` | `allowedHosts: ['.trycloudflare.com']` |
| TS | `tsconfig.json:15` | `strict`, `noUnusedLocals/Parameters`, `noFallthroughCasesInSwitch`, `moduleResolution: bundler`, `jsx: react-jsx` |
| Styles | `src/styles/index.css → tailwind.css + theme.css + fonts.css` | `@custom-variant dark`, `@theme inline` (Tailwind v4) |
| Scripts | `package.json:6` | `build: vite build`, `dev: vite`, `typecheck: tsc --noEmit` — no test/lint scripts |
| Gitignore | `.gitignore:36` | tracks `docs/meta/**` via negation; ignores `flow/`, `review/`, `plans/` |

**Verification:** `npm run typecheck` must pass with `strict` before merging. `npm run build` should be CI-gated for chunk budget (>500 KB warning in `docs/codex/README.md:126`).

---

## 4. Data flow — state transitions (current)

```
User action (toggle, log candling, add mode)
  → App.tsx callback (updateIncubator / updateMode / etc.)
    → deriveConditionSeverity({...})  (cycle.ts:40)
    → setIncubators map (App.tsx:138)  — patches single unit
    → re-render: PageHeader badges (App.tsx:198), StatusBadge, GaugeDial, Timeline
```

- **Mode edit drift:** `updateMode` (`App.tsx:172`) patches `modes[]` but does **not** recompute `conditionSeverity` for all units on that mode. Subsequent `updateIncubator` recomputes for one unit (`App.tsx:142`). Fix: derive in render or bulk-recalc on mode patch.
- **History mutation:** `recordHarvest`/`recordAbortedCycle` push to module arrays (`mockData.ts:551`); `App.tsx:79` copies `hatchHistory` via spread, but global array is shared. Isolate behind repository when persistent.

---

## 5. Desired target architecture (roadmap)

Per `docs/review-adr.md:149` dual-channel:

```
React components
  ├─ TanStack Query  ──REST──▶ GET /api/v1/devices, /history, /modes, /alerts
  └─ WebSocket client ──WS──▶ ws://api/v1/ws/telemetry  → patch Query cache
                                   │
                                   ▼
                              FastAPI + Postgres (Timescale hypertable per ADR-003)
                                   │
                                   ▼
                              Mosquitto MQTT ↔ ESP32 (local PID + NVS)
```

- **Hydration:** REST for initial load + background revalidation (caching, skeletons, retries).
- **Streaming:** WS frames patch the Query cache without full refetch.
- **Resilience:** on WS drop → `Connecting…` / `Offline — Showing Cached Data` pill + poll fallback every 10s.
- **Optimistic commands:** UI updates immediately, `POST /devices/{id}/command`, await ACK via WS, rollback on 5s timeout + `sonner` toast (`docs/review-adr.md:185`).

---

## 6. Cross-module dependencies to watch

- `TrendsScreen.tsx:198` calls `buildHistory()` per render (memoized). `buildHistory` is O(totalPoints) with seeded noise (`mockData.ts:352`); fine for mock, replace with paginated REST range query in production.
- `DetailScreen.tsx` candling flow copies prior entry via `previousEntry` (`CandlingJournalTab.tsx:382`) — carry-forward is visual only; save is required (spec §18).
- `IncubatorsScreen.tsx` Add/Setup flow writes `totalEggsLoaded` → `CURRENT_TRAY_CAPACITY=38` is a const (`mockData.ts:41`), not per-device config (spec §2 future: installed tray capacity setting).

---

## 7. Decisions inherited (ADRs)

| ADR | Decision | Status in UI |
|---|---|---|
| ADR-001 | MQTT (Mosquitto) for telemetry | Not yet wired; UI is mock-driven |
| ADR-002 | FastAPI backend | UI assumes FastAPI DTOs (proposed) |
| ADR-003 | Postgres + Timescale hypertable | `hatchHistory` in-memory stands in |
| ADR-004 | JWT (HTTP-only cookie) | `localStorage` only for contacts; no auth layer |
| ADR-005 | System architecture (central rules) | **Superseded** by `review-adr.md:42` local-first ESP32 autonomy |
| ADR-006 | Automation strategy (server rules) | Same — move loop to ESP32 PID + hysteresis |
| ADR-007 | Telemetry schema | `mockData.ts:156` Reading shape is a placeholder; add `sync_setpoints` ACK per `review-adr.md:104` |

---

*All paths verified against current tree. If you add a router/state lib, update §2.1 and `package.json:11` mapping.*
