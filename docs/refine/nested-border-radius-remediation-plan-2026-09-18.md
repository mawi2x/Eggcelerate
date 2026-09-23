# Refinement Plan: Nested Border Radius Consistency

**Source audit:** `docs/audit/nested-border-radius-audit-2026-09-18.md`  
**Plan date:** 2026-09-18 (revised 2026-09-18 — token mapping corrected)  
**Status:** Implemented 2026-09-18 — all 17 audit findings + 6 second-level companions applied; verified at computed-pixel level (devtools) at 1280px and 390–393px widths; `test` 293/293 pass; `build` passes; `typecheck` has 2 pre-existing TrendsScreen errors (present before this change, verified via stash); `lint` failures pre-exist (verified via stash). Verification was live computed-style reads in devtools (before/after inventories were local-only scratch under gitignored `docs/*`, since removed). One test assertion relaxed: `incubators-responsive.test.ts` no longer pins `rounded-2xl` on the Reading tile (implementation-pinned source-text assertion) — now asserts overflow-hidden + any rounded class.

## Goal

Make nested surfaces visibly subordinate to their containing surfaces while preserving the existing visual language, spacing, interactions, and responsive behavior.

### Radius mapping (computed, not Tailwind defaults)

`apps/web/src/styles/theme.css:337,427-430` remaps the Tailwind scale via `@theme inline`:

- `--radius: 1rem`, so `--radius-lg: var(--radius)` = 16px, `--radius-xl: calc(var(--radius) + 4px)` = 20px, `--radius-md: calc(var(--radius) - 2px)` = 14px.
- `--radius-2xl` is not remapped and stays the Tailwind default 16px.
- Verified in built CSS (`apps/web/dist/assets/index-*.css`): `.rounded-2xl` = 16px, `.rounded-xl` = 20px, `.rounded-lg` = 16px.

Consequence: bare `rounded-xl` / `rounded-lg` MUST NOT be used for nested hierarchy in this codebase. The prior draft's `rounded-2xl` → `rounded-xl` direction grows children 16px → 20px.

The corrected default relationship is:

- outer cards, sections, shells, dialogs keep 16px (`rounded-2xl` / `borderRadius: var(--radius-card)`);
- nested panels, tables, disclosures, and message bubbles use 12px via `var(--radius-dialog)` — spell as `rounded-[var(--radius-dialog)]` (class) or `borderRadius: "var(--radius-dialog)"` (inline style), following the surrounding code;
- Overview MiniCards use 8px mobile (`rounded-[8px]`, no token covers 8px) and 12px from the desktop breakpoint (`md:rounded-[var(--radius-dialog)]`);
- third-level surfaces inside a 12px parent use 10px via `var(--radius-compact)` (`ExtremumTile`, Hardware device rows);
- HelpWidget bubbles use 12px with 4px tails via `var(--radius-mini)`;
- controls that are intentionally pill-shaped or independently interactive are not changed by this plan.

Where a node sets radius twice (Tailwind class plus inline `borderRadius`, e.g. `DeviceSettingsTab.tsx` outer section), change both or remove the redundant class so the two sources agree. Never fix the global `@theme inline` scale in this plan — that would resize every unrelated control using `rounded-xl`/`rounded-lg`.

## Scope

This plan covers the 17 findings in the source audit across Overview, Incubators, Candling Logs, Trends, the incubator detail views, Settings, and Help, plus 6 mandatory second-level companions found during plan review (disclosure `summary`, `ExtremumTile`, Detail preview tiles, Trends metric grid, Hardware device rows, Help tails). Without the companions, shrinking a parent to 12px leaves an equal-or-larger child inside it.

It changes radius declarations only (class and/or inline style where both are present) unless a visual regression requires a narrowly scoped wrapper adjustment.

It does not change data flow, event handlers, navigation, component hierarchy, content, typography, spacing, touch targets, or the radius token definitions. No new radius token is needed.

## Preconditions and working-tree check

Before editing:

1. Re-read every cited component location because the audit references are line-based and the tree may have moved (line numbers below are approximate anchors, not pins).
2. Working tree MUST be clean for every target file before applying this plan. As of plan revision the tree is dirty in plan targets including `LiveMonitorTab.tsx`, `DetailScreen.tsx`, and `TrendsScreen.tsx` (11 modified files total per `git status`). Commit or stash unrelated work first and keep an explicit review boundary — do not fold radius changes into unrelated production, detail, or Trends work.
3. Confirm computed px, not class availability: check `theme.css` (`--radius-card`, `--radius-dialog`, `--radius-compact`, `--radius-mini`, `--radius`), the `@theme inline` remap, and the built CSS / devtools computed `border-radius` for `rounded-2xl` (16px), `rounded-xl` (20px), `rounded-lg` (16px), `rounded-md` (14px). Class presence does not imply value in this repo.
4. Capture one desktop and one mobile baseline screenshot for the affected routes so the visual comparison is reviewable.

