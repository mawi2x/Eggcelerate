# Eggcelerate Responsive Surface Remediation Plan

**Plan date:** 2026-09-05  
**Status:** Implemented in source — source/project validation complete; manual runtime matrix pending  
**Scope:** `apps/web` responsive typography, control geometry, filter rows, page reflow, fixed layers, overlays, and narrow-width validation.  
**Primary baseline:** the supplied screenshots and September 2026 screen audit of the pre-remediation source at 320–1440px, including portrait and landscape states.
**Validation constraint:** Per user instruction, do not use Playwright, browser automation, screenshot automation, or an agent-run browser check for this goal. Source/project gates are the agent sign-off; the runtime/zoom/accessibility matrix below is a manual user-owned handoff and is not claimed as completed here.

This is the master implementation plan for the responsive issues found across the supplied screenshots and the follow-up route/state audit. The older files under `docs/refine/` remain useful for individual topics, but this document is the execution scope for fixing the complete surface set. If an older plan conflicts with this one, the current source measurement and the contracts below win. The implementation is complete in source; the no-browser constraint intentionally leaves rendered runtime sign-off to the user.

## Outcome

Make every existing web screen readable, operable, and visually intentional from a small phone through desktop without creating a second mobile application or changing business behavior.

The governing rule is:

> Reflow the layout before shrinking meaningful content; enlarge the hit area before enlarging the glyph.

The desktop and mobile screenshots are not expected to be pixel-identical. A valid mobile result may stack a banner action, shorten a tab label, use a carousel, or contain a table in its own scroll region. It must not silently shrink essential text or make an action difficult to find or tap.

## Root-cause summary

| Priority | Root cause | Evidence in the pre-remediation audit | Remediation |
|---|---|---|---|
| P0 | The phone type cascade is an experimental “subtract 1px from every token” test | `theme.css` has `max-width: 39.9375rem` and `max-width: 25rem` blocks that produce 13/12px body text, 15/14px control values, and 8/7px micro labels | Remove the full-step tiers. Keep only the selective page/panel and form-control overrides in the locked contract |
| P0 | JavaScript and Tailwind disagree about the mobile boundary | `useIsMobile()` uses 768px while many `sm:` branches begin at 640px; 640–767px therefore renders a mobile shell with desktop-sized or desktop-labeled controls | Use the 768px contract for shell, labels, and touch geometry; audit `sm:` branches that change behavior rather than spacing |
| P0 | Screen code bypasses shared control tokens | `FilterBar`, Incubators, Candling Logs, Alerts, Trends, and detail/settings controls use `micro`, inline 28/32/36px heights, or raw button styles | Move responsive geometry into shared primitives and semantic variants; leave only documented content-specific exceptions |
| P1 | Filter families use different sizing and fitting rules | Status pills can have unequal widths; fit-to-screen segments are 24px high; Trends has a separate time-horizon treatment | Define equal-track status segments, a reusable segmented-control contract, and a separate non-segmented select/toolbar contract |
| P1 | Visual size and touch size are conflated | Switch tracks are 32×18px, compact actions are 28/32px, and some close/menu controls are smaller than their hit area | Keep compact visuals where useful, but provide an explicit 44px target wrapper for interactive controls |
| P1 | Fixed and nested surfaces have inconsistent narrow-width behavior | Tables, carousels, settings navigation, popovers, dialogs, and fixed widgets each have local overflow/offset rules | Establish an allowlisted nested-scroll contract and one mobile-nav clearance token |
| P1 | Micro text is used in both valid visualizations and ordinary UI | Timeline/gauge labels are legitimate candidates, but labels, actions, and editable fields must remain readable | Keep micro text only for redundant chart/illustration geometry; remove it from DOM controls and safety copy |
| P1 | Overlay and primitive hygiene is incomplete | Dialog overlay emits a React ref warning; shared dialog close and Help close controls render below the project target without a larger hit area | Forward refs correctly, give overlays a usable close path, and apply the hit-area contract to popovers, dialogs, lightbox, and More menu |
| P2 | Tests mostly assert authored source, not rendered behavior | Existing token tests can pass while a real 393px or 700px viewport still exposes the wrong cascade or clipping | Add boundary, geometry, overflow, state, zoom, and overlay checks to the source and browser validation matrix |

## Locked design contracts

### One breakpoint contract

Use the existing `MOBILE_BREAKPOINT = 768` as the single boundary for behavior that changes the mobile shell or the mobile interaction model.

