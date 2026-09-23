# Mobile Analytics Refinement Plan (Overview + Trend Architecture)

**Plan date:** 2026-09-05  
**Status:** Proposed  
**Source audit:** `docs/audit/mobile-analytics-screen-audit.md` (Verdict: Uninformative & Disproportionate)  
**Supercedes:** `docs/refine/analytics-chart-proportions-plan.md` (expands narrow geometry fix into complete informational + visual refinement)  
**Scope:** `apps/web/src/app/components/screens/TrendsScreen.tsx`, `apps/web/src/app/features/trends/selectors.ts`, `apps/web/src/tests/trends-selectors.test.ts`. Desktop rendering preserved.

---

## 1. Executive Summary & Design Vision

The mobile Analytics screen currently fails the operating farmer because it treats an incubation chamber chart as an isolated, static desktop visualization shrunk onto a phone. It wastes **~60% of the mobile viewport** on an oversized, near-square container that leaves the farmer guessing their actual current temperature, stability, and excursion history.

### The Refined Vision: "Hero Metric + Horizon Trend"
Rather than forcing a chart to communicate both immediate status and temporal history, this plan adopts the industry-standard mobile telemetry architecture:
1. **Immediate State First:** A bold **Hero KPI block** answering *"What is the reading now, and is it safe?"* (`37.7°C · Optimal`).
2. **Aggregate Context Second:** Compact summary statistics answering *"Did anything go wrong?"* (`Min 37.5° · Max 37.8° · Avg 37.65° · 100% In Range`).
3. **Temporal Validation Third:** A re-proportioned **landscape trend chart (220px height)** providing visual proof of stability over time, with an active endpoint marker dot.

```text
┌─────────────────────────────────────────────────────────────┐
│ Temperature History                         Chamber One ▾   │
│ Target Safe Range · 37.5 to 37.8°C                          │
├─────────────────────────────────────────────────────────────┤
│  37.7 °C   [ ● Optimal ]            Min 37.5° · Max 37.8°   │
│  Latest reading                     Avg 37.65° · 100% Safe  │
├─────────────────────────────────────────────────────────────┤
│ 38.0 ┌────────────────────────────────────────────────────┐ │
│      │····················································│ │
│ 37.7 │═══════ Target Safe Band ═══════     ╭───╮          │ │
│      │                                    ─╯   ╰──● 37.7° │ │
│ 37.4 └────────────────────────────────────────────────────┘ │
│      4 PM            10 PM            4 AM            4 PM  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Guidelines & Design System Alignment

All proposed changes strictly comply with the project guidelines in `docs/guide/`:

### 2.1 Color Tokens (`docs/guide/color-guidelines.md`)
* **Status Badging:** Pair `--status-success-bg` (`#DCFCE7`) + `--status-success-fg` (`#15803D`) for `Optimal`, `--status-warning-bg` (`#FEF3C7`) + `--status-warning-fg` (`#B45309`) for warning excursions, and `--status-danger-bg` (`#FEE2E2`) + `--status-danger-fg` (`#B91C1C`) for critical excursions (WCAG AA compliant ≥ 4.5:1).
* **Surfaces & Borders:** Reuse `--surface-card`, `--surface-subtle`, `--border-default`, and `--border-subtle`.
* **Chart Exception Zone:** Continue consuming `--chart-target-band` and `--chart-series-1..12` via the established `colorFor(unit.id)` mapping. Never reuse series colors for status indicators.

### 2.2 Typography Tokens (`docs/guide/typography-guidelines.md`)
* **Hero KPI Value:** `fontFamily: "var(--font-display)"` (Baloo 2), `fontSize: "var(--type-heading-lg)"` (20px mobile / 22px desktop), `fontWeight: "var(--weight-bold)"` (700).
* **Hero Subtext / Labels:** `fontFamily: "var(--font-body)"` (Nunito), `fontSize: "var(--type-caption)"` (12px), `color: "var(--text-secondary)"`.
* **Secondary Aggregates:** `fontSize: "var(--type-caption)"` (12px), `fontWeight: "var(--weight-semibold)"` (600), preserving the 11px system label floor.

### 2.3 UI Control Sizes (`docs/guide/ui-control-size-guidelines.md`)
* **Touch Targets:** All mobile controls meet the 44px minimum touch target (`min-h-11 min-w-11`).
* **Toolbar Controls:** Preserve `FilterBar` for horizon selection (`LAST 24H`, `LAST 7 DAYS`, `FULL INCUBATION`) and `SegmentedControl` for metric toggles (`Temperature` | `Humidity`).

