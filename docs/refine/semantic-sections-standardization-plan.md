# Refinement Plan: Semantic Sections and Consistent Record Components

**Source audit:** `docs/audit/semantic-sections-audit-2026-09-07.md`
**Plan date:** 2026-09-07
**Status:** Implemented 2026-09-07 — all four phases done, nothing deferred.
**Verification:** `pnpm --filter eggcelerate-ui test` 30 files / 227 passed (incl. new `semantic-sections.test.ts`, 13 tests); `typecheck` pass; `build` pass (only the known >500 kB chunk warning); `biome check` on touched files shows only the two `useSemanticElements` findings on the mobile dot-track `div role="group"`s, which are byte-identical on main (verified via `git stash`) along with several format findings in untouched files — all left as found.
**Recorded deviations from the plan:** (1) `IncubatorCard` footer buttons use record-named labels (`Configure {name}` / `Start setup for {name}` / `Finish cycle for {name}`) instead of the literal `Open details for X`, to satisfy label-in-name (WCAG 2.5.3) against their visible text. (2) `MiniCard`/`OffTargetRow` open controls are always-visible chevron icon-buttons reusing the journal action-button pattern, replacing hover-only decorative chevrons (which had no mobile affordance). (3) Notification rule-group sections additionally labelled via the new `GroupLabel id` prop (same mechanism as SEM-03). (4) `IncubatorsScreen` dot-nav focus selector updated from `[role="button"]` to `"button"` to follow the card restructure (matches `CandlingLogsScreen`).
**Scope:** Unlabelled meaningful `<section>`s, redundant competing labels, divergent repeated-record markup (wrapper element, title element, interaction pattern, accessible name).
**Validation constraint:** This plan does **not** require Playwright, browser automation, screenshots, or an agent-run browser check.

## Goal

Every meaningful page section exposes its visible heading as its accessible name, and every self-contained record (chamber cards/rows, journal cards/rows, mode cards/rows, feed items) uses one shared semantic pattern — without changing product behavior, navigation logic, filter/sort behavior, or visual design direction.

The standard, copied from patterns already present in the codebase:

- `section`/`article` get their name via `aria-labelledby` to a visible heading; plain `aria-label` only where no visible heading exists; minor/visual containers stay unlabelled (exemplar: `NotificationsPanel.tsx` SMS/Email sections).
- One "open record" pattern: `article` for cards / plain `tr` for table rows, record title as heading (cards) or cell text (rows), exactly one explicit named open control per record, no nested interactives (exemplar: `JournalCard` + Candling table rows sharing identical `Open log` text and `Open candling log for X` label).
- Card titles in a card list are `h3` with `id`; row/feed titles stay non-heading text in row context; open-action names are `Open details for X` (chambers) and `Open candling log for X` (logs) with no "click to …" suffix.

## What this plan does not do

- It does not require Playwright or any browser automation.
- It does not change click handlers' destinations, filtering, sorting, pagination, navigation, or data behavior — only the elements, roles, and names carrying them.
- It does not relabel minor containers (toolbar/filter rows, KPI grids, carousel scrollers, dividers, spacers, dot-tracks) or upgrade `KpiCard` wrappers to landmarks.
- It does not replace the control-size geometry or the clickable-affordance pointer/focus contract (see reconciliation below).
- It does not touch auth/onboarding, dialogs/lightbox, or chart rendering beyond the named label attributes.

## Project reconciliation (confirmation against existing project state)