- Below `768px`: mobile bottom navigation, mobile labels, mobile touch geometry, and mobile overlay offsets.
- At `768px` and above: desktop sidebar and desktop navigation labels.
- Keep the narrower `640px` boundary only for selective phone typography, if a type role genuinely needs it. It must not decide whether a component is mobile or desktop.
- Do not use `sm:` to switch between mobile and desktop markup, labels, control sizes, or hover-only actions. Use `md:` or a shared breakpoint constant for those decisions.
- `sm:` remains allowed for internal spacing or an element’s own content reflow when it does not create a 640–767px hybrid.

The implementation may keep `useIsMobile()` for genuinely different behavior. Its initial client value must be synchronous in this Vite app so a phone does not briefly render the desktop shell.

### Selective type scale

Desktop values remain unchanged. There is no second “400px scale,” and no token may be reduced merely because the viewport is narrower.

| Semantic role | Desktop | Phone target | Rule |
|---|---:|---:|---|
| Page title | 24px | 20px | Selective phone reduction |
| Panel title | 22px | 18px | Selective phone reduction |
| Large heading | 20px | 20px | Preserve hierarchy |
| Medium heading | 18px | 18px | Preserve hierarchy |
| Small heading | 16px | 16px | Preserve hierarchy |
| Body | 14px | 14px minimum | Never use compact/micro tiers for prose |
| Form/control value | 14px | 16px | Prevent iOS focus zoom and improve entry readability |
| Small body | 13px | 13px | Short supporting copy only |
| Caption | 12px | 12px | Short supporting copy only |
| Label | 11px | 11px | Meaningful labels and status text |
| Compact label | 10px | 10px | Short, secondary, non-prose labels |
| Micro label | 9px | 9px | Exceptional redundant visualization text only |

Requirements:

- Remove all 7px and 8px authored tiers and the tests that require them.
- Do not use 9px/10px for body copy, instructions, forms, alerts, errors, navigation, tabs, action labels, or safety warnings.
- A micro label must have a visible or accessible full-text path. A `title` attribute by itself is not sufficient on touch or for assistive technology.
- Preserve `rem` tokens and unitless line heights so browser zoom and user text settings continue to work.
- Use wrapping, `min-w-0`, stacking, or a shorter visible label before reducing type.

### Control and hit-area contract

The control’s visible decoration and its interactive hit area are separate decisions. The phone visual scale must stay compact; a 44px hit-area requirement must not be implemented by globally making every colored control 44px tall.

| Role | Mobile visual treatment | Desktop visual baseline | Hit-area rule |
|---|---:|---:|---|
| Primary/default button | Existing 36px visual tier | Existing 32/36px variant | Use an explicit 44px target when the action needs it; preserve label and feedback states |
| Input/select | Existing 36/40px visual tier | Existing default/toolbar variant | Use the control-value type role; do not raise every field through a global phone token |
| Toolbar control | Existing 40px visual tier | Existing 40px toolbar variant | Wrap controls instead of compressing them; use a target wrapper where supplied |
| Segmented tab/status item | Existing 36px visual tier | Existing 36px segment | Equal tracks when the row fits; add target padding only when it does not expand layout unexpectedly |
| Icon-only action | Existing 36px visual control | Existing 36px visual icon control | Use a 44×44px target wrapper where layout permits; glyph remains approximately 16–22px |
| Filter/status chip | 36px visual baseline | Existing 28px baseline | Use spacing or a target wrapper; do not shrink labels |
| Switch / checkbox | Compact visual track/mark | Compact visual track/mark | Keep the explicit 44px hit wrapper around the visual control |
| Pagination/secondary inline action | Documented compact exception | Existing compact variant | Must remain keyboard reachable and have sufficient spacing |

The prior implementation briefly escalated `--control-height-default`, `--control-height-toolbar`, `--control-size-icon`, and `--control-segment-height` to 44px below `768px`. That enlarged visible rows and card spacing, so the global phone override was removed. Only explicit wrappers/targets retain the larger interaction area.

Status/filter pill fitting rules:

1. A fit-to-screen segmented row uses equal-width tracks (`minmax(0, 1fr)`) so visible pills are proportionate.
2. If all labels do not fit at 320–402px, wrap to a deliberate second row or use a contained horizontal scroller with a visible affordance. Do not make the row 24px high or reduce its font to force a single line.
3. Counts are part of the label and must not be clipped. The accessible name must include the full status and count.
4. Scroll arrows and overflow controls use a 44px target even when their glyph is 16px.
5. The three-status vocabulary already defined by `docs/refine/list-filter-unification-plan.md` is a data/behavior decision. This plan only ensures that every status state fits and renders consistently; it does not reopen the taxonomy.

