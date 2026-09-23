# List Filter Unification Plan

Status: implemented 2026-09-05 — baseline reviewed against the current repository and the recommended mappings applied. Discussion/design copy for `docs/refine/`; the implementation lives in `apps/web`. This document covers the status-bucket unification plus the related Trends time-horizon control alignment.

Implementation record: Incubators now exposes `All / Optimal / Issues`, Candling Logs exposes `All / To Do / Done`, Notification Center keeps `All / Unread / Important` at every width, and Historical Trends uses the equal-width segmented treatment for its existing time-horizon choices. The shared `FilterBar` also tightens tracking only in fit-to-screen segmented mode so `Full incubation` remains readable at 320px.

Source: 4 screenshots 2026-09-05 — Incubators (`ALL (12) OPTIMAL (5) ATTENTION (0) URGENT (7)`), Candling Logs (`ALL (12) ACTION (7) UPCOMING (4) COMPLETE (1)`), Notification Center (`ALL (12) UNREAD (5) URGENT (5)`), Historical Trends (`LAST 24H / LAST 7 DAYS / FULL INCUBATION`) + `IncubatorsScreen.tsx:78,171-179,257-279,412-429`, `features/incubators/selectors.ts`, `features/candling/selectors.ts`, `types.ts:15`, `cycle.ts:34-88`, `statusPresentation.ts:18-22`, `StatusBadge.tsx:6-22`, `OverviewScreen.tsx:495-532`, `CandlingLogsScreen.tsx:63-139,150-192,402,427-464,582-610`, `AlertsScreen.tsx:52,90-98,133-164`, `TrendsScreen.tsx:111-116,541-574,706-711,808-823`, `filter-bar-refinement-plan.md`, and the current `FilterBar` implementation (segmented/fit-to-screen behavior plus the shared long-label tracking adjustment).

## Goal

Unify the three status-list filter groups so each exposes exactly 3 concise pills on all widths (desktop + mobile), and align the related three-option Trends time-horizon control without treating it as a status filter. `To Do` and `Full incubation` intentionally remain multi-word labels; they must fit and stay readable rather than being abbreviated:

- Incubators: `All / Optimal / Issues`, `Issues = warning + alert` (4 → 3).
- Candling: `All / To Do / Done`, `To Do = overdue + due + upcoming + not-started`, `Done = complete + ended` (4 → 3).
- Notification Center: `All / Unread / Important` on every width — already 3 pills on desktop; the work is deleting the mobile-only `Urgent`/`Urg` override so mobile reads the same as desktop.
- Historical Trends: preserve `Last 24h / Last 7 days / Full incubation` and the existing `24h`/`7d`/`full` range keys, but use the same equal-size, fit-to-screen treatment for this 3-option time horizon.

The current shared `FilterBar` supplies the responsive segmented treatment, including equal-width mobile fitting and extra-small-screen label handling. This pass removes the remaining four-state buckets and stale mobile abbreviations, and adds only a shared tracking adjustment for fit-to-screen segmented labels. No change to the underlying health/inspection/severity models, badges, threshold calculations, or API contracts; the only count change is the explicit aggregation of existing states into the new buckets.

## Scope boundary and pre-implementation baseline

This plan covers the status/list filters in three screens plus the related time-horizon control in Historical Trends:

| Screen | Component | Filter role | Current baseline |
| --- | --- | --- | --- |
| Incubators | `IncubatorsScreen.tsx` | Chamber health | 4 code-state pills (`All`, `Optimal`, `Warning`, `Alert`; displayed as `Attention`/`Urgent`); `fitToScreenOnMobile` is already enabled, but the extra state still requires overflow/compact labels. |
| Candling Logs | `CandlingLogsScreen.tsx` | Inspection work state | 4 logical pills (`All`, `Needs action`, `Upcoming`, `Complete`); `fitToScreenOnMobile` is already enabled, but the action/upcoming/complete labels still have mobile abbreviations. |
| Notification Center | `AlertsScreen.tsx` at `/alerts` | Notification status | Already 3 logical pills (`All`, `Unread`, `Important`); `Important` is still relabeled `Urgent` on mobile and must keep its logical meaning. |
| Historical Trends | `TrendsScreen.tsx` | Time horizon, not status | 3 options (`Last 24h`, `Last 7 days`, `Full incubation`) using `FilterBar`'s default chip mode; it does not currently use `variant="segmented"` or `fitToScreenOnMobile`. |

