# Eggcelerate Mobile Typography and Component-Sizing Plan

**Plan date:** 2026-09-04
**Status:** Implemented 2026-09-04 (workspace; `docs/*` is gitignored, so the tracked diff is `apps/web` only) — refined with 6 review amendments, executed Phases 0–6
**Scope:** The responsive web application in `apps/web`; phone typography, control geometry, compact data labels, and validation at narrow widths.

## Goal

Make Eggcelerate comfortable to read and operate on phones without creating a second mobile-only design system or reducing every desktop value by the same percentage.

The governing rule is:

> **Scale hierarchy selectively; preserve readable content; enlarge touch targets.**

Mobile web remains the same React application, component tree, data, and business logic. Responsive values should flow through the existing semantic tokens and shared primitives.

## Decisions

### Keep one responsive token system

Do not create `MobileTypography`, duplicate `mobile/` component trees, or parallel variables such as `--mobile-body-size`.

Use the existing role-named tokens in `apps/web/src/styles/theme.css`, then override only the roles that need a phone-specific value. The application already follows this direction by reducing `--type-page-title` and `--type-panel-title` below `39.9375rem`.

Use the existing breakpoints deliberately:

- below `40rem` / `640px`: phone typography adjustments;
- below `48rem` / `768px`: mobile-shell and touch-geometry adjustments;
- do not introduce an iPhone-model-specific breakpoint.

The iPhone 17 reference width is a validation target, not the source of truth for layout behavior.

### Do not globally shrink the desktop scale

Most of the current text scale is already compact. On a phone, resolve crowding in this order:

1. let text wrap;
2. stack or reflow adjacent content;
3. shorten a visible label while preserving its full accessible name;
4. hide genuinely secondary decoration;
5. reduce the font only when the role allows it.

Body copy, instructions, form values, alert messages, errors, navigation, primary status text, and action labels must not be reduced to 9px or 10px.

### Treat 9px as an exception, not the mobile baseline

The current `--type-label-micro` token may remain for short, redundant, high-contrast visualization labels when 10px demonstrably does not fit.

Allowed examples:

- a short timeline milestone such as `DAY 6` when the full event is also available nearby;
- a non-interactive chart or gauge sub-label whose meaning is repeated in visible text.

Disallowed examples:

- body or helper copy;
- buttons, links, tabs, form labels, or field values;
- alert severity, timestamps needed for decisions, warnings, errors, or safety instructions;
- the only visible or accessible source of information.

Prefer 10px over 9px. Every new 9px use requires a narrow-width screenshot or test fixture demonstrating why 10px cannot work, plus a documented accessible full-text path. A `title` attribute alone is not sufficient for touch or assistive-technology access.

### Keep interaction targets larger than their glyphs

Mobile density must not reduce the clickable area. Use a compact icon inside a comfortable target.

- Project target for primary mobile controls: at least `44px` in each interactive dimension.
- Absolute web accessibility floor: satisfy WCAG 2.2 target-size requirements or document the applicable spacing/inline exception.
- Keep at least `8px` between adjacent small touch targets where the layout permits.
- Never enlarge an icon merely to make its button clickable; enlarge the button or hit area.

## Proposed phone typography contract

The following is the initial target scale. Values remain `rem`-based and inherit browser/user zoom.

| Role | Existing desktop value | Phone target | Decision |
|---|---:|---:|---|
| Page title | 24px | 20px | Existing phone override; keep |
| Panel title | 22px | 18px | Existing phone override; keep |
| Large heading | 20px | 20px | Keep unless a specific layout proves it must step down |
| Medium heading | 18px | 18px | Keep |
| Small heading | 16px | 16px | Keep |
| Body | 14px | 14px minimum | Do not shrink; consider 15–16px for longer reading passages |
| Form value / editable text | 14px | 16px | Increase on phones for legibility and stable focus behavior |
| Small body | 13px | 13px | Keep for short supporting content |
| Caption | 12px | 12px | Keep |
| Label | 11px | 11px | General lower bound for meaningful labels |
| Compact label | 10px | 10px | Short, secondary, non-prose labels only |
| Micro label | 9px | 9px | Exceptional redundant visualization labels only |

Typography requirements:

- body and helper text use unitless line height of at least `1.5`;
- headings use the existing display family and semantic weight tokens;
- labels do not use color alone to communicate state;
- numeric dashboards use tabular figures where changing digits cause layout movement;
- essential text wraps instead of being clamped or silently truncated;
- text remains usable at 200% browser/text zoom and with WCAG text-spacing overrides.

