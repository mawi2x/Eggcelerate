# Refinement Plan: Improve the Mobile Web View

**Source review:** `docs/audit/mobile-web-implementation-review.md`  
**Plan date:** 2026-09-03  
**Status:** Implemented in source; manual responsive review pending  
**Scope:** Responsive layout, mobile navigation, fixed-layer clearance, narrow-width controls, dense data views, dialogs, and touch/accessibility behavior in the existing `apps/web` dashboard.  
**Validation constraint:** Source and project validation only. Do not use Playwright, browser automation, screenshot automation, or an agent-run browser check.

## Goal

Make the existing Eggcelerate web dashboard reliable and comfortable at narrow browser widths—especially **320px**, **375px**, and the supplied **402×874px** phone view—without creating a second web application or duplicating screen logic.

The governing architectural rule is:

> **Mobile web remains one responsive React application in `apps/web`; `apps/mobile` remains reserved for a future native Android/iOS application.**

The plan fixes the shell and shared layout contracts before making screen-specific refinements. This prevents each screen from inventing a different solution for the same breakpoint, bottom navigation, table, dialog, or touch-target problem.

## Current baseline

The project already has meaningful mobile-web support:

- `apps/web/src/app/components/ui/use-mobile.ts:3-20` defines a `768px` mobile breakpoint.
- `apps/web/src/app/components/AppSidebar.tsx:63-215` renders the mobile bottom navigation and More menu.
- `apps/web/src/app/App.tsx:536-542` reserves mobile bottom-navigation clearance with `pb-28`.
- `apps/web/src/app/components/PageHeader.tsx:50-117` has a mobile header branch.
- Main screen grids, settings panels, auth/onboarding, dialogs, and detail panels already use responsive stacking or wrapping.
- `apps/web/src/styles/theme.css:71-78` defines the 32/36/40px control scale and a 44px icon hit-area token.
- `apps/web/public/site.webmanifest` and `apps/web/index.html` provide PWA metadata, but service-worker/offline behavior is outside this layout plan.

## Implementation record — 2026-09-03

The source implementation for the shell and high-impact mobile refinement batch is complete:

- Aligned `App.tsx` sidebar padding with the existing `768px` mobile/desktop handoff.
- Made `useIsMobile()` resolve its initial client value synchronously to avoid an avoidable mobile desktop-first flash.
- Added the shared `--mobile-bottom-nav-clearance` token and applied it to the mobile More menu, HelpWidget, custom Settings toasts, and sticky Settings save bar.
- Added outside-pointer and Escape dismissal with focus return for the mobile More menu.
- Made Detail tabs use compact mobile labels with a contained horizontal-scroll fallback.
- Made Settings and Device Settings local navigation use the full mobile width.
- Made the notification popover viewport-relative and exposed notification dismiss actions on mobile with larger hit areas.
- Made Alerts row actions visible on mobile with 44px mobile targets.
- Made Trends chamber controls fluid on mobile.
- Made PhotoLightbox actions wrap/collapse to icon-only mobile controls and increased fullscreen zoom targets on mobile.

Validation completed:

- Changed-file diagnostics: no errors or warnings.
- `npm run typecheck` from `apps/web`: passed.
- `npm test` from `apps/web`: 9 files and 79 tests passed.
- `npm run build` from `apps/web`: Vite production build passed.
- No browser automation or agent-run browser check was used.

Remaining validation is user-owned manual review at 320px, 375px, 402px, 768px, and 1024px, plus the explicit product decision about whether dense mobile table views should remain horizontally scrollable.

## Architecture and breakpoint contract

### Keep one web component tree

- Modify the existing screen and shared components in `apps/web/src/app`.
- Use mobile-first Tailwind classes for layout and sizing, for example:

  ```tsx
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
    ...
  </div>
  ```

- Use `useIsMobile()` only where the rendered behavior is genuinely DOM-disjoint, such as desktop sidebar versus mobile bottom navigation. Do not use it for ordinary grid, spacing, wrapping, or typography decisions.
- Do not create duplicate `desktop/` and `mobile/` versions of every screen.
- Extract a mobile-specific component only when it represents a real interaction variant, such as a future `components/navigation/MobileBottomNav.tsx`.
- Do not modify `apps/mobile`; it is the native-app reservation described by `apps/mobile/README.md:1-5`.

### Standardize the shell breakpoint

The current shell has a mismatch:

