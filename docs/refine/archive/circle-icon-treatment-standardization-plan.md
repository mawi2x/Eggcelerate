# Refinement Plan: Standardize Filled Status Glyphs in Circular Badges

**Source audit:** `docs/audit/circle-icon-treatment-audit.md`  
**Plan date:** 2026-09-01  
**Status:** Implemented  
**Scope:** `apps/web/src` semantic status/emblem icons rendered inside colored circular badges.  
**Implementation note:** The plan has been implemented without changing the documented scope.

## Objective

Make the icon treatment predictable across status and emblem components:

> **Filled status, outlined action:** semantic status/emblem icons inside colored circular badges use a filled Phosphor glyph or an equivalent filled custom SVG path; outline icons remain available for circular action controls and navigation.

The implementation should improve visual weight at compact sizes without mechanically changing every `rounded-full` element or every Lucide icon in the application.

## Current baseline

The focused audit found:

- **Pass:** Candling Logs checkpoint badge.
- **Pass:** Incubator card lifecycle status badge.
- **Pass:** Shared `StatusCallout` icon treatment.
- **Pass:** Candling Logs status tags.
- **Pass:** Onboarding recommendation emblem.
- **Follow-up:** `AlertBanner` uses an unweighted Lucide `AlertOctagon` inside a circular container.
- **Boundary case:** `StatusBadge` uses outline icons in a rounded text pill, not in a separate circular icon badge.

The existing status colors are already represented by semantic tokens in `apps/web/src/styles/theme.css`, including `--status-success-*`, `--status-warning-*`, `--status-danger-*`, and `--status-info-*`. No new icon package is required; the project already uses `@phosphor-icons/react` and custom SVG glyphs.

## Non-goals and guardrails

- Do not convert circular navigation, view-toggle, close, previous/next, zoom, expand, or other action-control icons to filled glyphs solely because their wrapper uses `rounded-full`.
- Do not replace all Lucide icons globally. Some Lucide icons are intentionally used outside semantic circular badges.
- Do not alter status colors, copy, state logic, component dimensions, or interaction behavior unless required by the shared component contract.
- Do not introduce a second icon library. Prefer the existing Phosphor set or the existing custom filled-path icons.
- Do not make status color the only state signal. Preserve the accompanying icon and text/label.
- Do not add a new dependency.

## Recommended implementation sequence

### Phase 1 — Confirm and publish the component contract

**Priority:** P0  
**Owner:** UI/design-system maintainer  
**Output:** documented rule and agreed component API

1. Adopt the role-based rule from the audit:
   - `status`, `warning`, `success`, `danger`, `info`, completion, and domain emblems inside colored circles use filled/custom filled glyphs.
   - interactive action controls may use outline glyphs.
   - dots, counters, progress tracks, and numeric nodes are not icon badges.
2. Treat the audit’s `StatusBadge` as a deliberate boundary case for the first pass. It is a text pill, not a circular icon badge. Revisit it only if the product team expands the rule to all status pills.
3. Create an approved glyph inventory for semantic circular badges:
   - Phosphor icons must be wrapped or configured with `weight="fill"`.
   - Custom SVGs must render a filled path and expose the same `size`/`color` contract as the existing icon wrappers.
   - Raw unweighted Lucide status glyphs should not be passed to the semantic circular-badge primitive.
4. Keep accessibility behavior explicit:
   - If the adjacent label/callout text already names the state, the icon is decorative and should use `aria-hidden="true"`.
   - If the icon is the only status signal, give the containing component an accessible name; do not rely on the glyph alone.

### Phase 2 — Add a reusable circular status-badge primitive

**Priority:** P1  
**Candidate file:** `apps/web/src/app/components/StatusIconBadge.tsx`  
**Supporting tokens:** `apps/web/src/styles/theme.css`

Introduce a small presentational primitive for the repeated circular wrapper. It should own geometry, foreground contrast, and decorative semantics while callers provide the domain-specific approved glyph.

#### Proposed API