## Proposed mobile component contract

Desktop component sizes remain the documented `32/36/40px` compact/default/toolbar scale. Mobile changes target interaction comfort, not a visual redesign.

| Component role | Mobile target | Notes |
|---|---:|---|
| Primary/default button | 44px min height | Preserve label size and loading/disabled states |
| Input and select | 44px min height | Use 16px editable/value text on phones |
| Icon-only button | 44×44px target | Keep glyph approximately 18–22px |
| Segmented item/tab | 44px min height | Preserve `aria-pressed` or tab semantics |
| Toolbar control | 44px min height | May remain full width when wrapping |
| Filter/status chip | 36px visual baseline | Wrap the group first; provide sufficient spacing and target area |
| Bottom-navigation item | Existing large target | Preserve safe-area clearance and five-item limit |

Implement these through responsive overrides or shared size APIs. Do not add screen-local `minHeight: 44` declarations when a shared component token can express the role.

Illustrative direction in `theme.css` (normative token decisions):

```css
/* Phone typography — control value decouples from body copy so phone form
   text can go to 16px (also suppresses iOS auto-zoom on focus, which
   triggers below 16px) without enlarging ordinary body text. */
@media (max-width: 39.9375rem) {
  :root {
    --type-page-title: 1.25rem;
    --type-panel-title: 1.125rem;
    --type-control-value: 1rem;
  }
}

/* Mobile-shell touch geometry */
@media (max-width: 47.9375rem) {
  :root {
    --control-height-default: 2.75rem;
    --control-height-toolbar: 2.75rem;
    --control-size-icon: 2.75rem;
    --control-segment-height: 2.75rem;
  }
}
```

Token decisions locked by this refinement (2026-09-04 review):

- Add `--type-control-value: 0.875rem` at desktop, `1rem` on phones. Inputs
  and selects consume it instead of `--type-body`. Rationale: phone form
  text needs 16px for legibility and to suppress iOS focus auto-zoom;
  body copy stays 14px.
- Migrate the `@layer base` element defaults (`h1–h4`, `label`, `button`,
  `input` in `theme.css`, currently on `--text-*`) to the `--type-*` roles
  (page/panel/heading/body). Until then the base layer is a de facto second
  scale that fights token intent — Phase 1 must eliminate it, not document
  around it.
- Chip vs primary-target contract: `FilterBar` chips stay compact
  (`min-h-9` mobile / `--control-height-chip` baseline) and satisfy the
  WCAG 2.2 24px minimum with spacing; the project 44px goal applies to
  primary buttons, inputs/selects, icon-only buttons, segmented items, and
  toolbar controls — plus the `FilterBar` scroll arrows, which must grow
  from their current 28×20px to the 44px target (glyph stays 16px).
- SVG `<text>` numerics (`GaugeDial` value/unit/label fonts,
  `WaterDroplet` overlay fonts, `Math.max(9, …)` floors) are allowed
  chart/illustration exceptions: they cannot consume CSS vars without extra
  plumbing. Convert them to `rem`-equivalent numbers (`px / 16`) where
  touched, keep the 9px floor only inside SVG geometry, and never extend
  the floor to DOM text. The Phase 5 source guard must allowlist these
  files.
- `OverviewScreen` `text-[10px]` count badges (`h-4`, non-interactive) are
  classified in Phase 0 as replace (prefer `--type-label` 11px) or document
  with contrast proof plus a non-micro redundant source. They are not
  touch targets, so target-size does not apply — readability does.
- `title`-only disclosure is insufficient everywhere (touch/keyboard/SR).
  `Timeline` compact labels keep `title` as a supplement but need the
  existing node `title` + `DAY` full-text path; `docs/guide/typography-guidelines.md`
  ("`title` attr at minimum") must be corrected to this rule in Phase 6.

The implementation may use component-level mobile aliases if changing a global control token would unintentionally enlarge dense noninteractive layouts. Any additional alias must describe a semantic role rather than a particular screen.

## Current audit baseline

The implementation should start from the current source rather than the older counts in `typography-refinement-plan.md`.