The repository has four `FilterBar` uses: the three status-list groups above and the Trends time-horizon control. The following related controls and surfaces remain out of scope:

- `TrendsScreen` Environmental Trends/Hatch History navigation and chart Metric segmented controls; only its time-horizon `FilterBar` is included for visual alignment.
- `DetailScreen` Monitor/Candling/Settings tabs.
- Settings panel tabs and `ViewToggle` controls.
- `OverviewScreen` status KPIs/priority cards; this is a summary surface, not a filter.
- `NotificationPopover` compact preview; preserve its row severity labels and unread treatment.
- Underlying domain/status models, API values, row/card badges, and detail-page status copy unless the naming decision below is intentionally expanded.

Pre-implementation behavior and test baseline used for this change:

- `FilterBar` already supports `fitToScreenOnMobile`, `mobileLabel`, and `compactMobileLabel`; do not reimplement that behavior in individual screens.
- Before this pass, Incubators and Candling used four-state filter types, and Alerts had the `Important` → `Urgent` mobile override; the status screens now use the three-bucket contract above.
- Before this pass, `TrendsScreen.tsx:706-711` used the default `FilterBar` chip mode with no `variant="segmented"` or `fitToScreenOnMobile`; the screenshot's red-boxed control was this separate time-range control, not a missed status bucket. It now uses the aligned treatment in Part D.
- Incubator filter state and Candling filter state are local screen state; this plan does not add URL/query persistence.
- Existing coverage is in `tests/incubators-selectors.test.ts`, `tests/candling-selectors.test.ts`, `tests/alerts-responsive-layout.test.ts`, `tests/filter-bar.test.ts`, and the Trends selector/chart tests; extend those conventions rather than creating duplicate filter test locations.

## Part A — Incubators: All / Optimal / Issues

### Finding

Filter and health model are already decoupled, so this is a small, safe change:

- **Domain keeps 3 levels.** `UnitStatus = optimal | warning | alert` (`types.ts:15`), derived from `ConditionSeverity info | warning | critical` (`cycle.ts:34-40`). Thresholds in `deriveConditionSeverity:54-88` — critical = unpaired / water low / temp ±0.5 out / humidity ±5 out / battery ≤15% on battery; warning = temp/humidity drift, battery ≤25%, turning overdue. Nothing here needs to change.
- **Before this pass, the filter was exact-match on status.** `IncubatorStatusFilter = "all" | UnitStatus` (`selectors.ts:4`), `u.status !== opts.status` (`selectors.ts:14`); counts were per-status (`IncubatorsScreen.tsx:171-179`); 4-entry `filterPills` with mobile/compact abbreviations (`IncubatorsScreen.tsx:257-279`) fed into the generic `FilterBar` (`IncubatorsScreen.tsx:422-428`). Only this layer changed.
- **Precedent for the collapsed bucket already exists.** `OverviewScreen.tsx:518` computes `needsAttention = status !== "optimal"`, and `App.tsx:224` renders a binary `statusTone` (optimal vs non-optimal). `Issues` is the same predicate exposed as a filter.
- **Badges keep their granularity.** `StatusBadge` (`StatusBadge.tsx:6-22`) and `statusLabels` (`statusPresentation.ts:18-22`) render Optimal / Needs Attention / Urgent with success/warning/danger tokens; `IncubatorCard.tsx:460-481` renders the condition pill (critical vs warning). An `Issues` list will still show which rows are urgent vs drift — triage is preserved as long as badges stay 3-way.
- **Overview provided the precedence precedent.** `OverviewScreen.tsx:529` sorts `alert > warning > optimal`; the Issues path now applies that rank before the existing cycle-phase pin and requested sort, with tests covering the contract.

### Decisions (implemented defaults)

1. **Filter-only collapse, NOT a domain collapse.** Keep `UnitStatus`, `ConditionSeverity`, thresholds, badges, and card tiles 3-way. Collapsing the domain to 2 states would destroy the act-now (water empty, offline, temp ±0.5, battery ≤15%) vs watch (drift, turning overdue) distinction — rejected.
2. **Naming: use `Optimal` for this plan.** The current filter and status badge already use `Optimal` (`statusPresentation.ts:19`), while `Normal` is already used for sensor/water readings. This keeps the status vocabulary unambiguous and limits the change to the filter bucket. If the owner explicitly chooses `Normal`, update `statusLabels` and every badge consumer consistently, plus custom copy such as `App.tsx`'s `All Systems Optimal` and Overview's `All optimal`.
3. **Counts:** `Issues count = warning + alert` (screenshot: 0 + 7 = 7). `All` and `Optimal` unchanged.
4. **Drop only the abbreviations.** Remove `mobileLabel`/`compactMobileLabel` (`OPT`/`ATTN`). Keep the existing `fitToScreenOnMobile` layout contract if the equal-width, no-scroll treatment remains the target; it is shared behavior, not screen-specific workaround logic.
5. **Sort inside `Issues`:** alert-first, then warning (reuse the Overview rank), then the current cycle-phase and requested-sort rules. The precedence applies to every sort selection, while the existing cycle-phase pin remains the next tie-breaker.

