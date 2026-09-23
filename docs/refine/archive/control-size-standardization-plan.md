# Refinement Plan: Standardize Dashboard Control Sizes

**Source audit:** `docs/audit/control-size-standardization-audit.md`  
**Plan date:** 2026-09-01  
**Status:** Implemented  
**Scope:** Dashboard search fields, selects, filter chips, buttons, icon controls, segmented controls, and tabs shown in the supplied screen captures.  
**Implementation note:** The plan was implemented on 2026-09-01. The guide and validation record below document the resulting contract.

## Implementation record

Implemented the role-based scale and migrated the highlighted control families:

- Added the 32/36/40px control tokens and icon/segment aliases in `apps/web/src/styles/theme.css`.
- Extended `Button`, `Input`, and `SelectTrigger` with token-backed role sizes; added `SegmentedControl` and `SegmentedControlItem`.
- Kept `FilterBar` compact and updated `ViewToggle` with token-backed icon geometry and selected/button semantics.
- Migrated Trends, Candling Logs, Incubators, Alerts, and Detail toolbar controls to the shared APIs without changing their data or navigation behavior.
- Added `docs/guide/ui-control-size-guidelines.md` and reconciled the audit index.

## Goal

Create one role-based control-size system for the dashboard so the highlighted toolbars align without making every component physically identical.

The governing rule is:

> **40px toolbar, 36px default, 32px compact, compact chips:** use 40px for search/select/action controls in page toolbars, retain the existing 36px default primitive tier, use 32px for compact controls, and keep filter/status chips visually compact.

The plan deliberately removes unexplained 38px values rather than adding another permanent size tier.

## What is already implemented

The implementation should build on existing work rather than replace it:

- `Button` already exposes 32px, 36px, 40px, and 36px icon variants in `components/ui/button.tsx`.
- `Input` already has a 36px default in `components/ui/input.tsx`.
- `SelectTrigger` already has 32px and 36px variants in `components/ui/select.tsx`.
- `FilterBar` is the canonical shared filter primitive and its visual treatment is already resolved across Alerts, Incubators, and Trends.
- `ViewToggle` is already shared and uses 36px visual buttons with a padded outer group.
- Circular status/emblem sizing is already handled separately by `StatusIconBadge`; do not merge that system into toolbar sizing.

## Scope decisions

### In scope

- Explicit control-height tokens and component size APIs.
- Toolbar search/select/action baseline alignment.
- Shared visual sizing for segmented controls and tabs.
- Compact filter-chip height documentation/tokenization without changing the resolved filter-bar behavior.
- Focus/hit-area checks for icon-only controls.
- A new guide entry because `docs/guide/` is currently empty.

### Out of scope

- Changing filtering, sorting, navigation, or data logic.
- Replacing all screen-local layout structures with one identical toolbar layout.
- Changing card sizes, page-container widths, or chart dimensions.
- Changing status colors or the filled circular status-icon system.
- Globally replacing Lucide icons or changing intentional circular action icons.
- Reworking `StatusBadge` or rounded-square alert tiles unless a later audit expands the scope from circular badges to all status pills/tiles.

## Proposed control tokens

Add component-level aliases to the existing token home in `apps/web/src/styles/theme.css`:

```css
--control-height-compact: 2rem;       /* 32px */
--control-height-default: 2.25rem;   /* 36px */
--control-height-toolbar: 2.5rem;    /* 40px */
--control-height-chip: 1.75rem;       /* 28px visual baseline */
--control-size-icon: 2.25rem;        /* 36px visual control */
--control-hit-area-icon: 2.75rem;    /* 44px touch-friendly area */
--control-segment-height: 2.25rem;   /* 36px default segmented item */
```

Token rules:

- Keep primitive values in `theme.css`; screen files should consume semantic/component aliases.
- Do not add a 38px token.
- Use `min-height`/padding carefully for chips so count labels still fit and wrap behavior does not regress.
- Keep the 44px icon hit-area requirement separate from the 36px visual icon-control size where the surrounding layout allows it.

## Implementation sequence

### Phase 1 — Extend the shared primitive APIs

**Priority:** P0  
**Files:**