### 2.4 Architecture Contract (`docs/SYSTEM_ARCHITECTURE_GUIDE.md`)
* **Pure Selectors:** Statistical aggregations (min, max, mean, time-in-target percentage, current reading) must be extracted into pure, testable functions in `apps/web/src/app/features/trends/selectors.ts`.
* **No Unbounded Calculations:** Calculations must execute deterministically inside `useMemo` over the existing TanStack Query cache.
* **Bundle Budget:** Zero new dependencies; bundle size impact strictly < 1.5 kB.

---

## 3. Architectural Design & Pure Selectors

### 3.1 New Feature Selector (`features/trends/selectors.ts`)

```typescript
export interface EnvironmentalKpis {
  current: number | null;
  min: number | null;
  max: number | null;
  avg: number | null;
  inTargetPct: number | null;
  status: "optimal" | "warning" | "critical" | "offline";
  delta: number | null;
}

export function selectEnvironmentalKpis(
  chartData: Array<{ ts: number; [unitId: string]: number | undefined }>,
  unitId: string,
  safeMin: number,
  safeMax: number,
  criticalTolerance = 0.5,
): EnvironmentalKpis;
```

**Implementation Rules:**
1. **Current Reading:** Read the value of `unitId` from the last chronological entry in `chartData` where value is a finite number.
2. **Min / Max:** Computed over all finite numeric values for `unitId` within the selected range window.
3. **Average (Mean):** $\frac{1}{N} \sum v_i$, rounded to two decimal places (e.g., `37.65°C`).
4. **Time in Target Safe Band:** Count data points where $v_i \in [\text{safeMin}, \text{safeMax}]$, divided by total points $N$, rounded to an integer or 1 decimal place (e.g., `99.4%`).
5. **Status Evaluation:**
   - If current is `null` $\rightarrow$ `"offline"`
   - If current $\in [\text{safeMin}, \text{safeMax}]$ $\rightarrow$ `"optimal"`
   - If current is within `criticalTolerance` outside safe band $\rightarrow$ `"warning"`
   - If current exceeds critical tolerance $\rightarrow$ `"critical"`

---

## 4. Concrete Implementation Phases

### Phase 1 — Selector Layer & Unit Tests (P0)

1. **Add `selectEnvironmentalKpis` to `apps/web/src/app/features/trends/selectors.ts`:**
   - Pure function, handles empty datasets, single-point datasets, missing values, and excursions.
2. **Add unit test suite to `apps/web/src/tests/trends-selectors.test.ts`:**
   - Validates min, max, avg, and in-target % over mock reading arrays.
   - Asserts status classification (`optimal` vs `warning` vs `critical`).
   - Asserts graceful fallback when data is empty (`null` returns, no NaN or division by zero).

### Phase 2 — Hero KPI & Aggregate Stat Block (P0)

1. **Construct Hero KPI Sub-component inside `TrendsScreen.tsx`:**
   - Render above the chart divider, below the title/legend header.
   - **Left Column:** Latest value (`37.7 °C`), status badge (`● Optimal`), caption (`Latest reading`).
   - **Right Column:** 2×2 compact grid of aggregates:
     - `Min: 37.5°`
     - `Max: 37.8°`
     - `Avg: 37.65°`
     - `In Target: 100%`
2. **Responsive Adaptation:**
   - **Mobile (<768px):** Stacks beneath the title row with a clean border/separator.
   - **Desktop (≥768px):** Aligns horizontally alongside or beneath the title, adding high-density utility to the desktop card as well.
3. **Multi-Chamber Mode Handling:**
   - When "Compare Chambers" is active, display aggregate summary across all active chambers (e.g., `Range: 37.4° – 38.1°C`) or summary pills for the selected units.

### Phase 3 — Chart Geometry, Proportions & Endpoint Callout (P1)

1. **Re-proportion Chart Height:**
   - Update `TrendsScreen.tsx:821`:
     `className="mt-3 h-[220px] w-full border-t pt-3 sm:h-[320px] md:h-[400px] lg:h-[440px]"`
   - Reduces mobile height from `360px` to **`220px`** (saving 140px of vertical space, -38%).
2. **Symmetrical Mobile Margins:**
   - Update `ComposedChart margin`:
     `margin={{ top: 8, right: isMobile ? 8 : 18, left: isMobile ? 8 : 22, bottom: 12 }}`
   - Saves 14px of dead width on the left and 10px on the right.
3. **Y-Axis Width Optimization:**
   - Update `YAxis width`: `width={isMobile ? 44 : 72}`, `tickMargin={isMobile ? 4 : 8}`.
   - Saves 8px of gutter width while safely fitting 1-decimal labels (`38.0` = 27px width).
4. **Endpoint Marker Dot:**
   - Render a visible marker dot at the latest timestamp on the line (`activeDot` or an explicit SVG dot on the last valid reading) with an unobtrusive small label displaying the current value.

### Phase 4 — Toolbar Ergonomics & Mobile Layout Consolidation (P2)

