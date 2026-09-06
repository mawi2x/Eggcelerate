# Eggcelerate Typography — Experimental (blanket decrease)

**Status:** EXPERIMENTAL — blanket phone decrease, user-approved 2026-09-06. Stable selective contract is superseded for phones; `typography-guidelines.md` §Mobile needs the same rewrite (flagged below).
**Source of truth:** `apps/web/src/styles/theme.css` (`:root` + 3 `@media` blocks below). This doc mirrors code; code wins on conflict.

## What is experimental

Blanket decrease: every phone token steps below desktop (`<39.9375rem`), plus the filter tablet/mobile tiers. No token holds or steps up on phones anymore.

| Token | Desktop default | Tablet `48–63.9375rem` (768–1023px) | Mobile `<47.9375rem` (767px) | Consumer |
|---|---|---|---:|---|
| `--type-filter-value` | `var(--type-control-value)` 14 | `0.75rem` 12 | `var(--type-label)` 11 | `Select size="filter"` value (`select.tsx:64-66`) |
| `--type-filter-label` | `var(--type-label)` 11 | 11 hold | `var(--type-label-compact)` 10 | `FilterBar` pills (`filter-bar.tsx:158-162`) |

Definitions (`theme.css:14-16`):

```css
--type-filter-value: var(--type-control-value); /* 14px desktop; 12px tablet; 11px mobile */
--type-filter-label: var(--type-label);         /* 11px desktop/tablet; 10px mobile */
```

Overrides (`theme.css:366-379`):

```css
/* tablet — filter values only */
@media (min-width: 48rem) and (max-width: 63.9375rem) {
  :root { --type-filter-value: 0.75rem; /* 12px */ }
}
/* mobile — filter values + pill labels */
@media (max-width: 47.9375rem) {
  :root {
    --type-filter-value: var(--type-label);         /* 11px */
    --type-filter-label: var(--type-label-compact); /* 10px */
  }
}
```

## Blanket phone block (`theme.css`, `<39.9375rem>`/640px)

| Token | Desktop + tablet | Phone `<640px` | Δ |
|---|---|---:|---:|
| `--type-page-title` | `1.5rem` 24 | `1.25rem` 20 | $-4$ |
| `--type-panel-title` | `1.375rem` 22 | `1.125rem` 18 | $-4$ |
| `--type-heading-lg` | `1.25rem` 20 | `1.125rem` 18 | $-2$ |
| `--type-heading-md` | `1.125rem` 18 | `1rem` 16 | $-2$ |
| `--type-heading-sm` | `1rem` 16 | `0.875rem` 14 | $-2$ |
| `--type-body-lg` | `0.9375rem` 15 | `0.8125rem` 13 | $-2$ |
| `--type-body` | `0.875rem` 14 | `0.75rem` 12 | $-2$ |
| `--type-control-value` | `0.875rem` 14 | `0.75rem` 12 — below iOS 16px focus-zoom floor by request | $-2$ |
| `--type-body-sm` | `0.8125rem` 13 | `0.6875rem` 11 | $-2$ |
| `--type-caption` | `0.75rem` 12 | `0.625rem` 10 | $-2$ |
| `--type-label` | `0.6875rem` 11 | `0.5625rem` 9 | $-2$ |
| `--type-label-compact` | `0.625rem` 10 | `0.5rem` 8 — new micro floor by request | $-2$ |
| `--type-label-micro` | `0.5625rem` 9 | `0.5rem` 8 — merged with compact by request | $-1$ |
| `--type-filter-value` | `var(--type-control-value)` 14 | `var(--type-label)` 11 (`<47.9375rem`) | $-3$ |
| `--type-filter-label` | `var(--type-label)` 11 | `var(--type-label-compact)` 10 (`<47.9375rem`) | $-1$ |

Control geometry holds on all tiers (32/36/40 visual; 44px via explicit wrappers only). No `--control-*` inside any type `@media`.
## Breakpoint map (all `rem`, zoom-relative)


| Query | px | Owns |
|---|---|---|
| `max-width: 39.9375rem` | 639 | blanket decrease: titles, headings, body, control-value, labels all step down |
| `max-width: 47.9375rem` | 767 | filter-value 11 + filter-label 10 |
| `min-width: 48rem and max-width: 63.9375rem` | 768–1023 | filter-value 12 |
| `768px` shell (`md:`, `use-mobile.ts:3`) | 768 | nav/dialogs/layout — not type |
| `19rem` / `22.5rem` crowding | ~304 / 360 | wrap/scroll/shorten — not `font-size` |

Overlap note: `640–767px` uses desktop titles/body + mobile filter values. Intentional — the two overrides have different breakpoints.

## Rules

- `filter-value` = dropdown/select values with `size="filter"` only. Never body, prose, errors, actions.
- `filter-label` = `FilterBar` pill labels only (bold, uppercase, `var(--tracking-label)`). Blanket minimum is now 8px (`label-compact/micro` on phones) — contrast + full-text path review required wherever 9px or 8px renders.
- `rem` only. Do not convert breakpoints or tokens to `px`.
- No new `--type-*-mobile` parallel tokens; extend these roles, don't fork.

## Enforcement

- `mobile-typography.test.ts` — blanket phone asserts (all 13 tokens below desktop) + filter tablet/mobile asserts; asserts no `--control-*` inside the `47.9375rem` block.
- `filter-bar.test.ts:11-27` — asserts `FilterBar` consumes `var(--type-filter-label)` + bold + tracking; asserts `theme.css` defines `filter-label → label → label-compact` chain.
- `typography-tokens.test.ts` — asserts base `page-title`/`body`/weight/leading/tracking + `100%` root + blanket `body 0.75rem` / `control-value 0.75rem` phone presence.

## Validate

- Viewports: 1440 (desktop), 900 tablet (filter 12), 767 edge (filter 11 / pills 10), 393 + 360 (blanket phones), 320 floor (8px legibility).
- 200% zoom + long names/filter labels (wrap, no clip at 12/11/10/9/8 floors).
- `pnpm --filter eggcelerate-ui test -- src/tests/mobile-typography.test.ts src/tests/filter-bar.test.ts src/tests/typography-tokens.test.ts`.

## Promote or revert

- Promote: folded into this page already for phones; remaining step is rewriting `typography-guidelines.md` §Mobile + hierarchy floors (11px minimum, 16px UP, no-8px rule are all superseded) and re-shooting the viewport matrix above.
- Revert: restore selective block (titles + `control-value: 1rem` UP only, rest holds, no 8px) + delete the two `[EXPERIMENTAL]` filter blocks; `filter` falls back to `control-value` 14→16, pills to `label` 11. Tests to update: `mobile-typography` blanket asserts, `filter-bar` label asserts, `typography-tokens` blanket asserts.
