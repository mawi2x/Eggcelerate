# Mobile Analytics Chart Proportions Plan

**Plan date:** 2026-09-05
**Status:** Superceded by comprehensive plan `docs/refine/mobile-analytics-refinement-plan.md` (which covers both this geometry fix and the missing hero KPI / aggregate metrics).
**Scope:** `Analytics → Temperature History` card geometry on mobile only. No desktop/tablet pixel changes, no unrelated Analytics changes.
**Trigger:** mobile screenshot — card feels tall/narrow; plot does not use card width efficiently.

## 1. Current implementation

- **Renderer:** `TrendsScreen.tsx` (`export function TrendsScreen`, line 256). **Library:** Recharts `ComposedChart` inside `ResponsiveContainer width="100%" height="100%"` (lines ~827–831).
- **Height source is a fixed CSS height on the wrapper div** (line ~820): `h-[360px] sm:h-[420px] lg:h-[440px]`, plus `mt-4 border-t pt-4`. No aspect ratio, no `min-height`, no library-driven height. `ResponsiveContainer` just fills the box.
- **Width:** full card width via `w-full`; plot width = card − `CardContent p-5` (40px) − chart `margin { left: 22, right: 18 }` − `YAxis width` (52 mobile / 72 desktop).
- **Chrome above the plot (all inside `CardContent p-5`):** title block (`h2` 18px/snug + `mt-0.5` + 12px caption ≈ 43px), `gap-3` (12px), legend `fieldset` (1 row ≈ 16px, wraps with more chambers, scrolls past 44px), then divider block (`mt-4` + `pt-4` + 1px border ≈ 33px).
- **Current mobile height budget (<640px):** 40 (card padding) + ~43 (title) + 12 (gap) + ~16 (legend) + 33 (divider) + 360 (box) ≈ **~500px card**, plot ≈ 360 − 8 (top) − 12 (bottom) − ~28 (x-axis) ≈ **~310px tall × ~250px wide**.
- **Breakpoints, currently two systems:** CSS height uses Tailwind `sm:` 640px / `lg:` 1024px; JS treatment (`useIsMobile`, `<768px`: explicit ticks, 52px gutter, tooltip pill) uses 768px. In the 640–768px band the chart renders desktop height (420px) with mobile ticks/gutter — mismatched but not broken.

## 2. Root cause

The tall/narrow feel is the fixed 360px box, not the chart content: at 360px viewport the plot is ~310 tall × ~250 wide (taller than wide), and ~92px of card width (≈32%) goes to non-data chrome — 40px card padding, 22px left chart margin, 52px y-gutter, 18px right margin. The left 22px margin is a leftover from the rotated axis label (already removed on mobile in `c1b0cdf`); the 72→52 gutter shrink helped desktop-derived widths but mobile can go further now that y-labels are uniform 1-decimal. Title/legend/divider are correctly-sized system type — they contribute ~110px but must stay.

## 3. Files / components involved

- `apps/web/src/app/components/screens/TrendsScreen.tsx` — wrapper div height classes (line ~821), `ComposedChart margin` (~830), `YAxis width/tickMargin` (~861/874), `XAxis tickMargin` (~855). Only file needing edits.
- `apps/web/src/app/features/trends/chart-ticks.ts` — untouched (formatters already unit-tested).
- `apps/web/src/tests/trends-chart-ticks.test.ts` + `mobile-typography.test.ts` — extend with source-contract assertions.
- No token, theme, primitive, or other screen changes.

## 4. Proposed changes (`TrendsScreen.tsx` only)

1. **Box height:** `h-[360px] sm:h-[420px] lg:h-[440px]` → `h-[280px] md:h-[420px] lg:h-[440px]`. Plot becomes ≈ 280 − 8 − 12 − 26 ≈ **234px** — inside the 200–250 target. Switching `sm:`→`md:` aligns CSS with the 768px `useIsMobile` breakpoint so one viewport never mixes desktop height with mobile ticks.
2. **Chart margins (mobile only):** `margin={{ top: 8, right: isMobile ? 8 : 18, left: isMobile ? 8 : 22, bottom: 12 }}`. The mobile left-22 is dead compensation for the removed rotated label; right-18 is desktop breathing room. Saves ~24px of plot width.
3. **Y gutter (mobile):** `width 52→44`, keeps `tickMargin 4`. Uniform 1-decimal labels (`38.0` ≈ 27px at 11px medium) fit with margin; 44 is conservative, not minimal.
4. **X tick margin (mobile):** `tickMargin 10→8`. 11px labels need ~14px; 8 + 14 = 22px axis cost vs 24 today.
5. **Divider block:** `mt-4 pt-4` → `mt-3 pt-3` (mobile and desktop — 8px total, below perceptible threshold, keeps rhythm with `gap-3` system). Header title/legend/gaps untouched.
6. **Not changed:** domain/padding math (scale stays honest), `tickCount`, tick fonts, safe band, trend line, legend behavior, tooltip pill/position, card padding, colors, `Card` styling.

