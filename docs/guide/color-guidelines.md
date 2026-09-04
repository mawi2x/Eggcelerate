# Eggcelerate Color Guidelines

This guide defines how to use color in the Eggcelerate web app. It is intended for new screens, component work, design reviews, and visual QA.

## Source of truth

Use the semantic CSS variables in [theme.css](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/styles/theme.css). Do not add a new hex value directly to a component when an existing semantic token describes the same purpose.

The token flow is:

```text
Primitive value → semantic token → component state
```

For example:

```css
/* theme.css */
--brand-primary: #AD3A1D;
--global-nav-selected-bg: var(--brand-primary);

/* component */
background: var(--global-nav-selected-bg);
```

## Core palette

### Brand

| Token | Value | Use |
|---|---|---|
| `--brand-primary` | `#AD3A1D` | Primary actions, global navigation selection, links, brand emphasis |
| `--brand-primary-hover` | `#8B3A1C` | Hover, pressed, or nested selected text |
| `--brand-primary-soft` | `#FCE4D6` | Light selected state, soft brand background |
| `--brand-primary-soft-hover` | `#F2D4C5` | Hover state on soft brand controls |
| `--on-brand` | `#FFFFFF` | Text and icons placed on solid brand backgrounds |

`#AD3A1D` is the approved application brand color. Do not introduce new rust variants such as `#A84323` or `#C8623A` for controls.

### Text

| Token | Value | Use |
|---|---|---|
| `--text-primary` | `#1A1A1A` | Headings, primary labels, values, table content |
| `--text-secondary` | `#5A4838` | Supporting text, metadata, secondary controls |
| `--text-muted` | `#78716C` | Captions, helper text, table headers, low-emphasis labels |

Do not use muted text for essential instructions, errors, or action labels. Text should not rely on color alone to communicate state.

### Surfaces and borders

| Token | Value | Use |
|---|---|---|
| `--surface-page` | `#FBFAF7` | Application canvas |
| `--surface-card` | `#FFFFFF` | Cards, dialogs, menus, input surfaces |
| `--surface-subtle` | `#F9F6F0` | Secondary cards and quiet grouping surfaces |
| `--surface-muted` | `#F5EDD8` | Muted controls, hover backgrounds, low-emphasis areas |
| `--border-default` | `#E8E2D5` | Standard card, table, and input borders |
| `--border-subtle` | `#EAE7E1` | Hairlines, separators, sidebar borders |
| `--input-border` | `#D8D0C0` | Form control borders |

Surfaces should establish hierarchy through contrast, spacing, and elevation. Do not add a new cream or white variant for a one-off card without documenting why it is needed.

### Status colors

Use the darker foreground with the matching light background for normal-sized status text.

| Status | Foreground token | Background token | Contrast |
|---|---|---|---:|
| Success | `--status-success-fg` (`#15803D`) | `--status-success-bg` (`#DCFCE7`) | 4.57:1 |
| Warning | `--status-warning-fg` (`#B45309`) | `--status-warning-bg` (`#FEF3C7`) | 4.51:1 |
| Danger | `--status-danger-fg` (`#B91C1C`) | `--status-danger-bg` (`#FEE2E2`) | 5.44:1 |
| Information | `--status-info-fg` (`#57534E`) | `--status-info-bg` (`#F5F5F4`) | 7.19:1 |

Status colors must be paired with text or an icon. Never use red, amber, or green as the only indication of state.

## Navigation hierarchy

Selected navigation uses different treatments by level so two active locations do not compete visually.

### Global navigation

Use the solid brand treatment:

```css
background: var(--global-nav-selected-bg);
color: var(--global-nav-selected-fg);
```

This applies to the primary sidebar and mobile navigation.

### Local navigation

Use the light brand treatment:

```css
background: var(--local-nav-selected-bg);
color: var(--local-nav-selected-fg);
border-color: var(--brand-primary-soft);
```

This applies to Settings categories and incubator detail sub-navigation. Do not use another solid rust pill inside an already-selected global section.

### Hover states

Use the shared navigation hover tokens:

```css
background: var(--nav-hover-bg);
border-color: var(--nav-hover-border);
color: var(--brand-primary);
```

Keep hover styling from changing layout dimensions or moving neighboring content.

## Component usage

### React inline styles

```tsx
<Button
  style={{
    backgroundColor: "var(--brand-primary)",
    color: "var(--on-brand)",
  }}
>
  Save changes
</Button>
```

### Tailwind classes

```tsx
<div className="border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)]" />
```

### Status badge

```tsx
<span
  style={{
    backgroundColor: "var(--status-warning-bg)",
    color: "var(--status-warning-fg)",
  }}
>
  Needs attention
</span>
```

## Charts and data visualization

Chart-series colors are an approved exception because multiple chambers need to remain distinguishable. They must:

- remain separate from status colors;
- maintain at least 3:1 contrast against the plotting surface;
- use a visible legend and tooltip;
- never use red/green alone to communicate meaning;
- preserve the subtle target-range treatment behind the data.

Do not reuse a chamber-series color for an error, success, or warning state.

## Intentional exceptions

Raw values may remain when they are part of a dedicated visual asset or data system, including:

- mascot and illustration artwork;
- chamber-series palettes;
- target-range chart accents;
- photograph overlays and scrims;
- data-driven colors that are resolved through an explicit status or chart mapping.

Every exception should have a nearby comment or a named constant explaining its purpose.

## Accessibility requirements

- Normal text must meet a 4.5:1 contrast ratio.
- Large text and non-text controls must meet the applicable WCAG contrast thresholds.
- Focus indicators must remain visible against both the component and page surface.
- Never communicate status through color alone; include a label, icon, shape, or text.
- Icon-only controls require an accessible name.
- Disabled states must be visibly and semantically disabled, not merely recolored.
- Test the composed foreground/background pair, not the foreground color in isolation.

Avoid these known failing normal-text pairs:

```text
#C8623A on #FFFFFF       3.99:1  (fail)
#16A34A on #DCFCE7       3.00:1  (fail)
#D97706 on #FEF3C7       2.86:1  (fail)
```

Use the semantic status foreground tokens instead.

## Adding a new color

Before adding a color:

1. Search [theme.css](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/styles/theme.css) for an existing token with the same purpose.
2. Decide whether the value is primitive, semantic, or component-specific.
3. Add the token to `theme.css` with a descriptive name.
4. Check contrast in every foreground/background pairing.
5. Document the reason if it is a chart, illustration, overlay, or other approved exception.
6. Run TypeScript and the production build.

Do not add a raw hex directly to a screen component just to match a screenshot.

## Current scope

The light-theme token system is the supported implementation. The existing generic dark-mode values are not yet an approved Eggcelerate dark theme and should not be expanded without a separate dark-mode design review.