### Reflow, overflow, and fixed-layer contract

- `document.scrollWidth` must equal `document.clientWidth` for every supported phone and tablet viewport.
- Nested horizontal scroll is allowed only for an identified data or navigation region: carousel, settings category navigation, list/table view, hatch-history table, or raw-readings table.
- Every nested scroller must have a stable width, a visible continuation cue, and no interaction hidden behind the fixed bottom navigation.
- Long chamber names, mode names, alert messages, translated labels, and validation errors wrap with `overflow-wrap: anywhere` where needed; do not apply `word-break: break-all` to normal prose.
- Fixed/sticky content uses the shared mobile bottom-navigation clearance and safe-area inset.
- Dialog content scrolls internally when needed; dialog footer actions remain reachable.
- The primary action remains above the bottom navigation and the keyboard/focus viewport.

### Accessibility and feedback contract

- No mobile-critical action depends on hover.
- Icon-only controls have an accessible name, visible focus state, and a target at least 44×44px where the project contract applies.
- Meaning is not conveyed by color alone; status text/icons remain present.
- Dialogs, popovers, More menu, and lightbox have Escape/close paths and preserve focus behavior.
- Switches expose their state semantically even when the visual track remains compact.
- Reduced motion, 200% zoom, increased text spacing, keyboard navigation, and screen-reader labels are part of sign-off.

## Surface and state coverage

The implementation must account for every route and meaningful state below. A screen is not complete because its default screenshot looks correct.

| Surface | Routes / variants | States to verify | Main correction | Primary files |
|---|---|---|---|---|
| App shell | `/` and every authenticated route; 320–1024px handoff | Desktop sidebar, mobile bottom nav, More open/closed, safe area, HelpWidget, toast | Align `md` shell boundary, reserve one clearance token, remove first-paint desktop flash | `App.tsx`, `AppSidebar.tsx`, `use-mobile.ts`, `theme.css`, `HelpWidget.tsx`, `ToastStack.tsx` |
| Overview | `/` | KPI cards, active-incubator carousel, conditions, empty/attention data, CTA, count badges | Preserve two-column mobile cards where readable; give carousel dots real targets; keep CTA label/reflow deliberate | `OverviewScreen.tsx` |
| Incubators | `/incubators` grid and list | All/optimal/issues status states, optimal/urgent/offline/lockdown/past-hatch cards, search, sort, Add, Finish/Configure dialogs | Equal status segments; 44px selects/sort/actions; contained list table; reflow card actions/dialogs | `IncubatorsScreen.tsx`, `IncubatorCard.tsx`, `FilterBar`, `Select`, `ViewToggle` |
| Candling Logs | `/candling` grid and list | All/needs-action/upcoming/completed states, overdue/no-entry/partial checks, search, sort, Open log, pagination | Same filter/control contract as Incubators; keep diary cards and contained table semantics | `CandlingLogsScreen.tsx`, `filter-bar.tsx`, `pagination-bar.tsx` |
| Historical Trends | `/trends` Environmental Trends and Hatch History | Last 24h/7 days/full incubation, chamber selection, compare on/off, metric tabs, chart empty/loading/error, table/raw readings | Treat environmental/hatch switch and time horizon as distinct segmented patterns; keep selectors fluid; preserve readable chart/table alternatives | `TrendsScreen.tsx`, `trends-mobile-chart-and-filter-plan.md` |
| Alerts / Notification Center | `/alerts` and notification popover | All/unread/urgent or project-defined status filters, urgent/attention alerts, acknowledge/dismiss, empty, pagination | Keep urgency copy readable; stack actions when needed; make actions visible on touch; constrain popover width | `AlertsScreen.tsx`, `NotificationPopover.tsx`, `alertStyle.ts` |
| Settings | `/settings` Modes, Notifications, Farm/Account, Hardware/Device Preferences | Category navigation, switches, validation, unsaved changes, import conflict, calibration, sticky save/discard, dialogs | Full-width mobile local navigation; rows wrap/stack; switch hit wrappers; calibration/save controls use shared targets | `SettingsScreen.tsx`, `settings/tokens.tsx`, `ModeLibraryPanel.tsx`, `NotificationsPanel.tsx`, `FarmAccountPanel.tsx`, `HardwarePanel.tsx` |
| Incubator detail monitor | `/incubators/chamber-12` | Ready, attention, lockdown, past hatch, awaiting finish, live monitor, offline/system states | Keep banner CTA accessible when stacked; responsive timeline/gauges/status tiles; chart labels remain exceptions only where justified | `DetailScreen.tsx`, `LiveMonitorTab.tsx`, `Timeline.tsx`, `primitives.tsx` |
| Incubator detail candling | `/incubators/chamber-12/candling` | Empty journal, entries, expanded/collapsed entry, edit/delete, photo add/lightbox, log inspection dialog | Replace tiny expand/edit targets; keep note textarea at control-value size; make lightbox actions fit and remain discoverable | `CandlingJournalTab.tsx`, `PhotoLightbox.tsx` |
| Incubator detail settings | `/incubators/chamber-12/settings` | Mode/turning/device tabs, locked settings, interval selection, Turn Now, device errors | Apply 44px control targets, full-width mobile nav, readable labels, and stacked settings rows | `DeviceSettingsTab.tsx` |
| Auth/onboarding | `/login`, `/onboarding/1`, `/onboarding/2`, `/onboarding/3` | Field errors, password visibility, links, species chips, back/next, narrow viewport | Keep editable text at 16px on phones; preserve 44/48px actions; wrap chips and inline links without truncation | `auth/FormInput.tsx`, `SignInScreen.tsx`, `OnboardingStep1.tsx`, `OnboardingStep2.tsx`, `OnboardingStep3.tsx` |
| Shared overlays | Add Incubator, Harvest/Finish Cycle, Raw Readings, Mode Library, inspection, delete confirmation, notification popover, More menu, HelpWidget | Open/close, long content, validation/error, keyboard Escape, outside press, focus return, short landscape height | Viewport-relative widths, internal scrolling, 44px close/action targets, correct stacking and focus | `dialog.tsx`, dialog callers, `NotificationPopover.tsx`, `AppSidebar.tsx`, `HelpWidget.tsx` |

