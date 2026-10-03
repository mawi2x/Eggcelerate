# Sizing findings by screen size

Date: 2026-10-03. Companion to the [complete sizing audit](README.md).

Follow-up October 4: [representative responsive QA completed](../responsive-qa-2026-10-04.md), with Trends header and toolbar wrapping fixes. The tables below retain the original findings; the follow-up records tested coverage and remaining M9 qualification.

This is a source-based responsive sizing review. It confirms declarations and breakpoint behavior; it does not claim that clipping, overflow or poor readability has been reproduced in a browser. Counts below are static source occurrences in the specified component/role, not counts of visible elements. Conditional rendering, inherited styles, parent visibility and CSS overrides prevent dividing the 537 source occurrences into three mutually exclusive runtime totals.

## Screen categories and actual boundaries

| Category used here | CSS viewport width | Project behavior |
| --- | --- | --- |
| Mobile | Below 768px | Mobile shell, navigation and `md:hidden`/`hidden md:*` variants. Compact general typography only through 639px. |
| Tablet | 768–1023px | `md:` layout and controls activate; filter-value token becomes 12px. |
| Desktop | 1024px and above | `lg:` rules activate; filter-value returns to the base 14px. |

Pixel equivalents assume the standard 16px initial font size. Tailwind's installed theme defines `sm: 40rem`, `md: 48rem`, `lg: 64rem`; no project breakpoint overrides were found. The JavaScript mobile hook uses 768px (`apps/web/src/app/components/ui/use-mobile.ts:3`). General typography uses `max-width:39.9375rem`, filters use `max-width:47.9375rem`, and tablet filter values use `48rem–63.9375rem` (`apps/web/src/styles/theme.css:367`, `:386`, `:393`). These rem media endpoints leave fractional-width boundary slivers; test immediately either side of each transition, not just whole-pixel device presets.

## Responsive token comparison

These are existing definitions, not proposed sizes. All values below are px equivalents at a 16px root. Role tokens may be overridden by a component's raw font size.

| Role/token | Mobile ≤639px | Wide mobile 640–767px | Tablet 768–1023px | Desktop ≥1024px |
| --- | --- | --- | --- | --- |
| `--type-page-title` | 20 | 24 | 24 | 24 |
| `--type-panel-title` | 18 | 22 | 22 | 22 |
| `--type-heading-sm` | 14 | 16 | 16 | 16 |
| `--type-body` | 12 | 14 | 14 | 14 |
| `--type-body-sm` | 11 | 13 | 13 | 13 |
| `--type-control-value` | 12 | 14 | 14 | 14 |
| `--type-caption` | 10 | 12 | 12 | 12 |
| `--type-label` | 9 | 11 | 11 | 11 |
| `--type-label-compact` | 8 | 10 | 10 | 10 |
| `--type-label-micro` | 8 | 9 | 9 | 9 |
| `--type-filter-value` | 10 | 10 | 12 | 14 |
| `--type-filter-label` | 10 | 10 | 11 | 11 |

Sources: `apps/web/src/styles/theme.css:8–31`, `:367–396`. The small-phone typography is explicitly user-approved in the source comment. Preserve that decision during token cleanup; any change to the scale is a separate design decision. Some older base comments still describe a previous mobile scale and should be updated to match the actual overrides.

## Mobile findings

