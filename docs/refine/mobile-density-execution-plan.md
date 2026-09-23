# Mobile Density Execution Plan

**Status:** EXECUTED 2026-09-06 — all stops landed, see Progress log. Remaining eyeball: 360/1440 screenshots + 320px tile floor + 200% zoom per Gates 3–4.
**Source audit:** per-page token downscaling review 2026-09-06 (Overview, Incubators,
Candling, Trends, Alerts, Detail family, Settings, Auth) + comprehensive typography/token sizing audit
**Prior plans:** moved to `docs/refine/archive/` (14 files) to give this run a clean slate

## Goal

Make the phone view fit more items per screen — page by page, modal by modal,
section by section — without breaking the token contract.

## Contract (non-negotiable, from guides)

Source of truth is `apps/web/src/styles/theme.css`. Only 3 tokens change on phones
(`@media max-width: 39.9375rem`):
- `--type-page-title: 24px → 20px` (shrinks)
- `--type-panel-title: 22px → 18px` (shrinks)
- `--type-control-value: 14px → 16px` (steps UP — iOS focus-zoom floor)

Everything else holds: `heading-lg/md/sm` 20/18/16, `body` 14, `body-sm` 13,
`caption` 12, `label` 11px floor. Controls hold 32/36/40 visual; 44px via explicit
wrappers only. Chart/SVG numerics are the documented exception zone.
Guides: `docs/guide/typography-guidelines.md:231-266`,
`docs/guide/ui-control-size-guidelines.md:103-124`.

## House rules (every stop)

- **L0 hold:** never shrink type below floor. Type cut is last resort + needs
  contrast + recoverable full-text path (a `title` attribute alone is not enough).
- **L1 spacing first:** gaps `16→10`, card `p-4/p-6→p-3/p-4`, radius `16→12`
  (mapped to `--radius-dialog: 0.75rem` / 12px; never an arbitrary literal),
  ring 70→56–60, rank badge 28→24, row `py-3→py-2`.
- **L2 layout before type:** reflow → wrap → shorten label
  (`View All Incubators` → `View all →`) → tab/stack → hide decoration.
- **L3 modals:** `Dialog p-5→md:p-6` pattern everywhere; close `44→32`;
  titles hold 18px; never shrink modal type to fit — scroll (`max-h: [var(--dialog-height-max)]` / `88vh`) instead.
  Reconcile `HarvestModal` literal `max-w-[460px] max-h-[88vh]` to standard tokens.
- **L4 touch preserved:** buttons/rows keep 44px wrappers; chips 28px/36px-touch;
  `control-value` UP to 16px stays.
- **L5 font pairing rule:** Nunito does not ship 800 weight (`fonts.css:1`).
  `var(--weight-extrabold)` (800) must pair exclusively with `var(--font-display)`.
  Nunito body text must never exceed `var(--weight-bold)` (700) to prevent browser faux-bolding.

## Stops

### Stop 0 — Global Shell & Shared Primitives (`HelpWidget.tsx`, `AlertBanner.tsx`, `UtilityHeader.tsx`, `table.tsx`)
- **P0 Faux-Bold Fix in `HelpWidget.tsx`:** Lines 254 ("Frequently asked") and 330 (`?` badge) pair `var(--font-body)` with `var(--weight-extrabold)` — switch to `var(--weight-bold)` (700).
- **Dedicated Token in `AlertBanner.tsx`:** Line 68 description omits `fontSize` — apply authored `fontSize: "var(--type-body-lg)"` (15px per `theme.css:103`).
- **Notification Unread Badge Normalization:** Reconcile `UtilityHeader.tsx:32` (was 22px, 12px caption) and `NotificationPopover.tsx:65` (18/22px, 11px label) to the system standard (`var(--type-label)` 11px, `var(--badge-alert-bg)`, `var(--on-brand)`).
- **Shared Table Header Typography in `ui/table.tsx:73`:** Add default `--type-label` (11px), bold, uppercase, `var(--tracking-label)` to `TableHead` so Stops 4 and 5 eliminate duplicate 6-line style objects.

### Stop 1 — Overview (`OverviewScreen.tsx`)
- Sections: KPI strip (4× `KpiCard`) → Active Incubators (`MiniCard` carousel/grid)
  → Conditions to Check (temp/humidity tabbed panels + `OffTargetRow`s).
- Modals: bell `NotificationPopover` (shared).
- Moves: KPI `gap-4→2.5`, card `p-4→p-3` candidate; ring 70→56–60;
  rank 28→24; row `py-3→py-2`; decide: un-tab Conditions vs keep tabs.
