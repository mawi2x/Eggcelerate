# Frontend sizing and token audit — 2026-10-03

The source contains **409 direct pixel authoring occurrences, covering 69 distinct values**. These include numeric React dimensions as well as explicit `px` strings. **56 files contain direct sizes** when rem, relative sizes, line-height ratios and SVG strokes are included. This pass also applies role-preserving tokens to repeated frontend dimensions.

See the [mobile, tablet and desktop findings](screen-size-findings.md) for the responsive breakdown.

## Implementation status

The responsive sizing cleanup now uses existing or newly named semantic roles while preserving the previous values: 80 hairline borders use `--border-width-hairline`; StatusIconBadge glyphs use the existing 12/18/36/22px glyph tokens; seven 3px focus rings use `--focus-ring-width`; repeated filter, chart, list, table, card, Timeline and dialog dimensions use shared tokens; and matching 34px action buttons use `--control-height-mobile`. The 640–767px typography behavior remains unchanged because the project documentation marks that tier as intentional. Browser checks confirmed the mobile, tablet and desktop token values resolve as expected.

## Scope and counting

Scanned 159 authored CSS, TS/TSX, JS/JSX, HTML and SVG files under `apps`, excluding tests, dependencies, build output and hardware schematics. Counts measure source declarations/literals, not rendered elements, runtime frequency or reachable-component usage. A default is counted once where authored, even if reused many times. Components are grouped by file; nested helpers have an owner field where available.

CSS token definitions, arbitrary responsive breakpoints and asset canvases are excluded from the main ranking. A multi-length declaration counts each numeric length; zero without a unit does not need a token. Relative units and direct rem remain separate rather than pretending they are pixels. rem equivalence in recommendations assumes a 16px root. Percentages in color mixtures and sensor messages are excluded. SVG paths/viewBoxes and arithmetic multipliers are not CSS sizing occurrences. Computed geometry is not evaluated; for example Timeline's numeric interpolation coefficients are excluded, while its literal `38px` clamps are counted. This is a static literal audit, not a computed-style census.

## Most-used raw pixel values

Project counts cover every property; each example token recommendation applies only to that example's role. See the complete component tables for every location and property.

| Size | Count (project) | Properties | Example component | Example location | Recommendation for example |
| --- | --- | --- | --- | --- | --- |
| 16px | 51 | font size, height, icon size, spacing/position | components/AppSidebar | apps/web/src/app/components/AppSidebar.tsx:416 | No general icon-glyph scale; propose --icon-size-* by role (status badge glyph tokens only for badge glyphs) |
| 15px | 38 | icon size | components/IncubatorCard | apps/web/src/app/components/IncubatorCard.tsx:58 | No general icon-glyph scale; propose --icon-size-* by role (status badge glyph tokens only for badge glyphs) |
| 14px | 34 | font size, icon size | components/IncubatorCard | apps/web/src/app/components/IncubatorCard.tsx:419 | No general icon-glyph scale; propose --icon-size-* by role (status badge glyph tokens only for badge glyphs) |
| 18px | 29 | font size, height, icon size, spacing/position, width | components/AppSidebar | apps/web/src/app/components/AppSidebar.tsx:334 | No general icon-glyph scale; propose --icon-size-* by role (status badge glyph tokens only for badge glyphs) |
| 2px | 27 | border width, font size, shadow geometry, spacing/position | components/HarvestModal | apps/web/src/app/components/HarvestModal.tsx:98 | No project spacing scale; prefer matching Tailwind spacing or propose --space-*; preserve positional geometry |
| 10px | 19 | font size, icon size, spacing/position | components/IncubatorCard | apps/web/src/app/components/IncubatorCard.tsx:668 | No project spacing scale; prefer matching Tailwind spacing or propose --space-*; preserve positional geometry |
| 4px | 15 | border width, spacing/position, width | components/IncubatorCard | apps/web/src/app/components/IncubatorCard.tsx:495 | No project spacing scale; prefer matching Tailwind spacing or propose --space-*; preserve positional geometry |
| 12px | 14 | border radius, font size, height, icon size, spacing/position, width | components/IncubatorCard | apps/web/src/app/components/IncubatorCard.tsx:255 | --type-caption; role + responsive review |
| 11px | 13 | font size, height, icon size, spacing/position, width | components/IncubatorCard | apps/web/src/app/components/IncubatorCard.tsx:526 | --type-label; role + responsive review |
| 8px | 12 | filter geometry, height, shadow geometry, spacing/position, width | components/AppSidebar | apps/web/src/app/components/AppSidebar.tsx:566 | No exact role token; evaluate a component token if repeated |
| 1px | 11 | filter geometry, font size, height, spacing/position | components/WaterDroplet | apps/web/src/app/components/WaterDroplet.tsx:97 | No project spacing scale; prefer matching Tailwind spacing or propose --space-*; preserve positional geometry |
| 13px | 11 | height, icon size | components/detail/CandlingJournalTab | apps/web/src/app/components/detail/CandlingJournalTab.tsx:887 | No general icon-glyph scale; propose --icon-size-* by role (status badge glyph tokens only for badge glyphs) |
| 20px | 11 | icon size, spacing/position | components/AppSidebar | apps/web/src/app/components/AppSidebar.tsx:165 | No general icon-glyph scale; propose --icon-size-* by role (status badge glyph tokens only for badge glyphs) |
| 24px | 10 | icon size, spacing/position | App | apps/web/src/app/App.tsx:663 | No project spacing scale; prefer matching Tailwind spacing or propose --space-*; preserve positional geometry |
| 22px | 7 | height, icon size, spacing/position, width | components/AlertBanner | apps/web/src/app/components/AlertBanner.tsx:81 | No general icon-glyph scale; propose --icon-size-* by role (status badge glyph tokens only for badge glyphs) |

