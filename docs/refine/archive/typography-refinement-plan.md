# Eggcelerate Typography Refinement Plan

Status: planned, no implementation changes from this document

Historical note: the original local-only typography report is not part of the
tracked record. Current type roles and tokens are described in the
[typography guidelines](../../guide/typography-guidelines.md).

## Goal

Make Eggcelerate typography consistent, scalable, and easier to maintain without making the monitoring dashboard feel oversized or reducing its useful data density.

The app should retain its existing personality:

- Baloo 2 for display headings and selected metric values;
- Nunito for body copy, controls, tables, and supporting text;
- warm, compact dashboard density;
- readable text at browser zoom and narrow widths.

## Audit corrections to carry forward

The existing report is a useful inventory but should not be treated as the final baseline:

- It was generated on 2026-08-25 and is now stale.
- Current source contains approximately 331 `fontSize` declarations, 325 numeric inline sizes, and 24 `fontFamily` declarations.
- Headings without an inline family do not automatically use Nunito: `theme.css` applies `var(--font-display)` to `h1`–`h6`.
- Pixel values do not automatically fail browser zoom. The requirement is that text can resize to 200% without clipping, overlap, or loss of content.
- Tailwind text utilities are already rem-based; they should be reused where their semantic size matches the content.
- The 8px/9px calendar label is a real readability risk and needs a specific fix.

Before implementation, rerun the inventory and record exact counts for:

- inline `fontSize`, `fontFamily`, `fontWeight`, `lineHeight`, and `letterSpacing`;
- Tailwind text-size utilities;
- explicit font-family overrides;
- text below 11px;
- elements using weight 800 without an explicit display family.

## Decisions

### Keep the current families

Do not replace Baloo 2 or Nunito during this refinement. The existing pairing supports the Eggcelerate brand and the report does not establish a need for a font-family redesign.

### Make the root scalable

Change the root typography baseline from a hardcoded `16px` to a user-relative baseline such as `100%`. Validate the resulting layout at the default browser size and at 200% text/browser zoom before changing component sizes broadly.

### Use rem for type, not mechanically for everything

Use `rem` or semantic Tailwind text utilities for typography. Keep pixel units where they express physical UI details such as 1px borders, hairlines, icon geometry, chart-library constraints, and deliberate illustration measurements.

Do not convert every width, height, radius, or gap in one mechanical pass. Those values need separate component and responsive review.

## Proposed typography tokens

Add these tokens to `theme.css`, with names that describe role rather than a page or component:

```css
:root {
  /* Families */
  --font-display: "Baloo 2", ui-rounded, system-ui, sans-serif;
  --font-body: "Nunito", ui-rounded, system-ui, sans-serif;

  /* Type scale */
  --type-page-title: 1.5rem;       /* 24px */
  --type-panel-title: 1.375rem;   /* 22px */
  --type-heading-lg: 1.25rem;     /* 20px */
  --type-heading-md: 1.125rem;    /* 18px */
  --type-heading-sm: 1rem;        /* 16px */
  --type-body: 0.875rem;          /* 14px */
  --type-body-sm: 0.8125rem;      /* 13px */
  --type-caption: 0.75rem;        /* 12px */
  --type-label: 0.6875rem;        /* 11px; labels only */

  /* Weights */
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --weight-extrabold: 800;

  /* Unitless line heights */
  --leading-tight: 1.1;
  --leading-snug: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.6;

  /* Label tracking */
  --tracking-label: 0.05em;
  --tracking-tight: -0.01em;
}
```

The 11px token is for compact labels, table headers, and metadata—not paragraphs. Do not create an 8px body or label token.

## Intended hierarchy

| Role | Family | Size | Weight | Line height |
|---|---|---:|---:|---:|
| Page title | `--font-display` | `--type-page-title` | 700 | 1.25 |
| Panel title | `--font-display` | `--type-panel-title` | 700 | 1.25 |
| Section/card title | `--font-display` | `--type-heading-sm` to `--type-heading-md` | 600–700 | 1.25 |
| KPI/metric value | `--font-display` | 22–24px role token | 700–800 | 1.1 |
| Body and control copy | `--font-body` | `--type-body` | 400–600 | 1.5 |
| Dense table/supporting text | `--font-body` | `--type-body-sm` | 400–600 | 1.4–1.5 |
| Caption/helper text | `--font-body` | `--type-caption` | 400–500 | 1.5 |
| Micro-label | `--font-body` | `--type-label` | 700 | 1.25, uppercase only when useful |

