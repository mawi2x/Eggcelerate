# Phase 6 handoff — verification integrity

**Status:** complete. **Implementation commit:** `fc6e353` (`test: harden verification gates and UI behavior coverage`).
**Next:** Phase 7, frontend truthfulness and states.

## What changed

- Added the named `pnpm --filter eggcelerate-ui test:contract` gate. It requires
  `EGG_API_URL` to point at an HTTP loopback host because the shared contract mutates
  its farm. The API runner creates an isolated farm and now invokes that same script.
  The verification guide distinguishes the memory adapter tests from HTTP coverage.
- Removed the source-text UI tests. Real contracts now use rendered sign-in, filter,
  screen, mobile focus, accessible-section, and computed-style assertions. The Trends
  chart title was corrected to use the heading token its former test had only found
  elsewhere in the file.
- Expanded Vitest coverage to all seven screen modules and the rendered components used
  by those tests. Core floors are 90% lines, 88% functions, and 81% branches; the latest
  measured core result is 93.28%, 90.87%, and 83.06%, respectively. Separate screen and
  component floors avoid diluting the core gate. `coverage` also fails if a screen module
  is omitted from its report.
- Added a warning-as-error filter for Pydantic's
  `UnsupportedFieldAttributeWarning`. It exposed the alert routes' `Annotated` header
  alias; direct `Header(default=None, alias="Idempotency-Key")` parameters removed the
  warning. The remaining two warnings are dependency deprecations.
- Derived the Postgres incubator test's expected count from the seeded `MemoryStore`
  rather than pinning `13`.

## Verification

- `pnpm lint`, UI typecheck, and the full UI coverage run passed. The coverage run
  executed **222 tests across 27 files** and verified all seven screen modules.
- `pnpm --filter eggcelerate-ui build` passed. Vite still reports the existing main
  chunk above its 500 kB advisory limit (558.50 kB).
- API suite passed: **104 passed, 0 skipped, 2 dependency deprecation warnings**. Ruff
  check/format and mypy passed (36 source files).
- `verify_live_contract.py` passed the shared HTTP contract: **28/28**.
- `verify_migrations.py` passed fresh and populated upgrades.
- No test under `apps/web/src/tests` reads production source files for string pins.

## Limits and next work

These are jsdom behavior checks, not a real-browser visual regression run. The local
software and simulator path still does not qualify a physical electronics endpoint or
LAN reachability. Phase 7 should now address D1, D3–D7, WS-1…WS-6, and F1, F2, F5, F6
as listed in the execution plan. App-managed email/password authentication remains in
Phase 8.

See the [Phase 7 work and exit gate](project-review-execution-plan-2026-09-23.md#phase-7--frontend-truthfulness-and-states).
