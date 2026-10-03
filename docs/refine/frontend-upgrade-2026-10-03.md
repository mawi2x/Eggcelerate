# Frontend dependency upgrade — October 3, 2026

This batch upgrades the existing dashboard before M6. It preserves the API/data
model, the approved firmware plan, and the existing application libraries.
Evidence applies to the local working tree; nothing was deployed or committed.

## Versions and migration

| Package | Before | After |
| --- | --- | --- |
| React / React DOM | 18.3.1 | 19.3.0 |
| React / React DOM types | 18 | 19.3.0 |
| Vite | 6.3.5 | 8.3.2 |
| React Vite plugin | 4.7.0 | 6.1.1 |
| Tailwind CSS / Vite plugin | 4.1.12 | 4.3.3 |
| Vitest / V8 coverage provider | 3.2.7 | 5.0.3 |

Node 22.12+ within the supported 22/24/26+ release lines is declared in the root
package. Verification used Node 22.22.1 and pnpm 9.12.3. Existing Node 22 CI and
Docker build stages remain compatible. Linux glibc and musl native packages are
included for desktop/CI and Alpine builds respectively.

Vite now uses `build.rolldownOptions` and explicit vendor `codeSplitting` groups.
Configuration paths use `import.meta.dirname`. The module-size report, manifest,
and existing asset checker continue to work. The previous JavaScript compilation
targets are explicitly retained; this is not a claim of qualification on every
older browser. TypeScript explicitly includes Node types used by contract tests.

React 19 increased runtime size. Sign-in, registration, onboarding step 1 and
Alerts are now loaded on demand, with Suspense and recovery boundaries. Existing
dashboard recovery keeps its shell; authentication routes gain a recovery boundary.

## Loading measurements

| Measure | M5 checkpoint | Upgrade |
| --- | ---: | ---: |
| Main JS minified | 487,800 bytes | 429,477 bytes |
| Main JS gzip | 136,952 bytes | 119,537 bytes |
| Total initial JS gzip | 182,936 bytes | 188,185 bytes |
| Conservative total initial transfer | 591,150 bytes | 597,269 bytes |
| Largest JS chunk | 487,800 bytes | 436,752 bytes |

The original entry, initial JS/CSS/transfer and maximum-chunk limits remain intact.
Moving Alerts to a lazy route also moves its shared Select dependencies out of
the initial graph. Incubators incremental transfer is now 33,184 bytes and
Candling 22,756 bytes, so their route limits are rebased from 30,000 to 35,000
and 22,000 to 25,000 respectively. These costs include shared chunks only once
per cold route. This rebasing records the changed import graph rather than
charging those dependencies to the initial bundle. Other existing limits remain.
New route limits are 30,000 bytes for Alerts and 10,000 each for the three newly
split authentication screens. Actual costs: Alerts 13,204; sign-in 3,361;
registration 3,905; onboarding step 1 3,336 bytes.

## Verification

- Full frontend coverage gate: **327 tests across 42 files**, all seven screen
  modules present; existing coverage thresholds retained.
- **2 asset-report tests** and all production asset budgets pass.
- Frozen-lockfile installation, Biome lint, TypeScript, production build and
  whitespace checks pass.
- **30 live API/frontend contracts** pass against the disposable local database;
  migrated through `0015`, API readiness took approximately 1.2 seconds.
- An API-mode Alpine/Nginx Docker image builds successfully using the updated
  lockfile, native bindings, same-origin `/api`, and production URL guard.
- Firefox verifies direct mobile-width navigation to Alerts, sign-in, onboarding
  step 1, Settings, Incubators, Trends, Candling and chamber detail; no runtime
  errors or external asset requests. A blocked Settings chunk retains the shell
  and recovers via explicit retry, then navigation and browser Back work.
- The development server loads Settings successfully with React 19/Vite 8.

The newer coverage mapper counts executable statements/branches differently from
the previous runner. Both supported runner/provider comparisons reproduced the
change. Focused tests now cover cycle/connection cards, hardware states and tabs,
timeline milestones, authentication/cache clearing and failures, validated inputs,
profile fallbacks, legacy chamber sorting, idempotency fallbacks, sidebar controls,
dashboard conditions, and failed/confirmed pairing writes. No existing tests were
removed and no coverage floors were lowered. Coverage includes TS/TSX files
explicitly so Markdown is not parsed as executable code. The test helper supplies
jsdom's missing element `scrollTo`, as it already does for other layout APIs.

## Remaining work and rollback

M6 remains next: feature-module extraction and database-write maintainability and
scale measurements. M0 firmware source/full inventory, M7 Azure operations, M8
device integration and M9 pilot qualification remain open. The full API suite was
not rerun for this frontend-only batch; its latest evidence is the M4 checkpoint.
GitHub runner results, Azure deployment and physical ESP32 tests are unverified.

Rollback only this batch's dependency, lockfile, configuration, lazy import,
budget and regression-test changes while preserving prior M0–M5 work. Rebuild and
reload the dashboard; no database downgrade is needed. Local pre-upgrade package,
lockfile and built-asset snapshots are in ignored `output/upgrade-2026-10-03/`.
