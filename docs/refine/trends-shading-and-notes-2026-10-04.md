# Trends shading and bottom notes — October 4, 2026

The sparse historical chart now renders visible isolated reading points, faint
dashed connections across empty buckets, and a soft gradient below the trend.
Recorded solid segments and minimum/maximum bands still respect missing buckets.
The safe-range background is more visible. Aggregation, recorded values, and raw
CSV exports are unchanged.

The chart guide explains that dashed links and their soft shading are visual
estimates across gaps, not measured values. The guide follows the chart.
Following the user's clarification, the telemetry warning remains above the view
tabs and query status/retry messages remain above the chart. Only plain notes use
the bottom placement convention.

The Monitor telemetry preview note follows Environmental Summary. Hardware
preferences availability guidance follows the preferences. The standing placement
convention is recorded in [Screen notes](../guide/screen-note-guidelines.md).

Validation: 334 tests across 45 files passed with coverage gates. Type checking,
Biome lint, production build, and asset budgets passed. Browser inspection covered
393, 900, and 1440px Trends layouts and Monitor note placement. The mobile humidity
chart showed the dashed curve, markers and shading; no
page overflow was observed. Preview: `output/playwright/trends-shading-notes-393.png`.

M6 remains in progress; farm query/mutation extraction and remaining write/scale
work retain their existing scope.