### Tasks (for the implementing pass)

1. [x] Retain `Optimal`; no broader `Normal` rename was requested.
2. [x] `features/incubators/selectors.ts`: added the `all`/`optimal`/`issues` filter, explicit predicate, counts, and no URL persistence.
3. [x] `IncubatorsScreen.tsx`: reduced the pills 4→3, removed compact labels, and retained `fitToScreenOnMobile`.
4. [x] Tests cover the Issues union, Optimal-only membership, counts, and composition behavior without changing the domain model.
5. [x] Issues sorting is alert-first, then warning, with cycle-phase/requested-sort tie-breakers; browser checks at 320/360px show equal-width, non-scrolling pills and intact row badges.
6. [x] Typecheck, full tests, Vite build, focused Biome checks, and `git diff --check` pass. Repository-wide Biome still reports unrelated pre-existing formatting in other dirty files.

## Part B — Candling: All / To Do / Done

### Finding

Same shape as Part A — filter is a thin grouping over a richer derived state — with one extra wrinkle (orphan states):

- **Inspection model has 6 states.** `InspectionStatus = overdue | due | upcoming | complete | not-started | ended` (`CandlingLogsScreen.tsx:63-69`), derived in `getCandlingSummary:150-192` from mode checkpoints + `candled`/`candlingLog` + `cyclePhase`/`dayOfIncubation`. Nothing here changes.
- **Before this pass, the filter grouped 4 of the 6 states.** `RowFilter = "all" | "action" | "upcoming" | "complete"` (`:139`); `action = overdue + due` (`:428-430`, `:444-445`); `upcoming` (`:446`), `complete` (`:447`); counts (`:427-435`); pills with `Action`/`Act`, `Next`, `Done` compact labels (`:588-609`) fed into the generic `FilterBar` (`:582-587`). Only this layer changed.
- **Before this pass, orphan states were an existing quirk:** `not-started` (ready phase / Day ≤ 0, "Waiting for Day 1") and `ended` (`stopped_early`, "No further checks scheduled") matched no pill and were visible under `All` only. The implemented collapse places them in To Do and Done respectively.
- **Badges keep their granularity.** `statusMeta` (`:81-137`) renders Overdue / Due today / Upcoming / Complete / Not started / Cycle ended with distinct tones/icons; attention sort rank (`:457-464`) already orders `overdue > due > upcoming > not-started > complete > ended`. A `To Do` list still shows which rows are overdue vs scheduled — triage preserved.
- **Screenshot math:** `To Do = 7 + 4 = 11`, `Done = 1` under the recommended mapping.

### Decisions (implemented defaults)

1. **Filter-only collapse.** Keep `InspectionStatus`, `getCandlingSummary`, `statusMeta`, and card/row badges 6-way. Rejected: merging the domain states.
2. **Implemented bucket semantics — "work remaining" vs "no work remaining":**
   - `To Do = overdue + due + upcoming + not-started` (everything with outstanding or future checks; a Day-0 chamber at "0 of 3 checks" self-evidently has work to do).
   - `Done = complete + ended` (nothing further scheduled — "Cycle ended" reads as done, not as actionable).
   - Alternative (keep the former orphans): `To Do = overdue + due + upcoming`, `Done = complete`, not-started/ended visible under `All` only. This cheaper diff was rejected because it preserves a behavior trap; the inclusive mapping above is implemented.
3. **Labels:** pills `All / To Do / Done`. Row/card badges keep `Overdue / Due today / Upcoming / Complete` etc. — no `statusMeta` copy change. (Note the desktop pill currently reads "Needs action" `:592` while mobile reads "Action" `:593` — the collapse resolves this split for free.)
4. **Drop only the abbreviations.** Delete `Act`/`Next`/`Done` compact labels and keep the existing `fitToScreenOnMobile` treatment for the equal-width, no-scroll layout; re-check it at 320/360px.
5. **Sort inside `To Do`:** keep the existing attention rank (overdue first), then current sort key — same argument as A5.
6. **Sort scope:** make the precedence behavior explicit. Today the attention sort applies the status rank, while name/recent sorts do not; preserve that distinction unless the product owner wants overdue-first to be invariant across every sort choice.