1. **Clickable-affordance audit/plan (`docs/audit/archive/clickable-affordance-audit.md`, implemented via `docs/refine/archive/clickable-affordance-standardization-plan.md`) explicitly lists `IncubatorCard` and the `IncubatorsScreen` table rows as already-covered patterns** ("Additional raw-button review": card pointer/hover/focus/Enter-Space handling; table row with role/tab stop/keyboard handling). CON-01/CON-02 deliberately supersede that coverage for these two spots — not because the old audit missed them, but because the container-as-button pattern nests real buttons inside (`stopPropagation` crutches), strips `tr` table semantics, and diverges from the `JournalCard` pattern for equivalent content. Everything that audit established for these elements (visible `cursor-pointer`, hover/pressed feedback, visible focus ring, adequate hit area) MUST be preserved on the replacement explicit controls, not removed with the `role="button"` containers.
2. **Control-size contract (`docs/guide/ui-control-size-guidelines.md`)**: replacement open/action buttons keep the project geometry — 44px mobile hit areas (existing card buttons already use `h-11`/`min-h-[var(--control-height-default)]` with `md:h-8`; keep that split), 36px icon visuals where present. New `h3`s reuse the adjacent card-title styling (raw `h3` + type tokens, as in `JournalCard`/`IncubatorCard`), not a second heading convention.
3. **Tests**: no existing test pins the old `aria-label` strings or `role="button"` markup (verified: `grep` over `apps/web/src/tests` for `Open details for|click to open details|click to view|View incubator|Open candling log|role.*button` finds no matches; `incubators-responsive.test.ts` asserts only layout classes). No test updates are required by the rename, but Phase 2 adds one source-contract test file in the existing `incubators-responsive.test.ts` style (source assertions, since jsdom cannot evaluate AT semantics).
4. **Dirty working tree**: `IncubatorCard.tsx`, `CandlingLogsScreen.tsx`, `IncubatorsScreen.tsx`, `TrendsScreen.tsx`, `theme.css`, and `mobile-typography.test.ts` are currently modified and uncommitted — all four component files are in this plan's scope. Commit or stash that work first; audit line numbers below refer to the audited revision and MUST be re-grounded (`read` before editing) if the tree has moved.
5. **Prior mobile audit (`docs/audit/mobile-responsiveness-audit-2026-09-06.md`)**: MOB-03/MOB-04 flag density risks on the same cards/gauges this plan restructures. Keep all geometry classes byte-identical except where the element swap requires it; any spacing change belongs to the mobile follow-ups, not this plan.

## Target interaction contract (applies to every record change below)

```text
wrapper: article (cards) / plain tr (rows) / li (feed, journal)
title:   h3 with id (card lists) / cell or row text (rows, feed)
action:  exactly one explicit named control per record; native button
name:    "Open details for {name}" / "Open candling log for {name}" /
         existing per-item names elsewhere ("Mark {title} as read", …)
never:   role="button" containers, tabIndex on non-interactives,
         nested interactives, stopPropagation crutches,
         "click to …" instruction text inside accessible names
keep:    cursor-pointer, hover/pressed feedback, visible focus ring,
         44px mobile hit areas, existing geometry classes
```

## Implementation phases

### Phase 1 — Label the meaningful sections (SEM-01, SEM-02, SEM-03)

**Priority:** P1 — pure additions, no interaction change.

- `OverviewScreen.tsx` (~`:661-680`, `:758-776`): add `id`s to the `Active Incubators` and `Conditions to Check` `h2`s; add matching `aria-labelledby` to their `<section>`s. Nothing else in those blocks changes.
- `SettingsScreen.tsx` (`:153-156`): downgrade the static outer wrapper to `div` (it cannot name-swapped panels); each panel already renders `PanelHeader` (`settings/tokens.tsx:37-57`, an `h2`) — wrap each panel body in `<section aria-labelledby>` pointing at its own `PanelHeader` `h2` (add `id`s there). If a smaller diff is preferred, keep the outer `section` and re-point its `aria-labelledby` per active category; do not leave one static wrapper naming four swapping panels.
- `DeviceSettingsTab.tsx` (`:166-173`, `h2`s at `:180`, `:419`, `:558`): same treatment as Settings — labelled `<section>` per sub-tab content, `aria-labelledby` to its `h2` with added `id`.
- `HardwarePanel.tsx` (`:206-209`, `:261-264`, `:321-324`): promote `GroupLabel` (`settings/tokens.tsx:28-34`) to `h3` with `id` (keep its visual styling byte-identical) and add `aria-labelledby` per `<section>`; if any group is judged minor on implementation, use `div` instead of `section` for that group only and note it in the phase report.