## Implementation phases

### Phase 0 — Freeze the baseline and build the allowlist

**Priority:** P0  
**Output:** a measured baseline and a finite exception list before source migration.

**Validation note:** The supplied screenshots and existing source/runtime audit are the frozen baseline for this implementation. No new agent-run viewport or computed-style capture is claimed because browser automation is disabled for this goal.

1. Re-run the raw inventory against the current checkout. Record direct `fontSize`, `text-xs/text-sm`, hardcoded `h-*`/`w-*`, `sm:` behavior branches, `whitespace-nowrap`, fixed widths, and raw interactive elements.
2. Use the supplied audit as the route/state matrix baseline at `320`, `375`, `393`, `402`, `640`, `700`, `767`, `768`, `1024`, and `1440px`, plus `852×393px` landscape.
3. Use the existing audit’s computed-type findings at 393px and 402px as the failing baseline for the experimental blocks; do not claim a new computed-style capture in this source-only run.
4. Classify every sub-11px use as `replace`, `approved visualization exception`, or `product review`. The exception list may include SVG/chart geometry in `GaugeDial`, `WaterDroplet`, and the timeline, but not ordinary DOM copy.
5. Classify every nested overflow region. Anything not in the carousel, local navigation, list/table, hatch-history, or raw-readings allowlist must be treated as a page-overflow defect.
6. Define the test fixtures for optimal, attention, urgent, offline, lockdown, past-hatch, overdue, empty, loading, error, and unsaved states.

**Exit criteria:** the supplied baseline is recorded, all routes/states have an owner, and the allowlists are explicit.

### Phase 1 — Repair the token and breakpoint foundation

**Priority:** P0  
**Primary files:** `theme.css`, `use-mobile.ts`, `App.tsx`, `mobile-typography.test.ts`, `typography-tokens.test.ts`.

1. Delete the experimental “every token minus 1px” phone blocks, including the 400px tier. Replace them with only the selective page/panel/control-value overrides in the type contract.
2. Keep `--type-body` at 14px minimum, `--type-control-value` at 14px desktop/16px phone, and the 11/10/9 label tiers with their restrictions.
3. Keep the 32/36/40px visual control scale below 768px; use explicit 44px wrappers for switches, checkboxes, scroll arrows, close actions, and other controls where the layout can absorb them without enlarging the visible row.
4. Ensure the `@layer base` element defaults and component primitives consume the same semantic roles; remove any parallel `--text-*` sizing scale.
5. Align behavior-changing Tailwind branches with `md`/768px. Do not mass-replace harmless `sm:` spacing rules without reviewing their layout effect.
6. Ensure `useIsMobile()` initializes from the client viewport and continues to respond to `matchMedia` changes.
7. Add or preserve a shared `--mobile-bottom-nav-clearance` token with `env(safe-area-inset-bottom, 0px)`.
8. Update source tests so they assert the corrected contract. Remove test names and expectations that describe the experimental tiers.

