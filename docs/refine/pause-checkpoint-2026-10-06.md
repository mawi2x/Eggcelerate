# Pause checkpoint — October 6, 2026

Paused at the user's request to focus on academic papers. Resume only when asked.

Checkpoint tag: `checkpoint-2026-10-06-papers` on `experiment`.
This local checkpoint preserves the complete current tracked/untracked source,
configuration and documentation changes since `493f051`. It has not been pushed
or deployed. Ignored local environment files, build/coverage output and browser
artifacts are not part of the commit.

## State at pause

- M6 is in progress. Trends and Incubators extraction plus recent UI refinements
  are saved, including empty states/404, candling photo actions/loading, calendar
  and notes improvements, settings links/controls, and profile-photo upload.
- Profile photos are limited to 2 MiB JPG/PNG/WebP and prepared as 256 × 256 JPEG.
  Migration `0016`, API readiness correction and historical migration fixtures
  are included. Production databases have not been upgraded by this work.
- Frontend baseline restored: 356 tests across 51 files, unchanged coverage
  thresholds, 23-module coverage scope, lint, typecheck, build and asset budgets
  passed. Official Font Awesome exclamation paths are retained without the
  heavyweight runtime renderer.
- Entry chunk: 430,210 bytes; initial JS: 189,714 gzip bytes; total initial assets:
  599,855 bytes. All existing asset budgets pass.
- Earlier in this checkpoint, the required-database API suite passed 131 tests
  with zero skips; the live contract passed 30 tests; fresh/populated migration
  upgrades passed. Backend lint/format and mypy passed.
- Focused desktop/mobile Chromium checks covered warning glyphs in Incubators
  and Candling. Broader browser, operator and hardware qualification remains open.
- The review's disposable test database was stopped; its volume was retained.
  The task-specific browser session was closed. Existing preview services remain.

## Resume here

Read `ROADMAP.md` and the linked preparation/baseline-repair reports. Next planned
implementation is M6 farm query/mutation separation, then narrower database writes,
concurrency measurements and collection pagination. Preserve the passing gates.

M0 firmware/inventory discovery, M7 deployment/runbook corrections, M8 physical
qualification, and M9 release acceptance remain open. Guided candling camera is
still a placeholder/future capability; production candling image storage and
SMS/email delivery scope remain undecided. No release or deployment is approved
by this checkpoint.

Evidence:

- [Roadmap](../../ROADMAP.md)
- [Preparation review](project-preparation-review-2026-10-06.md)
- [Frontend baseline repair](frontend-baseline-repair-2026-10-06.md)
