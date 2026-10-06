# M6 first frontend batch — Trends extraction

Date: 2026-10-04. Baseline: `493f051` (`oct 4 frontend test`) on `experiment`.
The extraction follows that checkpoint in the working tree. This closes the
Trends batch, not the whole M6 milestone.

## Responsibilities and state ownership

`TrendsScreen.tsx` now composes the sticky header, tabs, environmental/history
panels and raw-readings dialog (171 lines, previously 1,734). The UI and data
contracts are preserved; no dependencies or database changes were introduced.

| Module | Responsibility |
| --- | --- |
| `components/trends/EnvironmentalTrends.tsx` | Environmental controls, loading/retry states, chart and legend |
| `components/trends/useEnvironmentalTrends.ts` | Chamber/compare/range/metric state, reading subscription, chart derivation and export selection |
| `components/trends/HatchHistory.tsx` | History status, KPIs, filters, grid/table and pagination |
| `components/trends/useHatchHistory.ts` | Search/species/view/page state and history selectors |
| `components/trends/ChartTooltip.tsx` | Compact and desktop reading tooltips |
| `components/trends/presentation.ts` | Existing shared tokens, chart configuration and presentation types |
| `features/trends/readings-csv.ts` | Existing simple CSV serializer, moved out of the screen |

Both state hooks are called by the screen above its conditional tab rendering.
Switching tabs therefore preserves state and keeps the existing reading-query
lifetime. Panels consume inferred hook return types. The hooks remain beside the
panels because they coordinate presentation state; domain selectors and transport
remain in their existing feature/repository modules.

The production paginated raw-export path remains `RawReadingsDialog` plus
`features/trends/raw-export.ts`. The extracted simple CSV helper is the existing
separately tested serializer, not a replacement for the complete raw export.

## Validation

- `pnpm coverage:web`: **328 tests passed in 43 files**; all coverage thresholds
  passed. The existing screen floors now cover both screens and extracted Trends
  modules. The scope verifier checks all seven screens and six Trends modules.
- Added a rendered regression test for metric/range/compare state, history search,
  list view and page retention across tab switches; no extra reading fetch on
  switching back.
- Existing raw CSV, paginated export, chart aggregation/ticks, readings-dialog,
  screen routing and mobile tests passed in the full suite.
- `pnpm lint`, `pnpm typecheck:web`, `pnpm build:web` and
  `pnpm --filter eggcelerate-ui check:assets`: passed.
- Playwright Chromium fixture check: both tabs at **320, 768, 900 and 1440px**,
  eight cases, no page overflow or page errors. Reproduction:
  `repro/m6-trends-qa.js`; screenshots under ignored `output/playwright/m6-trends-*`.

The October 3 sizing audit retains its original source hashes and paths as
historical evidence. It is not a fresh source-hash audit after this extraction.
Browser checks use local fixture data; Azure, live firmware and broader M9
cross-browser/operator qualification remain outside this batch.

## Next

Continue frontend-first M6 with Incubators list/create flow extraction, then farm
query/mutation coordination. Concurrency measurements, operation policy,
resource-specific transactions and growing-collection pagination remain open.
