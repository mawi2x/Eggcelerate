# UI Control-Size Guidelines

**Status:** Implemented  
**Last reviewed:** 2026-09-01  
**Source plan:** `docs/refine/control-size-standardization-plan.md`  
**Source audit:** `docs/audit/control-size-standardization-audit.md`

## Purpose

Use one role-based geometry system for dashboard controls. The goal is aligned toolbars without forcing every control, chip, icon, or navigation item to have the same physical size.

This guide applies to the dashboard control families reviewed in Trends, Candling Logs, Incubators, Alerts, and Incubator Detail. It does not replace the separate status/emblem badge or pagination standards.

## Standard scale

The canonical scale is **32px compact, 36px default, and 40px toolbar**. There is intentionally no 38px tier.

| Role | Token / Class | Value | Use |
|---|---|---:|---|
| Micro | `size="micro"` / `h-7` | `1.75rem` / **28px** | Inline toolbar dropdowns, micro filters, compact sort toggles |
| Compact | `--control-height-compact` | `2rem` / **32px** | Dense utility actions, small selects, compact segments |
| Default | `--control-height-default` | `2.25rem` / **36px** | Ordinary buttons, inputs, and selects |
| Toolbar | `--control-height-toolbar` | `2.5rem` / **40px** | Search fields, toolbar selects, and page-level toolbar actions |
| Filter chip | `--control-height-chip` | `1.75rem` / **28px baseline** | Filter/status pills; keep their compact treatment and wrapping behavior |
| Icon visual | `--control-size-icon` | `2.25rem` / **36px** | Grid/list toggles and icon-only controls |
| Icon hit area | `--control-hit-area-icon` | `2.75rem` / **44px** | Touch-friendly wrapper or minimum interactive area when layout permits |
| Segmented item | `--control-segment-height` | `2.25rem` / **36px default** | Shared visual geometry for choice segments and tabs |
| Filter row | `--control-height-filter-row` | `calc(var(--control-segment-height) + 0.5rem)` / **44px** | Desktop filter row: height-matched segmented FilterBar and dropdown controls |
All tokens live in `apps/web/src/styles/theme.css`. Screen code should consume these semantic tokens through the shared primitives rather than introducing numeric height literals.

## Shared component API

### Buttons
Use `Button` sizes by role:

```tsx
<Button size="micro">Micro action</Button>        {/* 28px */}
<Button size="sm">Compact action</Button>         {/* 32px */}
<Button>Default action</Button>                   {/* 36px */}
<Button size="toolbar">Toolbar action</Button>    {/* 40px */}
<Button size="icon" aria-label="More options">...</Button>
```

`Button size="lg"` remains a supported 40px variant for existing generic usage. Prefer `size="toolbar"` when the intent is page-toolbar alignment because the name documents the role.

### Inputs

`Input` uses a 36px default and supports explicit role sizing:

```tsx
<Input placeholder="Ordinary form field" />
<Input size="compact" placeholder="Dense field" />
<Input size="toolbar" placeholder="Search incubators..." />
```

The wrapper's `size` prop selects the visual control tier; it is not the native HTML character-width attribute. Use CSS/layout width separately with `className` or a parent container.

### Selects

Use `SelectTrigger` with the matching semantic size:

```tsx
<SelectTrigger size="micro">...</SelectTrigger>     {/* 28px */}
<SelectTrigger size="sm">...</SelectTrigger>        {/* 32px */}
<SelectTrigger>...</SelectTrigger>                   {/* 36px */}
<SelectTrigger size="toolbar">...</SelectTrigger>   {/* 40px */}
```
Custom button triggers that visually participate in a toolbar should use `h-[var(--control-height-toolbar)]` and the same padding, border, typography, and focus treatment as the shared trigger.

### Filter chips

Use the shared `FilterBar` for dashboard filter groups. It owns the compact pill treatment, uppercase label typography, counts, spacing, border, and `aria-pressed` state.

Do not promote filter chips to the 40px toolbar tier. The chip token is a 28px minimum visual baseline; its content padding and count label may make the rendered height slightly larger. Preserve wrapping and do not force a fixed height that clips labels or counts.

For status groups that need the connected tab treatment, use `FilterBar` with `variant="segmented"`. It reuses the shared segmented-control surface, active elevation, focus ring, and choice semantics; status screens may choose full-width equal mobile segments or the scrollable treatment when labels need more room.

When all status options are short enough to remain visible, `fitToScreenOnMobile` makes the segmented group fill the phone width with equal columns and removes the overflow affordance. Provide `compactMobileLabel` for any extra-small breakpoint labels that cannot fit without clipping; use the scrolling treatment for groups whose labels need more room.

