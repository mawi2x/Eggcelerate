# Trends Mobile Chart + Filter Plan

**Plan date:** 2026-09-05
**Status:** Implemented 2026-09-05 (workspace; `docs/*` is gitignored — tracked diff is `apps/web` only). Tooltip direction changed mid-plan per shared refs (value pill, not shrunk card). The later list-filter unification pass also migrated the Trends time-horizon control to the shared segmented fit-to-screen treatment.
**Scope:** `TrendsScreen.tsx` chart axes/tooltip on narrow viewports + `FilterBar` edge-overlap on mobile. Desktop behavior unchanged.

## Defects and root causes

### 1. Scroll chevron covers the edge chip
`FilterBar` arrows live in an absolute overlay (`filter-bar.tsx:68-84,138-154`) on top of the scroll track. A partially visible end chip scrolls *under* the 44px arrow button, so `FULL INCUBATION` reads as `FULL INCUBA…` with a `>` stamped on it. The track has no end spacer and no `scroll-padding`, so there is no scroll position where the last chip is fully visible while the arrow shows.

### 2. Y-ticks mix decimal places
`YAxis` (`TrendsScreen.tsx:776-800`) sets `allowDecimals` with no `tickFormatter`, so Recharts emits raw floats from the auto domain (`38.4`, `38.05`, `37.7`, …). One-decimal and two-decimal labels side by side look broken and widen the gutter unevenly.

### 3. X-ticks repeat the same wall time
`formatAxisTime` (`TrendsScreen.tsx:140-146`) renders hour+minute for `24h`. Recharts picks ~3 ticks spanning 24h starting at dataMin (`11:21 PM … 11:21 AM … 11:21 PM`), so all three labels share `:21` and differ only by AM/PM — unreadable as a time axis. Same class of bug will hit any range whose ticks land on identical minutes.

### 4. Y gutter wastes narrow width
`YAxis width={72}` + `tickMargin={8}` + an `insideLeft` rotated `Temperature (°C)` label. On a ~360px card that gutter eats ~25% of the plot. The unit is already in the card subtitle (`Target Safe Range · 37.5 to 37.8°C`) and the tooltip — the rotated label is redundant on phones.

### 5. Tap tooltip swallows the plot
`ChartTooltip` (`TrendsScreen.tsx:164-244`) renders a full-size card: title row, timestamp, two data rows at 13–14px. On a ~360px plot a center-anchored tooltip hides the line, band, and ticks behind it, so inspecting a point means losing the context that gives it meaning. Content is fine; geometry is not.
## Decisions