## Least-used raw pixel values

Every value below appears once project-wide. Rarity alone does not justify a new token: artwork dimensions, one-off layout constraints and chart geometry can remain component-specific.

| Size | Count (project) | Properties | Example component | Example location | Recommendation for example |
| --- | --- | --- | --- | --- | --- |
| -2px | 1 | spacing/position | components/ui/switch | apps/web/src/app/components/ui/switch.tsx:27 | No project spacing scale; prefer matching Tailwind spacing or propose --space-*; preserve positional geometry |
| -10px | 1 | width | components/screens/OverviewScreen | apps/web/src/app/components/screens/OverviewScreen.tsx:641 | No exact role token; evaluate a component token if repeated |
| -14px | 1 | spacing/position | components/AppSidebar | apps/web/src/app/components/AppSidebar.tsx:402 | No project spacing scale; prefer matching Tailwind spacing or propose --space-*; preserve positional geometry |
| 5px | 1 | spacing/position | components/UtilityHeader | apps/web/src/app/components/UtilityHeader.tsx:34 | No project spacing scale; prefer matching Tailwind spacing or propose --space-*; preserve positional geometry |
| 27px | 1 | background geometry | components/screens/CandlingLogsScreen | apps/web/src/app/components/screens/CandlingLogsScreen.tsx:259 | No exact role token; evaluate a component token if repeated |
| 30px | 1 | icon size | components/UtilityHeader | apps/web/src/app/components/UtilityHeader.tsx:25 | No general icon-glyph scale; propose --icon-size-* by role (status badge glyph tokens only for badge glyphs) |
| 34px | 1 | height | components/detail/Timeline | apps/web/src/app/components/detail/Timeline.tsx:167 | --control-height-mobile; only for matching control role |
| 48px | 1 | icon size | components/detail/PhotoLightbox | apps/web/src/app/components/detail/PhotoLightbox.tsx:401 | No general icon-glyph scale; propose --icon-size-* by role (status badge glyph tokens only for badge glyphs) |
| 54px | 1 | width | components/detail/PhotoLightbox | apps/web/src/app/components/detail/PhotoLightbox.tsx:441 | No exact role token; evaluate a component token if repeated |
| 64px | 1 | width | components/AppSidebar | apps/web/src/app/components/AppSidebar.tsx:384 | No exact role token; evaluate a component token if repeated |
| 70px | 1 | icon size | components/screens/OverviewScreen | apps/web/src/app/components/screens/OverviewScreen.tsx:233 | No general icon-glyph scale; propose --icon-size-* by role (status badge glyph tokens only for badge glyphs) |
| 76px | 1 | width | components/detail/Timeline | apps/web/src/app/components/detail/Timeline.tsx:376 | No exact role token; evaluate a component token if repeated |
| 80px | 1 | width | components/detail/Timeline | apps/web/src/app/components/detail/Timeline.tsx:201 | No exact role token; evaluate a component token if repeated |
| 88px | 1 | width | components/detail/Timeline | apps/web/src/app/components/detail/Timeline.tsx:294 | No exact role token; evaluate a component token if repeated |
| 110px | 1 | width | components/detail/DeviceSettingsTab | apps/web/src/app/components/detail/DeviceSettingsTab.tsx:509 | No exact role token; evaluate a component token if repeated |
| 116px | 1 | height | components/screens/CandlingLogsScreen | apps/web/src/app/components/screens/CandlingLogsScreen.tsx:253 | No exact role token; evaluate a component token if repeated |
| 118px | 1 | width | components/detail/IncubationCalendar | apps/web/src/app/components/detail/IncubationCalendar.tsx:283 | No exact role token; evaluate a component token if repeated |
| 165px | 1 | width | components/screens/AlertsScreen | apps/web/src/app/components/screens/AlertsScreen.tsx:198 | No exact role token; evaluate a component token if repeated |
| 176px | 1 | icon size | components/GaugeDial | apps/web/src/app/components/GaugeDial.tsx:41 | No general icon-glyph scale; propose --icon-size-* by role (status badge glyph tokens only for badge glyphs) |
| 190px | 1 | width | components/screens/CandlingLogsScreen | apps/web/src/app/components/screens/CandlingLogsScreen.tsx:838 | No exact role token; evaluate a component token if repeated |
| 196px | 1 | width | components/screens/TrendsScreen | apps/web/src/app/components/screens/TrendsScreen.tsx:282 | No exact role token; evaluate a component token if repeated |
| 220px | 1 | width | components/screens/TrendsScreen | apps/web/src/app/components/screens/TrendsScreen.tsx:1281 | No exact role token; evaluate a component token if repeated |
| 256px | 1 | width | components/AppSidebar | apps/web/src/app/components/AppSidebar.tsx:385 | No exact role token; evaluate a component token if repeated |
| 280px | 1 | width | components/screens/TrendsScreen | apps/web/src/app/components/screens/TrendsScreen.tsx:245 | No exact role token; evaluate a component token if repeated |
| 320px | 1 | width | components/ToastStack | apps/web/src/app/components/ToastStack.tsx:76 | No exact role token; evaluate a component token if repeated |
| 340px | 1 | width | components/alerts/NotificationPopover | apps/web/src/app/components/alerts/NotificationPopover.tsx:90 | No exact role token; evaluate a component token if repeated |
| 380px | 1 | height | components/alerts/NotificationPopover | apps/web/src/app/components/alerts/NotificationPopover.tsx:164 | No exact role token; evaluate a component token if repeated |
| 400px | 1 | height | components/detail/PhotoLightbox | apps/web/src/app/components/detail/PhotoLightbox.tsx:38 | No exact role token; evaluate a component token if repeated |
| 999px | 1 | border radius | components/detail/IncubationCalendar | apps/web/src/app/components/detail/IncubationCalendar.tsx:447 | No exact radius token; review radius role |

