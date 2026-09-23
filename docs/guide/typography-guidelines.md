# Eggcelerate Typography Guidelines

This guide defines how to use typography in the Eggcelerate web app. It mirrors `color-guidelines.md` — the token flow is **Primitive → semantic role → component**. It is intended for new screens, component work, design reviews, and visual QA. Source of truth is `apps/web/src/styles/theme.css`.

## Source of truth

Use the role-named CSS variables in `theme.css`. Do not add a new `fontSize`, `fontFamily`, or `fontWeight` value directly to a component when an existing semantic token describes the same purpose.

```text
Primitive value → semantic token → component state
```

```css
/* theme.css — primitives */
:root {
  --font-display: "Baloo 2", ui-rounded, system-ui, sans-serif;
  --font-body: "Nunito", ui-rounded, system-ui, sans-serif;

  --type-page-title: 1.5rem;    /* 24px */
  --type-panel-title: 1.375rem;  /* 22px */
  --type-heading-lg: 1.25rem;    /* 20px */
  --type-heading-md: 1.125rem;   /* 18px */
  --type-heading-sm: 1rem;       /* 16px */
  --type-body: 0.875rem;         /* 14px */
  --type-body-sm: 0.8125rem;     /* 13px */
  --type-caption: 0.75rem;       /* 12px */
  --type-label: 0.6875rem;       /* 11px */

  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --weight-extrabold: 800;

  --leading-tight: 1.1;
  --leading-snug: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.6;

  --tracking-label: 0.05em;
  --tracking-tight: -0.01em;
}

html { font-size: 100%; } /* user-relative, respects browser zoom */
```

```css
/* token reuse */
--type-page-title: 1.5rem; /* 24px — page h1 */
```

```tsx
/* component */
<h1 style={{
  fontFamily: "var(--font-display)",
  fontSize: "var(--type-page-title)",
  fontWeight: "var(--weight-bold)",
  lineHeight: "var(--leading-snug)",
  color: "var(--text-primary)"
}}>Incubators</h1>
```

Fallback stack `ui-rounded, system-ui, sans-serif` after Baloo 2 / Nunito ensures no layout shift when fonts load slowly (`fonts.css` `display=swap`).

## Core scale

### Families

| Token | Value | Use |
|---|---|---|
| `--font-display` | `Baloo 2` | Page titles, panel titles, KPI/metric values, section titles, 800-weight numbers |
| `--font-body` | `Nunito` | Body copy, controls, tables, supporting text, captions, labels |

Do not replace families — the Baloo 2 / Nunito pairing is brand-locked ([historical typography plan](../refine/archive/typography-refinement-plan.md)). Headings `h1–h6` default to `var(--font-display)` via `theme.css`, body/inputs default to `var(--font-body)`.

### Type scale (rem, user-scalable)

| Token | rem | px @100% | Role |
|---|---|---:|---|
| `--type-page-title` | `1.5rem` | 24 | Page `h1` (`PageHeader.tsx`) |
| `--type-panel-title` | `1.375rem` | 22 | Panel `h2` (`settings/tokens.tsx` `PanelHeader`), KPI value (`OverviewScreen.tsx`) |
| `--type-heading-lg` | `1.25rem` | 20 | Section `h2` (`DeviceSettingsTab.tsx`) |
| `--type-heading-md` | `1.125rem` | 18 | Dialog titles, chart titles (`HarvestModal.tsx`, `TrendsScreen.tsx`) |
| `--type-heading-sm` | `1rem` | 16 | Card `h3` (`detail/primitives.tsx` `SectionCard`), `16` mode names |
| `--type-body` | `0.875rem` | 14 | Body copy and form labels (`ui/label.tsx`); editable values use `--type-control-value` below, never this token |
| `--type-control-value` | `0.875rem` → `1rem` on phones | 14 → 16 | Editable form values (`Input`, `SelectTrigger`); decoupled from body so phones get 16px legibility + iOS focus-zoom stability while body stays 14px |

`11px` is for compact labels/table headers/metadata — do not create `8px/9px` tokens. The former `8px`/`9px` calendar/photo labels were migrated to `11px` label (`IncubationCalendar.tsx`, `CandlingJournalTab.tsx`).

### Weights

| Token | Value | Use |
|---|---|---|
| `--weight-regular` | `400` | Body, secondary copy |
| `--weight-medium` | `500` | Labels, secondary emphasis |
| `--weight-semibold` | `600` | Card titles, mixed emphasis |
| `--weight-bold` | `700` | Headings, strong labels |
| `--weight-extrabold` | `800` | KPI numbers — **always pair with `var(--font-display)`** (Nunito does not ship 800; fallback would be synthetic) |

### Leading (unitless)