The hierarchy should be established by size, weight, spacing, and placement—not by adding more colors or arbitrary font sizes.

## Migration phases

### Phase 0 — Refresh the baseline

1. Rerun the typography inventory against the current source.
2. Correct file/line citations in the report.
3. Identify all text below 11px and all explicit family overrides.
4. Record the current visual hierarchy as the comparison baseline.

### Phase 1 — Add tokens and root behavior

1. Add the type, weight, leading, and tracking tokens.
2. Keep the existing `--font-display` and `--font-body` names as the source of truth.
3. Change the root baseline to a user-relative value.
4. Confirm Google font loading still uses `display=swap` and that fallback fonts do not cause unacceptable layout shift.

### Phase 2 — Migrate shared primitives

Migrate these before individual screens:

- `PageHeader`;
- `SectionCard`, `PanelHeader`, `SettingRow`, and `Field`;
- buttons, inputs, selects, labels, pagination, badges, and dialogs;
- sidebar, utility header, and notification popover.

Use semantic tokens or Tailwind utilities. Replace hardcoded `fontFamily: "Baloo 2, sans-serif"` with `var(--font-display)` and body overrides with `var(--font-body)`.

### Phase 3 — Migrate screens in batches

1. Overview and Incubators.
2. Alerts and Settings.
3. Trends and chart labels/tooltips.
4. Incubator detail, candling, and calendar views.

For each batch, preserve the existing density and content. Only consolidate sizes that have the same semantic role.

### Phase 4 — Fix outliers

- Replace the 8px/9px calendar label with a readable label or a non-text indicator.
- Review 10px and 11px labels for truncation and mobile readability.
- Check 800-weight text that does not explicitly use Baloo 2; either use the display family or reduce to a loaded Nunito weight.
- Normalize one-off 17px, 19px, and 22px values to the closest documented role when the visual context matches.
- Give long labels room to wrap instead of relying on truncation.

### Phase 5 — Validate and update the report

Test each migrated batch at:

- default browser size;
- 125%, 150%, and 200% browser zoom;
- narrow mobile widths, especially 320px and 375px;
- long chamber names, alert titles, mode names, and translated/expanded text;
- keyboard focus and modal states;
- slow font loading and fallback rendering.

Then rerun the inventory and record the remaining intentional exceptions.

## Implementation rules

Use:

```tsx
<h2 style={{
  fontFamily: "var(--font-display)",
  fontSize: "var(--type-panel-title)",
  fontWeight: "var(--weight-bold)",
  lineHeight: "var(--leading-snug)",
}}>
  Incubation mode
</h2>
```

Or use an existing Tailwind semantic size when it maps exactly:

```tsx
<p className="text-sm leading-normal">Supporting text</p>
```

Avoid:

```tsx
<p style={{ fontSize: 12, fontWeight: 700 }}>...</p>
```

unless the value is a documented chart/illustration constraint or a deliberate data-density exception.

## Accessibility acceptance criteria

- Text resizes to 200% without clipping, overlap, or loss of controls.
- No essential prose uses 10px or smaller text.
- Body/supporting copy remains readable at narrow widths.
- Line heights remain unitless and support wrapping.
- Heading hierarchy remains sequential and semantic (`h1` → `h2` → `h3`).
- Focus indicators remain visible after text enlargement.
- Font fallback does not hide text or create an unusable layout shift.
- Numeric values and timestamps remain stable using tabular figures where needed.

## Non-goals

- Do not change Baloo 2 or Nunito now.
- Do not introduce `shadcn/typeset`; it is for rendered markdown/prose and has no current dashboard consumer.
- Do not make every dashboard label 16px; preserve compact data-table and chart density where the text remains accessible.
- Do not convert borders, shadows, chart-library numeric props, or illustration geometry solely to remove every `px`.
- Do not change data, chart calculations, navigation behavior, or component functionality.

## Definition of done

- The refreshed inventory is accurate.
- Shared typography tokens are used by all high-reuse components.
- Remaining raw font sizes are documented exceptions.
- The 8px/9px micro-label issue is resolved.
- The app passes TypeScript and production build checks.
- Zoom, responsive, fallback-font, and keyboard checks pass.
- `typography-report.md` is updated with post-migration counts and remaining work.