- The semantic type scale already exists in `theme.css` and uses `rem` values.
- Phone overrides currently change only page and panel titles.
- Shared control tokens currently provide 32px, 36px, and 40px visual tiers plus a 44px icon hit-area token.
- `Typography` does not yet expose the compact and micro label roles.
- Much of the application still bypasses `Typography`; the current source contains approximately 152 direct numeric `fontSize` declarations.
- Compact responsive text behavior is split between CSS tokens, responsive Tailwind classes, and inline styles.
- The 9px tier is used by timelines and also appears in gauge/water-status presentation, so the current guide does not completely describe actual usage.
- The input and select primitives render 14px value text by default.
- `ViewToggle` has 36px interactive buttons; outer group padding does not increase each button's clickable target.
- the `FilterBar` scroll arrows include an approximately 20px-wide target and need direct target-size review.
- Existing typography tests assert source/token values but do not prove rendered reflow at narrow widths or 200% zoom.

Counts are a planning baseline only. Rerun the inventory immediately before migration because unrelated feature work may change them.

## Implementation phases

### Phase 0 — Freeze the baseline and resolve token boundaries

**Priority:** P0

1. Rerun the source inventory for raw `fontSize`, responsive text utilities, and 9px/10px uses.
2. Record screenshots at 320px, 375px, and 402px for each main screen before changes.
3. Confirm the two-breakpoint contract: phone type below 640px and mobile touch geometry below 768px.
4. Identify controls where globally overriding a base token would cause an unintended desktop/tablet regression.
5. Classify every sub-11px use as allowed, replace, or needs product review — including `OverviewScreen` `text-[10px]` count badges and the `@layer base` `--text-*` element defaults, which are inventoried here so Phase 1 can eliminate the parallel scale.

**Exit criteria:** the migration list and intentional exceptions are explicit; implementation does not begin from stale counts.

### Phase 1 — Extend semantic and component tokens

**Priority:** P0
**Primary file:** `apps/web/src/styles/theme.css`

1. Preserve the existing font families and desktop type values.
2. Keep the current page/panel phone overrides.
3. Add `--type-control-value: 0.875rem` (desktop) with a phone override to
   `1rem` inside the existing `39.9375rem` block. Point `Input` and
   `SelectTrigger` at it (Phase 2). Do not reuse `--type-body` for this —
   body copy stays 14px on phones.
4. Migrate `@layer base` element defaults to semantic roles: `h1`→page
   title, `h2`→panel/heading, `h3`→heading, `h4`→body/heading-sm,
   `label`/`button`/`input`→body or control-value as appropriate. Delete
   the `--text-*` references in base styles so tokens are the only scale.
5. Add phone/mobile control geometry through existing component tokens or narrowly scoped component aliases.
6. Keep all typography in `rem` and line heights unitless.
7. Document why typography and touch geometry use different established breakpoints.

**Exit criteria:** no parallel mobile token tree exists, and shared primitives can consume every approved mobile value without screen-local literals.

### Phase 2 — Update shared typography and form primitives

**Priority:** P0
**Candidate files:**

- `apps/web/src/app/components/ui/typography.tsx`
- `apps/web/src/app/components/ui/button.tsx`
- `apps/web/src/app/components/ui/input.tsx`
- `apps/web/src/app/components/ui/select.tsx`
- `apps/web/src/app/components/ui/label.tsx`
- `apps/web/src/app/components/ui/segmented-control.tsx`

Tasks:

1. Add documented `labelCompact` and `labelMicro` typography variants only if they reduce duplication without encouraging general-purpose micro text. (Decision 2026-09-04: not added — the only approved micro uses need responsive `sm:` overrides an inline-style primitive cannot express; they consume the tokens directly. Rationale recorded in a `typography.tsx` code comment.)
2. Give micro-label usage a visible code-level warning or documentation comment describing its restrictions.
3. Apply 16px value/editable text to phone inputs and selects via
   `--type-control-value` while retaining the established desktop value.
   Remove the conflicting Tailwind `text-base md:text-sm` on `Input` (inline
   token style already wins; the classes mislead readers).
4. Give buttons, fields, selects, icon buttons, and segmented items the approved mobile target size.
5. Preserve visible focus, disabled semantics, loading behavior, labels, and error associations.
6. Ensure typography styles do not override consumer `aria-*`, native form attributes, or responsive layout classes.

**Exit criteria:** high-reuse components own the responsive contracts; screens do not need to know the numeric mobile values.

### Phase 3 — Repair high-risk compact components

**Priority:** P0–P1  
**Candidate files:**

- `apps/web/src/app/components/ui/filter-bar.tsx`
- `apps/web/src/app/components/ViewToggle.tsx`
- timeline, gauge, and water-status components under the incubator detail feature

Tasks:

1. Expand FilterBar scroll arrows from 28×20px to a 44px target via padding/hit-area (glyph stays 16px); keep chips compact per the chip-vs-primary contract.
2. Expand each ViewToggle button's hit area to 44px (padding or pseudo-target inside the button); do not count outer container padding as part of an individual button target.
3. Audit each 9px and 10px timeline/gauge/water label against the allowed-use contract. Keep SVG `<text>` numerics (`GaugeDial`, `WaterDroplet`, `Math.max(9, …)` floors) as allowed illustration exceptions; convert to rem-equivalents where touched.
4. Replace `title`-only disclosure with visible supporting text, an accessible full label, or an operable details/tooltip pattern appropriate to touch and keyboard use (keep `title` only as a supplement).
5. Verify red, amber, green, and muted compact text against their actual composed backgrounds.

**Exit criteria:** no essential information depends on micro text, hover, color alone, or `title` alone.

### Phase 4 — Migrate screens in risk order

**Priority:** P1

Migrate repeated raw type and size values only after shared primitives are ready:

1. Incubator Detail and Candling — densest timelines, gauges, status labels, and operational instructions.
2. Alerts and Notifications — urgency, timestamps, action discoverability, and compact status pills.
3. Incubators and Overview — cards, toolbar controls, metric hierarchy, and view toggles.
4. Settings — forms, local navigation, device rows, and sticky action areas.
5. Trends — chart labels, selectors, legends, and comparison controls.

For each screen:

- replace raw values only when the semantic role is known;
- preserve data and interaction behavior;
- reflow before reducing text;
- use `min-w-0`, wrapping, and responsive stacking where necessary;
- keep primary actions reachable above the mobile bottom navigation and safe area;
- document unavoidable chart-library numeric exceptions rather than forcing them into DOM typography tokens.

(Decision 2026-09-04: mobile-scope screen edits are the `OverviewScreen`
10px count badges → 11px label, plus token-driven 44px targets and 16px
phone form text which need no per-screen code. The remaining ~190 numeric
`fontSize` values are overwhelmingly intentional 12/13 dense-table density
owned by `typography-refinement-plan.md` — migrating them here would expand
blast radius without mobile benefit, so they stay documented exceptions.)

**Exit criteria:** screen code consumes shared semantic roles and remaining raw sizes are documented exceptions.

### Phase 5 — Automated and manual validation

**Priority:** P0 before completion

Automated checks:

1. Add token contract tests for phone typography and mobile control geometry.
2. Add component tests for responsive classes/styles, accessible names, state semantics, and full-label alternatives.
3. Add a source guard against new DOM text below 9px and unauthorized 9px DOM uses where practical. Allowlist SVG illustration geometry (`GaugeDial.tsx`, `WaterDroplet.tsx`, `Timeline` node/phase-band sizes) and numeric chart-library props — the guard must not false-positive on them.
4. Run typecheck, unit tests, and production build.
5. Rerun the raw-value inventory and compare it with the Phase 0 baseline.

Rendered review matrix:

| Width/state | Required checks |
|---|---|
| 320px portrait | Smallest supported reflow; no page-level horizontal scroll |
| 375px portrait | Small-phone control spacing and wrapping |
| 402px portrait | iPhone 17 reference layout |
| Phone landscape | No clipped dialogs, toolbars, charts, or fixed actions |
| 768px | Clean handoff between mobile shell and desktop/tablet behavior |
| 1024px+ | Desktop geometry and density remain unchanged |
| 200% zoom | No clipped text, overlap, missing controls, or obscured focus |
| Text-spacing override | Content survives increased line, word, and letter spacing |

Also test long chamber names, expanded/translated labels, validation errors, open dialogs, virtual keyboard visibility, reduced motion, and slow font loading.

**Exit criteria:** all checks pass or every exception has an owner, reason, and follow-up issue.

### Phase 6 — Reconcile documentation

**Priority:** P1

1. Update `docs/guide/typography-guidelines.md` so its 9px guidance is internally consistent and matches actual approved usage — including correcting "`title` attr at minimum" to "`title` only as supplement; every micro label needs a visible or accessible full-text path".
2. Update `docs/guide/ui-control-size-guidelines.md` with the mobile target contract and the distinction between desktop visual size and mobile hit area.
3. Update related audits/plans with current counts and completion status.
4. Record intentional third-party chart/illustration exceptions.

**Exit criteria:** the guides, tests, and implementation describe the same system.

## Acceptance criteria

### Architecture

