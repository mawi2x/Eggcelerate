# Project preparation review — October 6, 2026

Reviewed the working tree based on `493f051` (`oct 4 frontend test`). Recent
changes are uncommitted. This is a local code and automated-check review; it is
not an Azure deployment, physical-device test, pilot acceptance, or fresh browser
qualification.

## Current position

M6 remains in progress. Trends and Incubators extraction is implemented, while
farm query/mutation separation, concurrency measurement, narrower database
transactions, and collection pagination remain open. M1–M5 delivery evidence is
historical; current failures must be resolved before claiming a passing candidate.
M7 operations, M8 physical devices, and M9 release acceptance remain open.

## Recent work now included in the checkpoint

- Shared branded empty states across notifications, incubators, candling,
  hatch history, modes and paired devices; unknown routes show a centered 404
  with an Overview action.
- Responsive hatch-history summary: up to three species per mobile carousel
  slide, shorter search text on mobile, and summary typography/figure emphasis.
- UI consistency refinements to dropdowns, segmented controls, status icons,
  battery segments, and chamber-status icons. Paired devices link to their
  incubator details.
- Candling photo picker offers Upload photo and a placeholder Open camera.
  Local file preparation shows loading feedback, with animated thumbnails;
  camera-guided egg framing remains unscheduled future work.
- Candling calendar summary removes the redundant date strip, shows current
  cycle guidance, and lists both candling checkpoints. Log moved to the journal
  heading; the mobile calendar control is 34 × 34 px; both actions use 12 px radii.
- Notes fields support content sizing and vertical manual resizing, bounded at
  40dvh. Browser behavior across all supported platforms is not freshly qualified.
- Profile photos accept JPG/PNG/WebP up to 2 MiB, center-crop to 256 × 256 px JPEG,
  preview in Account settings, and follow Save Changes/Discard. Removal restores
  initials. Saved photos appear in the sidebar. Preferences transport and API
  validation include the optional photo; migration `0016` adds persistence.

Profile photos are bounded embedded JPEG data in preferences, not a separate
image-storage service. Candling photo references/local preparation likewise do
not qualify production image storage, access control, or deletion lifecycle.

## Verification

| Check | October 6 result |
| --- | --- |
| Repository Biome | Passed; 240 files checked |
| Frontend TypeScript | Passed |
| Full frontend suite via coverage command | **347 passed, 7 failed**, 50 test files; coverage/scope completion is blocked by failed tests |
| Asset-report unit tests | Passed; 2 tests |
| Production Vite build | Passed, with >500 kB chunk warning |
| Asset budgets | **Failed**: initial JS 213,879 gzip bytes / 195,000 limit; total initial assets 624,017 bytes / 620,000 limit; entry chunk 524,173 bytes / 500,000 limit |
| API Ruff lint/format | Passed after the integration correction |
| API mypy | Passed; 45 source files |
| Fresh and populated migration upgrades | Passed through `0016` in verifier-created disposable databases |
| First required-database API run | **124 passed, 7 failed**, no skips; readiness and historical-fixture issues diagnosed below |
| Final required-database API run | **131 passed, zero skipped**, after readiness/historical-fixture corrections; 60.78 s |
| Historical cycle migration preservation rerun | Passed; 1 targeted test with the full preferences snapshot retained |
| Live API/frontend contract | **30 passed** after readiness correction; isolated startup 963 ms |

### Frontend failures to resolve

- Four Overview shortcut tests still expect `0 running · 0 idle`; current copy
  uses `0 running and 0 idle`. Confirm the intended wording and keep the tests
  checking the visible behavior.
- The day-25 device test expects `Overdue`; current timeline uses days-past-hatch
  wording. Confirm the intended status language and preserve usable checkpoints.
- Hatch-summary coverage expects one progress bar, but rendered markup has two.
  Investigate carousel visibility/accessibility and target the intended metric.
- History-error recovery test times out waiting for rendered UI. Treat this as
  unresolved recovery behavior until reproduced and corrected, not a wording fix.

### API integration correction discovered by this review

The new profile-photo migration exposed two missed integration updates:
readiness hard-coded `0015`, rejecting a database correctly upgraded to `0016`;
three populated historical migration fixtures inserted current photo metadata
into pre-0016 tables. Updated readiness to `0016` and reflected the historical
preferences table in those fixtures, filtering inserts to actual columns and
retaining prior-data preservation assertions. The first live contract failed
readiness; its rerun passed all 30 tests. The full required-database API rerun passed all 131 tests with no skips,
including profile-photo restart persistence and farm isolation. These are narrow corrections associated
with profile-photo support, not completion of remaining M6 database-write work.

## Preparation priorities

1. Restore the frontend regression/coverage baseline. Investigate the specific
   failing expectations and recovery timeout; verify intended behavior rather
   than weakening assertions or coverage thresholds.
2. Restore asset budgets through measured import/chunk changes. Do not raise
   limits merely to make the current build pass.
3. Retain the corrected API readiness/historical-fixture checks and require a
   passing full database/live-contract baseline. Preserve fresh migration and
   profile-photo persistence checks.
4. Correct M7 deployment documentation: root README still claims authentication
   is disabled although the production overlay forces sessions; the VPS handoff
   still says 15 schema revisions and must account for migration `0016`. Validate
   the runbook against the actual overlay, account provisioning, and HTTPS setup.
5. Resume M6 farm-hook separation and database-write/collection measurements once
   the candidate baseline is restored. The current transaction still locks the
   farm row and loads multiple collections before mutations.
6. Before M9, qualify recent UI flows in real browsers/mobile devices, including
   upload errors, preview/save/discard/removal, note resizing, empty-state actions,
   calendar access, and keyboard interactions. Set explicit production scope for
   candling image storage and provisional SMS/email delivery.
7. Continue M0 firmware/inventory discovery and M7/M8 environment work without
   treating simulator readiness as physical-device qualification.

## Review boundaries

The disposable test service was started for this review and stopped afterward;
its volume was retained. No production database or service was migrated. Database checks target only the
loopback disposable test service and verifier-created databases. No release,
GitHub runner/branch-protection verification, backup/restore drill, firmware
flash, hardware test, or VPS access was performed.

## Follow-up: frontend baseline restored

The later October 6 [frontend baseline repair](frontend-baseline-repair-2026-10-06.md)
resolved the seven stale frontend assertions and asset overruns. The final run
passed 356 tests, coverage/scope gates, lint, typecheck, production build, and all
asset budgets. The failed results above remain the initial review evidence;
they are superseded for current frontend status by that follow-up. M6 remains
in progress, with farm-hook and database-write/collection work still pending.