- `use-mobile.ts` treats widths below `768px` as mobile.
- `AppSidebar` therefore renders the desktop fixed sidebar from `768px` upward.
- `App.tsx:537` currently applies sidebar padding only with `lg:pl-16`/`lg:pl-64`, which begins at Tailwind’s `1024px` breakpoint.

At `768px–1023px`, the desktop sidebar can therefore render without corresponding main-content padding. The plan standardizes the shell at the existing `768px` boundary:

- Keep `MOBILE_BREAKPOINT = 768`.
- Change the main-content padding modifiers in `App.tsx` from `lg:pl-16`/`lg:pl-64` to `md:pl-16`/`md:pl-64`.
- Keep `lg` for larger desktop density/layout changes, not for deciding whether the fixed sidebar exists.
- Confirm that widths below `768px` receive no sidebar padding because the bottom-nav version is rendered instead.

### Prevent first-paint mobile layout shifts

`useIsMobile()` currently initializes to a false value through `undefined` plus an effect. Components can render desktop markup before switching to mobile after mount.

Update the hook so its initial value is derived synchronously from `window.innerWidth` in this client-rendered Vite application, while retaining the existing media-query listener and a safe non-browser fallback. This keeps the hook limited to real responsive behavior changes and avoids a desktop-sidebar/header flash on mobile.

### Define the fixed-layer contract

Use one named clearance value rather than repeating slightly different bottom offsets:

```css
--mobile-bottom-nav-clearance: calc(4.5rem + env(safe-area-inset-bottom, 0px));
```

The exact value should follow the actual mobile navigation height and be validated against the existing `4.5rem` More-menu offset in `AppSidebar.tsx:164-169`.

Layer responsibilities:

| Layer | Current role | Contract |
|---|---|---|
| Mobile bottom navigation | `z-40`, fixed bottom bar | Remains above page content; safe-area padding stays included. |
| More menu | `z-50`, fixed above navigation | Uses the shared clearance and dismisses on selection, outside tap, and Escape. |
| Dialogs | Radix overlay/content at `z-50` | Must remain above the page shell and preserve focus management. |
| HelpWidget | `z-[70]` | Uses the mobile clearance rather than competing with the nav. |
| Custom Settings ToastStack | `z-50` | Uses the mobile clearance; desktop returns to normal bottom-right placement. |
| Settings save bar | Sticky page action | Uses the mobile clearance while sticky; desktop returns to the normal bottom edge. |

Do not change the generic Sonner `Toaster` positioning unless a separate issue is found; the main app currently places it at the top-right.

## Scope decisions

### In scope

- Shell breakpoint alignment and first-paint behavior.
- Mobile bottom-navigation and fixed-overlay clearance.
- Detail tab fitting/scrolling and mobile labels.
- Settings and Device Settings local navigation widths.
- Notification popover width and touch-visible actions.
- Photo lightbox header layout and mobile action targets.
- Narrow-width toolbar controls.
- Screen-by-screen overflow, wrapping, table, dialog, and touch review.
- Documentation reconciliation for the current Candling table implementation.

### Out of scope

- A native Android/iOS implementation in `apps/mobile`.
- A second mobile-web route tree or duplicate screen components.
- Changes to incubation calculations, alert logic, data models, routing behavior, or business rules.
- A broad visual redesign, new colors, new typography, or a new component library.
- Forcing every dense table into cards without a product decision.
- Service-worker registration, offline caching, install prompts, or full PWA runtime behavior. If required, create a separate PWA plan after layout work.

## Implementation sequence

### Phase 0 — Baseline, invariants, and decisions

**Priority:** P0  
**Files:** Documentation only initially; source files listed in later phases.

1. Use `docs/audit/mobile-web-implementation-review.md` as the source baseline.
2. Treat `320px`, `375px`, `402px`, `768px`, `1024px`, and a normal desktop width as the review matrix.
3. Preserve these invariants:
   - no page-level horizontal scrolling caused by a shared shell or toolbar;
   - dense data may scroll horizontally inside its own table region;
   - fixed navigation and overlays must not hide primary content or actions;
   - navigation, filtering, sorting, pagination, and incubation data behavior remain unchanged;
   - mobile and desktop use the same screen data and business logic.