1. **Consolidate Mobile Controls:**
   - Place Chamber Selector and Metric Toggle (`Temperature` | `Humidity`) on a single compact flex row with `justify-between`.
   - Keep `FilterBar` (`LAST 24H`, `LAST 7 DAYS`, `FULL INCUBATION`) as a clean, self-contained row without redundant instructional text.
2. **Preserve Touch Scrollability:**
   - Shorter 220px chart height leaves comfortable top/bottom gutters on phone screens so vertical scrolling gestures are not trapped by chart tooltip scrubbing.

---

## 5. Responsive Strategy & Breakpoint Alignment

* **Unified Breakpoint System:** Align CSS classes with the 768px JS contract:
  - Mobile tier: `< 768px` (`isMobile === true`) $\rightarrow$ 220px chart height, 44px Y-axis, compact hero stat block.
  - Tablet/Desktop tier: `≥ 768px` (`md:`) $\rightarrow$ 400px–440px chart height, 72px Y-axis with rotated label, expanded legend.
* **No `clamp()` or Dynamic Resizing Loops:** Use static Tailwind breakpoint tiers (`h-[220px] sm:h-[320px] md:h-[400px] lg:h-[440px]`) to maintain predictable Recharts layouts and static test assertability.

---

## 6. Risks, Edge Cases & Mitigations

| Risk / Edge Case | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Compare Mode Active (Multiple Chambers)** | Hero KPI could be ambiguous if multiple chambers have different temperatures. | In compare mode, change Hero label to show active chamber count and range (`37.4° – 38.1°C`), or key the hero stat to the hovered/selected series. |
| **Sensor Offline / Zero Readings** | Math operations could produce `NaN` or `-Infinity`. | Selector explicitly guards empty arrays; returns `current: null, status: "offline"`, rendering a quiet `Sensor Offline` badge. |
| **Narrow 320px Viewport** | 2-column KPI row could collide with 12px text. | Use `flex-wrap` and compact spacing tokens (`gap-2`); verified at 320px with zero text clipping. |
| **Out-of-Range Spikes** | Y-axis domain might compress normal safe band. | Domain calculation already auto-scales to include both data bounds and safe bands; status badge immediately reflects `Warning` or `Critical`. |

---

## 7. Validation & Verification Plan

### 7.1 Automated Contract Tests (Vitest)
* `src/tests/trends-selectors.test.ts`:
  - Verify `selectEnvironmentalKpis` on known fixtures (calculates correct min, max, avg, in-target %).
  - Test excursion conditions (`38.5°C` triggers critical, `37.6°C` triggers optimal).
  - Test empty and sparse datasets.
* `src/tests/trends-chart-ticks.test.ts`:
  - Assert chart height classes (`h-[220px] md:h-[400px] lg:h-[440px]`).
  - Assert mobile margin (`left: 8`, `right: 8`) and YAxis width (`44`).

### 7.2 Manual Viewport Review
* **320px (iPhone SE / minimal floor):**
  - Verify Hero KPI values, status badge, secondary stats, and chart Y-labels fit with no horizontal overflow.
* **375px–430px (Standard Phones):**
  - Verify entire card footprint is ~340px–360px tall (down from ~500px).
  - Confirm page can be scrolled vertically without getting captured by chart tooltip listeners.
* **1024px+ (Desktop):**
  - Verify desktop layout retains all existing visual fidelity, including rotated axis label and full legend.

---

## 8. Acceptance Checklist

- [ ] `selectEnvironmentalKpis` implemented under `apps/web/src/app/features/trends/selectors.ts` with 100% pure function test coverage.
- [ ] Hero KPI block rendered inside `TrendsScreen.tsx` displaying:
  - Current value + unit in `var(--font-display)`.
  - Semantic status pill (`Optimal`, `Warning`, `Critical`, or `Offline`).
  - Min, Max, Average, and % In Safe Range.
- [ ] Mobile chart container height reduced to `220px` on viewports `< 768px`.
- [ ] Chart horizontal margins balanced (`left: 8`, `right: 8`), eliminating the rightward visual offset.
- [ ] YAxis gutter tightened to `44px` on mobile, fitting 1-decimal labels cleanly.
- [ ] Latest data point highlighted with an endpoint marker dot.
- [ ] Desktop rendering (≥ 768px / 1024px) pixel-identical or cleanly enhanced with the stat row.
- [ ] Zero TypeScript errors (`tsc --noEmit`), Biome clean (`pnpm lint`), and bundle size < 500kB.

---

## 9. Non-Goals

* No changes to underlying database schemas or backend APIs.
* No changes to hatchability trend analytics (`Hatchability` tab stays as-is).
* No dark mode theme expansion (light theme remains system of record per `color-guidelines.md`).
* No introduction of third-party charting or animation libraries.
