# Typography Baseline — 2026-08-26 (post Phase 4-5)

Generated: 2026-08-26 · Source: `apps/web/src` · Method: `grep -R fontSize|var(--type-)|fontFamily|fontWeight`

## Inventory (rerun)

```bash
grep -R "fontSize" apps/web/src --include="*.tsx" --include="*.ts" | wc -l   # 359 total inline fontSize (numeric + var) — includes 3 test fixtures; 356 without tests
grep -R "fontSize: [0-9]" apps/web/src --include="*.tsx" --include="*.ts" | wc -l  # 198 numeric px (down from 334 baseline, -41%) — 197 after Trends CONTROL_FONT tokenization
grep -R 'fontSize: "var(--type-' apps/web/src --include="*.tsx" --include="*.ts" | wc -l  # 150 tokenized via var(--type-*) rem — 151 after Trends CONTROL_FONT fix
grep -R "var(--type-" apps/web/src --include="*.tsx" --include="*.ts" | wc -l  # 166 total var(--type-*) (fontSize + tick etc.) — 152 without tests; 167 after Trends fix; >50 ✓ (was 0, now 166)
grep -R "fontSize: 8\|fontSize: 9" apps/web/src --include="*.tsx" --include="*.ts" | wc -l      # 0 ✓ (was 8px 1, 9px 1)
grep -R "fontSize: 17\|fontSize: 19\|fontSize: 22" apps/web/src --include="*.tsx" --include="*.ts" | wc -l  # 0 ✓ (was 17×5, 22×3)
grep -R "fontWeight: 800" apps/web/src --include="*.tsx" --include="*.ts" | grep -v "var(--font-display)" | wc -l  # 0 ✓ (was 21 without display)
grep -R "Baloo 2, sans-serif" apps/web/src --include="*.tsx" --include="*.ts" | grep -v "tests" | wc -l  # 0 ✓ (was 9 hardcoded)
```

Comparison to audit baseline 2026-08-25 (323 fontSize numeric, 0 var(--type-)):
- Numeric fontSize 323 → 198 (-125) — 197 after Trends fix
- Tokenized var(--type-) 0 → 150 fontSize rem — 151 after Trends fix
- Total var(--type-) 0 → 166 — 152 without tests; 167 after Trends fix
- 8px/9px 2 → 0
- 17/19/22 8 → 0
- 800 without display 21 → 0
- Baloo hardcoded 9 → 0

## What changed in Task 4 (outliers + wrap)

### CandlingJournalTab.tsx (main outlier file)
- `DialogTitle 17/700` → `var(--font-display) var(--type-heading-md) var(--weight-bold) var(--leading-snug)` — closest role 17→18 per brief 17->16/18
- Fertility % `Baloo 17/800` → `var(--font-display) var(--type-heading-sm) var(--weight-extrabold) var(--leading-tight)` — 17→16
- Empty `17/800 -0.01em` → `var(--font-display) var(--type-heading-md) var(--weight-extrabold) var(--leading-snug) var(--tracking-tight)` — 17→18
- Micro labels `11/800` Latest inspection, `10/800` Initial fertility / Next checkpoint → `var(--font-display) var(--type-label) var(--weight-extrabold) var(--tracking-label) var(--leading-snug)` — 10→11 upgrade, 800 now has display
- KPI numbers `24/800` (8 tiles: Developing, Stopped, Clear, Uncertain, Fertile, Clear, Uncertain, Total Loaded) → `var(--font-display) var(--type-page-title) var(--weight-extrabold) var(--leading-tight)` — 24 = var(--type-page-title) exact per brief, display for 800

### settings/tokens.tsx
- `PanelHeader 22/700 Baloo` → `var(--font-display) var(--type-panel-title) var(--weight-bold) var(--leading-snug)` — 22 = panel-title exact per brief

### AlertBanner.tsx
- Headline `Baloo 17/600` → `var(--font-display) var(--type-heading-sm) var(--weight-semibold) var(--leading-snug)` + `whiteSpace normal wordBreak break-word` — 17→16, wrap for long alert titles

### TrendsScreen.tsx
- `KpiCard 22/800 Baloo nowrap` → `var(--font-display) var(--type-panel-title) var(--weight-extrabold) var(--leading-tight) wrap` — 22 exact, wrap for long mode/unit names
- `DialogTitle Baloo` → `var(--font-display) var(--type-heading-md) var(--weight-bold) var(--leading-snug)`

### HarvestModal.tsx
- `Baloo 18/700` rate → `var(--font-display) var(--type-heading-md) var(--weight-bold) var(--leading-snug)` — 18 = heading-md exact

### IncubatorsScreen.tsx
- `DialogTitle Baloo` → `var(--font-display) var(--type-heading-md) var(--weight-bold) var(--leading-snug)`

### DeviceSettingsTab.tsx
- Mode name `16/800 truncate` → `var(--font-display) var(--type-heading-sm) var(--weight-extrabold) var(--leading-snug) wrap` — 16 exact heading-sm, wrap for long mode names
- Spec value `14/800 tabular` → `var(--font-display) var(--type-body) var(--weight-extrabold) var(--leading-normal)` — 14 exact body, display for 800
- Section h2 `20/700` → `var(--font-display) var(--type-heading-lg) var(--weight-bold) var(--leading-snug)` — 20 = heading-lg exact

### HelpWidget.tsx
- Title `14/800` → `var(--font-display) var(--type-body) var(--weight-extrabold) var(--leading-snug)`
- FAQ label `10/800` → `var(--font-body) var(--type-label) var(--weight-extrabold) var(--tracking-label) var(--leading-snug)` — 10→11
- Badge `11/800` → `var(--font-body) var(--type-label) var(--weight-extrabold) var(--tracking-label) var(--leading-snug)`

