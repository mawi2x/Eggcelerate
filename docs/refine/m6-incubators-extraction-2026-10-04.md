# M6 frontend batch — Incubators extraction

Date: 2026-10-04. Checkpoint: `493f051` (`oct 4 frontend test`) on `experiment`.
This extraction follows the Trends batch in the working tree. The Incubators
batch is complete locally; the full M6 milestone remains in progress.

## Responsibilities and state ownership

`IncubatorsScreen.tsx` now composes the toolbar, chamber list, creation dialog and
existing harvest modal (77 lines, previously 995). The existing UI markup,
selectors, creation payload and harvest contract are preserved.

| Module under `components/incubators/` | Responsibility |
| --- | --- |
| `IncubatorToolbar.tsx` | Search, view toggle, status/mode filters, sort and Add action |
| `ChamberList.tsx` | Empty state, card grid, mobile chamber index, table and pagination |
| `CreateIncubatorDialog.tsx` | Pairing fields, inline error, busy state and dialog controls |
| `useIncubatorList.ts` | Search/filter/sort/view/page state, selectors and mobile scroll/focus behavior |
| `useCreateIncubator.ts` | Persistent form draft, validation, duplicate detection, creation payload and confirmed-close behavior |
| `useIncubatorHarvest.ts` | Harvest selection, fertility validation, cycle completion and success feedback |
| `presentation.ts` | Existing tokens and sort options shared by the panels |

All three state hooks are called at screen level. Opening or closing creation
does not remount the list model. Grid/list switches preserve pagination and
filters. A failed creation keeps the draft and dialog open; a successful one
clears the draft and closes. Dialog controls remain locked during the local
pending write. Cancelled form drafts retain the existing reopen behavior.

The harvest hook still delegates persistence to `useCycleHistoryActions`, which
keeps the existing idempotency key and cache invalidation. The harvest modal closes
only after confirmed completion. Domain validation and repository coordination
remain in their established modules. No dependency, transport or database changes
were required.

## Validation

- `pnpm coverage:web`: **331 tests passed across 44 files**; coverage thresholds
  passed. Existing screen thresholds also cover the extracted Incubators modules.
  The scope verifier includes all seven screens, six Trends modules and seven
  Incubators modules.
- Three new rendered tests cover list selections/pagination across view and dialog
  changes, empty-filter recovery and table navigation; pending creation lock and
  draft retention after failure/cancellation; and actual in-memory harvest history
  persistence with the chamber reset to Ready.
- Existing pairing validation/retry/confirmed-close and mobile chamber scroll/focus
  tests passed in the full suite. During test development, the new harvest assertion
  omitted the repository retry-key argument; the assertion was corrected before
  the passing full run.
- `pnpm lint`, `pnpm typecheck:web`, `pnpm build:web` and
  `pnpm --filter eggcelerate-ui check:assets`: passed.
- Playwright Chromium: **11 cases** at 320, 768, 900 and 1440px with 480px height.
  Grid, available list views and Add dialog passed without page overflow, page
  errors or dialog bounds failures. Screenshots for the narrow dialog and tablet
  table were visually inspected. Reproduction: `repro/m6-incubators-qa.js`;
  screenshots: ignored `output/playwright/m6-incubators-*`.

These checks use local fixture data and in-memory persistence. The earlier sizing
audit remains historical after file extraction. Azure deployment, physical-device
pairing and broader M9 operator/cross-browser qualification remain open.

## Next

Split farm query coordination from alert, mode, cycle and command mutations.
Concurrency measurements, operation policy, resource-specific transactions,
growing-collection pagination and other focused component reviews remain M6 work.