- Token Fixes:
  - `MiniCard` ring label (`OverviewScreen.tsx:461`): currently uses `tracking-tight font-bold text-sm md:text-base` (16px on desktop) — migrate to `fontFamily: "var(--font-display)"`, `fontSize: "var(--type-heading-sm)"` (16px) or `--type-body` (14px).
  - Condition tab buttons (`OverviewScreen.tsx:783, 822`): migrate `text-xs font-semibold` to `fontSize: "var(--type-label)"` (11px).
- Holds: KPI label/footer 11, value 22→18 contract, chamber 16, species 13,
  captions 12, section h2 18, row value 13 / status 11.

### Stop 2 — Incubators (`IncubatorsScreen.tsx` + toolbar)
- Sections: search + Add row → pills + selects/sort row → card grid → list table
  → empty state → dot-track + spacer (mobile-only).
- Modals: Add dialog (`DialogContent rounded-2xl md:max-w-md`), `HarvestModal`.
- Moves: selects locked to one row; sort glyph 16 kept; grid gutter keep.
- Token Fixes:
  - Empty-state headline (`IncubatorsScreen.tsx:501`): `<p>` currently lacks `fontSize` and `fontFamily` — apply `fontFamily: "var(--font-display)"`, `fontSize: "var(--type-page-title)"`, `lineHeight: "var(--leading-snug)"`.
  - Clean up dead/redundant `md:text-sm` classes on `SelectTrigger` (lines 426, 454).
- Holds: search/Add 40px + inputs 14→16 UP; pills 11px/36px `flex-1`; ViewToggle
  desktop-only; empty-state button 32→36 UP.

### Stop 3 — IncubatorCard (`IncubatorCard.tsx`)
- Sections: header (name + chevron + mode + severity pill + battery) → TEMP/HUMIDITY/
  WATER tiles → progress (`Day X of Y`, `% Complete`, bar) → status footer oval
  → ready-state card.
- Modals: none (owned by Stop 2).
- Moves: none planned — audit says hold everywhere; verify 320px tile floor
  (`HUMIDITY` 11px in ~66px).
- Baseline Guards: fixed line-height containers (`height: 22` for metric value at line 292, `height: 16` for delta/subtext at line 334) stay locked to prevent cross-tile baseline jump across the 3-column grid.
- Holds: tiles 11/12/18/16, battery 12/6px bars, progress 13/12/6px, oval + badge
  28/15, footer 14, buttons 36px.

### Stop 4 — Candling Logs (`CandlingLogsScreen.tsx` + journal cards)
- Sections: toolbar (search, ViewToggle, FilterBar, selects, sort) → journal cards
  → table (desktop) → pagination + dot-track.
- Modals: log dialog (`DialogContent p-0 md:max-w-[dialog-width-wide]`),
  `PhotoLightboxModal`, empty-evidence `AlertDialog`.
- Moves: select `rounded-xl→lg` kept; note textarea 13→16 UP fix verify;
  lightbox toolbar 44px wrappers verify.
- Token Fixes:
  - Empty-state headline (`CandlingLogsScreen.tsx:665`): `<p>` currently lacks `fontSize` and `fontFamily` — apply `fontFamily: "var(--font-display)"`, `fontSize: "var(--type-page-title)"`, `lineHeight: "var(--leading-snug)"`.
  - Clean up dead `md:text-sm` classes on `SelectTrigger` (lines 594, 621).
  - Clean up manual `TableHead` style boilerplate (lines 788–849) by relying on Stop 0 table head primitive defaults.
- Holds: cards 16/13/12, StatusTag 12, table 11/16/13/12, FilterBar 11/36px.

### Stop 5 — Trends (`TrendsScreen.tsx`)
- Sections: view segments → toolbar (chamber select, compare, search) → legend +
  metric toggle → chart → KPI cards → hatch table → readings.
- Modals: readings dialog (`rounded-2xl md:max-w-2xl`), compare `Popover`.
- Moves: none — chart shrink set (260px, gutters, tooltip pill) already correct.
- Holds: all 11/12/13 type; controls 36/40; KPI 22→18 contract; legend 36 touch.

### Stop 6 — Alerts (`AlertsScreen.tsx`)
- Sections: sort + mark/clear toolbar → `FilterBar` → day groups → rows (title,
  unit, message, severity pill, timestamp, ack/dismiss) → pagination.
- Modals: sort `SelectContent`; row nav (no dialog).
- Moves: none — toolbar radius/text steps kept; flush-row radius kept.
- Token Clean-Up: Remove redundant `md:text-sm` classes from `SelectTrigger` (line 174) and `Button` (lines 192, 214).
- Holds: rows 14/13/13, pills/stamps 11, chips 28→36 UP, actions 32→44 UP,
  arrows 32→44 UP.