4. Reconcile `docs/audit/table-consistency-audit.md` and `docs/refine/table-consistency-refinement-plan.md` with the current `CandlingLogsScreen.tsx` source. The source now uses the shared table and pagination primitives, so the older “migration pending” status is no longer an accurate implementation description.
5. Do not force mobile list views to cards in this phase. Incubators and Candling Logs already default to grid cards and provide a list choice. Preserve that choice while making list overflow explicit and contained.

**Exit criteria:** The breakpoint, overflow, table, and overlay decisions are recorded before screen-specific work begins.

### Phase 1 — Repair the shared mobile shell

**Priority:** P0  
**Files:**

- `apps/web/src/app/App.tsx`
- `apps/web/src/app/components/AppSidebar.tsx`
- `apps/web/src/app/components/PageHeader.tsx`
- `apps/web/src/app/components/ui/use-mobile.ts`
- `apps/web/src/styles/theme.css`
- `apps/web/src/app/components/HelpWidget.tsx`
- `apps/web/src/app/components/ToastStack.tsx`
- `apps/web/src/app/components/screens/SettingsScreen.tsx`

Tasks:

1. Align `App.tsx` sidebar padding with the `768px` desktop-sidebar boundary:
   - `navCollapsed ? "md:pl-16" : "md:pl-64"`;
   - preserve the existing mobile `pb-28` content clearance.
2. Make `useIsMobile()` choose its initial value synchronously in the client-rendered app, then continue responding to media-query changes.
3. Add the named mobile bottom-navigation clearance token in `theme.css` with a safe-area fallback.
4. Reuse the token in the mobile More-menu position instead of maintaining a separate literal offset.
5. Apply the same mobile clearance to the custom `ToastStack`. Use a desktop override at `md` because the desktop sidebar begins at `768px` after the shell fix.
6. Apply an appropriate mobile sticky bottom offset to the Settings save bar. Confirm that the bar remains visually attached to the Settings panel and does not create an unexplained empty gap in normal document flow.
7. Replace the HelpWidget’s mobile `bottom-20` value with the shared clearance or a documented derived offset. Preserve its draggable behavior and `z-[70]` layer.
8. Add outside-pointer and Escape dismissal to the mobile More menu. Preserve `role="menu"`, `role="menuitem"`, selection state, and current navigation behavior. If focus is managed, return focus to the More trigger when the menu closes.
9. Keep the mobile bottom-navigation targets at a comfortable touch size. Do not add extra nav items that make the five-target layout too dense.

**Acceptance criteria:**

- At all widths below `768px`, only the mobile bottom navigation is visible.
- At `768px–1023px`, the desktop sidebar and main content no longer overlap.
- The mobile nav, More menu, HelpWidget, Settings save bar, and custom Settings toasts have a predictable stacking/clearance relationship.
- The hook does not produce an avoidable desktop-first mobile flash.
- Normal page content still ends with enough space above the mobile nav.

### Phase 2 — Fix shared high-impact mobile components

**Priority:** P1  
**Files:**

- `apps/web/src/app/components/screens/DetailScreen.tsx`
- `apps/web/src/app/components/ui/segmented-control.tsx` only if the shared wrapper contract needs a small presentational adjustment
- `apps/web/src/app/components/screens/SettingsScreen.tsx`
- `apps/web/src/app/components/detail/DeviceSettingsTab.tsx`
- `apps/web/src/app/components/alerts/NotificationPopover.tsx`
- `apps/web/src/app/components/screens/AlertsScreen.tsx`
- `apps/web/src/app/components/detail/PhotoLightbox.tsx`
- `apps/web/src/app/components/screens/TrendsScreen.tsx`

#### 2.1 Detail tabs

Current risk: `SubTabNav` uses three long, `whitespace-nowrap` toolbar items inside an `inline-flex` segmented control (`DetailScreen.tsx:31-61`, `ui/segmented-control.tsx:21-24`, `45-50`).

Implement:

1. Provide compact mobile labels such as `Monitor`, `Candling`, and `Settings`, while preserving the full desktop labels.
2. Keep actual tab semantics: `role="tablist"`, `role="tab"`, `aria-selected`, and an identified tab-panel relationship where practical.
3. Make the mobile tab wrapper `max-w-full overflow-x-auto` as a safety net for translations or future label changes.
4. Remove `self-end` on the mobile layout; retain right alignment only at the desktop breakpoint if it remains part of the visual contract.
5. Do not put navigation/data logic into the shared segmented-control primitive.

#### 2.2 Settings local navigation widths

Replace the always-on inline `maxWidth` constraints:

- `SettingsScreen.tsx:46-56`: mobile `w-full max-w-none`, desktop `lg:max-w-[220px]`.
- `DeviceSettingsTab.tsx:84-101`: mobile `w-full max-w-none`, desktop `lg:max-w-[240px]`.

Keep the mobile category rows horizontally scrollable, but let the scroll region use the full content width. Preserve desktop sticky positioning and vertical menu layout.

#### 2.3 Notification popover and alert actions

Implement:

1. Replace the fixed `width: 340` at `NotificationPopover.tsx:67-72` with a viewport-relative maximum, such as `w-[min(340px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)]`.
2. Keep the popover aligned to the notification trigger and ensure it remains inside the viewport at 320px.
3. On small screens, make per-alert dismiss actions visible without hover. Desktop may retain the compact hover/focus reveal.
4. Expand mobile action hit areas toward the project’s 44px icon hit-area guidance while keeping the visible glyph compact.
5. Preserve accessible names, keyboard focus, and the current acknowledge/dismiss handlers.
6. Apply the same mobile-visible action treatment to the full Alerts list at `AlertsScreen.tsx:299-335`.
7. Consider stacking the alert row’s severity/timestamp/actions below the message at the narrowest breakpoint if the current right-hand column makes messages too narrow.

#### 2.4 Photo lightbox actions

Implement:

1. Allow the header action group at `PhotoLightbox.tsx:233-276` to wrap or use compact mobile controls.
2. Hide visible text labels below `sm` only when each icon retains an explicit accessible name and title.
3. Keep Enlarge, Download, Delete, and Close available; do not remove functionality on mobile.
4. Use at least the project’s touch-friendly hit area for mobile icon buttons, without enlarging the glyph unnecessarily.
5. Preserve the existing responsive image viewport, fullscreen touch panning, keyboard navigation, and delete behavior.

#### 2.5 Trends toolbar controls

Change the single-chamber and comparison controls from fixed-width-only behavior to mobile-first fluid width:

- mobile: `w-full`;
- larger screens: `sm:w-[240px]` or an equivalent max-width contract.

Keep the toolbar wrapping, metric choice, range filters, chart height, legend scrolling, and contained table overflow intact.

**Acceptance criteria:**

- Detail tabs do not cause page-level horizontal overflow at 320px, 375px, or 402px.
- Settings and Device Settings local menus use the available mobile width.
- Notification popovers fit within a 320px viewport.
- Alert actions are discoverable and tappable without hover.
- Lightbox actions remain available and fit on small screens.
- Trends controls occupy full available width when the mobile toolbar needs to wrap.

### Phase 3 — Screen-by-screen mobile refinement

**Priority:** P1/P2  
**Rule:** Each screen must reuse the shared shell and component contracts from Phases 1–2. Do not solve shared problems with screen-local offsets or duplicate markup.

#### 3.1 Overview

**File:** `apps/web/src/app/components/screens/OverviewScreen.tsx`

- Preserve the existing two-column KPI and priority-card layout at mobile widths (`:356-390`).
- Confirm card text remains readable at 320px after section padding and gaps are applied.
- Preserve the one-column Conditions to Check layout and mobile divider (`:393-449`).
- Keep long chamber/mode names wrapped or safely broken; do not introduce page-level overflow.
- Keep the compact layout as an intentional product choice unless manual review shows genuine loss of readability.

#### 3.2 Incubators

**File:** `apps/web/src/app/components/screens/IncubatorsScreen.tsx`

- Preserve wrapping for search, ViewToggle, Add Incubator, filters, sort, and sort direction.
- Preserve grid cards as the default mobile presentation (`:358-370`).
- Keep list mode available; do not silently hide the toggle or force cards in this plan.
- Ensure list-mode horizontal scrolling is contained inside the table region (`:371-447`).
- If manual review shows the list view is difficult to discover, add a visible scroll cue or make the first Chamber column sticky without changing data or pagination semantics.
- Recheck Add Incubator and Harvest dialogs at 320px.

#### 3.3 Candling Logs

**File:** `apps/web/src/app/components/screens/CandlingLogsScreen.tsx`

- Preserve the single-column diary-card grid at mobile widths (`:453-456`).
- Keep list-mode table overflow contained (`:457-547`).
- Confirm status tags, checkpoint text, and Open log actions remain readable after wrapping.
- Keep `PaginationBar` and the current native table semantics; do not revert to a custom CSS-grid list.
- Reconcile the older table audit/plan status after implementation is verified.

