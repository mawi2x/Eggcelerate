# Refinement Plan: Standardize Clickable Affordances

**Source audit:** `docs/audit/clickable-affordance-audit.md`  
**Plan date:** 2026-09-01  
**Status:** Implemented  
**Scope:** Missing or inconsistent pointer, hover, pressed, focus, target-size, and keyboard affordances on clickable UI elements.  
**Validation constraint:** This plan does **not** require Playwright, browser automation, screenshots, or an agent-run browser check.

## Goal

Make every clickable element communicate that it is interactive without changing its product behavior, navigation logic, or visual design direction.

The standard should be applied by role:

- Native buttons and links use a visible pointer and state treatment.
- Shared controls provide the contract centrally.
- Icon actions expose a name, visible focus, and an adequate hit area.
- Custom clickable containers use native semantics or complete keyboard behavior.
- Disabled controls do not advertise an active click state.

## What this plan does not do

- It does not require Playwright or any browser automation.
- It does not require the agent to open the application in a browser.
- It does not require screenshot comparison or visual regression tooling.
- It does not change click handlers, filtering, sorting, navigation, or data behavior.
- It does not replace the existing control-size plan or status/icon treatment plan.
- It does not add pointer styling to decorative, read-only, draggable, or intentionally `cursor-default` elements.

## Current known coverage

Already covered and should be preserved:

- `apps/web/src/app/components/ui/button.tsx` — shared `Button` pointer, focus, and disabled behavior.
- `apps/web/src/app/components/ui/filter-bar.tsx` — pointer cursor, `aria-pressed`, and focus treatment.
- `apps/web/src/app/components/ui/segmented-control.tsx` — pointer, selected state, and focus treatment.
- `apps/web/src/app/components/ViewToggle.tsx` — pointer, `aria-pressed`, and focus treatment.
- `apps/web/src/app/components/IncubatorCard.tsx` — card pointer, hover, focus, and Enter/Space handling.
- `apps/web/src/app/components/screens/OverviewScreen.tsx` — button-like cards and rows with pointer, hover, focus, and keyboard behavior.
- `apps/web/src/app/components/screens/IncubatorsScreen.tsx` — interactive table rows with role, tab stop, keyboard handling, pointer, hover, and focus.

Intentional exceptions:

- `SelectItem` menu entries may retain `cursor-default`.
- The draggable HelpWidget trigger may retain `cursor-grab`/`cursor-grabbing`.
- Status badges, decorative elements, and read-only cards are not clickable affordances.

## Recommended interaction contract

For enabled clickable controls:

```text
pointer: cursor-pointer
hover/pressed: non-layout-shifting visual feedback
focus: visible focus ring or equivalent native indicator
semantics: native button/link whenever possible
state: aria-pressed, aria-selected, aria-expanded, or disabled where applicable
```

For disabled controls:

```text
pointer: cursor-not-allowed or equivalent disabled treatment
interaction: native disabled semantics; no click action
```

For small icon controls, keep the visible glyph size separate from the hit area. Do not enlarge the icon merely to make the target easier to activate.

## Implementation phases

### Phase 1 — Normalize shared primitives

**Priority:** P1

Update only the shared primitives that are confirmed to be interactive:

- `apps/web/src/app/components/ui/select.tsx`
- `apps/web/src/app/components/ui/checkbox.tsx`
- `apps/web/src/app/components/ui/switch.tsx`
- `apps/web/src/app/components/ui/radio-group.tsx`
- `apps/web/src/app/components/ui/dialog.tsx`

Add the enabled pointer affordance and consistent hover/focus treatment where the primitive currently lacks it. Preserve disabled overrides and existing selected/value behavior.

Do not change `SelectItem` menu semantics as part of this phase.

### Phase 2 — Fix semantic custom click targets

**Priority:** P1

Fix the Candling upload surface:

- `apps/web/src/app/components/detail/CandlingJournalTab.tsx:893-909`

Use a native button-like element, or add complete button semantics to the drop zone:

- `role="button"`;
- `tabIndex={0}`;
- Enter/Space activation;
- accessible name;
- existing pointer and drag/drop behavior preserved.

The hidden file input remains the file-selection implementation.

### Phase 3 — Fix high-impact navigation and hidden actions

**Priority:** P1

Normalize affordances for:

- `apps/web/src/app/components/AppSidebar.tsx`
  - mobile navigation;
  - More trigger/menu items;
  - edge collapse toggle;
  - collapsed icon rail;
  - collapse controls.
- `apps/web/src/app/components/AlertBanner.tsx`
- `apps/web/src/app/components/alerts/NotificationPopover.tsx`
  - trigger;
  - Mark all action;
  - hover-revealed dismiss action;
  - View All action.
- `apps/web/src/app/components/detail/IncubationCalendar.tsx`
  - previous/next month controls.
- `apps/web/src/app/components/detail/CandlingJournalTab.tsx`
  - remove-photo action.

Ensure hidden controls become visible on keyboard focus, have a focus indicator, and do not rely on hover alone.

Where the visual target is smaller than the project’s touch guidance, enlarge the interactive area without enlarging the visible icon.