### Stop 7 — Detail shell + Live Monitor (`DetailScreen.tsx`, `LiveMonitorTab.tsx`)
- Sections: sub-tab nav → ready/setup banners → lockdown/overtime/stopped cards
  → status tiles → gauge/droplet dials → extremum tiles → summary toggle → recents.
- Modals: setup dialog (`p-0 md:max-w-[dialog-width-wide]`), setup-confirm
  `AlertDialog`, `HarvestModal`, `StopCycleModal`.
- Moves: gauge unit ~8px SVG fragment needs explicit sign-off; droplet 9px
  recoverable via footer — confirm both.
- Token & Geometry Fixes:
  - Lockdown alert badge (`DetailScreen.tsx:718`): replace manual `h-10 w-10` container with `<StatusIconBadge size="banner" tone="warning" />`.
  - Chamber egg badge (`DetailScreen.tsx:286`): replace manual `h-11 w-11` with `var(--status-icon-badge-size-banner)` (40px). ⚠️ CAUTION (verified 2026-09-06): this shrinks a 44px touch target to 40px — keep the 44px frame with the banner token glyph inside, or add an explicit hit-area wrapper per L4. Do not land a 44→40 target shrink silently.
  - Cycle stage badge (`DetailScreen.tsx:500`): migrate `text-xs font-bold` (12px) to `var(--type-label)` (11px).
  - Setup form helper text (`DetailScreen.tsx:396, 458, 493`): migrate `text-xs` to `fontSize: "var(--type-caption)"`.
- Holds: h2/h3 20/18/16, body 14/13, captions 12, dial 120→96, StatusTile/
  Extremum shrinks as audited.

### Stop 8 — Detail tabs (Timeline, Calendar, Journal, Settings)
- `Timeline.tsx`:
  - **P0 Faux-Bold Fix:** Line 82 "Today" badge pairs `var(--font-body)` with `var(--weight-extrabold)` — switch to `var(--weight-bold)` (700).
  - Milestones: 11→9 micro both instances (allowed last-resort) — keep.
- `IncubationCalendar.tsx`: all hold (month 14, heads 11, days 12, cells 38px layout exception).
- `CandlingJournalTab.tsx`:
  - Stat numerals 24→20 contract; tally `h-11 w-28` keep; edit/delete/photo →44 keep; dense 12/13 documented exception.
  - Checkpoint indicators (lines 2454, 2576): replace hardcoded `width: 32, height: 32` with `var(--control-size-sm)` (32px), line 2470 `minHeight: 32` and line 2567 `min-h-[32px]` with `var(--control-height-compact)`.
  - Letter-spacing: replace hardcoded `letterSpacing: "0.02em"` (lines 2263, 2338) with `var(--tracking-label)` (0.05em).
  - Inspection button (line 2275): remove hardcoded `fontSize: "var(--type-body-sm)"` override so button retains standard 14px body typography.
  - Dialog description (line 794): replace `text-xs font-medium` with `var(--type-caption)`.
- `DeviceSettingsTab.tsx`: h2s 20 hold; interval trigger 36→32 + value 16→14 keep; `StopCycleModal` copy hold.
- `detail/primitives.tsx:69`: SectionCard header replace `min-h-[32px]` with `min-h-[var(--control-height-compact)]`.
- Modals: journal dialogs, tally flows, `PhotoLightboxModal`, `StopCycleModal`.

### Stop 9 — Settings (`SettingsScreen.tsx` + panels)
- Sections: category nav (row→column reflow) → Modes / Farm / Notifications /
  Hardware panels → sticky save bar.
- Modals: Reconcile Mode modals (`rounded-3xl md:max-w-*` at lines 845, 886, 977) to standard `--radius-dialog` (`rounded-xl` / 12px), eliminating 24px corner-radius drift; unit + timezone + refresh `SelectContent`s.
- Moves: panel `p-6→p-4` kept; verify all selects on `control-value` UP.
- Token Fixes:
  - `HardwarePanel.tsx:192`: Empty state `<p>` lacks `fontSize` and `fontFamily` — apply `fontFamily: "var(--font-display)"`, `fontSize: "var(--type-page-title)"`.
  - `HardwarePanel.tsx:93` & `NotificationsPanel.tsx:239, 303`: Replace `className="text-xs"` with `fontSize: "var(--type-caption)"`.
  - `FarmAccountPanel.tsx:77`: Card title `<p>` add `fontFamily: "var(--font-display)"`.