### Tasks (for the implementing pass)

1. [x] Use the inclusive orphan placement: not-started → To Do, ended → Done.
2. [x] `CandlingLogsScreen.tsx`: reduced the pills 4→3, added the `all`/`todo`/`done` filter and counts, and removed compact variants.
3. [x] Pure selector helpers and tests cover To Do/Done membership and counts; existing search/mode/sort composition remains unchanged.
4. [x] Browser check at 320px shows equal-width, non-scrolling pills and intact Overdue/Upcoming/Complete badges; attention ordering remains overdue-first.
5. [x] Existing empty-state copy remains valid under the new labels.
6. [x] Typecheck, full tests, Vite build, focused Biome checks, and `git diff --check` pass. Repository-wide Biome still reports unrelated pre-existing formatting in other dirty files.

## Part C — Notification Center: All / Unread / Important (all widths)

### Finding

No reduction needed — this screen is already 3 pills with the exact target vocabulary:

- **Filter already ternary.** `Filter = "all" | "unread" | "important"` (`AlertsScreen.tsx:52`); `unread → !acknowledged` (`:94-95`); `important → critical OR (warning AND unacknowledged)` (`:96-97`, `:134-138`); counts `unreadCount`/`importantCount` (`:133-138`). Predicate and counts are untouched by this part.
- **Before this pass, the only delta was a mobile-only relabel.** The third pill declared `label: "Important"` but overrode `mobileLabel: "Urgent"` + `compactMobileLabel: "Urg"` (`:157-163`) — so desktop read `Important` while phones read `URGENT` (the screenshot). The override is now removed; `Urgent` elsewhere remains card/row badges (`alertStyle.ts:13`, `statusPresentation.ts:21`, `cycle.ts:29`).
- **No second notification-list filter is missing.** `AlertsScreen` is the Notification Center route; `NotificationPopover` is only a compact preview and has no equivalent list filter. Its severity labels and unread marker remain out of scope.
- **Same overflow motive.** The former `Urg`/`Urgent` abbreviations plus `fitToScreenOnMobile` (`:148`) came from the 4-pill-era crowding; after removal, the bar fits at 320/360px without scroll aids.

### Decisions

1. **Delete the override, keep everything else.** Remove `mobileLabel`/`compactMobileLabel` on the `important` pill so all widths — desktop included — read `All / Unread / Important`. No predicate, count, sort (`recent | oldest | severity`, `:53`), or badge change.
2. **Do NOT rename the severity itself.** Rows keep their `Urgent` / `Needs Attention` badges (`alertStyle.ts:12-17`, screenshot cards) — `Important` is the filter-bucket word, `Urgent` remains the row-severity word. Same split as Parts A/B (bucket label vs badge label).

### Tasks (for the implementing pass)

1. [x] `AlertsScreen.tsx`: deleted the mobile-only `Urgent`/`Urg` overrides and kept `label: "Important"`.
2. [x] Browser check at 320px shows all three full-word pills with equal widths and no horizontal overflow; row badges still read `Urgent`/`Needs Attention`.
3. [x] Source-contract tests cover the removed overrides and shared segmented fit treatment.
4. [x] Desktop behavior remains the same logical three-option filter; mobile now uses the same words.
5. [x] Typecheck, full tests, Vite build, focused Biome checks, and `git diff --check` pass. Repository-wide Biome still reports unrelated pre-existing formatting in other dirty files.

## Part D — Historical Trends: time horizon (layout scope only)

### Finding

The Trends page contains a related three-option control, but it is not part of the status taxonomy:

- **Range semantics are already complete.** `RangeKey = ReadingWindow` with `24h`, `7d`, and `full` (`TrendsScreen.tsx:111-116`). These keys drive the chart data window and raw-readings dialog; no renaming or bucket merge is needed.
- **Before this pass, the red-boxed control used chip mode.** `TrendsScreen.tsx:706-711` rendered `FilterBar` without `variant`, so it defaulted to `chips` and retained the mobile scroll/arrow treatment. It was visually different from the segmented status groups even though it was also a mutually exclusive choice.
- **The page has other, intentional segmented controls.** Environmental Trends/Hatch History (`:559-574`) is top-level view navigation, and Temperature/Humidity (`:808-823`) is a chart metric toggle. Neither should be folded into this time-horizon change.
- **No status/count behavior is involved.** The three labels are already full words and there are no status counts, mobile abbreviations, or orphan states to reconcile.