| Token | Value | Use |
|---|---|---|
| `--leading-tight` | `1.1` | KPI/metric values |
| `--leading-snug` | `1.25` | Headings (`h1–h3`) |
| `--leading-normal` | `1.5` | Body, captions, inputs |
| `--leading-relaxed` | `1.6` | Long prose (rare) |

### Tracking

| Token | Value | Use |
|---|---|---|
| `--tracking-label` | `0.05em` | Uppercase labels (`11px` 700) |
| `--tracking-tight` | `-0.01em` | Empty-state display headings |

### Sub-label tier (10px compact / 9px micro)

Below the 11px system minimum, opt-in only. The label-family naming is the
contract: these tokens are for **short uppercase labels**, never body,
controls, prose, errors, or action text.

| Token | rem | px @100% | Use |
|---|---|---:|---|
| `--type-label-compact` | `0.625rem` | 10 | Preferred concession — timeline milestone labels on `<sm` (`Timeline.tsx` `labelSize={10}`, the default) |
| `--type-label-micro` | `0.5625rem` | 9 | Last-resort — same slots when 10px still crowds (`labelSize={9}`), currently live on Monitor + Candling timelines |

- Short strings only (roughly ≤8 characters per line, e.g. `1ST`, `DAY 8`, `LOCKDOWN`), uppercase, bold, with `var(--tracking-label)`.
- Pair with a recoverable full-text path: visible supporting text, an accessible label, or an operable details/tooltip pattern. A `title` attribute alone is not sufficient for touch or assistive-technology users — keep it only as a supplement (mobile typography plan, Phase 3.4).
- Keep 4.5:1 contrast — small text gets no contrast discount.
- Both are `rem`, so they scale with browser zoom and Dynamic Type — never convert them to `px`.
- Prefer 10px. Reach for 9px only with a concrete crowding screenshot, and note it the way this section notes the timeline.
- Do not extend the tier downward — there is no 8px token and there will not be one without a design review.

## Intended hierarchy

| Role | Family | Size | Weight | Leading | Example |
|---|---:|---:|---:|---:|---|
| Page title | `--font-display` | `--type-page-title` `24` | `700` | `1.25` | `PageHeader.tsx` `h1` |
| Panel title | `--font-display` | `--type-panel-title` `22` | `700` | `1.25` | `PanelHeader` `h2` |
| Section / card title | `--font-display` | `--type-heading-sm` `16` to `--type-heading-md` `18` | `600–700` | `1.25` | `SectionCard` `h3` |
| KPI / metric value | `--font-display` | `22–24` via panel/page title | `700–800` | `1.1` | `OverviewScreen.tsx` `22/800`, candling summary `24/800` |
| Body, labels & control values | `--font-body` | `--type-body` `14`, `--type-control-value` `14`→`16` on phones | `400–600` | `1.5` | `label.tsx` body, `input.tsx`/`select.tsx` values |
| Dense table / supporting | `--font-body` | `--type-body-sm` `13` | `400–600` | `1.5` | Mode table cells |
| Caption / helper | `--font-body` | `--type-caption` `12` | `400–500` | `1.5` | `SectionCard` subtitle |
| Micro-label | `--font-body` | `--type-label` `11` | `700` | `1.25` uppercase `0.05em` | `StatusPill`, table `TH` |
| Sub-label (opt-in) | `--font-body` | `--type-label-compact` `10` / `--type-label-micro` `9` | `700` | `1.25` uppercase `0.05em` | Timeline milestones on `<sm` (`Timeline.tsx` `labelSize`) |

Hierarchy is established by size/weight/placement — not by adding colors or arbitrary `17px/19px/22px` one-offs. The former one-offs (`17` DialogTitle, `22` Panel/KPI) were normalized to the nearest role (`16` `heading-sm`, `18` `heading-md`, `22` `panel-title`) in `730943e`.

## Component usage

### React inline styles (token-direct)

```tsx
<h3 style={{
  fontFamily: "var(--font-display)",
  fontSize: "var(--type-heading-sm)",
  fontWeight: "var(--weight-semibold)",
  lineHeight: "var(--leading-snug)",
  letterSpacing: "var(--tracking-label)",
  color: "var(--text-primary)"
}}>Chamber status</h3>

<p style={{
  fontFamily: "var(--font-body)",
  fontSize: "var(--type-caption)",
  fontWeight: "var(--weight-regular)",
  lineHeight: "var(--leading-normal)",
  color: "var(--text-secondary)"
}}>Live systems, power, and connectivity</p>
```

Merge `style` after token defaults so consumer overrides don't clobber tokens (`input.tsx`, `label.tsx`, `select.tsx` destructure `...style` after defaults — `cb67abe`).

### Tailwind classes