### Phase 4 — Clean up localized raw-button gaps

**Priority:** P2

Apply the shared affordance contract to remaining raw buttons in:

- `PageHeader.tsx`
- `ToastStack.tsx`
- `UtilityHeader.tsx`
- `TrendsScreen.tsx`
- `IncubatorsScreen.tsx`
- `AlertsScreen.tsx`
- `LiveMonitorTab.tsx`
- `DeviceSettingsTab.tsx`
- `ModeLibraryPanel.tsx`
- `PhotoLightbox.tsx`
- `HelpWidget.tsx` close/FAQ actions
- auth/onboarding screens
- Candling journal timeline edit/delete/expand actions

Prefer migration to `Button` when it preserves the existing geometry. Otherwise use a small shared raw-action class/helper rather than repeating unrelated one-off styles.

Do not change the existing `cursor-grab` behavior of the draggable HelpWidget trigger.

### Phase 5 — Source and project validation

**Required validation; no browser required:**

1. Run diagnostics for changed files and confirm no new errors.
2. Run `npm run typecheck` from `apps/web`.
3. Run `npm test` from `apps/web`.
4. Run `npm run build` from `apps/web`.
5. Run source scans for:
   - clickable elements without `cursor-pointer` or an intentional cursor exception;
   - `focus-visible:outline-none` without a replacement focus ring;
   - custom non-native click targets without role/tab stop/keyboard handling;
   - hidden clickable controls without focus reveal;
   - icon controls below the target-size guidance.
6. Review the diff to verify that interaction/data behavior was not changed.

The terminal environment may emit the known `/bin/sh: 2: Cannot set tty process group` message after commands. Treat the command output itself as the validation result when it clearly reports success.

### Optional user-owned review

After implementation, the user may optionally check the app manually for:

- pointer cursor appearance;
- hover and pressed feedback;
- keyboard focus visibility;
- mobile target comfort;
- responsive wrapping.

This is an optional handoff checklist, not a blocker for the agent, and the agent will not use Playwright or open a browser to perform it.

## Implementation record — 2026-09-01

Implemented the plan in focused slices:

- Added enabled pointer, hover, and disabled cursor behavior to shared button/select/checkbox/switch/radio/dialog primitives.
- Added keyboard activation and focus styling to the Candling photo drop zone.
- Normalized AppSidebar, alert banner, notifications, calendar, journal, dashboard, settings, auth, lightbox, and help actions.
- Expanded notification and alert quick-action hit areas where inline styles had previously limited them.
- Added safe `type="button"` attributes to raw controls where appropriate.
- Preserved the draggable HelpWidget cursor behavior and existing interaction/data handlers.

Required non-browser validation passed:

- `npm run typecheck` from `apps/web` — no compiler errors.
- `npm test` from `apps/web` — 9 files and 79 tests passed.
- `npm run build` from `apps/web` — Vite production build succeeded.
- Source scan — no unresolved high-priority raw-button pointer/focus gaps or custom click containers without keyboard semantics were found; remaining flagged geometry is intentional or state-driven.

Playwright, browser automation, screenshot comparison, and agent-run browser checks were not used. The manual review checklist remains optional for the user.

## Acceptance criteria

### Shared behavior

- [x] Enabled shared selects, switches, checkboxes, radios, and dialog close controls communicate clickability.
- [x] Disabled controls retain disabled semantics and do not show active pointer treatment.
- [x] No focus outline is removed without a visible replacement.
- [x] Hover/pressed feedback does not shift layout bounds.

### Custom and small controls

- [x] Candling photo drop zone is keyboard-activatable.
- [x] Hidden notification actions reveal on keyboard focus and have visible focus treatment.
- [x] Calendar, remove-photo, and other small icon controls have an adequate hit area or a documented exception.
- [x] Draggable HelpWidget behavior remains intentionally distinct.

### Behavior preservation

- [x] No click handler, navigation path, filtering, sorting, upload behavior, or data mutation changes.
- [x] Existing `aria-pressed`, `aria-selected`, `aria-expanded`, and accessible names remain correct.
- [x] Native buttons are given `type="button"` where adding it is safe and appropriate.

### Validation

- [x] Diagnostics show no new errors.
- [x] `npm run typecheck` passes.
- [x] `npm test` passes.
- [x] `npm run build` passes.
- [x] Source scans show no unresolved high-priority affordance gaps.
- [x] Optional user-owned manual review is available as a handoff checklist, but is not required from the agent.

## Rollout and rollback

Implement in small slices:

1. Shared primitives.
2. Candling drop zone semantics.
3. Sidebar and notification/high-impact controls.
4. Remaining raw-button cleanup.
5. Required source/project validation.

If a shared primitive causes an unintended visual change, roll back only that primitive’s caller migration and keep the audit findings documented. Do not reset unrelated work in the repository.

## Definition of done

The refinement is complete when high-priority clickable affordance and keyboard issues are fixed, shared primitives provide a consistent enabled/disabled interaction contract, required source/project validation passes, and the optional manual checklist is handed off without requiring Playwright or browser automation.