**Exit criteria:** source contracts and static checks remove the 12/13px body text and 7/8px micro tiers; no mobile/desktop behavior switch is authored at 640px; desktop values remain unchanged. Rendered computed-style confirmation remains in the manual matrix.

### Phase 2 — Normalize shared primitives and overlays

**Priority:** P0–P1

Update the reusable components before screen callers:

- `Button`: make `default`, `toolbar`, `icon`, `segment`, and `micro` semantics explicit; remove misleading global `text-sm` assumptions where token styling owns the role.
- `Input` and raw `FormInput`: use `--type-control-value`; audit the journal textarea and every focusable raw text field for the same role.
- `Select`: use the control-value role for values; reserve `micro` for non-primary compact presentation, not standard mobile selects.
- `SegmentedControl`: define equal-track, scroll, and wrapped modes; preserve selected/pressed/tab semantics.
- `FilterBar`: separate status/filter visual chips from their hit areas; keep fit-to-screen items visually compact and proportionate; keep arrows 44px with 16px glyphs.
- `ViewToggle`: size each button from the icon target token, not from group padding.
- `Switch`: add a 44px hit wrapper around the 32×18px visual track and preserve checked/disabled semantics.
- `PaginationBar`: document its compact secondary-action exception, keep spacing and keyboard target behavior, and verify it does not become a page-overflow source.
- `Dialog`/`AlertDialog`: forward refs through the overlay, give the shared close control a usable target, constrain content to the viewport, and allow internal scrolling.
- `NotificationPopover`, More menu, HelpWidget, and PhotoLightbox: align close/action targets, viewport widths, focus handling, stacking, and mobile-nav clearance.

**Exit criteria:** screen code no longer needs inline 28/32/36/40px values for standard mobile controls, and the dialog ref warning is gone.

### Phase 3 — Unify filter and toolbar families

**Priority:** P1

Treat these as related but not identical patterns:

1. **Status filters:** Incubators, Candling Logs, Alerts/Notification Center use the shared status vocabulary and equal-width fit/scroll behavior. Counts remain readable and part of the accessible label.
2. **Environmental/Hatch History switch:** Trends uses a full-width two-option segmented switch, not a status-filter row.
3. **Time horizon:** Trends `Last 24h`, `Last 7 days`, and `Full incubation` use the shared segmented contract, but retain their analytics meaning and selected state.
4. **Select/filter toolbar:** `All modes`, `Progress`/`Attention`, chamber selectors, sort selectors, and direction controls use full-width wrapping and the compact shared visual tokens; direction/overflow actions may use explicit 44px targets.
5. Remove screen-local `isMobile ? micro` decisions when the shared component can select the correct responsive variant. A screen may choose semantic `variant`, not a numeric mobile height.
6. At 320–402px, verify that no trailing pill is clipped under a scroll arrow and no row relies on a 24px height to fit.

**Exit criteria:** Incubators, Candling, Alerts, and Trends have an intentional, documented filter strategy; visually similar controls are proportionate without forcing unrelated controls into one pattern.

### Phase 4 — Migrate screens in impact order

**Priority:** P1

#### 4.1 Incubators and Candling Logs

- Make status segments equal-width or intentionally scroll/wrap; keep the three-status data decision from the list-filter plan.
- Give mode/status/progress/attention selects and sort direction controls the shared compact visual treatment; preserve explicit target wrappers only where they do not enlarge the filter row.
- Preserve the mobile card default and list-view choice. Keep table overflow inside the table viewport, with a visible continuation cue.
- Ensure card actions (`Finish Cycle`, `Configure`, `Open log`) are reachable and do not become tiny because the card is narrow.
- Recheck Add Incubator, Finish/Harvest, and inspection dialogs at 320px and short landscape height.
- Keep pagination and native table semantics; do not replace data behavior with a purely visual card approximation.

**Files:** `IncubatorsScreen.tsx`, `CandlingLogsScreen.tsx`, `IncubatorCard.tsx`, `FilterBar`, `Select`, `PaginationBar`, dialog callers.

#### 4.2 Overview