## Implementation phases

### Phase 1 — Dashboard and record surfaces

**Priority:** P1 — repeated surfaces with the broadest visual impact.

- `apps/web/src/app/components/screens/OverviewScreen.tsx` (MiniCard, ~:234)
  - From `rounded-xl md:rounded-2xl` (20px mobile / 16px desktop) to `rounded-[8px] md:rounded-[var(--radius-dialog)]` (8px / 12px). Parent section (~:519) stays `rounded-2xl` 16px.
- `apps/web/src/app/components/IncubatorCard.tsx`
  - Reading metric tiles (~:272): `rounded-2xl` → `rounded-[var(--radius-dialog)]`.
  - Ready chamber body (~:474): `rounded-2xl` → `rounded-[var(--radius-dialog)]`. Outer `ChamberCardShell` stays `var(--radius-card)` 16px.
- `apps/web/src/app/components/screens/CandlingLogsScreen.tsx`
  - Latest journal entry panel (~:253): `rounded-2xl` → `rounded-[var(--radius-dialog)]`. List/table wrappers and empty state are top-level surfaces — leave at 16px.
- `apps/web/src/app/components/screens/TrendsScreen.tsx`
  - Name each wrapper separately (the audit's single "table wrapper" label is ambiguous):
    - Hatch grid cards (~:1237): `rounded-2xl` → `rounded-[var(--radius-dialog)]`.
    - Metric grid inside each hatch card (~:1297): `rounded-xl` (20px, already larger than its parent) → `rounded-[var(--radius-dialog)]`.
    - Hatch empty state (~:1379): `rounded-2xl` → `rounded-[var(--radius-dialog)]`.
    - Desktop table wrapper (~:1399): `rounded-2xl` → `rounded-[var(--radius-dialog)]`.
    - Raw readings modal table (~:1599): `rounded-2xl` → `rounded-[var(--radius-dialog)]`. Dialog shell (~:1555) stays 16px.
  - Outer `cardStyle` (`borderRadius: var(--radius-card)`) stays 16px.

**Phase acceptance:** outer cards remain 16px computed; MiniCards compute 8px mobile / 12px desktop; every other listed inner surface computes 12px; no card height, grid gap, or interaction behavior changes.

### Phase 2 — Incubator detail surfaces

**Priority:** P1 — the same relationship is repeated across the detail workflow.

- `apps/web/src/app/components/detail/LiveMonitorTab.tsx`
  - Disclosure shell (~:266): `rounded-2xl` → `rounded-[var(--radius-dialog)]`. Mandatory with it (not "recheck"): `summary` (~:288) `rounded-2xl` → `rounded-[var(--radius-dialog)]`; preserve list-none treatment, padding, and focus ring.
  - `ExtremumTile` (~:46): `rounded-lg` (computes 16px, equal to the SectionCard) → `rounded-[var(--radius-compact)]` (10px) so the third-level tile stays subordinate inside the 12px disclosure.
  - Outer `SectionCard` (`detail/primitives.tsx`, `borderRadius: var(--radius-card)`) stays 16px.
- `apps/web/src/app/components/detail/DeviceSettingsTab.tsx`
  - Active preset panel (~:198): `rounded-2xl` → `rounded-[var(--radius-dialog)]`.
  - Mode Information matrix (~:306): `rounded-2xl` → `rounded-[var(--radius-dialog)]`.
  - Outer settings section (~:107) keeps both sources at 16px (`rounded-2xl` + `borderRadius: var(--radius-card)`).
- `apps/web/src/app/components/screens/DetailScreen.tsx`
  - Set-up cycle mode-profile preview (~:445): `rounded-2xl` → `rounded-[var(--radius-dialog)]`. Mandatory with it: inner preview tiles (~:507) `rounded-xl` (20px, already larger than the preview) → `rounded-[var(--radius-dialog)]`.
  - Setup dialog shell (~:303–309, `borderRadius: var(--radius-card)`) stays 16px.

**Phase acceptance:** detail SectionCards and the setup dialog remain 16px computed; nested panels/disclosures compute 12px; third-level tiles compute ≤10px; disclosure, form, and dialog behavior unchanged.

### Phase 3 — Settings and import flows

**Priority:** P1 for the persistent Settings panels; P2 for the rare import-conflict flow.

- `apps/web/src/app/components/settings/ModeLibraryPanel.tsx`
  - Empty state (~:598), grid cards (~:635), table wrapper (~:724): each `rounded-2xl` → `rounded-[var(--radius-dialog)]`.
  - Import conflict cards inside the dialog (~:1017): `rounded-2xl` → `rounded-[var(--radius-dialog)]`. Dialog shells (~:849, ~:890, ~:981) stay 16px.
- `apps/web/src/app/components/settings/NotificationsPanel.tsx`
  - SMS/email delivery cards (~:224, ~:291) and alert-rule cards (~:377): `rounded-2xl` → `rounded-[var(--radius-dialog)]`.
- `apps/web/src/app/components/settings/HardwarePanel.tsx`
  - Paired-device empty state (~:187) and the three preference sections (~:217, ~:275, ~:338): `rounded-2xl` → `rounded-[var(--radius-dialog)]`.
  - Mandatory with the sections: device rows (~:112) `rounded-xl` (computes 20px, would protrude from a 12px section) → `rounded-[var(--radius-compact)]` (10px). Icon badge inside the row is decorative — leave unless screenshots show clipping.
  - Settings shell (`SettingsScreen.tsx:154`) stays `rounded-2xl` 16px.

**Phase acceptance:** the Settings shell remains the dominant 16px surface computed; listed child sections compute 12px; device rows / conflict cards compute ≤12px; tabs, save behavior, forms, and dialog actions are unchanged.

### Phase 4 — Help conversation bubbles

**Priority:** P2 — isolated utility surface.

- `apps/web/src/app/components/HelpWidget.tsx`
  - Three chat bubbles (~:201, ~:216, ~:232): `rounded-2xl` → `rounded-[var(--radius-dialog)]`, and shrink the tails in the same edit because `rounded-tl-md` / `rounded-tr-md` compute to 14px (`--radius-md` = 16px − 2px) — larger than a 12px bubble:
    - bot bubbles: `rounded-tl-md` → `rounded-tl-[var(--radius-mini)]` (4px);
    - user bubble: `rounded-tr-md` → `rounded-tr-[var(--radius-mini)]` (4px).
  - Panel (~:144) stays `rounded-2xl` 16px; launcher button and avatar treatments unchanged.

**Phase acceptance:** bubbles compute 12px with 4px directional tails and no longer visually merge with the 16px panel; tails, padding, text wrapping, and send controls remain visibly unchanged apart from radius.

## Validation gates

1. After each phase, verify computed `border-radius` in devtools (or built CSS), not class names: outers 16px, nested 12px, MiniCards 8px mobile / 12px desktop, third-level tiles/rows 10px, Help tails 4px. Re-check every audit location plus the companions.
2. Grep guard on touched surfaces: no bare `rounded-xl` / `rounded-lg` / `rounded-md` may remain where this plan specifies a token-arbitrary value — in this theme those compute to 20px / 16px / 14px and reintroduce the bug.
3. Capture affected routes at mobile and desktop widths: Overview, Incubators, Candling Logs, Trends, incubator detail Live Monitor, Device Settings, Settings Modes, Settings Notifications, Settings Hardware, and the HelpWidget.
4. Check concentricity at the smallest supported mobile width and at the desktop breakpoint. Confirm no child corner exceeds its parent and no border or background leaks at the corners.
5. Check long names, empty states, tables, disclosures, dialogs, and the HelpWidget for clipping or unexpected height changes.
6. Run the existing frontend checks:
   - `pnpm --filter eggcelerate-ui typecheck`
   - `pnpm --filter eggcelerate-ui test`
   - `pnpm --filter eggcelerate-ui build`
   - `pnpm lint` (biome) for touched files
7. Review the diff to ensure only the planned radius declarations and this plan file changed. No new test file is required for these reversible visual-only class changes; screenshots are the primary closure evidence.

## Completion criteria

The plan is complete when all 17 audit findings plus the 6 second-level companions are either implemented or explicitly deferred with a reason, the specified screenshots show a clear parent-to-child radius hierarchy at computed-pixel level, all existing frontend checks pass, and this plan's Status line is updated with the implementation date and verification counts. Leave the dated audit document immutable — link the completed change from this plan, not from the audit.