```ts
type StatusIconBadgeProps = {
  tone?: "success" | "warning" | "danger" | "info" | "brand";
  backgroundColor?: string;
  icon: React.ReactNode;
  size?: "sm" | "md" | "lg" | "banner";
  decorative?: boolean;
  className?: string;
};
```

#### Proposed defaults

| Size | Circle | Glyph | Current examples |
|---|---:|---:|---|
| `sm` | 28px | 15px | Candling Logs and IncubatorCard status footer |
| `md` | 32px | 18px | Default `StatusCallout` |
| `lg` | 48px | 36px | Large `StatusCallout` |
| `banner` | 40px | 22px | `AlertBanner`, preserving its existing geometry |

The primitive should:

- Use `rounded-full`, centered alignment, and `flex-shrink: 0`.
- Map `tone` to existing semantic foreground tokens rather than hardcoded component colors; allow an explicit `backgroundColor` override where an existing domain-specific status palette must be preserved.
- Use `var(--status-icon-badge-fg)` as the default glyph color where the tone foreground is the circle background.
- Apply `aria-hidden="true"` by default for decorative status glyphs, with an explicit opt-in for meaningful standalone icons.
- Avoid owning click handlers or button semantics; circular actions remain separate components.

If a shared primitive would create unnecessary churn for the small current surface area, the fallback is to retain local wrappers but adopt the same size/tone/a11y contract and add the rule to the component documentation. The alert-banner fix is required either way.

#### Token proposal

Add component-level aliases only if the current hardcoded sizes need to be centralized:

```css
--status-icon-badge-size-sm: 1.75rem;
--status-icon-badge-size-md: 2rem;
--status-icon-badge-size-lg: 3rem;
--status-icon-badge-size-banner: 2.5rem;
--status-icon-badge-glyph-sm: 0.9375rem;
--status-icon-badge-glyph-md: 1.125rem;
--status-icon-badge-glyph-lg: 2.25rem;
--status-icon-badge-glyph-banner: 1.375rem;
--status-icon-badge-fg: var(--on-brand);
```

Keep the existing primitive → semantic → component token layering. Do not create new primitive colors when the existing semantic status foreground/background tokens already express the intent.

### Phase 3 — Migrate semantic circular-badge callers

**Priority:** P1  
**Output:** one implementation pattern for all in-scope circular status/emblem badges

Migrate only the following semantic callers, preserving their existing domain glyphs and state mapping:

1. **`apps/web/src/app/components/AlertBanner.tsx`**
   - Replace the unweighted Lucide `AlertOctagon` with the existing custom `ExclamationIcon`, or a Phosphor warning glyph configured with `weight="fill"`.
   - Keep the current 40px translucent circle and white-on-brand treatment.
   - Mark the icon decorative because the button already contains a visible headline/detail message.
   - Do not change the banner’s button behavior or navigation affordance.

2. **`apps/web/src/app/components/screens/CandlingLogsScreen.tsx`**
   - Preserve the existing filled `CheckCircle` and `Notepad` choices.
   - If the shared primitive is adopted, replace only the repeated circle wrapper; do not change the checkpoint state logic.

3. **`apps/web/src/app/components/IncubatorCard.tsx`**
   - Preserve the existing Phosphor `weight="fill"` adapters and custom `ExclamationIcon`.
   - Keep the intentional ready-state dot as a dot, not an invented glyph.
   - If the shared primitive is adopted, migrate the footer wrapper without changing the operational status mapping.

4. **`apps/web/src/app/components/detail/primitives.tsx`**
   - Preserve the filled custom `CheckIcon`, `ExclamationIcon`, and `InfoIcon` defaults.
   - Reuse the shared wrapper only if it does not regress the existing `sm`, default, and `lg` sizes or its current decorative `aria-hidden` behavior.

5. **`apps/web/src/app/components/auth/OnboardingStep3.tsx`**
   - Keep the filled custom `IncubatingIcon` emblem.
   - Migration to the shared status primitive is optional because this is an illustration/domain-emblem context rather than a status callout. Do not flatten its existing visual treatment just for abstraction consistency.