| Size | Property | Component / role | File location | Source count | Finding and recommended token/action |
| --- | --- | --- | --- | ---: | --- |
| 14px; 10px | Font size | DeviceSettingsTab section titles/descriptions | `apps/web/src/app/components/detail/DeviceSettingsTab.tsx:195`, `:206`, `:414`, `:425`, `:582`, `:593` | 3 each | Raw mobile text switches to heading-sm/body-sm tokens at `md`. Heading-sm matches 14px on small phones but becomes 16px at 640px; body-sm is 11px, not 10px. Confirm desired wide-mobile behavior before token replacement. A mobile description role may be needed to preserve 10px through 767px. |
| 58px | Height | CandlingJournalTab compact cards | `apps/web/src/app/components/detail/CandlingJournalTab.tsx:1627`, `:2119` | 2 | Fixed height is replaced by `md:h-auto`. Review long labels on phones; propose a shared local compact-card height token, or min-height if expansion is intended. |
| 50px | Minimum height | LiveMonitorTab summary card | `apps/web/src/app/components/detail/LiveMonitorTab.tsx:52` | 1 | Changes to Tailwind `md:min-h-16` (64px). Treat as card geometry, not a control-height token; propose a component token only if reused. |
| 8px | Radius | OverviewScreen summary card | `apps/web/src/app/components/screens/OverviewScreen.tsx:244` | 1 | Changes to `--radius-dialog` at `md`. No exact 8px semantic radius was identified; decide whether compact cards intentionally need a separate radius role. |
| 44px | Minimum width/height | FilterBar scroll-arrow controls | `apps/web/src/app/components/ui/filter-bar.tsx:225`, `:276` | 4 | Mobile arrow wrappers are hidden at `md`. Replace minimum dimensions with existing `--control-hit-area-icon`; preserve the current hit area. |
| 296px (18.5rem) | Minimum width | Timeline track | `apps/web/src/app/components/detail/Timeline.tsx:114` | 1 | Existing parent explicitly allows horizontal scrolling. Review smallest phone widths; preserve the scroll behavior and use a local track-min-width token if needed. This is not evidence of page overflow. |

**Mobile priority:** inspect 320/375px and the 640–767px transition with long names, filter labels and modal content. General text grows at 640px while mobile filters remain 10px and several raw text sizes remain fixed until 768px. The difference is confirmed; whether it looks inconsistent needs visual verification.

## Tablet findings

`md:` rules apply to tablets **and continue onto desktop** unless replaced later. They should not be labeled desktop-only.

| Size | Property | Component / role | File location | Source count | Finding and recommended token/action |
| --- | --- | --- | --- | ---: | --- |
| 240px | Width | TrendsScreen incubator selectors, alternate branches | `apps/web/src/app/components/screens/TrendsScreen.tsx:719`, `:746` | 2 | Fixed widths activate at 768px. Test remaining row width beside other filters; propose `--trends-selector-width` if both branches share the intended role. These are alternative render paths, not necessarily two simultaneous controls. |
| 130px | Minimum width | IncubatorsScreen and CandlingLogsScreen filters | `apps/web/src/app/components/screens/IncubatorsScreen.tsx:446`, `:475`; `apps/web/src/app/components/screens/CandlingLogsScreen.tsx:573`, `:601` | 4 | Repeated tablet-and-up filter minimum. Consider a shared filter minimum-width token; do not substitute the 136px mobile pill token just because it is close. |
| 165px; 150px | Width | AlertsScreen filter / row metadata | `apps/web/src/app/components/screens/AlertsScreen.tsx:198`, `:449` | 1 each | Both activate at `md`, but represent different roles. Keep separate component tokens if centralized; inspect long metadata at 768px. |
| 180px | Width | DeviceSettingsTab field | `apps/web/src/app/components/detail/DeviceSettingsTab.tsx:281` | 1 | Full-width mobile field becomes fixed at `md`. Review alongside its label; use a component field-width token rather than a generic control-height token. |
| 420px | Height | TrendsScreen main chart | `apps/web/src/app/components/screens/TrendsScreen.tsx:1023` | 1 | Explicit tablet height between mobile 260px and desktop 440px. Strong candidate for a responsive chart-height token. |
| 28px minimum; 32px | Minimum height / width and height | FilterBar chips / dialog close button | `apps/web/src/app/components/ui/filter-bar.tsx:184`; `apps/web/src/app/components/ui/dialog.tsx:86` | 1 declaration per role | At `md`, chip min-height drops from 36px to 28px, and close button dimensions drop from 44px to 32px. Already token/framework-based; review touch interaction on tablets before assuming every `md` device has a mouse. Minimum height does not prove the final rendered height. |

**Tablet priority:** verify widths at 768px with the non-mobile shell, long labels and touch input. Consider distinguishing compact visual controls from touch target dimensions instead of basing both solely on viewport width.

## Desktop findings

