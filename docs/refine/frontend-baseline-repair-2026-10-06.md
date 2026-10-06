# Frontend baseline repair — October 6, 2026

Working-tree follow-up to the [preparation review](project-preparation-review-2026-10-06.md),
based on `493f051`. Restores the frontend candidate gates before remaining M6 work.

## Causes and changes

The seven reported failures came from outdated checks following approved UI
changes. Four Overview cases still expected the old separator in the running/idle
copy. The timeline test expected “Overdue” instead of the more specific days-past-
hatch text. Updated those expectations while retaining shortcut/checkpoint behavior
checks.

Hatch-summary markup contains separately styled mobile and desktop species lists;
CSS hides one at each viewport, while jsdom queries both. The test now checks each
layout independently, including the one valid hatchability bar and the unavailable
fertility count for Duck. It no longer counts both responsive copies as one list.

The history recovery test successfully retried data but waited for “Completed
Cycles,” a removed label. It now verifies that unavailable totals are absent before
retry and that the hatch summary and records return afterward, with the retry
error removed. Recovery production logic did not require changes.

The bundle-size increase was dominated by the Font Awesome SVG runtime. The
application uses the official exclamation glyph without transforms, masks or
runtime icon-library registration. The shared component now renders the official
`faExclamation` path directly, preserving its viewBox, aspect ratio, theme color,
size and accessible naming. Incubator and Candling warnings use that shared
component. The official Font Awesome glyph remains in use; the SVG core and React
renderer no longer appear in the generated module report.

No asset limits or coverage thresholds were relaxed. Added checks for the official
icon path/proportions, sizing, decorative semantics, and a named standalone warning.

## Measurements

| Metric | Preparation review | After repair | Existing limit |
| --- | --- | --- | --- |
| Entry chunk, minified | 524,173 bytes | 430,210 bytes | 500,000 bytes per chunk |
| Initial JS, gzip | 213,879 bytes | 189,714 bytes | 195,000 bytes |
| Total initial assets | 624,017 bytes | 599,855 bytes | 620,000 bytes |
| Entry JS, gzip (asset guard) | 143,962 bytes | 119,797 bytes | 145,000 bytes |

Vite's own gzip reporting differs slightly from the asset guard's gzip calculation;
this table uses the guard for reproducible budget comparisons. Build completes
without the >500 kB chunk warning. All route and shared asset budgets pass.

## Verification

- Full frontend suite: **356 tests passed across 51 files**; 84.14 s.
- Coverage thresholds passed unchanged; scope gate covers all **23 screen and
  extracted feature modules**. Overall coverage: 84.52% statements, 77.76%
  branches, 84.15% functions, 86.42% lines. Thresholds are per-group/file, so these
  overall totals should not be compared to a single group floor.
- Repository Biome and web TypeScript passed.
- Production build and all asset budgets passed, without a large-chunk warning.
- Asset-report unit tests passed earlier in the preparation review; the guard
  implementation did not change in this batch.
- Recovery/icon focused run: 15 tests passed before the final full coverage run.
- `git diff --check` passed.

Browser smoke checks used local mock-mode Chromium at 1440 × 900 and 393 × 852:
Incubators battery warnings and Candling “To Log” badges render the official glyph;
no console errors were reported. Candling mobile has no horizontal page overflow.
Screenshots were inspected under `output/playwright/baseline-{incubators,candling}-{desktop,mobile}.png`.
This is focused browser QA, not full cross-browser or physical-device qualification.

## Next action

Resume M6 farm query/mutation separation and narrower database-write/collection
measurements after the final candidate gates pass. M7 deployment/runbook work and
M8/M9 external qualification remain open. The passing API/database/live-contract
results in the preparation review remain historical evidence; this frontend batch
does not change API behavior or migrations.