- Preserve KPI card reflow and the active-incubator carousel.
- Keep carousel dots visually compact with accessible labels and focus styles; do not let their hit-area treatment add a large empty layout row.
- Keep the compact mobile CTA label only if its full accessible name remains available and the button still meets the target.
- Promote any remaining non-interactive 10px count badge to the label role or document a redundant visualization exception.
- Verify Conditions to Check in attention and empty states, including long chamber names.

**File:** `OverviewScreen.tsx`.

#### 4.3 Alerts and notification surfaces

- Keep urgency and remediation copy at readable roles; never use compact/micro text for alert descriptions, timestamps needed for decisions, or severity labels.
- Make acknowledge/dismiss actions visible on touch and stack the action column when the message becomes too narrow.
- Make `Recent`, `Mark all`, and `Clear all` controls wrap cleanly without reducing value text.
- Keep the popover viewport-relative at 320px and aligned to its trigger.
- Preserve empty, pagination, unread, urgent, and error states.

**Files:** `AlertsScreen.tsx`, `NotificationPopover.tsx`, `alertStyle.ts`.

#### 4.4 Incubator detail

- Keep the Past Hatch/Ready/Lockdown banners responsive: copy above, action below on narrow widths, action inline when space permits.
- Use compact mobile tab labels only as a content reflow strategy; preserve full accessible names and tab semantics.
- Keep timeline milestone nodes and gauge SVG text as documented visualization exceptions, but keep adjacent DOM labels readable and non-overlapping.
- Ensure the Monitor, Candling, Settings, Full Trends, Stop Cycle, Harvest, and Configure paths remain reachable above the bottom navigation.
- Give journal expand/edit/delete/photo controls deliberate hit areas; keep note entry fields at control-value size.
- Apply the same contract to Mode, Turning, and Device Settings navigation and interval/device controls.

**Files:** `DetailScreen.tsx`, `LiveMonitorTab.tsx`, `Timeline.tsx`, `CandlingJournalTab.tsx`, `DeviceSettingsTab.tsx`, `PhotoLightbox.tsx`, `primitives.tsx`.

#### 4.5 Settings

- Let Settings and Device Settings local navigation use the full mobile content width; contained horizontal scrolling is permitted for the category strip.
- Make setting rows use `min-w-0` and wrap/stack labels, hints, and controls rather than truncating essential text.
- Keep switches visually compact but give them a 44px hit wrapper.
- Fix Hardware calibration and device sampling controls, including the compact Save action and fixed-width select.
- Keep Mode Library/import conflict dialogs readable and vertically scrollable.
- Keep the sticky save/discard bar and custom toasts above the mobile navigation and below modal layers.

**Files:** `SettingsScreen.tsx`, `settings/tokens.tsx`, `ModeLibraryPanel.tsx`, `NotificationsPanel.tsx`, `FarmAccountPanel.tsx`, `HardwarePanel.tsx`.

#### 4.6 Historical Trends

- Keep Environmental Trends/Hatch History as a full-width two-option switch.
- Keep chamber selector and compare controls fluid; do not allow a fixed 200px field to force the toolbar wider than the viewport.
- Fit or wrap time-horizon segments with the compact visual baseline; do not use a 24px phone row or a global 44px visual escalation.
- Preserve chart proportions, readable axis/legend behavior, accessible metric toggles, and the existing analytics-specific chart plan.
- Keep hatch-history and raw-readings tables in contained scroll regions with a visible affordance and accessible table alternative.
- Verify empty/loading/error chart states and the raw-readings modal at narrow widths.

**Files:** `TrendsScreen.tsx`, `GaugeDial.tsx`/chart callers as applicable, `docs/refine/trends-mobile-chart-and-filter-plan.md`.

#### 4.7 Auth and onboarding

- Keep raw form inputs at `--type-control-value` on phones, including password and onboarding fields.
- Preserve 44/48px primary actions, password visibility, back/next, error placement, and password-manager attributes.
- Let species chips and inline links wrap rather than shrink below readable roles.

**Files:** `auth/FormInput.tsx`, `SignInScreen.tsx`, `OnboardingStep1.tsx`, `OnboardingStep2.tsx`, `OnboardingStep3.tsx`.

**Exit criteria:** every surface in the coverage table has a deliberate reflow, scrolling, or preserved-density decision, and no screen-local numeric mobile workaround remains for a shared component responsibility.

### Phase 5 — Validate runtime behavior and accessibility

**Priority:** P0 before sign-off

#### Source and project gates

Run after each implementation batch and at completion:

```bash
pnpm --filter eggcelerate-ui typecheck
pnpm --filter eggcelerate-ui test
pnpm --filter eggcelerate-ui build
git --no-pager diff --check
```

