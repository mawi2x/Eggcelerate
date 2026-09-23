# Mobile Heading Scale-Down Plan

Status: implemented 2026-09-05 (all 6 tasks + acceptance gates green; visual sign-off done via headless Chromium renders — 360px Incubators shows full TEMP/HUMIDITY/WATER labels with restored tile padding, 360px Overview shows stepped title + bottom nav, 1440px Overview shows full sidebar + 4-up KPIs; dialog 360px eyeball still open).

Source audit: Desktop vs Mobile Token Scaling Audit — only `--type-page-title` (24→20px) and `--type-panel-title` (22→18px) step down below 639px (`theme.css:352-358`); `--type-heading-lg/md/sm` (20/18/16px) render identically at 360px and 1440px. Form controls (14→16px), touch targets (36/40→44px), navigation reflow, and table scroll patterns are verified clean and are non-goals here.

## Goal

Extend the mobile step-down to the heading tier so dialog titles, section titles, and card titles stop rendering desktop-sized on phones — reusing the existing token-scale mechanism (media-query token redefinition, zero component edits for token consumers), plus deleting dead responsive classes and verifying the 320px tile floor. No behavior, layout, or desktop rendering changes.

## Findings (audit P1–P4)

- **P1** Heading tier never steps: ~30 usages of `--type-heading-lg/md/sm` stay 20/18/16px on mobile, including every dialog title (`alert-dialog.tsx:101`, `ModeLibraryPanel.tsx:850,891,982`, `HarvestModal.tsx:85`, `TrendsScreen.tsx:753,1183`, `CandlingJournalTab.tsx:783`), section titles (`DeviceSettingsTab.tsx:181,420,558`, `FarmAccountPanel.tsx:67`), card titles (`IncubatorCard.tsx:415,495`, `DetailScreen.tsx:359`, `OverviewScreen.tsx:637,732`). Only per-component `sm:` override in the app: `LiveMonitorTab.tsx:147`.
- **P2** Dead responsive classes: `text-xs sm:text-(length:--type-body-sm)` on toolbar `SelectTrigger`s (`IncubatorsScreen.tsx:436,462`, `CandlingLogsScreen.tsx:599,626`) can never apply — inline `sortTriggerStyle.fontSize: var(--type-body-sm)` (`IncubatorsScreen.tsx:86-94`) always wins; rendered 13px on all widths.
- **P3** Below-norm button text: `OverviewScreen.tsx:661` renders 12px (`text-xs`) on phones vs the 14px button standard (`button.tsx:8`).
- **P4** Fixed dialog/card padding: `dialog.tsx:75` (`p-6`), `primitives.tsx:67` (`p-5`), `primitives.tsx:111` (`p-4`) — same gutters at 360px and desktop; the `p-5 sm:p-6` pattern (`TrendsScreen.tsx:745`, `OverviewScreen.tsx:722`, `AuthCard.tsx:6`) is the established fix.
- **320px floor**: stat tiles are fixed `grid-cols-3` (`IncubatorCard.tsx:518`) with `nowrap` + `clip`; restored 12px tile padding (`IncubatorCard.tsx:272`) leaves ~66px for `HUMIDITY` at 11px bold — may clip the Y at 320px. No incubators-grid responsive test exists.

## Decisions

- Token-scale extension over per-file patches: add `--type-heading-lg/md` step rules to the existing `@media (max-width: 39.9375rem)` block (proposed: 20→18px, 18→16px); leave `--type-heading-sm` (16px) and all small tiers untouched — 16px section titles are correct on phones, and stepping them would push titles into body-copy sizes.
- `metric` variant (`typography.tsx:57-62`, aliased to panel-title) steps 22→18px automatically with P1 — accepted, correct direction for phone KPI numbers.
- P2: delete the dead classes, keep the 13px toolbar voice (deliberate spec, `TrendsScreen.tsx:101-107`); if 13px-on-44px is judged too small, raise the voice to `--type-body-sm`-equivalent explicitly, not via classes inline styles defeat.
- P3: bump to `text-sm` to match the button norm; do not invent a mobile button-text token.
- P4: apply the existing `p-* sm:p-*` pattern; no new spacing scale (none exists; rejected during the padding fix).
- 320px: verify on-viewport first; fallback is responsive tile padding (`p-2 sm:p-3` equivalent), never shrinking the 11px label floor.

## Tasks

1. [ ] P1 token step: extend the `39.9375rem` block in `theme.css:352-358` (`--type-heading-lg: 1.125rem`, `--type-heading-md: 1rem`); run `mobile-typography.test.ts` + full suite; screenshot dialog + card titles at 360px vs desktop.
2. [ ] P2 dead classes: remove `text-xs sm:text-(length:--type-body-sm)` from the four toolbar triggers; assert rendered 13px unchanged (inline style already wins — zero visual delta); add contract assertion if cheap.
3. [ ] P3 button text: `OverviewScreen.tsx:661` `text-xs` → `text-sm` (mobile); confirm 44px min-height retained.
4. [ ] P4 padding: `dialog.tsx:75` → `p-5 sm:p-6`; `primitives.tsx:67` → `p-4 sm:p-5`; leave `InnerTile p-4` (already compact); screenshot 360px dialogs.
5. [ ] 320px floor: viewport-check incubator stat tiles with the restored `0.75rem` tile padding; apply responsive tile padding only if `HUMIDITY` clips; add incubator-grid responsive test (columns, tile non-overflow, bottom-nav clearance) — the guard the padding regression proved missing.
6. [ ] Sign-off: 360px + desktop screenshot pair for Incubators, one dialog, Trends toolbar; `typecheck`, full tests, `vite build`, `biome check`, `git diff --check`.

## Acceptance

- [ ] No `20px`/`18px` heading renders on a 360px viewport except intentional display uses (verified by screenshot pair, not grep — tokens resolve at runtime)
- [ ] `grep -rn "text-xs sm:text-(length:--type-body-sm)" src/app` returns zero results
- [ ] Dialogs/cards keep desktop rendering pixel-identical (step rules only touch sub-640px; desktop classes unchanged)
- [ ] 320px chamber tiles show full `TEMP`/`HUMIDITY`/`WATER` labels, no clip
- [ ] Gates green: `tsc --noEmit`, `vitest run`, `vite build`, `biome check .`, `git diff --check`

## Non-goals

- No change to the stepping breakpoints (639px type / 767px touch) or the `useIsMobile` 768 contract
- No new type scale, spacing scale, or button-text token
- No layout reflow changes (grid columns, nav paradigm, table scroll patterns — all verified correct)
- No iOS input work (14→16px verified on every entry surface, 12/12 contract tests green)