### Phase 4 — Resolve adjacent boundary decisions

**Priority:** P2  
**Output:** documented scope decisions, not automatic icon replacement

Review these components only after the circular-badge migration is complete:

- `apps/web/src/app/components/StatusBadge.tsx`: currently an inline outline icon in a rounded text pill. Decide whether the product wants the narrow circular-badge rule or a broader “all status pills use filled glyphs” rule. If broadening, migrate the three status icons to approved filled/custom glyphs in a separate change.
- `apps/web/src/app/components/alerts/alertStyle.ts` and `NotificationPopover.tsx`: alert icons are rendered in rounded-square tiles, not circular badges. Leave them unchanged under the current rule; review separately if the policy expands from circular badges to all semantic icon tiles.
- `ViewToggle`, `PhotoLightbox`, calendar navigation, sidebar navigation, counters, dots, and timeline nodes: retain their current action/indicator treatment as intentional exceptions.

## Acceptance criteria

### Visual and semantic

- [ ] Every semantic status/emblem icon inside a colored circular badge uses a filled Phosphor glyph or filled custom SVG path.
- [ ] `AlertBanner` no longer renders an unweighted outline warning glyph in its circular container.
- [ ] Existing Candling Logs, IncubatorCard, and `StatusCallout` filled treatments remain visually unchanged apart from any shared-wrapper internals.
- [ ] Circular action controls and navigation icons remain outline-capable and are not changed by the migration.
- [ ] The `StatusBadge` pill and alert notification tiles have an explicit documented scope decision.

### Accessibility

- [ ] Decorative circular status glyphs are hidden from the accessibility tree when visible text already communicates the state.
- [ ] Meaningful standalone icons have an accessible name through their containing component.
- [ ] State remains understandable through text/icon semantics, not color alone.
- [ ] Existing keyboard focus and button semantics are unchanged.

### Engineering

- [ ] No new icon dependency is added.
- [ ] Existing semantic color tokens are reused; no new raw component hex values are introduced.
- [ ] Approved glyph adapters expose a consistent `size` and `color` interface.
- [ ] The shared primitive, if introduced, has no interaction logic and does not alter layout bounds unexpectedly.

## Validation plan

Run validation after implementation, beginning with the changed surface:

1. **Static review**
   - Search `apps/web/src/**/*.tsx` for `rounded-full` wrappers containing status/emblem icons.
   - Confirm each in-scope icon is explicitly filled or supplied by a filled custom-path wrapper.
   - Confirm action-control and indicator exceptions remain documented.
2. **Typecheck**
   - From `apps/web`, run `npm run typecheck`.
3. **Tests**
   - From `apps/web`, run `npm test`.
   - Add a focused component test only if the project’s existing test setup supports rendering these components without introducing a new testing dependency. At minimum, test the shared primitive’s size/tone/a11y contract if it is created.
4. **Build**
   - From `apps/web`, run `npm run build`.
5. **Visual QA**
   - Check alert, success, warning, info, and neutral states at `sm`, default, and large callout sizes where applicable.
   - Verify the alert banner at narrow and wide layouts, including long headline/detail text.
   - Verify light and dark theme behavior if those themes are enabled in the application shell.
   - Confirm no circular action icon changed weight or focus appearance.

## Rollout and rollback

Implement the work as a small, isolated UI refinement:

1. Add the documented contract/tokens and optional primitive.
2. Fix and migrate the in-scope semantic callers.
3. Run typecheck, tests, build, and visual QA.
4. If the new wrapper causes spacing or contrast regressions, revert the shared-wrapper adoption while retaining the narrowly scoped `AlertBanner` glyph correction. The existing filled local adapters provide a safe fallback.

## Definition of done

The refinement is complete when the design rule is documented, `AlertBanner` matches the filled status treatment, the in-scope circular badges share a reviewed contract, intentional outline exceptions remain intact, and the validation checklist passes without unrelated product changes.