Focused source checks must cover:

- no 7px/8px type token or DOM text;
- no experimental all-token phone cascade;
- no standard mobile input/select using body/body-sm instead of control-value;
- no behavior-changing `sm:` branch that creates a 640–767px hybrid;
- no unallowlisted standard interactive control below 44px at mobile widths;
- no fixed overlay width wider than `100vw` minus its gutters;
- no `title`-only disclosure for essential information;
- no React ref warning from Dialog primitives;
- no new page-level overflow source.

#### Browser matrix — manual user-owned handoff

The user has explicitly disabled Playwright and agent-run browser automation because of RAM constraints. Do not launch a browser for this plan. Use this matrix for a later manual review in the project’s normal browser/devtools workflow; an unchecked item is deferred validation, not a source implementation failure.

For every route family and representative state:

| Viewport | Required review |
|---:|---|
| 320×800 | Smallest reflow, pill fitting, dialogs, alert actions, long labels |
| 375×812 | Common small-phone spacing and action reachability |
| 393×852 | Supplied phone reference, computed type and control dimensions |
| 402×874 | Larger phone reference and card/toolbar balance |
| 640×852 | Typography boundary only; must still behave as mobile |
| 700×852 | Explicit hybrid-regression check |
| 767×852 | Last mobile width |
| 768×852 | Exact shell handoff; no sidebar/content overlap |
| 852×393 | Landscape, fixed layers, dialog height, chart/table reflow |
| 1024×900 | Desktop sidebar and tablet alignment |
| 1440×900 | Desktop density and visual regression |

Automate where practical:

- assert `document.scrollWidth === document.clientWidth`;
- assert only allowlisted nested regions scroll horizontally;
- measure mobile target dimensions and verify exceptions by selector/role;
- inspect computed font sizes for body, control values, labels, tabs, and alerts;
- open each dialog/popover/lightbox and verify its bounds and reachable footer/close action;
- verify More menu dismissal, Escape, outside press, and focus return;
- run long labels, validation errors, empty/loading/error states, and every card status;
- repeat at 200% zoom, increased text spacing, reduced motion, keyboard navigation, and with the virtual keyboard/short viewport where available.

**Exit criteria for the agent run:** source/project gates pass and every source exception has a reason and accessible alternative. Runtime visual, computed-style, overflow, zoom, and assistive-technology confirmation remains manual handoff work.

### Phase 6 — Reconcile documentation and close the plan

**Priority:** P1

1. Update `docs/guide/typography-guidelines.md` to remove any test-only full-step scale and to state that `title` is supplementary, not the only disclosure path.
2. Update `docs/guide/ui-control-size-guidelines.md` with the 44px target-wrapper versus compact-visual distinction, equal status-pill fitting, and the nested-scroll allowlist.
3. Cross-reference `docs/refine/list-filter-unification-plan.md` so its three-status decision and this plan’s visual filter contract are not confused.
4. Keep `docs/refine/trends-mobile-chart-and-filter-plan.md`, table plans, and clickable-affordance plans as focused supporting documents; remove contradictory “implemented” claims if their work is still part of this plan.
5. Record the final source coverage, approved visualization exceptions, changed-file groups, test counts, and the browser-validation constraint. Record runtime evidence only when a human performs the manual matrix.
6. Change this document’s status to **Implemented in source** once source/project gates pass; keep the manual runtime matrix visibly separate from the implementation status.

## Ownership and delivery order

| Batch | Priority | Deliverable | Why this order |
|---|---|---|---|
| A | P0 | Type contract, 768px breakpoint, shell clearance, raw editable fields, tests | Prevents every screen from inheriting the wrong cascade or layout tier |
| B | P0/P1 | Button/Input/Select/Segmented/FilterBar/Switch/Dialog/overlay primitives | Removes duplicated local fixes and establishes measurable contracts |
| C | P1 | Incubators, Candling, Alerts, and Trends filter/toolbar migration | These are the repeated pill/control inconsistencies visible in the audit |
| D | P1 | Detail and Settings migration | These contain the densest operational controls and fixed/sticky layers |
| E | P1/P2 | Overview, Auth/Onboarding, chart/illustration exceptions, documentation | Closes lower-density surfaces after the shared rules are stable |
| F | P0 handoff | Manual runtime matrix, zoom/accessibility review, project gates | Keeps rendered sign-off explicit when agent-run browser validation is unavailable |

## Non-goals and guardrails

