# Filter Bar Refinement Plan

Status: implemented; this document records the shared primitive rationale, while the implementation and tests are in place. Status-bucket vocabulary and the Trends time-horizon responsive treatment are governed by `docs/refine/list-filter-unification-plan.md`.

Source audit: `docs/audit/*` (no dedicated filter-bar audit existed 2026-08-25) + 3 red-boxed screenshots 2026-08-26: Alerts `AlertsScreen.tsx:78`, Trends `TrendsScreen.tsx:543`, Incubators `IncubatorsScreen.tsx:288`

Execution plan: `docs/superpowers/plans/2026-08-26-filter-bar-consistency.md` (canonical, task-by-task with tests)

## Goal

Unify the three filter/horizon controls into one canonical `FilterBar` primitive without changing filtering logic, counts, or sorting — fix the pill drift that made the same interaction look like 3 different components.

Keep compact dashboard density: `pill 9999`, `gap-2` 8px, `11px` label via `var(--type-label)` — not oversized 14px prose.

## Finding (refined audit)

No dedicated `filter-bar` audit existed; generic `standardization-report.md:5,11,14` flagged the causes:

- **P0** Button bypass `15+ inline bg RUST` — all 3 bars use raw `<button style={{backgroundColor:RUST}}>`
- **P1** Radius `11 variants` `rounded-full 86 vs rounded-xl 12` — Trends `rounded-xl` vs others `rounded-full`
- **P1** Spacing `9 gap-*` — `gap-2` etc. mixed
- **P2** Typography `11 fontSizes` — `600 14 Title Case` vs `700 11 uppercase 0.05em`

Exhaustive diff 2026-08-26:

| Bar | File:Line | Visual | Tokens |
|-----|-----------|--------|--------|
| **Alerts** `All (12) Urgent (2)…` `AlertsScreen.tsx:78-95` | Title Case `600` ~14px `px-4 py-2` `rounded-full` | active `RUST`/`#fff`, inactive `#F5EDD8`/`#5C4636` no border, no `0.05em`, no `var(--type-label)` |
| **Incubators** `ALL (12) OPTIMAL…` `IncubatorsScreen.tsx:289-311` | `UPPERCASE 11/700 0.05em` `px-3.5 py-1.5` `rounded-full` | active `RUST`/`var(--on-brand)` `1px RUST`, inactive `CARD #F9F6F0`/`var(--border-default)` — raw `11` not token |
| **Trends** `LAST 24H…` `TrendsScreen.tsx:543-562` | `UPPERCASE 11/700 0.05em` `px-4 py-2` `rounded-xl 12` | active `RUST`/`white` `no border`, inactive `SURFACE #FFF`/`BORDER` `1px` — wrong radius |

**Verdict:** Same interaction, 3 radii/spacings/type/backgrounds — fix by extracting single primitive.

## Decisions

- Canonical styling: `pill 9999` `gap-2` `px-3.5 py-1.5` `var(--type-label) 0.6875rem` `700` `var(--tracking-label) 0.05em` `uppercase` `var(--leading-snug) 1.25` `RUST var(--brand-primary)` active + `var(--on-brand)` text vs `var(--surface-card)` `#FFFFFF` + `var(--border-default)` `#E8E2D5` / `var(--text-muted)` inactive, `1px` hairline, `focus-visible:ring-2 ring-ring`
- Keep `px` only for `1px` border hairline `typography-refinement-plan.md:48`; `rem` for `fontSize` via `var(--type-label)`
- No hex in new bar code `color-guidelines.md:7` — only `var(--*)`; exceptions remain chart/illustration only
- Behavior unchanged: `aria-pressed`, counts `(12)`, `setFilter/setPage`, `Sort: Recent` etc. untouched

## Architecture

`src/app/components/ui/filter-bar.tsx` `FilterBar({options,value,onChange,ariaLabel})` where `options:{key,label,count?}[]` — single source for all 3 screens; migrate incrementally Alerts → Incubators → Trends with Vitest grep tests + `typecheck` + `build` + 100%/200% zoom + `focus ring` validation.

## Copy for refine

This file is the **design-discussion copy** for `docs/refine/` (lightweight). The **executable plan with code blocks, test commands, and commit steps** remains `docs/superpowers/plans/2026-08-26-filter-bar-consistency.md` (5 tasks, self-review, handoff). Keep this file as the reasoning audit; do not duplicate code blocks here — reference the superpowers plan for implementation.

## Acceptance

- [ ] All 3 bars render `pill 9999` `uppercase 11/700 0.05em` `gap-2` visually identical (only label text differs)
- [ ] No `fontSize: 11` number or `#F5EDD8`/`#5C4636` remain in filter-bar code — `grep filter-bar.test.ts` passes
- [ ] `theme.css` tokens `var(--type-label)` `var(--brand-primary)` reused; no new hex
- [ ] `100%/200%` zoom 320/375px no clip, keyboard `Tab` ring visible, `aria-pressed` correct
- [ ] `pnpm --filter eggcelerate-ui typecheck && build` green, `<500kB`

## Non-goals

- No change to filtering logic, counts, search, `Sort` selects, or data fetching
- No new families; keep `Nunito` body for bar
- No bulk `px`→`rem` for widths/heights/radii beyond the bar's `fontSize` and `1px` hairline