## Where to start

| Component | Raw pixel count | Most common sizes | Locally rare sizes |
| --- | --- | --- | --- |
| components/detail/CandlingJournalTab | 46 | 2px × 6; 15px × 5; 1px × 4; 13px × 4 | 8px, 9px, 11px, 12px, 20px |
| components/detail/Timeline | 33 | 2px × 7; 10px × 5; 58px × 4; 8px × 3 | 1.5px, 12px, 13px, 34px, 72px, 76px, 80px, 88px |
| components/IncubatorCard | 27 | 15px × 11; 12px × 5; 2px × 2; 16px × 2 | 4px, 6px, 10px, 11px, 14px, 18px, 22px |
| components/AppSidebar | 24 | 20px × 7; 18px × 5; 16px × 4; 7px × 2 | -14px, 1.5px, 64px, 256px |
| components/detail/IncubationCalendar | 23 | 11px × 8; 1px × 4; 15px × 2; 28px × 2 | 7px, 9px, 44px, 118px, 999px |
| components/screens/CandlingLogsScreen | 23 | 16px × 3; 2.5px × 2; 4px × 2; 12px × 2 | 10px, 14px, 24px, 27px, 28px, 40px, 116px, 190px |
| components/screens/TrendsScreen | 21 | 4px × 3; 16px × 3; 8px × 2; 2px × 1 | 2px, 10px, 12px, 18px, 22px, 24px, 40px, 72px, 150px, 196px, 200px, 220px, 280px |
| components/alerts/NotificationPopover | 20 | -4px × 2; -6px × 2; 18px × 2; 22px × 2 | 2px, 4px, 10px, 14px, 15px, 17px, 20px, 26px, 340px, 380px |