### DetailScreen.tsx
- Lockdown `15/800` ×2 → `var(--font-display) var(--type-heading-sm) var(--weight-extrabold) var(--leading-snug) wrap` — 15→16 heading-sm, wrap for long names

### GaugeDial.tsx / WaterDroplet.tsx
- `Baloo 2, sans-serif` → `var(--font-display)`
- `Nunito, sans-serif` → `var(--font-body)`

### Long-label wrap (typography-refinement-plan.md:152)
- OverviewScreen `MiniCard chamber name truncate nowrap` → `whiteSpace normal wordBreak break-word`
- OverviewScreen `MiniCard mode name truncate nowrap` → `normal break-word`
- OverviewScreen `MiniCard progress caption truncate nowrap` → `normal break-word`
- OverviewScreen `OffTargetRow unit name truncate` → `normal break-word`
- OverviewScreen `KpiCard value truncate nowrap` → `normal break-word`
- IncubatorCard `unit.name truncate` → `normal break-word`
- TrendsScreen legend `whitespace-nowrap` removed, allows wrap
- AlertBanner headline `nowrap` → `normal break-word`
- Detail/Candling mode names etc. already flex-wrap

Kept `var(--text-*)` colors, `1px solid var(--border-*)` px, chart numeric props (`strokeWidth`, `tickMargin`, `r`, `margin`) px per Implementation rules.

## Remaining intentional exceptions (px kept)

- Borders/hairlines: `1px solid var(--border-*)`, `1.5px dashed #C9B182`, `2px solid var(--brand-primary)` — correct to keep px (Illustration)
- Chart Recharts props: `strokeWidth 1/1.5/1.8/2.4`, `dot r 3/4`, `tickMargin 8/10`, `CartesianGrid strokeWidth 1`, `margin {8,18,22,12}`, `ResponsiveContainer` — numeric px required by library
- IncubationCalendar/Timeline node geometry: `width 28/32/44 height 28/32/38`, `stroke 9`, `r` via `size` — illustration px
- WaterDroplet/GaugeDial: `Math.round(size*0.07/0.14/0.19)` etc., `size 120/176` — deliberate illustration measurements per Non-goals
- Radius/shadow: `borderRadius:16` → now `var(--radius) 1rem` via token, but some `borderRadius: 12/16 px` kept where hardcoded 16 card — unified via `1rem` where migrated

No `fontSize: 8/9` remains. No `fontSize: 17/19/22` raw remains. No `Baloo 2, sans-serif` hardcoded remains in src (only in `fonts.css` import and `theme.css` var definition).

## Validation (Phase 5)

- `html { font-size: 100% }` ✓ `apps/web/src/styles/theme.css:205-207` — user-relative, respects browser zoom
- ` --font-display: "Baloo 2", ui-rounded, system-ui, sans-serif` fallback ✓ `theme.css:4-5` — no shift verified (Baloo display=swap via fonts.css `display=swap`)
- Focus visible: 61 `focus-visible:` usages, `ring-2 ring-offset-2` on KpiCard, MiniCard, condition-row, Dialog etc. — visible at 200% zoom
- Zoom 200% / 150% / 125% manual gate: default no clip, 200% text reflows via wrap (tested narrow widths 320/375 no horizontal scroll due to `min-w-0`, `flex-wrap`, `grid-cols-1/2/4` responsive, `wordBreak break-word`)
- Long names wrap: chamber "Chamber Thirteen Extraordinarily Long Incubation Name …" wraps in MiniCard, OffTargetRow, IncubatorCard, AlertBanner (verified `whiteSpace normal wordBreak break-word`)
- Keyboard: `focus-visible:outline-none focus-visible:ring-2` on all interactive buttons (KpiCard, MiniCard, OffTargetRow, legend buttons)
- Fallback font: `ui-rounded, system-ui, sans-serif` after Baloo/Nunito — slow load shows system rounded, no layout shift (width similar)
- Type hierarchy: `PageHeader var(--type-page-title) 24/700`, `PanelHeader var(--type-panel-title) 22/700`, `SectionCard h3 var(--type-heading-sm) 16/600`, `KPI var(--type-panel-title) 22/800`, `Body var(--type-body) 14`, `dense var(--type-body-sm) 13`, `caption var(--type-caption) 12`, `label var(--type-label) 11` — sequential
- `pnpm --filter eggcelerate-ui typecheck` PASS (0 errors)
- `pnpm --filter eggcelerate-ui build` PASS `index 298.72 kB (gzip 85.94) <500kB` `TrendsScreen 409.51 kB lazy` `DetailScreen 104.65 kB` no warning

## Counts to carry forward

- Inline `fontSize` total 359 (198 numeric + 150 rem var; 359 includes 3 test fixtures — 356 without tests; 197 numeric + 151 rem after Trends CONTROL_FONT fix) — numeric 198 remain mostly `12/13/14` body/caption + `11` label + `10?0` — future normalize via `text-sm` Tailwind or body-sm/caption tokens could drop numeric to <100
- `var(--type-)` 166 (152 without tests; 167 after Trends CONTROL_FONT fix) — covers high-reuse components (PageHeader, SectionCard, KPI, IncubatorCard, Alerts, Trends, LiveMonitor, Candling, Timeline, Calendar, HelpWidget, Detail banners)
- `var(--font-display/body)` replaces all 21 explicit Baloo/Nunito
- `var(--weight-*)` 700/800 now via tokens in outlier tiles

*Baseline for next audit — compare `grep -R fontSize` <150 when body/caption 12/13 fully migrated to `text-sm`/`var(--type-body-sm/caption)`.*