### Segmented controls and tabs

Use `SegmentedControl` and `SegmentedControlItem` for repeated pill-shaped choice groups:

```tsx
<SegmentedControl aria-label="Metric">
  <SegmentedControlItem active={metric === "temp"} aria-pressed={metric === "temp"}>
    Temperature
  </SegmentedControlItem>
  <SegmentedControlItem active={metric === "humidity"} aria-pressed={metric === "humidity"}>
    Humidity
  </SegmentedControlItem>
</SegmentedControl>
```

Choose `size="compact"` for dense secondary choices, the default size for ordinary segments, and `size="toolbar"` when the group belongs to a 40px toolbar or detail action row.

Visual geometry is shared, but interaction semantics are not:

- **Choice segments:** remain buttons and expose `aria-pressed`.
- **Navigation tabs:** put `role="tablist"` on the container, `role="tab"` on each item, and `aria-selected` on each item. Add `aria-controls` when the tab is connected to a separately identified tab panel. The selected state must be conveyed by both `aria-selected` and the visual active state.
- Keep keyboard focus visible with the shared focus ring. Do not replace tab/choice semantics with a generic clickable `div`.

## Icon controls and hit areas

Separate the visual size from the interactive hit area:

- Keep the visible icon control at 36px when it belongs to the icon-control family.
- Below the 768px mobile-shell breakpoint the shared visual tokens stay at
  the compact 32/36/40px scale. Do not globally step
  `--control-height-default`, `--control-height-toolbar`,
  `--control-size-icon`, or `--control-segment-height` to 44px: that makes
  every visible filter, select, and toolbar row grow.
- Use explicit 44px wrappers when a touch target needs to grow without
  enlarging its visual mark: `Switch`, `Checkbox`, filter scroll arrows,
  dialog close actions, and other icon actions where the surrounding layout
  can absorb the wrapper. Glyphs stay 16–22px.
- `ViewToggle` uses the 36px visual icon token. Do not count outer group
  padding as an individual button target; add a wrapper when a larger target
  is required.
- `FilterBar` chips stay compact (28px baseline, 36px mobile) and satisfy
  the WCAG 2.2 24px minimum with spacing — the 44px project goal applies to
  primary controls, not chips. The `FilterBar` scroll arrows are the
  exception inside that component: 44px targets with 16px glyphs.
- Every icon-only button needs an accessible name, a `type="button"` when it is not submitting a form, and a visible focus state.

## Screen application

| Screen | Toolbar contract |
|---|---|
| Trends | 40px chamber/species/search controls; shared segmented controls; compact `FilterBar`; compact “See all readings” action |
| Candling Logs | 40px search, selects, and sort-direction control; shared `ViewToggle` and `FilterBar` |
| Incubators | 40px search, selects, add action, and sort-direction control; shared `ViewToggle` and `FilterBar` |
| Alerts | 40px sort select and mark/clear actions; shared compact `FilterBar` |
| Detail | Shared segmented visual contract for 40px detail tabs; 40px primary actions; tab semantics remain navigation semantics |

The standardization changes geometry and accessibility metadata only. Search, filtering, sorting, navigation, and data behavior must remain unchanged.

## Intentional exceptions

The following are not toolbar-size violations:

- Circular status/emblem badges and alert/status tiles, which use the separate `StatusIconBadge` and status geometry tokens.
- Calendar day cells and “today” highlights in `detail/IncubationCalendar.tsx`, whose 38px geometry is a timeline/grid layout requirement rather than a toolbar control.
- Settings-only save bars or other screens outside the reviewed red-boxed dashboard control scope; migrate them in a separate screen audit rather than adding a new size tier.
- Pagination internals and content/card dimensions.
- Filter chip content height when padding and counts require more than the 28px baseline.

Do not add a local 38px value to standard toolbar controls. If a new control cannot use the scale, document the reason next to the exception and in the relevant audit.

## Review checklist

When adding or reviewing a dashboard control:

- [ ] Select the role first: compact, default, toolbar, chip, icon, or segment/tab.
- [ ] Use the shared size prop or a named CSS token; do not add an unexplained pixel height.
- [ ] Keep filter bars compact and use `FilterBar`.
- [ ] Preserve the distinction between `aria-pressed` choices and `aria-selected` tabs.
- [ ] Give icon-only controls accessible names and visible focus.
- [ ] Check wrapping at 320px and 375px, desktop alignment, and 100%/200% zoom.
- [ ] Verify that no standard toolbar control introduces a new 38px tier.