```tsx
<p className="text-sm leading-normal">Supporting text</p> {/* 0.875rem = var(--type-body) */}
<span className="text-xs font-bold tracking-widest">LABEL</span> {/* 0.75rem = var(--type-caption) */}
```

Prefer Tailwind semantic sizes only when they map exactly (`text-sm` = `var(--type-body)` `14`, `text-xs` = `var(--type-caption)` `12`). Otherwise use tokens directly.

### Trends toolbar (single voice)

```tsx
const CONTROL_FONT: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--type-body-sm)",
  fontWeight: "var(--weight-semibold)",
  lineHeight: "var(--leading-normal)",
};
```

Before `bca3846` this was hardcoded `'"Nunito", sans-serif' 13/600`; now tokenized (`TrendsScreen.tsx:72`).

## Implementation rules

**Use:**

```tsx
<span style={{
  fontFamily: "var(--font-body)",
  fontSize: "var(--type-label)",
  fontWeight: "var(--weight-bold)",
  lineHeight: "var(--leading-snug)",
  letterSpacing: "var(--tracking-label)",
  textTransform: "uppercase"
}}>NEEDS ATTENTION</span>
```

**Avoid:**

```tsx
<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em" }}>...</span>
```

Unless the value is a documented chart/illustration constraint or a deliberate
density exception (for example, compact 12px/13px table copy). The original
typography audit was local-only; the [archived refinement plan](../refine/archive/typography-refinement-plan.md)
records its assumptions, and source code remains authoritative.

## Intentional exceptions (px kept)

Raw `px` may remain when it expresses physical UI detail, not typographic scale:

- `1px` hairlines: `border: 1px solid var(--border-subtle)` — must stay `1px` crisp, not grow with font
- Chart library props: Recharts `strokeWidth`, `dot r`, `tickMargin`, `margin` (`TrendsScreen.tsx`) — numeric px required
- Illustration geometry: `IncubationCalendar` phase bands `height 38 width 44`, `Timeline` nodes `32`, `GaugeDial` `Math.round(size*0.07)` `WaterDroplet` `size*0.14` — deliberate measurements
- Icon geometry: `lucide-react` `size={16}` etc.

Every exception should have a nearby comment or be an obvious chart/illustration prop. Do not add raw `fontSize` for new prose.

## Mobile type and visual control geometry — SUPERSEDED 2026-09-06

> Blanket phone decrease (user-approved) replaces the selective scale below.
> Source of truth is now `typography-experimental.md` + `theme.css` phone block
> (all tokens step down; `control-value` 14→12; 8px micro floor). This section
> is kept for history and will be rewritten or removed on promotion.

## Mobile type and visual control geometry (one scale, three tiers) [HISTORICAL]
There is a single type scale. Default `:root` is the 1440/desktop scale.
Below 640px, only page/panel titles step down selectively while form values
step up to 16px for legibility (values below 16px trigger iOS auto-zoom on
focus). Control visuals keep the canonical 32/36/40px compact scale on
phones; larger hit areas are explicit wrappers, not a global height override.
Do not invent parallel `--type-*-mobile` tokens — they drift from the scale
within weeks.

```css
/* theme.css — selective phone type adjustments only */
@media (max-width: 39.9375rem) {
  :root {
    --type-page-title: 1.25rem; /* 20px */
    --type-panel-title: 1.125rem; /* 18px */
    --type-control-value: 1rem; /* 16px */
  }
}
```

Rules:

- Only the three selective phone type tokens change. Body stays 14px and
  labels stay 11px; the canonical 32/36/40px visual control scale is
  unchanged on phones. Everything at `md` and up is unchanged.
- Breakpoints are `rem`-based so they follow user font-size and 200% zoom.
  Do not convert them to `px`. Type and geometry deliberately use different
  breakpoints: 640px for reading density, 400px for small-phone crowding,
  768px for the mobile shell and explicit hit-area treatment.
- No per-screen `useIsMobile` font switching: components keep reading
  the tokens and the tokens do the work.
- Enforced by `mobile-typography.test.ts` (file-content assertions — jsdom
  cannot evaluate media queries).
- Validate on real 1440px, 600px, 400px, 320px and 375px viewports after any
  change here.

## Accessibility requirements

- Text must resize to `200%` without clipping, overlap, or loss of controls (`typography-refinement-plan.md:156`). Validate at `100%/125%/150%/200%` + narrow `320px`/`375px` + long chamber/mode names (wrap via `whiteSpace: normal; wordBreak: break-word` — `OverviewScreen.tsx:169`, `IncubatorCard.tsx:138`).
- No essential prose uses `10px` or smaller — `11px` label is minimum (`IncubationCalendar.tsx` `10→11` fix done).
- Line heights remain unitless (`1.1`/`1.25`/`1.5`) so wrapping scales predictably.
- Heading hierarchy stays sequential `h1 → h2 → h3` (`PageHeader` `h1` 24, `PanelHeader` `h2` 22, `SectionCard` `h3` 16).
- Focus indicators stay visible after enlargement — `focus-visible:ring-2 ring-offset-2` on `KpiCard` `MiniCard` `AlertBanner` etc. (`61` usages).
- Font fallback `ui-rounded, system-ui, sans-serif` must not hide text or cause unacceptable shift — verified no shift at slow load.
- Numeric values/timestamps use tabular figures where needed (`LiveMonitorTab.tsx` `tabular-nums`).

