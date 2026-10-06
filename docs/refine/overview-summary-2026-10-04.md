# Overview daily summary — 2026-10-04

User-approved scope: adapt only the highlighted top summary from the desktop and
mobile references. The greeting/header and the lower Active Incubators and
Conditions to Check layouts retain their existing structure.

The four separate KPI cards are replaced by one charcoal Today panel with a
daily sentence, Start checks action and four statistics. Statistics use two
columns below 1024px and four columns from 1024px. They display incubator count,
running/idle counts, eggs loaded, next hatch/chamber and unread alerts/critical
alerts. Values come from the application data; screenshot values are not fixtures.
Unread alerts use the same notification collection as the header bell.

Start checks opens a due hatch first, then the first chamber needing attention;
when neither exists it opens the incubator list. Idle and unpaired chambers do
not populate Next hatch; an empty or idle farm shows an em dash and No active
cycles.

`OverviewSummary.tsx` owns the presentation. Five `--overview-summary-*` aliases
in `theme.css` reuse the existing toast charcoal/text, brand palette and overlay
divider. The accent is a CSS mix of the existing primary and soft brand colors.
Typography, radius and control geometry reuse existing semantic tokens. There
are no new raw colors or dependencies.

Follow-up: Start checks uses `--control-height-mobile` (34px) for both height and
maximum height below 768px, and `--control-height-default` (36px) from 768px.
Vertical padding is zero so it does not inflate the button. On mobile viewports
below 768px, the button is right-aligned (`self-end`), resetting to `md:self-auto`
in the desktop row layout. Browser measurements at 375px and 900px confirmed 34px and 36px respectively; component lint passed.

The Today sentence uses `text-wrap: balance` to reduce orphaned endings at narrow
widths without fixed line breaks. The hatch and offline clauses wrap as short
inline groups, keeping their counts with their descriptions while still allowing
internal wrapping if a group exceeds the available width.
Browser checks at 320/393/768/1440px passed
without overflow; the 393px screenshot was visually inspected.

Validation:

- Full frontend coverage suite: 333 tests passed in 45 files; all coverage gates passed.
- Targeted overview/control/screen tests: 12 passed; new checks cover actual
  unread counts, due-hatch navigation and idle/empty-farm behavior.
- Lint, frontend typecheck, production build and asset budgets passed.
- Playwright Chromium checks at 320, 375, 639, 767, 768, 900, 1023, 1024 and
  1440px: no page/tile overflow or page errors; expected two/four columns.
- At 375px with 200% root text size: no page or summary overflow.
- Measured summary text contrast: primary 15.98:1, accent 5.85:1, secondary
  9.90:1. Mobile and desktop screenshots were visually inspected.
- Reproduction: `repro/overview-summary-qa.js`; screenshots in ignored
  `output/playwright/overview-summary-{375,900,1440}.png`.

The work follows checkpoint `493f051` and remains in the working tree with the
M6 extraction batches. Farm hook extraction remains the next M6 task.

Follow-up: Today now uses a wrapping text/action row with two columns at 360px and
wider when space permits, placing Start checks beside the smart-wrapped sentence.
Below 360px or with enlarged text it stacks for readability. Existing tokens and
the 34px mobile button height are preserved.
Browser checks at 320/360/393/768/900/1440px passed without page overflow; the 393px
preview was visually inspected. At 393px with 200% root text size, summary overflow
and text/action overlap checks passed. Lint and frontend typecheck passed.
Preview: `output/playwright/overview-two-columns-393.png`.

Palette follow-up: the Today panel now uses the existing warm cream
`--surface-muted` (#F5EDD8), primary/secondary text, rust `--brand-primary`
accents and `--border-default` dividers through the summary aliases. This
replaces the original charcoal palette. Mobile (393px) and desktop (1440px)
browser previews were visually checked; lint passed.

Emphasis follow-up: the cream panel blended into the page, so it now uses
`--brand-primary-soft` peach, a translucent rust border/dividers, and
`--shadow-accent`. Start checks uses the filled rust brand style with white
text and the existing hover token. Mobile and desktop browser checks confirmed
the peach background and no horizontal overflow.

Visual follow-up: removed the Today panel shadow at the user's request; the
peach fill, rust border and filled action remain.

Active card follow-up: `ActiveIncubatorCard.tsx` is shared by the mobile
carousel and desktop grid. Offline cards use a neutral badge, a dimmed full
ring with a small wifi-off icon, and a last-seen label instead of a percentage.
The label uses server receipt time (`telemetryReceivedAt`, falling back to
`telemetryLastSeenAt`); absent/invalid dates show Last seen unavailable.
Overdue days use amber text; fresh progress uses green and stale progress amber.
The complete mode name is available through its title tooltip and accessible
description. Ring geometry and reserved status/footer slots keep state changes
from changing card height. Carousel widths, pagination and fonts are retained.
Four focused tests passed, along with typecheck/lint and browser checks at
393px and 1440px for equal card heights and hidden offline percentages.

Day-label follow-up: restored the neutral Day X of Y label for all batches,
including days beyond the planned duration, as requested by the user.

Badge follow-up: removed the Offline badges from the shared active card at
the user's request. The neutral wifi-off ring and last-seen label remain;
live/stale indicators are retained. The reserved status row prevents resizing.

Offline-copy follow-up: missing or invalid last-seen timestamps now display
Offline below the ring. Available timestamps still display the last-seen age.

Control follow-up: View All Incubators now uses the same 34px mobile / 36px
desktop control-height tokens as Start checks. Removed its 44px desktop
minimum and vertical padding; retained the existing outlined styling.

Header follow-up: the entire Active Incubators title/subtitle/action row now
uses the 36px desktop height token (34px mobile). Desktop title/subtitle line
heights are 20px/16px with no extra gap, so both lines fit inside the row.

Conditions to Check uses the same header geometry: 36px desktop / 34px mobile,
with the same title/subtitle line heights and no extra gap.

Action typography follow-up: Start checks, View All Incubators, Add Incubator,
Finish Cycle and Configure now use `--type-button-label` (14px desktop /
12px below 768px) and `--leading-button` (1.25). Existing weights are retained
for action hierarchy. All five use 36px desktop / 34px mobile control heights.
Previously labels mixed body, caption and filter sizes, with 1.25, 1.5 and
inherited utility line heights. Browser assertions at 402/640/768/1164px verified
font sizes, line heights, button heights and no page overflow.