- `apps/web/src/styles/theme.css`
- `apps/web/src/app/components/ui/button.tsx`
- `apps/web/src/app/components/ui/input.tsx`
- `apps/web/src/app/components/ui/select.tsx`
- `apps/web/src/app/components/ui/filter-bar.tsx`
- `apps/web/src/app/components/ViewToggle.tsx`

Tasks:

1. Add the control tokens above.
2. Keep `Button`’s current semantic sizes, but express its 32px/36px/40px values through the token scale where Tailwind/CVA integration permits. Use the 40px variant for toolbar actions instead of screen-local `minHeight: 40` styles.
3. Add an explicit `size` prop to `Input` if needed, with `default` at 36px and `toolbar` at 40px. Preserve the existing default for ordinary forms.
4. Extend `SelectTrigger` with a `toolbar` size at 40px while retaining `sm` at 32px and `default` at 36px.
5. Keep `FilterBar` as the canonical compact filter component. Tokenize/document its compact baseline only if the resulting CSS preserves its current wrapping and count-label behavior.
6. Keep `ViewToggle` at 36px visual buttons. Verify that the outer padding or responsive wrapper provides an adequate hit area; do not make the glyph buttons visually oversized to solve hit-area requirements.
7. Add selected-state semantics while touching shared choice controls where appropriate:
   - `aria-pressed` for view/metric choices;
   - `aria-selected` for actual tabs.

### Phase 2 — Establish a shared segmented-control contract

**Priority:** P1  
**Candidate location:** `apps/web/src/app/components/ui/segmented-control.tsx`

Create a small presentational contract for repeated segmented visual groups, or extract only the shared style helpers if a new component would add unnecessary abstraction.

Required contract:

- `size: "default" | "toolbar"` maps to the named segment heights.
- Shared radius, horizontal padding, gap, selected surface, text colors, focus ring, and transition behavior.
- Choice segments expose `aria-pressed` and remain buttons.
- Navigation tabs expose `role="tab"`, `aria-selected`, and `aria-controls` where applicable.
- No data or navigation logic belongs in the primitive.

Callers should still provide their own labels/icons. The primitive standardizes geometry and state presentation, not domain semantics.

### Phase 3 — Migrate the highlighted screen families

**Priority:** P1  
**Behavior:** preserve existing state, labels, filtering, sorting, and layout structure.

#### Trends — `apps/web/src/app/components/screens/TrendsScreen.tsx`

- Use the 40px toolbar size for the chamber selector, compare-chambers trigger, species selector, and hatch-history search.
- Keep the environmental view switch and metric switch in the shared segmented-control visual contract.
- Keep the time-horizon `FilterBar` in its compact role; do not promote it to the 40px toolbar tier. Its three options may use the shared segmented fit-to-screen treatment defined by the list-filter unification plan.
- Give the view and metric buttons explicit selected semantics.
- Align “See all readings” to the toolbar action contract without changing its compact label treatment.
- Preserve the two-row toolbar and divider because that grouping is intentional; this plan standardizes control geometry, not page information architecture.

#### Candling Logs — `apps/web/src/app/components/screens/CandlingLogsScreen.tsx`

- Use the 40px toolbar input size for search.
- Replace the two 38px selects with the 40px toolbar select size.
- Replace the 38px sort-direction button with the shared icon-control visual/hit-area contract.
- Keep `ViewToggle` and the canonical compact `FilterBar` unchanged in behavior and visual role.

#### Incubators — `apps/web/src/app/components/screens/IncubatorsScreen.tsx`

- Use the 40px toolbar input size for search.
- Use the 40px toolbar action size for “Add Incubator” rather than inline `minHeight`.
- Replace the two 38px selects with the 40px toolbar select size.
- Replace the 38px sort-direction button with the shared icon-control contract.
- Keep the canonical compact `FilterBar` and shared `ViewToggle`.

#### Alerts — `apps/web/src/app/components/screens/AlertsScreen.tsx`

- Replace `h-10`/inline `minHeight: 40` with the shared toolbar size API.
- Keep the filter chips compact and shared.
- Preserve the wrapping behavior of the sort/read/clear action group.

#### Detail — `apps/web/src/app/components/screens/DetailScreen.tsx`

- Migrate `SubTabNav` to the segmented-control visual contract while preserving tab roles and selected state.
- Use the 40px toolbar/action tier for the primary actions currently using `minHeight: 40`.
- Do not alter the detail screen’s content structure or state transitions.