#### 3.4 Trends / Analytics

**File:** `apps/web/src/app/components/screens/TrendsScreen.tsx`

- Confirm the chart remains usable at its 360px mobile height and that the Y-axis/margins do not consume the entire plot area (`:629-637`).
- Keep the environmental toolbar wrapped and fluid.
- Confirm legend scrolling does not hide chamber identity without an accessible alternative.
- Preserve contained horizontal overflow for hatch-history and raw-reading tables.
- Recheck chart, table, and raw-reading modal behavior at 320px and 375px.

#### 3.5 Alerts

**File:** `apps/web/src/app/components/screens/AlertsScreen.tsx`

- Apply the touch-visible actions from Phase 2.
- At narrow widths, prefer a stacked message/action arrangement over an overly compressed three-column row.
- Preserve pagination, empty state, severity labels, acknowledge/dismiss handlers, and readable message text.

#### 3.6 Settings

**Files:** `SettingsScreen.tsx`, `settings/ModeLibraryPanel.tsx`, `settings/NotificationsPanel.tsx`, `settings/FarmAccountPanel.tsx`, `settings/HardwarePanel.tsx`

- Apply the full-width local navigation from Phase 2.
- Confirm setting rows wrap or stack where label/hint/control combinations become too narrow at 320px.
- Preserve one-column form fields below `sm` and two-column fields only where they remain readable.
- Confirm the sticky save bar remains visible above the mobile nav and does not cover form controls.
- Confirm custom notification toasts appear above the mobile nav.
- Recheck Mode Library dialogs, import conflict content, and numeric form grids at 320px.

#### 3.7 Incubator Detail

**Files:** `DetailScreen.tsx`, `detail/LiveMonitorTab.tsx`, `detail/CandlingJournalTab.tsx`, `detail/DeviceSettingsTab.tsx`, `detail/IncubationCalendar.tsx`

- Apply the tab fix first.
- Preserve stacked gauges/status tiles and the one-column journal/calendar arrangement below `lg`.
- Confirm timeline milestone labels do not overlap the content edge at narrow widths.
- Preserve full-width Log Inspection and setup actions on mobile.
- Confirm journal cards, delete/edit actions, photo upload, calendar, and Stop Cycle/Harvest dialogs remain usable.

#### 3.8 Authentication/onboarding

**Files:** `auth/AuthCard.tsx`, `auth/SignInScreen.tsx`, `auth/OnboardingStep1.tsx`, `auth/OnboardingStep2.tsx`, `auth/OnboardingStep3.tsx`

- Preserve the fluid `AuthCard` and 48px primary actions.
- Confirm the Step 2 focus grid, species chips, and Step 3 action row at 320px.
- Keep the existing dedicated specification in `docs/screens/auth-and-onboarding-plan.md` as the source of truth for copy and flow.

**Acceptance criteria:**

- Every screen has an explicit decision for stacking, wrapping, internal scrolling, or preserved density.
- No screen introduces page-level horizontal overflow.
- Users can reach every existing mobile action without hover-only interaction.
- Long labels either wrap, truncate with a useful title, or use a deliberate compact label.
- Existing empty, loading, error, pagination, and modal states remain clear.

### Phase 4 — Touch, accessibility, and overlay verification

**Priority:** P1/P2

Use the existing interaction contracts from:

- `docs/guide/ui-control-size-guidelines.md`
- `docs/audit/clickable-affordance-audit.md`
- `docs/refine/clickable-affordance-standardization-plan.md`

Tasks:

1. Keep the distinction between visual control size and touch hit area:
   - toolbar controls may remain 40px visual controls;
   - visual icon controls may remain 36px;
   - mobile icon actions should use a 44px hit area where layout permits.
2. Remove hover-only discoverability from mobile-critical actions.
3. Confirm all icon-only actions have accessible names and visible focus treatment.
4. Preserve native buttons and Radix semantics; do not replace them with generic clickable containers.
5. Confirm sticky/fixed elements do not hide focused controls or dialog actions.
6. Confirm dialogs have a usable close path, vertically scroll when content exceeds the viewport, and keep footer actions reachable.
7. Confirm safe-area behavior for the bottom nav and every fixed/absolute element positioned relative to it.
8. Confirm no focus outline is removed without a visible replacement.

### Phase 5 — Source validation, user-owned responsive review, and documentation

**Priority:** Required before marking the source implementation fully validated