Acceptance: every `<section>` in the touched files has an accessible name resolving to a visible heading; `grep` for `<section` without a following `aria-label(ledby)` in these files returns nothing.

### Phase 2 — One open-record pattern (SEM-04, CON-01, CON-02, CON-03, CON-04 title split)

**Priority:** P1 — the core consistency fix. Do Phase 1 first so card `h3` `id`s created here can serve as `article` labels.

- `IncubatorCard.tsx` (`:387-442`, `:651-697`): replace the `Card`+`role="button"`+`tabIndex`+card-click/keydown container with `article aria-labelledby` to the chamber-name `h3` (add `id`); delete card-level `onClick`/`onKeyDown`; delete both `stopPropagation` calls; rename the card `aria-label` to `Open details for {unit.name}` on the explicit action. Keep the inner `Finish Cycle` / `Configure` / `Start Setup` buttons, their visible text, geometry, hover/focus, and 44px mobile targets unchanged. Keep the whole-card `cursor-pointer`/hover affordance only if it still signals the explicit action — otherwise move the affordance onto the action button itself.
- `IncubatorsScreen.tsx` (`:679-692`, `:747-760`): drop `role`, `tabIndex`, `onClick`/`onKeyDown` from the `tr`; the row keeps its cells and the existing `Configure` button becomes the single named open control with `aria-label="Open details for {unit.name}"`. Table headers regain their AT associations.
- `OverviewScreen.tsx` `MiniCard` (`:381-435`) and `OffTargetRow` (`:262-267`): restructure to the shared pattern — `article` + `h3` name + explicit open button for `MiniCard`; row content + explicit button for `OffTargetRow`. Fold the `title`-only context (`X · Day N of M`, `X · value`) into visible content or the new control's `aria-label`; the progress `svg role="img"` keeps a short label that no longer duplicates a whole-card button name.
- Naming sweep (CON-03): `Open details for X` (chambers), `Open candling log for X` (logs, already correct at `CandlingLogsScreen.tsx:378,950` — do not touch those two call sites); delete every `— click to …` suffix.
- Title-element split (CON-04): mode grid card name `p` (`ModeLibraryPanel.tsx:638-649`) → `h3` with `id`; Alerts titles, mode table cells, and Candling table cells remain non-heading row text by documented decision (record in the phase report, one sentence).

Acceptance: `grep` for `role="button"` under `app/components` returns only intentional non-record usages (if any, each listed with justification); `grep` for `stopPropagation` in `IncubatorCard.tsx`/`IncubatorsScreen.tsx` returns nothing; `grep` for `click to` in accessible-name/title positions returns nothing; chamber open actions across grid, list, and Overview share one wording.

### Phase 3 — Trends, Alerts, shell landmarks (SEM-05, SEM-06, SEM-07)

**Priority:** P2 — follows Phase 2 (uses its naming and title-split decisions).