Resulting mobile budget (≈360px viewport): 40 + 43 + 12 + 16 + 25 + 280 ≈ **~416px card** (−90px, −18% page scroll), plot ≈ **234 × ~274** (wider than tall).

## 5. Responsive strategy

- **Breakpoint classes, not `clamp()` / aspect-ratio.** `h-[280px] md:h-[420px] lg:h-[440px]` matches repo convention (explicit tiers, statically assertable in file-content tests) and ends the 640–768 mismatch. `clamp(280px, 72vw, 420px)` was considered: it scales smoothly but forces continuous Recharts re-layout on every resize frame and can't be pinned in tests — worse tradeoff for a fixed-chrome card. Aspect-ratio was rejected: ratio of *what* — the box includes no chrome, but any ratio couples plot height to card width including padding variance across breakpoints; fixed tiers are predictable.
- **JS-driven props (`margin`, `YAxis width`, tooltip) stay on `useIsMobile()`** (768px) — after change (1) both systems agree at every width.
- Desktop (≥1024) and tablet-landscape (768–1024): byte-identical values to today.

## 6. Risks / edge cases

- **Y-tick clipping at 320px:** `38.0`/`37.3` at 11px ≈ 27–30px < 44 − 4 gutter — safe; humidity integers even shorter. Guarded by keeping 44px, not squeezing to 40.
- **X-label overlap at 320px:** 3 explicit ticks over ~210px plot; hour labels (`11 PM` ≈ 35px) cannot collide; dedupe blanks pathological repeats. `interval={0}` is safe *because* ticks are explicit and counted.
- **Multi-chamber compare:** legend wraps/scrolls (`max-h-[44px]`) — card grows, by existing design; chart box itself unchanged.
- **Landscape phones (≈360px tall viewport):** 280px box + chrome scrolls the page — acceptable, page scrolls by design; no fixed/sticky chart elements to collide.
- **Tooltip:** `position={{ y: 0 }}` still valid in a shorter box; pill is small; tap-away unchanged.
- **Honest scale:** domain math untouched; shorter plot does not rescale data (same domain, fewer pixels per degree — stated, not hidden).
- **`useIsMobile` SSR/initial paint:** client-only app, initial state reads `window.innerWidth` — no hydration mismatch, no layout shift beyond the existing pattern.
- **Recharts version behavior:** `ticks` + `interval={0}` + `tickFormatter(_, index)` is stable public API; no private APIs used.

## 7. Validation plan

- **Automated:** extend `trends-chart-ticks.test.ts` (or `mobile-typography.test.ts`) with source-contract assertions — wrapper has `h-[280px] md:h-[420px] lg:h-[440px]`; mobile margin/gutter values present; desktop values (`420/440`, `right: 18`, `left: 22`, `width: 72`) still present. `pnpm test`, `tsc --noEmit`, `pnpm build`.
- **Rendered (real viewport, LAST 24H + 7D, temp + humidity, 1 and 3 chambers):**
  - 320px: no clipped y-labels, x-labels distinct, no horizontal scroll.
  - 360 / 375 / 390 / 412 / 430px: card ≈ 400–425px tall, plot ≈ 225–240 tall; chip row, tooltip pill, legend all clear.
  - 640–767px: 280px box + mobile ticks (consistent pair — *changed* from today, verify deliberately).
  - 768 / 1024 / 1440px: pixel-compare against pre-change screenshots — must be identical.
  - Landscape 740×360: page scrolls sanely, tooltip reachable/dismissible.
  - `prefers-reduced-motion`, 200% zoom spot-check.

## 8. Acceptance criteria

- [ ] Mobile card ≈ 400–425px tall at 360–430px viewports (≈ −90px vs today); plot ≈ 225–240px tall and wider than tall.
- [ ] Y-labels fully visible at 320px; x-labels distinct; safe band, trend line, Chamber One legend all preserved.
- [ ] Domain math untouched — same data maps to the same values (scale honest).
- [ ] 768px+ rendering pixel-identical to pre-change (screenshots).
- [ ] No new `tsc`/test/build failures; contract tests cover the new values.
- [ ] No changes outside `TrendsScreen.tsx` (plus tests).

**Note on the 300–360px card target:** not recommended as-is. Fixed chrome (40 padding + ~71 header + 25 divider ≈ 136px) plus a readable plot floor (~200px: 5 y-ticks + x-labels + band context) puts the honest minimum at ≈ 340px before any box margin — 300–360 would require cutting title/legend or compressing below readability. The plan delivers ~416px (−18%) and says so explicitly rather than hitting the number by degrading the chart.