#### Source/project validation

Run from the repository root:

```bash
pnpm --filter eggcelerate-ui typecheck
pnpm --filter eggcelerate-ui test
pnpm --filter eggcelerate-ui build
git --no-pager diff --check
```

Equivalent `npm run typecheck`, `npm test`, and `npm run build` commands may be run from `apps/web`.

Also run focused source checks for:

- remaining `lg:pl-16`/`lg:pl-64` shell padding mismatch;
- fixed mobile widths without viewport-relative constraints;
- `sticky bottom-0` or `fixed bottom-*` elements that lack mobile-nav clearance;
- hover-only mobile-critical actions;
- `whitespace-nowrap` segmented/tab groups without a mobile fit or scroll strategy;
- icon controls below the project’s touch-hit-area guidance;
- page-level overflow risks outside intended table/scroll regions.

Run diagnostics for changed files and confirm no new errors.

#### User-owned responsive review

The agent does not open a browser or run Playwright. If the user performs a manual review, use:

| Width | Primary checks |
|---:|---|
| 320px | Smallest supported layout, dialogs, popovers, lightbox header, text wrapping, touch targets |
| 375px | Common small-phone layout, tables, Settings rows, detail tabs |
| 402px | Supplied iPhone 17 reference width and vertical spacing |
| 768px | Exact shell handoff: bottom nav disappears and desktop sidebar begins without occlusion |
| 1024px | Desktop layout remains aligned after moving shell padding to `md` |

For every width, check:

- no accidental page-level horizontal scrollbar;
- bottom navigation does not cover content or actions;
- fixed overlays are above the correct surface;
- detail tabs and settings menus fit;
- tables scroll only inside their intended regions;
- actions are visible and tappable;
- keyboard focus remains visible when using a keyboard or assistive technology.

#### Documentation updates

After implementation:

- Mark this plan **Implemented** and record the changed files and validation results.
- Update `docs/audit/mobile-web-implementation-review.md` with completed phases and intentional exceptions.
- Reconcile `docs/audit/table-consistency-audit.md` and `docs/refine/table-consistency-refinement-plan.md` with the current Candling table implementation.
- Keep PWA runtime work separate unless offline/install behavior is explicitly requested.

## Acceptance criteria

### Architecture

- [ ] Mobile web changes stay in `apps/web`.
- [ ] `apps/mobile` remains untouched and reserved for native mobile work.
- [ ] No duplicate desktop/mobile screen tree is introduced.
- [ ] `useIsMobile()` is limited to true behavior differences and avoids an avoidable first-paint layout shift.

### Shell

- [ ] The desktop sidebar and main content align at every width from `768px` upward.
- [ ] The mobile bottom nav remains fixed, safe-area aware, and five-target.
- [ ] Main content and fixed overlays clear the mobile nav.
- [ ] More menu dismissal and focus behavior are complete.

### Shared components

- [ ] Detail tabs fit or scroll safely at 320px, 375px, and 402px.
- [ ] Settings and Device Settings menus use the full mobile content width.
- [ ] Notification popover width never exceeds the viewport.
- [ ] Alert actions are visible/discoverable and use touch-friendly hit areas on mobile.
- [ ] Photo lightbox actions fit and remain fully accessible.
- [ ] Trends controls can become full width on mobile.

### Screens and content

- [ ] Overview, Incubators, Candling Logs, Trends, Alerts, Settings, and Detail have explicit mobile layout decisions.
- [ ] Dense tables use contained scrolling or an explicitly approved mobile representation.
- [ ] No page-level horizontal overflow is introduced.
- [ ] Long labels, empty states, errors, loading states, and pagination remain understandable.
- [ ] Authentication and onboarding remain usable at 320px.

### Quality

- [ ] Mobile-critical controls do not rely on hover.
- [ ] Icon-only actions have names, focus states, and adequate hit areas.
- [ ] Dialogs and sticky actions remain reachable on short/narrow viewports.
- [ ] Typecheck, tests, build, diagnostics, and diff checks pass.
- [ ] The audit and related table documentation reflect the actual implementation.

## Definition of done

The plan is complete when the existing web dashboard uses one coherent responsive shell, no longer has the identified breakpoint/layer/tab/popover/menu/lightbox defects, each screen has a documented narrow-width decision, and source/project validation passes. Manual browser review remains user-owned and optional; it is not replaced by Playwright or an agent-run browser check.