| Size | Property | Component / role | File location | Source count | Finding and recommended token/action |
| --- | --- | --- | --- | ---: | --- |
| 440px | Height | TrendsScreen main chart | `apps/web/src/app/components/screens/TrendsScreen.tsx:1023` | 1 | `lg:h-[440px]` replaces tablet 420px. Propose one responsive `--trends-chart-height` role with 260/420/440px tiers. |
| 560px | Height | IncubatorsScreen and CandlingLogsScreen list viewports | `apps/web/src/app/components/screens/IncubatorsScreen.tsx:646`; `apps/web/src/app/components/screens/CandlingLogsScreen.tsx:768` | 2 | Repeated fixed scroll-container height, with no responsive modifier on these declarations. Candidate for a shared list viewport token; check short desktop/laptop windows. It is not desktop-exclusive. |
| 520px; 640px | Height / minimum width | TrendsScreen readings table container/table | `apps/web/src/app/components/screens/TrendsScreen.tsx:1561`, `:1562` | 1 each | Explicit scrolling and minimum table width. Keep chart and table viewport roles separate; consider viewport-aware height after checking short windows. Declarations themselves are not desktop-exclusive. |
| 1600px; 94vw | Maximum width / width | Dialog fullscreen variant | `apps/web/src/app/components/ui/dialog.tsx:58` | 1 each | Begins at `md`, so applies on tablets too. Consider `--dialog-width-fullscreen` for the cap; preserve viewport-relative width. Existing 400/600px dialog tokens represent different sizes. |
| 64px; 256px | Width constants | AppSidebar rail/panel | `apps/web/src/app/components/AppSidebar.tsx:384`, `:385` | 1 each | Already centralized as component constants. Keep local unless page layout or another component must share these dimensions. |

**Desktop priority:** consolidate repeated list and chart geometry, then inspect 1024/1280/1440px widths and short window heights. A large screen width does not guarantee enough vertical space for a 560px list plus headers.

## Shared across screen sizes

Before this cleanup, the base audit found 80 direct 1px border occurrences, 179 icon-size occurrences, and four StatusIconBadge numeric glyph definitions duplicating existing glyph tokens. These are source totals, not claims that every occurrence renders at every width. The current source keeps valid 1px borders while routing the repeated roles through tokens.

| Size | Property | Component / role | Location | Count | Recommendation |
| --- | --- | --- | --- | ---: | --- |
| 1px | Border width | Multiple screens and shared components | See [complete component tables](component-details.md) | 80 | Use `--border-width-hairline` for matching borders without changing thickness. |
| 12/18/36/22px | Icon glyph size | StatusIconBadge | `apps/web/src/app/components/StatusIconBadge.tsx` | 4 | Reuse `--status-icon-badge-glyph-sm/md/lg/banner`; account for callers requiring numeric values. |
| 3px | Focus ring width | Shared form controls and TrendsScreen | See [complete component tables](component-details.md) | 7 | Candidate `--focus-ring-width`; keep focus-ring sizing separate from normal borders. |

## Follow-up sequence

The following source changes are now implemented while preserving the existing computed values:

| Change | Result |
| --- | --- |
| Hairline borders | 80 direct `1px` border declarations now use existing `--border-width-hairline`. |
| Status badge glyphs | `StatusIconBadge` now returns the existing glyph CSS tokens for 12/18/36/22px roles. |
| Focus rings | Seven 3px focus-ring uses now reference `--focus-ring-width`. |
| Repeated geometry | Filter minimums, Trends chart tiers, list viewports, table width, mobile card heights, Timeline minimum width, Overview mobile radius and fullscreen dialog cap now have semantic tokens. |
| Mobile action controls | Matching 34px action buttons now use `--control-height-mobile`. |

Remaining work is visual validation and decisions that change behavior:

1. Resolve the intended 640–767px typography behavior and tablet touch sizing before changing responsive semantics.
2. Verify representative screens at 320, 375, 639, 640, 767, 768, 1023, 1024 and 1440px, plus fractional breakpoint edges. Include long labels, open dialogs, list view, empty/error states and short viewport heights.
3. Review whether the new semantic geometry tokens should be promoted into a documented component-token layer after visual approval.

The token implementation was typechecked, tested and production-built. Browser inspection confirmed CSS-token-backed status glyphs resolve to 12px in the running app; a full viewport matrix remains. Source snapshot consistency is checked by `python3 docs/refine/repro/verify-sizing-audit.py`.