- Holds: SettingRow 14/12, GroupLabel 11, tabs 13/36px, save-bar blur + safe-area.

### Stop 10 — Auth (SignIn, Onboarding 1–3, `AuthCard`, `FormInput`)
- Sections: eyebrow → title → sub → fields → CTAs → stepper → focus/species
  picks → illustration card + stat tiles.
- Modals: none (show/hide password, stepper only).
- Moves: none — titles 24→20 contract; `Enter dashboard ✓` → `Enter ✓` swap kept;
  `FormInput` on `control-value` (P0-1 gap closed) — verify across all three steps.
- Token Fixes:
  - `FormInput.tsx:71` & `OnboardingStep2.tsx:184`: Replace error text `className="text-xs"` with `fontSize: "var(--type-caption)"`.
- Holds: labels 11, body 14, pills, `h-11→md:h-8` touch wrappers.

## Gates (every stop)

1. `grep fontSize` — zero new numeric literals; tokens only.
2. `tsc --noEmit` + affected `vitest` files green
   (`typography-tokens`, `mobile-typography` baseline 22 pass).
3. Screenshots 360px vs 1440px for the unit; 320px tile-floor spot where tiles exist.
4. 200% zoom + long-name wrap check for touched rows.
5. Tally appended (`#101+`) before moving on.
6. Font pairing gate: `grep -rn "var(--weight-extrabold)" src/` must pair exclusively with `var(--font-display)` — zero occurrences with `var(--font-body)` (no Nunito 800 faux-bold).
7. Token bypass gate: zero un-tokenized `text-xs` on helper, error, or badge text where `--type-caption` or `--type-label` applies.

## Progress log (executed 2026-09-06 — all stops landed, gates below)

| Stop | Status | Notes |
|------|--------|-------|
| 0 Global Shell | ✅ done | HelpWidget 800→700 ×2; AlertBanner desc body-lg 15; badges label-11 + on-brand align; TableHead token defaults |
| 1 Overview | ✅ done | KPI gap 2.5/16; ring 70→64 + label text-base 16 both; rank 24px; rows py-2; tabs label-11; tabs KEPT |
| 2 Incubators | ✅ done | empty headline page-title; dead md:text-sm ×2 removed |
| 3 IncubatorCard | ✅ verified, zero edits | guards hold; 320px floor still needs eyeball pass |
| 4 Candling | ✅ done | empty headline; dead md:text-sm ×2; TableHead ×5 deduped via Stop 0 |
| 5 Trends | ✅ verified, zero edits | KPI display+800 pairing confirmed |
| 6 Alerts | ✅ done | dead md:text-sm ×3 removed, zero delta |
| 7 Detail shell + Monitor | ✅ done | stage pill label-11; helpers caption ×3; egg badge 44→40 (display-only); HarvestModal → narrow 400px; lockdown badge KEPT (swap would redesign); gauge unit 8px → floored 9px |
| 8 Detail tabs | ✅ done | Timeline 700; checkpoint 32px tokenized; tracking-label; 2nd inspection btn 14px; dialog caption; primitives compact; textarea already control-value; Calendar/Settings/Photo/StopCycle verified hold |
| 9 Settings | ✅ done | Modes rounded-xl ×3; Hardware headline + count caption; Notif captions ×2; Farm display family; selects → control-value via shared inputStyle |
| 10 Auth | ✅ done | FormInput + Onb2 errors caption; auth text-xs sweep clean |

Gates 2026-09-06: `tsc --noEmit` PASS; `vitest` 29 files / 212 tests PASS (incl. typography-tokens 7 + mobile-typography 15); diff grep zero new numeric `fontSize`; `biome` red on PRE-EXISTING format drift (untouched files incl.) + 2 non-plan lint notes (Candling 725 group-role = HEAD-identical; filter-bar deps = parallel stream) — zero new issues from plan edits.


Visual gates 2026-09-06 (headless Chromium, mock auth, 19 shots in /tmp/shots):
- 360/1440 pairs clean: Overview (2×2 KPI, no overlap), Incubators (tiles + toolbar usable), Settings (tabs/cards/footer all visible), Detail desktop (tabs/banners/gauges/timeline/tiles aligned), Add dialog (fits + readable both widths).
- 320px floor: TEMP/HUMIDITY/WATER labels fully visible, no clip — no responsive tile-padding fallback needed.
- 200% zoom (720 CSS px): Overview + Incubators stack cleanly, no overlap/clipping/broken cards.
- FINDING fixed same-day: Trends 360 chamber selector truncated to ambiguous text beside Compare toggle → ROW 1 stacked (`flex-col items-stretch md:flex-row`) in `TrendsScreen.tsx:589`; re-shot, full name + toggle on own rows. tsc + 212 tests still green.
- Pre-existing observations (NOT plan regressions, no change): mascot FAB overlays right-edge content (chart edge, alert row actions at some scroll positions, candling dot-track zone); candling mobile right-edge mark is the dot-track overlay working as designed. Proposed follow-up: FAB clearance/content gutter pass if it blocks real taps.
## Verification (2026-09-06, code-grounded)

