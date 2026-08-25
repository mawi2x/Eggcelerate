# Typography Phase 1-2 Design — Tokens + Root + Shared Primitives

**Date:** 2026-08-26  
**Status:** approved for planning  
**Source:** `docs/refine/typography-refinement-plan.md` Phases 1-2, `docs/audit/typography-report.md`, `docs/guide/color-guidelines.md`  
**Scope:** Phase 1 (tokens + root 100%) + Phase 2 (shared primitives) only — screens batches deferred per user choice

## Goal

Make Eggcelerate typography consistent/scalable without oversized dashboard density, retaining Baloo 2 (display) + Nunito (body) and compact data density, per `typography-refinement-plan.md:12`.

## Decisions (from refinement doc)

- Keep Baloo 2 / Nunito `typography-refinement-plan.md:41` — no family redesign
- Root `16px` → `100%` user-relative `typography-refinement-plan.md:45` — validate at 200% zoom before broad migration
- Use `rem` for type via tokens/Tailwind `typography-refinement-plan.md:48`, keep `px` for 1px borders/hairlines/icon geometry/chart constraints `typography-refinement-plan.md:49`
- Do not mechanically convert widths/heights/radii/gaps

## Architecture

Token flow mirrors color guide `Primitive → semantic → component` `color-guidelines.md:9`:

```
:root --type-* / --weight-* / --leading-* / --tracking-*  (theme.css)
   ↓
Component style={{ fontFamily:"var(--font-display)", fontSize:"var(--type-*)" }}
or Tailwind text-sm when maps exactly `typography-refinement-plan.md:182`
```

- Add tokens to `apps/web/src/styles/theme.css:3` `:root` (role names, not component names)
- Keep existing `--font-display`/`--font-body` as source of truth `typography-refinement-plan.md:121`
- `html { font-size: 100% }` replaces `100%` via `var(--font-size)` or direct — remove `--font-size:16px` hardcoded

## Proposed Tokens (exact from refinement doc)

```css
:root {
  --font-display: "Baloo 2", ui-rounded, system-ui, sans-serif;
  --font-body: "Nunito", ui-rounded, system-ui, sans-serif;
  --type-page-title: 1.5rem;      /* 24px */
  --type-panel-title: 1.375rem;   /* 22px */
  --type-heading-lg: 1.25rem;     /* 20px */
  --type-heading-md: 1.125rem;    /* 18px */
  --type-heading-sm: 1rem;        /* 16px */
  --type-body: 0.875rem;          /* 14px */
  --type-body-sm: 0.8125rem;      /* 13px */
  --type-caption: 0.75rem;        /* 12px */
  --type-label: 0.6875rem;        /* 11px; labels only */
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
```

11px token only for labels/metadata, not paragraphs `typography-refinement-plan.md:93`.

## Hierarchy (for primitives)

| Role | Family | Size | Weight | Leading |
|---|---|---:|---:|---:|
| Page title | `var(--font-display)` | `var(--type-page-title)` | 700 | 1.25 |
| Panel title | `var(--font-display)` | `var(--type-panel-title)` | 700 | 1.25 |
| Section/card | `var(--font-display)` | `var(--type-heading-sm)–md` | 600–700 | 1.25 |
| Body/control | `var(--font-body)` | `var(--type-body)` | 400–600 | 1.5 |
| Dense table | `var(--font-body)` | `var(--type-body-sm)` | 400–600 | 1.4–1.5 |
| Caption | `var(--font-body)` | `var(--type-caption)` | 400–500 | 1.5 |
| Micro-label | `var(--font-body)` | `var(--type-label)` | 700 | 1.25 uppercase |

Establish via size/weight/spacing, not color `typography-refinement-plan.md:108`.

## Components to Migrate (Phase 2 first)

Before screens `typography-refinement-plan.md:126`:

- `PageHeader.tsx:85` h1/p
- `detail/primitives.tsx:60` `SectionCard`/`PanelHeader`/`SettingRow`/`Field` `tokens.tsx`
- `ui/button.tsx` `ui/input.tsx` `ui/select.tsx` `ui/label.tsx` `PaginationBar`
- `AppSidebar.tsx:289` brand, `UtilityHeader`, `NotificationPopover`
- Replace `fontFamily: "Baloo 2, sans-serif"` → `var(--font-display)`, body → `var(--font-body)` `typography-refinement-plan.md:135`
- Keep color usage `color: var(--text-primary/secondary)` `color-guidelines.md:7` — no raw hex

Explicitly out of scope this slice: `Overview/Incubators/Alerts/Settings/Trends/Detail/Candling/Calendar` screens (Phase 3), outlier fixes (Phase 4).

## Validation

Per `typography-refinement-plan.md:154` + `typography-refinement-plan.md:196`:

- Default, 125/150/200% browser zoom, 320/375px, long names
- `pnpm --filter eggcelerate-ui typecheck` + `build`
- Text resizes 200% no clip/overlap, no essential prose ≤10px, unitless leading, h1→h2→h3 sequence, focus visible, `display=swap` fallback no layout shift
- Rerun `grep -R fontSize | wc -l` inventory before/after

## Non-goals

- No Baloo/Nunito change, no `shadcn/typeset` `typography-refinement-plan.md:209`, no 16px-everywhere, no border/shadow px conversion, no data/chart logic change

## Open Risks

- `theme.css:185` `var(--text-2xl)` undefined — replace with new type tokens
- `--font-weight-medium` duplicates new `--weight-*` — alias or deprecate
- `html 100%` changes Tailwind rem base — test fallback fonts layout shift

## Approach Chosen

**A — Token-direct** — add tokens exactly as proposed, `100%` root, inline `var(--type-*)` in primitives (faithful to `typography-refinement-plan.md:172` example). Rejected B (Tailwind config) and C (primitives-only abstraction) for now.