[All components: most-common and locally rare values](component-summary.md). “Locally rare” means one occurrence in that file, even if common elsewhere. [Complete size/property/component/location/count/token table](component-details.md) covers all direct units and all component files; [CSV version](component-sizes.csv) is suitable for filtering.

## Existing tokens and proposed additions

Match the semantic role before replacing a number. Existing typography changes on phones; a desktop numerical match can alter mobile behavior. In particular `--type-body-lg` belongs to banner descriptions, not arbitrary 15px text. Glyph dimensions and control hit areas are separate roles.

| Size | Property | Component/role | Example file location | Count | Recommended token |
| --- | --- | --- | --- | --- | --- |
| 34px | min-height | Mobile control heights | apps/web/src/app/components/detail/Timeline.tsx:167 | 1 | --control-height-mobile after confirming each control role. |
| 18px, 16px, 15px, 14px | size | General icon glyphs | apps/web/src/app/components/AppSidebar.tsx:334 | 133 | Propose --icon-size-sm/default/md by role; rationalize 14/15/16/18px only after visual review. |
| 2px | border | Strong borders | apps/web/src/app/components/UtilityHeader.tsx:39 | 7 | Propose --border-width-strong: 2px; review decorative nodes separately. |
| 58px | top | Timeline geometry | apps/web/src/app/components/detail/Timeline.tsx:121 | 4 | Propose local --timeline-track-offset: 58px; synchronize dependent timeline geometry. |

For spacing, use the existing Tailwind scale when the intended spacing matches it. Introduce project `--space-*` primitives only if a shared spacing vocabulary is needed across CSS and React; avoid creating one token for every number. Preserve special positions until their layout dependencies are reviewed. Shadows should map to a complete existing `--shadow-*` recipe rather than tokenizing each offset. Local shell widths such as the sidebar's 64/256px constants are already centralized within that component; promote them only if another layout depends on them.

## Token definitions versus component hardcodes

| Inventory | Count | Interpretation |
| --- | --- | --- |
| Direct raw px | 409 | Component uses/defaults/constants; main ranking |
| Direct rem | 23 | Hardcoded lengths, separately counted |
| Unitless line heights | 24 | Compare --leading-* by role |
| SVG stroke values | 41 | Vector units, not CSS pixels |
| Token sizing literals | 122 | Expected authoring inside token definitions |
| All CSS custom-property declarations | 355 | Includes colors, aliases and responsive overrides |
| All custom-property references | 3310 | Includes color references and token-to-token aliases; not a sizing adoption percentage |
| Recognized framework scale utilities | 2253 | Static Tailwind references; separate from arbitrary hardcodes |
| Breakpoint literals | 25 | Responsive conditions, excluded from component-size rank |
| Intrinsic asset dimensions | 48 | Asset canvases, excluded from component-size rank |

[Token declarations](token-definitions.csv) include exact values, selectors/media contexts and locations, so base and phone overrides remain distinguishable. Token authoring is expected and is not itself a bypass. [Token references](token-references.csv) and [framework-scale utilities](tailwind-scale-usage.csv) show the current reuse. Built-in Tailwind scale classes use framework tokens; they are not raw `px` literals, though they may still bypass a project semantic role. Exact CSS-variable references are counted lexically, not as distinct rendered uses.

## Verification and reproducibility

Run from the repository root:

```sh
node docs/refine/repro/sizing-audit.mjs
python3 docs/refine/repro/verify-sizing-audit.py
```

Verification passed: all 159 source hashes match, all ranking/component totals reconcile, locations match source excerpts, representative defaults/badge glyphs/arbitrary dimensions are classified correctly, and no review candidates remain unresolved. Numeric JSX sizes are extracted with the TypeScript AST; CSS declarations use PostCSS. Frontend typecheck, tests and production build passed after the token changes.

The [manifest](manifest.json) freezes the inspected source hashes. Rerun after frontend edits; line numbers and counts describe this snapshot. [Every occurrence](occurrences.csv) retains its bucket, unit, property, component, helper owner, source excerpt and recommendation. [Full pixel ranking](pixel-ranking.csv) includes all 69 values. Recommendations are candidates for a subsequent visual refactor, not claims that equal numeric values are interchangeable.