### Decisions

1. **Preserve time-horizon semantics.** Keep `Last 24h / Last 7 days / Full incubation`, the `24h`/`7d`/`full` keys, the default `24h` selection, and all chart/readings behavior.
2. **Align the control treatment.** Implemented: render this `FilterBar` as `variant="segmented"` with `fitToScreenOnMobile`, so its three mutually exclusive options share the equal-size, no-scroll mobile treatment used by the status filters. Keep `ariaLabel="Time horizon"`.
3. **Do not abbreviate the long option.** Verify `Full incubation` remains available and readable at 320/360px; if reflow is needed, wrap/reflow the label rather than introducing a cryptic abbreviation.
4. **Keep neighboring controls unchanged.** The Trend view navigation, chamber selector, Compare Chambers control, and Temperature/Humidity metric toggle are not part of this migration.

### Tasks (for the implementing pass)

1. [x] `TrendsScreen.tsx:706-711`: added the shared segmented/fit-to-screen props; options and `ariaLabel="Time horizon"` are unchanged.
2. [x] `tests/filter-bar.test.ts` covers the Trends `FilterBar` props and shared primitive contract.
3. [x] Browser checks at 320/360px show equal-size pills, no scroll arrows/clip, and readable `Full incubation`; chart/view/metric semantics remain present.
4. [x] Browser snapshot verifies the time-horizon group, `aria-pressed`, and full accessible labels; the shared button focus contract remains unchanged.
5. [x] Typecheck, full tests, Vite build, focused Biome checks, and `git diff --check` pass. Repository-wide Biome still reports unrelated pre-existing formatting in other dirty files.

## Joint acceptance

- [x] Incubators pills read `All (12) Optimal (5) Issues (7)`; Candling pills read `All (12) To Do (11) Done (1)`; Notification pills read `All (12) Unread (5) Important (5)` on desktop and mobile.
- [x] Each new bucket's membership matches Decisions A2/B2; `All` is unchanged; Alerts predicates/counts remain unchanged.
- [x] Card/row badges still distinguish every underlying state (Urgent vs Needs Attention; Overdue vs Due today vs Upcoming vs Complete).
- [x] No `OPT`/`ATTN`/`Act`/`Next`/`Urg` compact labels remain on the status-list filter groups. UI filter keys are `all`/`optimal`/`issues` and `all`/`todo`/`done`; underlying domain keys remain intentionally. No mobile override remains on Alerts' `important` pill.
- [x] 320/360px checks show no pill scroll/clip on the status screens; Trends' time-horizon control passes the same responsive check.
- [x] Historical Trends keeps `Last 24h / Last 7 days / Full incubation` and the `24h`/`7d`/`full` keys, with aligned equal-width, no-scroll treatment.
- [x] Out-of-scope controls (Trends view/metric segmented controls, detail tabs, settings tabs, `ViewToggle`, Overview summaries, and `NotificationPopover`) were not changed by this pass.

## Non-goals

- No change to `UnitStatus`, `ConditionSeverity`, `deriveConditionSeverity` thresholds, `unitStatusFromConditionSeverity`, or `conditionSeverityFromLegacyStatus`.
- No change to `InspectionStatus`, `getCandlingSummary`, `statusMeta`, or the attention sort ranks.
- No change to alert predicates, counts, severity ranks, sorts, or row badges (`alertStyle.ts`, `severityTint`).
- No change to `StatusBadge`, `statusLabels` (unless Decision A2(a)), `IncubatorCard` tiles, `OverviewScreen` KPIs, or the mode/sort dropdowns (the Candling "Attention" sort select in the screenshot is untouched).
- No change to Trends range calculations, chart data, raw-readings behavior, Trend view navigation, or metric selection; only the time-horizon control's shared visual variant/responsive treatment is in scope.
- No API/contract change (transport contracts, fixtures, repository stay as-is).
- No new screen-specific `FilterBar` logic — the primitive still owns arbitrary options and shared segmented fit/compact-label behavior. The only primitive change in this pass is the shared fit-to-screen tracking adjustment needed for long labels.