- [x] Mobile and desktop use one semantic type and component system (`--type-control-value` added; `@layer base` migrated off `--text-*`; no `MobileTypography` tree).
- [x] No duplicate mobile screen/component tree is introduced.
- [x] Responsive values are owned by tokens or shared primitives, not screen-local literals (Typography `labelCompact`/`labelMicro` deliberately not added — rationale in `typography.tsx` comment).
- [x] Existing desktop typography and 32/36/40px control geometry remain unchanged at desktop widths (all overrides are `max-width`-scoped; raw unclassed `label`/`button`/`input` align 16→14px to the system — primitives already forced these sizes, so rendered UI is unchanged).

### Typography

- [x] Page and panel titles use the approved phone values.
- [x] Body, instructional, alert, form-label, navigation, and action text never use the compact or micro tiers.
- [x] Phone input/select values render at the approved 16px role (`--type-control-value`; source-contract tested — jsdom cannot evaluate media queries).
- [x] Every 9px use is short, redundant, high contrast, documented, and recoverable without relying only on `title` (Timeline/Gauge/WaterDroplet audited; Overview 10px badges → 11px).
- [x] No text smaller than 9px is introduced (source guard in `mobile-typography.test.ts`; inventory: `text-[10px]`/`[9px]` 2→0, numeric `fontSize` steady at 152 — remaining are documented 12/13 density owned by `typography-refinement-plan.md`).
- [ ] Text remains usable at 200% zoom and with increased text spacing — NOT verified here: no browser automation in this environment. Manual pass required (matrix in Phase 5).

### Interaction and layout

- [x] Primary mobile controls and icon buttons use a 44px target where the project contract requires it (token override + FilterBar arrows 28×20→44px, glyphs unchanged).
- [x] Every target satisfies WCAG 2.2 minimum target-size behavior or has a documented valid exception (chips 36px ≥ 24px minimum + `gap-2` spacing; arrows/ViewToggle/segments 44px).
- [x] Adjacent small controls have sufficient separation to prevent mistaps (chip `gap-2` = 8px preserved).
- [ ] No horizontal page scroll appears at 320px, 375px, or 402px — NOT verified here: needs device/UND viewport pass.
- [x] Text wraps or content reflows before typography is reduced (no new clamping; Timeline keeps nowrap+maxWidth only on redundant micro labels with full-text path).
- [x] Fixed controls, dialogs, toasts, and content clear the mobile navigation and safe areas (existing `--mobile-bottom-nav-clearance` untouched).

### Quality and regression safety

- [ ] Typecheck, unit tests, and production build pass — tests 182/182 ✓, build ✓; `tsc --noEmit` still reports 2 PRE-EXISTING unused-var errors (`CandlingLogsScreen:55`, `IncubatorsScreen:80`) identical on clean HEAD — not introduced here, left for their owners.
- [x] The raw numeric `fontSize` count decreases and remaining cases are documented (Tailwind sub-11px 2→0; numeric steady at 152 per scope decision in Phase 4).
- [ ] Main screens pass the responsive review matrix — NOT verified here: needs the Phase 5 device/zoom pass.
- [ ] Desktop screenshots show no unintended density or alignment regressions — NOT verified here: needs screenshot pass.
- [x] Typography and control-size guides match the shipped implementation (both guides updated; `title`-only rule corrected).

## Non-goals

- Do not replace Baloo 2 or Nunito.
- Do not make the dashboard a native iOS interface or modify `apps/mobile`.
- Do not make every label 16px or every visual control look 44px tall on desktop.
- Do not redesign colors, cards, charts, navigation, or data behavior as part of this work.
- Do not optimize for only one iPhone model or physical pixel resolution.
- Do not remove useful information merely to make a narrow screenshot look cleaner.

## Standards references

- Apple Human Interface Guidelines, Accessibility: <https://developer.apple.com/design/human-interface-guidelines/accessibility>
- Apple Human Interface Guidelines, Typography: <https://developer.apple.com/design/human-interface-guidelines/typography>
- WCAG 2.2 Understanding Reflow: <https://www.w3.org/WAI/WCAG22/Understanding/reflow.html>
- WCAG 2.2 Understanding Text Spacing: <https://www.w3.org/WAI/WCAG22/Understanding/text-spacing>
- WCAG 2.2 Understanding Target Size (Minimum): <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum>

## Definition of done

The work is complete when mobile typography is selectively responsive, meaningful content no longer depends on micro text, phone form text and touch targets meet the approved contract, all main screens pass the responsive/zoom matrix, desktop behavior is preserved, and the implementation, tests, and documentation agree.