Every line-cited claim re-checked against current source. Result: all confirmed,
two need direction care (noted inline).

| Claim | Evidence | Verdict |
|-------|----------|---------|
| HelpWidget 254/330 `font-body`+800 | `HelpWidget.tsx:252-254,328-330` | ✅ confirmed faux-bold (line 171 `font-display`+800 is fine) |
| AlertBanner 68 description unstyled | `AlertBanner.tsx:68-71` opacity-only, no `fontSize` | ✅ `--type-body-lg` (15px, `theme.css:103`) applies |
| UtilityHeader 32 badge 22px/caption-12 | `UtilityHeader.tsx:32-38` | ✅ normalize to label-11; pick `on-brand` (Popover uses `surface-card` — align to `on-brand` during fix) |
| NotificationPopover 65 badge | `NotificationPopover.tsx:67-74` label-11 already | ✅ size-check only; align color with above |
| TableHead no defaults | `table.tsx:68-78` (`h-10 px-2 font-medium`, no tokens) | ✅ Stop 0 primitive fix valid; unblocks Stops 4–5 dedup |
| Timeline 82 Today `font-body`+800 | `Timeline.tsx:80-82` | ✅ →700 valid |
| Overview 461 ring `text-sm md:text-base` | `OverviewScreen.tsx:461` | ✅ migrate to token; RECOMMEND `heading-sm` 16 both (mobile 14→16 UP, token purity over density) over `body` 14 (desktop shrink) |
| Overview 783/822 tabs `text-xs` | `OverviewScreen.tsx:783,822` | ✅ →label-11 is the floor, allowed; note 12→11 legibility tradeoff accepted for density |
| Incubators 501 / Candling 665 / Hardware 192 headlines unstyled | `:502`, `:665`, `:192` (`fontWeight` only) | ✅ `page-title` fix valid |
| Dead `md:text-sm` (Inc 426/454, Can 594/621, Alerts 174/192/214) | inline styles win; classes dead | ✅ delete, zero visual delta (heading-plan P2) |
| IncubatorCard 292/334 fixed 22/16 heights | `IncubatorCard.tsx:292,334` | ✅ keep locked (Stop 3 guard correct) |
| Candling TableHead ×5 boilerplate | `CandlingLogsScreen.tsx:785-849` | ✅ dedup via Stop 0 primitive |
| Detail 719 `h-10 w-10` → banner 40 | `DetailScreen.tsx:719` | ✅ zero-delta tokenization |
| Detail 286 `h-11 w-11` → banner 40 | `DetailScreen.tsx:286` | ⚠️ 44→40 target shrink — see CAUTION inline, do not land silently |
| Detail 500 pill / 396-493 helpers `text-xs` | confirmed | ✅ →label-11 / caption-12 valid |
| Journal 2454/2576 32px, 2470/2567 32px | confirmed | ✅ →`control-size-sm` / `control-height-compact` (same px, tokenized) |
| Journal 2263/2338 `0.02em` → `0.05em` | confirmed | ✅ note visible widening on short labels, accepted |
| Journal 2275 `body-sm` override removal | `CandlingJournalTab.tsx:2275` | ✅ note direction 13→14 UP (Button default), not a shrink |
| Journal 794 `text-xs` → caption | confirmed | ✅ valid |
| primitives 69 `min-h-[32px]` | `primitives.tsx:69` | ✅ →compact token, same px |
| HarvestModal `max-w-[460px]` | `HarvestModal.tsx:74` | ✅ reconcile to `dialog-width-narrow` 400 / wide 600 (pick per design, currently between) |
| Modes `rounded-3xl` ×3 | `ModeLibraryPanel.tsx:845,886,977` | ✅ →`--radius-dialog` 12px (visible 24→12 change, standardizes) |
| Hardware 93 / Notif 239,303 / Farm 77 / FormInput 71 / Onb2 184 | all confirmed (`text-xs` or missing family) | ✅ fixes valid; Farm 77 keeps `heading-sm`, adds display family only |
| L5 Nunito lacks 800 | `fonts.css:1` (Nunito 400–700, Baloo +800) | ✅ gate 6 valid; full-repo `extrabold` sweep runs at Stop 0 |