- `TrendsScreen.tsx`: delete the dead `aria-label` on the chart region, keeping `aria-labelledby="environmental-chart-title"` (`:866-871`); move chamber/metric context to `aria-describedby` or visually-hidden description text. Rename toggle `aria-label="Metric"` → `"Chart metric"` (`:835-838`). Hatch view (`:1066-1147`): add a visible `h2 Hatch history` + `aria-labelledby` region; add `aria-label="Filter hatch history"` to the search input (`:1098-1109`).
- `AlertsScreen.tsx`: label the feed region (`section aria-label="Notifications"` or `labelledby` a new visible `h2`); promote date-group `<p>`s (`:272-287`) to headings or per-group labelled sections; replace per-row `role="status"` badges (`:312-319`) with presentational icon + `sr-only` Read/Unread text, keeping a single list-level live region only for genuinely live updates.
- `PageHeader.tsx` (`:85-145` vs `:173-210`): render `<header>` on both breakpoints with identical landmark behavior.
- `AppSidebar.tsx` (`:417`, `:571`, `:475`, `:623` vs `:121`): label the desktop primary `nav` (`Primary`), and either label the `aside`/secondary `nav` or fold Settings into the primary `nav` / downgrade chrome to `div` — mirror whichever the mobile labelled pattern already establishes.
- `IncubatorsScreen.tsx` list vs `CandlingLogsScreen.tsx:656`: apply the Phase 2 title-split decision so both lists share one treatment (visible `h2` + `labelledby`, or documented unlabelled card grids).

Acceptance: desktop and mobile expose the same landmark set; Alerts groups are heading-navigable; no element carries both `aria-labelledby` and `aria-label`.

### Phase 4 — Shared primitives and record-named actions (SEM-08, CON-05, CON-06)

**Priority:** P3 — opportunistic; may ride with the next Settings/Trends touch instead of a dedicated pass.

- `detail/primitives.tsx` `SectionCard` (`:40-99`): accept an optional section mode rendering `<section aria-labelledby>` (heading keeps its `id`); promote the `LiveMonitorTab.tsx:480,515` instances (`Incubation Timeline`, `Chamber status`); leave `InnerTile`/`KeyValue` as `div`s.
- `KpiCard` duplication (`OverviewScreen.tsx:50-177` vs `TrendsScreen.tsx:1356-1405`): extract one shared primitive covering pill/footer/unit/accent props, or rename to `OverviewKpiCard`/`TrendKpiCard` with a comment stating why they differ. No landmark or interaction change either way.
- `ModeActions` (`ModeLibraryPanel.tsx:416-470`): include the mode name in all four labels — `Edit {name}`, `Duplicate {name}`, `Share or export {name}`, `Delete {name}`.

Acceptance: one `KpiCard` decision recorded in code; `grep` for `aria-label="(Edit|Duplicate|Delete) mode"` (without a name interpolation) returns nothing.

## Verification

1. `pnpm test` — full suite green (29 files / 214 tests baseline per the mobile audit; exact count may have moved — record the actual numbers).
2. `pnpm run typecheck` — pass. `pnpm run build` — pass (only the known large-chunk warning).
3. New source-contract test file (style follows `incubators-responsive.test.ts`, which already asserts source because jsdom cannot evaluate AT semantics): `apps/web/src/tests/semantic-sections.test.ts` asserting (a) no `role="button"` on `Card`/`tr` in `IncubatorCard.tsx`/`IncubatorsScreen.tsx`, (b) `article` + single named open control per chamber card, (c) every `<section>` in the Phase 1 files carries `aria-labelledby`/`aria-label`, (d) `ModeActions` labels interpolate the mode name. Each assertion names the plausible regression it guards (reintroduction of container-buttons, unnamed sections, unnamed repeated actions).
4. Keyboard walkthrough (no browser automation required — code-level plus any available manual pass): Tab reaches every replacement open/action control in grid, list, carousel, dialog, and table contexts; Enter/Space activates; focus ring visible via the preserved affordance classes; no `stopPropagation` remains to silently swallow inner actions.
5. Close each SEM/CON item by re-reading the cited lines in their post-edit state.

## Completion criteria

The plan is complete when Phases 1–3 are implemented with `pnpm test`/`typecheck`/`build` green and the new contract test passing; Phase 4 is either implemented or explicitly deferred with its deferral recorded in this file's Status line; the audit's explicit non-findings still hold (re-run the two `grep` non-finding checks); and this file's Status is updated to Implemented with actual verification numbers. Budget pressure or turn boundaries never mark this complete — only the verification above does.