### Phase 4 — Reconcile documentation and stale status labels

**Priority:** P2

1. Create `docs/guide/ui-control-size-guidelines.md` with:
   - the role-based size table;
   - the token names and values;
   - when to use compact/default/toolbar/chip/icon/segment sizes;
   - the distinction between visual icon size and hit area;
   - selected-state and focus requirements;
   - intentional exceptions.
2. Add the new audit and guide references to `docs/audit/README.md` if the report index remains the project convention.
3. Review `docs/refine/filter-bar-refinement-plan.md`, whose status currently says planned even though the shared FilterBar and its audit resolution indicate that work is implemented. Update that status only as a separate documentation cleanup, not as part of the control-height migration.
4. Do not treat missing `docs/docs/*` references in `SYSTEM_ARCHITECTURE_GUIDE.md` as current UI-size guidance; those files are absent in the current workspace.

## Acceptance criteria

### Geometry

- [x] A named 32/36/40 role-based control scale exists in the token/component layer.
- [x] No unexplained `height: 38px` remains on standard toolbar selects or icon controls.
- [x] Search fields, toolbar selects, and toolbar actions in Trends, Candling Logs, Incubators, Alerts, and Detail align to the 40px toolbar tier.
- [x] Base 32px and 36px variants remain available for compact/default contexts.
- [x] Filter bars remain compact and visually consistent across Alerts, Incubators, and Trends.
- [x] Segmented controls and tabs share a visual size contract without merging their interaction semantics.

### Accessibility and behavior

- [x] View/metric choice buttons expose `aria-pressed`.
- [x] Detail sub-tabs expose correct tab semantics and selected state.
- [x] Icon-only controls retain visible focus and an adequate hit area, especially on responsive layouts.
- [x] No filter, sort, search, navigation, or data behavior changes.
- [x] Existing status/emblem circular badges and action-control outline exceptions remain unchanged.

### Documentation

- [x] `docs/guide/ui-control-size-guidelines.md` exists and matches the implemented tokens.
- [x] The audit index points to the new control-size audit.
- [x] Stale filter-bar plan status is corrected separately.

## Validation plan

Run from `apps/web` after implementation:

1. `npm run typecheck`
2. `npm test`
3. `npm run build`
4. Source scan for screen-local `height: 38`, `minHeight: 40`, and duplicate toolbar-size objects; remaining occurrences must be documented exceptions.
5. Fixed-viewport visual comparison of all supplied screen families:
   - Trends environmental and hatch-history states;
   - Candling Logs;
   - Incubators;
   - Alerts;
   - Detail tabs/actions.
6. Responsive checks at 320px/375px and desktop widths, including wrapping and no horizontal overflow.
7. 100% and 200% zoom checks for text/control alignment.
8. Keyboard pass for focus visibility, segmented selected state, tab selected state, and icon-only controls.

## Validation record — 2026-09-01

- `npm run typecheck` from `apps/web`: passed with no TypeScript diagnostics.
- `npm test` from `apps/web`: passed, 9 test files and 79 tests.
- `npm run build` from `apps/web`: passed; Vite transformed 6,926 modules and produced the production bundle.
- Targeted source scan: no `height: 38`, `h-[38px]`, `minHeight: 40`, or `h-10` toolbar geometry remains in the five reviewed screen files. The remaining Detail `h-10` is the intentional lockdown status tile; 38px calendar cells are documented exceptions.
- Manual fixed-viewport comparison, responsive 320/375px checks, zoom checks, and keyboard walkthrough were not run in this editor session and remain follow-up QA.

## Rollout and rollback

Implement as small slices:

1. Tokens and shared primitive APIs.
2. Trends/Candling/Incubators toolbar migration.
3. Alerts/Detail migration.
4. Guide and audit-index reconciliation.
5. Validation and visual comparison.

If the shared API introduces layout regressions, roll back the caller migrations while retaining the token definitions and migrate one control family at a time. Do not revert unrelated existing UI work.

## Definition of done

The refinement is complete when the project has a documented 32/36/40 role-based control scale, all highlighted toolbar controls use the appropriate shared tier, the compact FilterBar remains intact, segmented/tab semantics are preserved, the guide is added, and the full validation checklist passes.