- Do not change incubation calculations, alert logic, status counts, routing, persistence, or API behavior.
- Do not create a second mobile-web component tree or modify `apps/mobile`.
- Do not globally shrink or enlarge every type/control value by a percentage.
- Do not turn every table into cards; keep list choice and data semantics intact.
- Do not remove information solely to make one screenshot look cleaner.
- Do not redesign the brand palette, card style, chart type, or navigation hierarchy in this remediation.
- Do not treat a passing source test as proof of rendered responsiveness.
- Keep SVG/chart numerics as exceptions only when they are non-DOM visualization geometry and the surrounding accessible information is available.

## Validation record — 2026-09-06

### Completed in source/project validation

- Shared responsive tokens, the locked `768px` behavior boundary, mobile bottom-navigation clearance, selective phone typography, and the compact 32/36/40px visual control scale are implemented.
- Shared buttons, inputs, selects, segmented controls, filters, switches, checkboxes, pagination, dialogs, popovers, More menu, HelpWidget, and lightbox use the documented visual-density and explicit-hit-area contracts.
- Incubators, Candling Logs, Alerts/Notification Center, Trends, Overview, incubator detail, Settings, and auth/onboarding callers were migrated. Status filters use the three-status vocabulary from the list-filter plan; Trends time horizons remain an analytics-specific segmented control.
- Long names, alert/safety copy, settings hints, device status, card content, and action labels have source-level wrapping/containment rules. Tables, carousels, local navigation, hatch history, and raw readings retain only the documented nested-scroll regions.
- Gauge, WaterDroplet, timeline, and chart geometry remain approved visualization exceptions. Their surrounding DOM labels and accessible names remain in the readable contract.

### Commands and results

```text
pnpm --filter eggcelerate-ui test -- --run  -> 29 files, 212 tests passed
pnpm --filter eggcelerate-ui typecheck      -> passed
pnpm --filter eggcelerate-ui build          -> passed
git --no-pager diff --check                 -> passed
```

### Deferred manual validation

The browser matrix below, `document.scrollWidth`/computed-style measurements, rendered target-size checks, 200% zoom, increased text spacing, reduced motion, keyboard/focus behavior, virtual-keyboard/short-viewport behavior, and desktop visual regression were not run by the agent. They remain the user-owned manual handoff because browser automation is intentionally disabled. Do not mark those items as passed from the source/project results above.

## Definition of done

- [x] The experimental all-token phone tiers and all 7/8px output are removed in source.
- [x] Phone body/control/label roles match the locked contract; editable fields use the 16px control-value role in source.
- [x] Mobile/desktop behavior changes align at 768px, with no authored 640–767px hybrid branch.
- [x] Primary mobile controls, segmented items, inputs/selects, checkboxes, switches, and icon actions use the compact source-level visual contract with explicit hit-area wrappers where appropriate.
- [x] Status filters are proportionate, readable, and equal-track/wrap/scroll intentionally across Incubators, Candling, Alerts, and Trends.
- [x] All route/state surfaces in the coverage table have been migrated or have a documented source exception.
- [x] Page-overflow sources are addressed in source; nested scrolling is contained to the documented allowlist.
- [x] Banners, tabs, timelines, gauges, charts, cards, tables, dialogs, popovers, More menu, HelpWidget, lightbox, and fixed navigation have source-level reflow/clearance contracts.
- [x] No mobile-critical action is intentionally hover-only; labels, focus, Escape, and screen-reader semantics are preserved in source.
- [x] Typecheck, tests, build, and diff checks pass.
- [ ] Runtime browser matrix, zoom, text-spacing, reduced-motion, assistive-technology, and desktop visual regression review — manual user-owned handoff; not run by the agent per the validation constraint.
- [x] Guides and supporting plans agree with the shipped source implementation, and this plan records the validation evidence and limitation.

## Implementation goal prompt

> Implement `docs/refine/mobile-responsive-remediation-plan.md` completely in `apps/web`. Start with Phase 0 and Phase 1, then normalize shared primitives before migrating screen callers. Preserve business behavior and desktop appearance. Use the locked 768px behavior breakpoint, selective phone type overrides, 44px mobile target wrappers, equal/wrapped/contained filter strategies, and the nested-overflow/fixed-layer allowlists. Update tests and documentation as each batch lands. Run the source/project gates and record their evidence. Do not use Playwright, browser automation, screenshot automation, or an agent-run browser check for this goal; leave the listed route/state, zoom, text-spacing, reduced-motion, keyboard, and desktop visual matrix as an explicit manual user-owned handoff rather than claiming it passed.