- **Chart ticks are data formatting, not tokens.** Fix in `TrendsScreen.tsx` with pure formatter functions (unit-testable, no CSS). Do not invent chart typography tokens; the existing `--type-label` tick style stays.
- **Y decimals derive from the domain span**, not the metric: span ≤ 2 → 1 decimal; span ≤ 0.5 → 2 decimals; else 0. Temp (≈1.4 span) renders `38.4 / 38.0 / 37.7 / 37.3 / 37.0` — uniform, and the trailing `.0` is intentional (ragged decimals are the bug).
- **Mobile tooltip becomes a minimal value pill (inspiration 2026-09-05).** The shared refs converge on a small dark pill pinned to the data point (ref 1's `1:25:22` pill) instead of a centered card. Adopt that: compact dark pill with value + unit and a caption-size timestamp, top-anchored at the touch point (`allowEscapeViewBox`), tap-away dismiss verified. Chamber name and target range are dropped from the mobile pill only — both repeat the card legend/subtitle already on screen. Desktop keeps the full card.
- **Narrow y-axis via the existing hook.** `useIsMobile()` (`ui/use-mobile`) already exists: on mobile hide the rotated axis label and shrink `width 72→52`, `tickMargin 8→4`. Desktop keeps everything. No new breakpoint, no new hook.
- **FilterBar keeps overlay arrows for chip-mode consumers** (tap target for non-swipers; the `Swipe for more filters` hint stays for discoverability) but the track gets a trailing spacer + `scroll-padding-inline` so the last chip can scroll fully clear of the arrow. The Trends time-horizon control is now the intentional exception: its three options use the segmented fit-to-screen treatment, so arrows are hidden there. No layout change on desktop (`sm:` wraps, arrows hidden).
- **Out of scope:** domain/padding math, safe-band opacity, tooltip content, legend, chip heights, any desktop pixel.
- **Deliberately not taken from the refs:** dark theme, new palettes/gradients, bar-chart swaps, KPI/stat tiles below the chart, and full-width segmented filters outside the migrated time-horizon control. Reasons: Baloo 2/Nunito + rust/cream are brand-locked, the mobile-typography plan forbids parallel visual systems, and tiles add content rather than fixing the reported defects. The truncated edge chip already acts as a swipe "peek" (ref 4 pattern) — the spacer just makes it legible.

## Phase 1 — Chart ticks (P0)

`apps/web/src/app/components/screens/TrendsScreen.tsx`:

1. Add `formatYTick(value, domainSpan)` per the span rule above; pass as `YAxis tickFormatter`. Humidity (span ~40+) renders integers as today.
2. Change `formatAxisTime` 24h branch to hour-only; add a dedupe wrapper: map ticks, blank repeats (implement inside the existing `tickFormatter` closure where the full tick array is visible — Recharts passes `(value, index)`, so track the previous label in a ref-like local; simplest correct approach: `ticks` prop is not set, so instead post-process via `tick={{}}`? No — do it in `tickFormatter` with a module-local `let lastLabel` reset per render via `key={range + metric}` on `XAxis`, which already re-mounts per range since `key="x-axis"` is static — extend the key to include range so the closure resets).
3. Mobile y-axis: `const isMobile = useIsMobile()`, `width={isMobile ? 52 : 72}`, `tickMargin={isMobile ? 4 : 8}`, `label={isMobile ? undefined : {...}}`.
4. Mobile tooltip pill: `ChartTooltip` renders the compact dark pill variant when `useIsMobile()` (value + unit, caption timestamp, top-anchored, tap-away verified); desktop path untouched.
5. Keep tick font (`--type-label`), `tickCount={5}`, colors.

## Phase 2 — FilterBar edge overlap (P0)

1. For chip-mode bars, append a trailing spacer (`<span aria-hidden className="w-11 shrink-0 sm:hidden" />`) inside the `fieldset` so the last chip scrolls 44px past the arrow zone; add `scroll-pr-12 sm:scroll-p-0` (or `scroll-padding-inline-end`) to the track so `scrollBy`/swipe end positions clear the overlay. The migrated Trends time-horizon bar uses segmented fit-to-screen and intentionally does not use the arrow overlay.
2. Preserve: 44px arrow targets, 16px glyphs, `aria-label`s, gradient fades, desktop wrap.
3. The `FULL INCUBATION` option must be fully readable in the migrated equal-width Trends bar; chip-mode consumers must keep the last chip fully readable at max scroll with the arrow visible.

## Phase 3 — Validation (P0)

1. Unit tests (vitest, pure functions, no DOM):
   - y-tick: temp span → uniform 1-decimal incl. trailing `.0`; humidity span → integers; span ≤ 0.5 → 2 decimals.
   - x-tick 24h: hour-only; dedupe blanks repeats; day ranges unchanged.
2. Existing suite: `pnpm test`, `tsc --noEmit`, `pnpm build`.
3. Rendered (needs a real viewport — same gap as the mobile-typography plan):
   - 360–400px, range `LAST 24H`: y-labels uniform, x-labels distinct hours, last chip fully visible at max scroll, arrows still tappable.
   - Desktop 1024px+: chart and FilterBar pixel-identical to today.
   - Recharts animation + `prefers-reduced-motion` unaffected (no animation props touched).

## Acceptance
- [x] No mixed-decimal y-labels for any metric/range (`formatYTick`, span rule; unit-tested).
- [x] No two adjacent x-ticks render identical text (explicit ticks + hour-only + dedupe; unit-tested).
- [x] Rotated y-axis label hidden on mobile; plot area visibly wider; desktop unchanged (source-contract; rendered check still needs a viewport).
- [x] Mobile tooltip is a compact value pill; content and desktop tooltip unchanged (source; rendered check still needs a viewport).
- [x] Last filter chip fully legible at max scroll on mobile; arrows keep 44px targets and labels (spacer + scroll-padding; rendered check still needs a viewport).
- [x] Unit tests fail pre-fix (paste old formatter output) and pass post-fix; full suite + build green (203/203, `tsc` clean, vite build succeeds).