## Adding a new size

Before adding:

1. Search `theme.css` for an existing role token with the same purpose (`--type-*` table above).
2. If no role fits, add a **role-named** token to `theme.css` (`--type-*` not `font-size-15`), with `rem` value and `px` comment.
3. Check `12/13` density: reuse `var(--type-body-sm)` `13` / `var(--type-caption)` `12` before inventing `17/19`.
4. Ensure `fontWeight 800` pairs with `var(--font-display)` — do not use 800 with body.
5. Run `pnpm --filter eggcelerate-ui typecheck` and `pnpm --filter eggcelerate-ui build` (`<500kB` gate).
6. Test `200%` zoom + `320px` wrap + keyboard focus + fallback.

Do not add a raw `fontSize: 17` directly to a screen component just to match a screenshot — map to the nearest role (`16` `heading-sm` or `18` `heading-md`).

## Current scope and counts

Standardized via 2 SDD runs (`fff9c75..cb67abe` Phase 1-2 + `0caa6fa..bca3846` Phase 3-5):

- `grep -R "fontSize" apps/web/src` → `359` total (`197 numeric px` + `151 var(--type-)` + `11 Tailwind/other`); `var(--type-)` `167` (>50) — was `323` all `px` audit baseline, `0 var`
- `8px/9px` `0` (was 2), `17/19/22` `0` (was 8), `Baloo 2, sans-serif` hardcoded `0` (was 9), `fontWeight 800` without `var(--font-display)` `0` (was 21)
- In the recorded inventory, the remaining `197 px` was mostly `12/13` body/caption in `CandlingJournalTab.tsx` (`71` of 197), retained for dense tables. These counts are historical and should be regenerated before another typography pass.
- `pnpm test` `11/11` (`typography-tokens` `batch-a/b/c`) `typecheck` PASS `build` `index 298.76kB + vendor 183.88kB + Trends 409.58kB` <500kB `bca3846`

Light-theme token system is the supported implementation. Dark-mode `oklch()` values in `theme.css` remain generic, not brand-approved — do not expand without a separate dark-mode review (`color-guidelines.md` current scope).

## [EXPERIMENTAL] Responsive filter-value scale

> **EXPERIMENTAL — not part of the baseline type scale.** This rule is being
> trialed for compact filter dropdowns and may be revised or removed after
> rendered desktop/tablet/mobile review.

Scope: compact filter controls: `SelectTrigger size="filter"` plus the
Incubators overview search/Add controls. It does not change ordinary selects,
body copy, prose, or headings.

| Viewport tier | CSS range | `--type-filter-value` | Computed size |
|---|---|---|---:|
| Desktop | `min-width: 64rem` (1024px) | `var(--type-control-value)` | 14px |
| Tablet | `48rem`–`63.9375rem` (768–1023px) | `0.75rem` | 12px |
| Mobile | below `48rem` (under 768px) | `0.625rem` | 10px |

Implementation lives in `apps/web/src/styles/theme.css`,
`apps/web/src/app/components/ui/select.tsx`, and the mobile controls in
`IncubatorsScreen.tsx`. The filter control geometry remains 36px on mobile and
40px at `md` and above; only the mobile filter-control text trial changes the
typography.

The 10px mobile tier is intentionally compact and must be checked at 320px,
375px, 200% zoom, keyboard focus, and with long option names. Do not reuse
`--type-filter-value` for prose or essential body text. If the compact tier
fails legibility or focus review, revert this experimental scale to the
standard `--type-control-value` role.


### [EXPERIMENTAL] Mobile segmented-filter labels

> **EXPERIMENTAL — visual trial only.** This is a compact mobile treatment
> for short, uppercase segmented-filter labels. It is not a new general
> purpose body or prose size.

Scope: `FilterBar` controls with `variant="segmented"`.

| Viewport tier | `--type-filter-label` | Computed size |
|---|---|---:|
| Desktop and tablet | `var(--type-label)` | 11px |
| Mobile below `48rem` (768px) | `0.625rem` | 10px |

Counts use the same `var(--type-filter-label)` tier, so labels and count
badges share the 10px mobile trial. Review this trial at 320px/375px, 200%
zoom, keyboard focus, and with longer translated filter labels before promoting
it to the baseline scale.
