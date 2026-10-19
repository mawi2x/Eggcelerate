# Frontend Compliance Audit — Desktop & Mobile Design Guidelines

**Role:** Senior Frontend QA & UI/UX Auditor
**Audit date:** 2026-10-19
**Target codebase:** `apps/web/src` (React 19, Vite, Tailwind CSS, Radix UI / shadcn primitives)
**Reference guidelines:** `docs/guide/color-guidelines.md`, `docs/guide/typography-guidelines.md`, `docs/guide/typography-experimental.md`, `docs/guide/ui-control-size-guidelines.md`, `docs/guide/ui-copy-guidelines.md`, `docs/guide/screen-note-guidelines.md`, `docs/guide/checkmark-icons.md`, with `apps/web/src/styles/theme.css` as the code source of truth
**Accessibility baseline:** WCAG 2.2 AA (target size, contrast, labels, focus, landmarks)
**Method:** static source review of 277 files + rendered evidence in `output/audit/` (320 / 375 / 402 / 700 / 900 / 1440 px, 200% zoom reflow, dialog/menu/focus/hover states)
**Audit is read-only:** no application source was modified.

> **Scope note:** the original request left the guide paths and target codebase as placeholders. This audit assumes the official guides under `docs/guide/` are the reference system and `apps/web/src` is the target codebase. Unrelated in-progress work in the worktree (benchmark feature, firmware, API) was left untouched; where it introduces new UI, it is flagged inline.

---

## 1. Executive Summary

| Platform | Compliance score | Reading |
|---|---:|---|
| **Desktop (≥768px)** | **65%** | Token system, layout shell, control geometry, focus/hover states are strong. Deductions come from target sizes (timeline nodes, compare checkbox), nine unlabeled form controls, and three contrast misses. |
| **Mobile (<768px)** | **55%** | No horizontal overflow anywhere and the bottom-nav shell is solid. Deductions are concentrated in one systemic pattern — 4–6px dot pagers and 8×12px vertical chamber indexes — plus faint calendar/icon contrast and the same label/contrast issues. |

**Overall readiness:** the frontend is close to guideline-compliant. Three systemic fixes — dot/index hit areas, form-label association, and a small contrast token sweep — would move both scores into the 90s without layout rework.

**What passes cleanly**

- **No horizontal overflow at any tested width** — 320, 375, 402, 700, 900, 1440 px and 200% zoom reflow; all `overflow: false` in `output/audit/reflow.json` and `output/audit/control-runtime.json` (16 path/width combinations).
- **Breakpoint contract holds** — JS `useIsMobile` (<768) matches Tailwind `md`; 640px reading break and 400px small-phone break are consistently applied.
- **Mobile shell is correct** — bottom navigation plus More drawer below 768px, sidebar at ≥768px, safe-area clearance, 320px label collapse, focus moved into the More menu on open.
- **Control geometry follows the role table** — rendered 402px measurements: compact toolbar controls 34px, fields 36px, action buttons 34px, switch root 44px, dialog close 44px, segmented tabs 34/36px.
- **Design tokens dominate** — all font families/weights, nearly all font sizes, surfaces, status colors, radii, and control heights resolve through `theme.css`; only **one raw hex** remains in component code.
- **Interactive states are thorough** — skip link, `focus-visible` rings on shared primitives, roving focus + Arrow/Home/End on tab bars, disabled/loading/`aria-busy` handling, hover states across all desktop controls.
- **Icon-only controls have accessible names** — no unlabeled icon buttons found; `aria-current` correctly marks active navigation and pagination.

**What fails or needs work**

| Area | Count | Worst case |
|---|---:|---|
| Active targets below WCAG 2.2 24×24px | 7 components (1 more latent) | 8×12px vertical chamber index; 20×20px timeline nodes (desktop too) |
| Visible form controls without programmatic labels | 9 | 7 inputs in `ModeLibraryPanel.tsx` |
| Contrast pairs below WCAG AA | 4 distinct pairs | 1.53:1 out-of-cycle calendar days; 2.52:1 faint icon buttons |
| Hardcoded type sizes bypassing tokens | 4 classes / 7 lines | `text-[10px]` at all viewports |
| Raw palette / hex / geometry bypasses | 10 locations | `bg-red-600`, `#ffffff`, `h-[34px]`, `#d5cabe` idle dots (1.61:1) |

**Build/verification status (at time of audit)**

- `pnpm --filter eggcelerate-ui typecheck` — **pass**
- `pnpm --filter eggcelerate-ui build` — **pass** (largest chunk 466.5 kB, under the 500 kB gate)
- `pnpm --filter eggcelerate-ui test` — **340/373 pass, 33 fail (14 files)**. Sampled failures are caused by in-progress work and stale assertions, not by the design findings in this report: missing `QueryClientProvider` in the live-monitor test harness, tests matching exact tab text while the DOM renders both desktop and mobile labels, and the new `sampling_interval_seconds` preferences field. **Recommendation:** repair the suite before using it as a merge gate.

### 1.1 Scoring rubric

Twelve weighted checks; each rated Pass (full weight), Partial (half weight), or Fail (0). The same rubric was applied on both platforms; rendered measurements and source review back every rating.

| # | Check | Weight | Desktop | Mobile |
|---:|---|---:|---|---|
| 1 | No horizontal overflow / breakpoint behavior | 15 | Pass | Pass |
| 2 | Shell, layout, heading hierarchy | 10 | Pass | Pass |
| 3 | Control geometry per role table | 5 | Pass | Pass |
| 4 | Pointer/tap targets ≥ 24×24px (WCAG 2.5.8) | 15 | Partial | Fail |
| 5 | Color token discipline (no raw hex/palette) | 5 | Partial | Partial |
| 6 | Typography token discipline | 5 | Partial | Partial |
| 7 | Spacing / radii / geometry tokens | 5 | Partial | Partial |
| 8 | Text & non-text contrast (WCAG 1.4.3 / 1.4.11) | 15 | Partial | Partial |
| 9 | Hover / focus / disabled / active states | 5 | Pass | Pass |
| 10 | Programmatic form labels (WCAG 1.3.1 / 4.1.2) | 10 | Fail | Fail |
| 11 | Accessible names for icon-only controls | 5 | Pass | Pass |
| 12 | Tabs / panel ARIA wiring | 5 | Partial | Partial |
| | **Weighted total** | **100** | **65** | **55** |

---

## 2. Discrepancy Table

Severity reflects user impact: **High** = blocks or badly degrades a core task or fails a WCAG AA criterion, **Med** = measurable guideline/contrast failure with a workaround, **Low** = token hygiene, consistency, or latent issue.

| Component/File | Platform (Desktop/Mobile) | Guideline Rule | Actual Implementation | Severity (High/Med/Low) | Recommended Code Fix |
|---|---|---|---|---|---|
| `apps/web/src/app/components/incubators/ChamberList.tsx:149` and `apps/web/src/app/components/screens/CandlingLogsScreen.tsx:720` | Mobile | WCAG 2.2 2.5.8 (24×24px); ui-control-size hit-area rule | Vertical chamber index buttons are `h-3 w-2` (12×8px); rendered height **12px** at 320/402/700px in `output/audit/control-runtime.json`, gap-1 so 24px spacing circles overlap | High | Keep the 6px visual bar, add a ≥24px (ideally 44px) transparent hit area via a wrapper or `before:absolute before:-inset-y-2 before:inset-x-1.5`, and increase row gap to ≥12px. |
| `apps/web/src/app/components/detail/Timeline.tsx:388` | Desktop + Mobile | WCAG 2.2 2.5.8; ui-control-size 44px-wrapper rule | Milestone node buttons are `h-5 w-5` (**20×20px**); rendered 20px at 1440/402/320 in `output/audit/detail-panels.json`, track nodes are ~7px apart at 320px | High | Wrap the 20px glyph in a `min-h-11 min-w-11` mobile / `min-h-8 min-w-8` desktop transparent button (or `before:-inset-3`), keep the visual dot size. |
| `apps/web/src/app/components/screens/OverviewScreen.tsx:481,723`; `apps/web/src/app/components/trends/HatchSummaryPanel.tsx:220`; `apps/web/src/app/components/detail/IncubationCalendar.tsx:667` | Mobile (calendar dots also desktop) | WCAG 2.2 2.5.8; ui-control-size "do not shrink hit areas" | Carousel/condition/calendar/species dots are `h-1.5` (6px) with 4–16px widths; `--dot-idle: #d5cabe` is **1.61:1** on white and active-vs-idle is only 3.83:1 | High | Extract a shared `DotPager` that renders ≥24px (44px on touch) hit areas around the 6px mark; add a page counter (`2 of 5`) or darken idle dots to ≥3:1. |
| `apps/web/src/app/components/trends/EnvironmentalTrends.tsx:194-225` | Desktop (Mobile root is 44px) | WCAG 2.5.8; 1.3.1 label association | Compare-list checkbox is a **16×16px** desktop target (`md:size-4`), and the chamber name is a `<span>` in a clickable-looking row — clicking the text does nothing | High | Use `<label htmlFor={...}>` for the whole row, keep the 44px `size-11` root at every breakpoint, and keep the visual indicator at `size-4`. |
| `apps/web/src/app/components/settings/ModeLibraryPanel.tsx:495,932` (calls at `947-987`) | Desktop + Mobile | WCAG 1.3.1 / 3.3.2 / 4.1.2 | Seven visible inputs (mode name + six numeric fields) render a visual `<Label>` with no `htmlFor`, and the `<Input>` has no `id`/`aria-label`; screen readers announce an unnamed edit field | High | Thread a stable `id` through `draftField()` and use `<Label htmlFor={id}>`; alternatively pass `aria-label={label}` on `Input`. |
| `apps/web/src/app/components/detail/CandlingJournalTab.tsx:294,1077` | Desktop + Mobile | WCAG 1.3.1 / 4.1.2 | Quick-note `<textarea>` and custom-day `<Input>` have visible "Note:"/"Day" text but no programmatic label (`id` + `htmlFor` or `aria-label`) | Med | Add `id="journal-quick-note"` + matching `<label htmlFor>`, and `aria-label="Custom day"` on `#custom-day-input`. |
| `apps/web/src/app/components/detail/IncubationCalendar.tsx:276-292` | Desktop + Mobile | WCAG 1.4.3 (4.5:1 text) | Out-of-cycle day numbers use `--text-faint` (`#a8a29e`, 2.52:1) with `opacity: 0.5` → effective **1.53:1**, yet the buttons remain clickable | Med | Use `--text-muted` (`#78716c`, 4.8:1 on card) without opacity for selectable dates; if truly non-interactive, set `disabled`/`aria-disabled` and remove `cursor-pointer`. |
| `apps/web/src/app/components/screens/OverviewScreen.tsx:204`; `apps/web/src/app/components/ActiveIncubatorCard.tsx:69`; `apps/web/src/app/components/detail/CandlingJournalTab.tsx:2489,2498` | Desktop + Mobile | WCAG 1.4.11 (3:1 non-text) | Meaningful icon buttons (chevron, pencil, trash) use `text-[var(--text-faint)]` = **2.52:1** on card surfaces | Med | Switch to `--text-secondary` or `--text-muted`; keep `--text-faint` for decorative placeholders only. |
| `apps/web/src/app/components/settings/ModeLibraryPanel.tsx:765-775` | Desktop | WCAG 1.4.3 (4.5:1 text) | 11px uppercase table headers use `--text-muted #78716c` on `--surface-tile #f2eee5` = **4.14:1** | Med | Use `--text-secondary` for table headers, or darken the header surface text token to ≥4.5:1. |
| `apps/web/src/app/components/settings/HardwarePanel.tsx:248-252` | Desktop + Mobile | WCAG 1.4.3 (4.5:1 text) | 12px "Fixed at 5 minutes" chip uses `MUTED` (`#78716c`) on `--surface-tile #f2eee5` = **4.14:1** | Med | Use `--text-secondary` on the tile chip. |
| `apps/web/src/app/components/IncubatorCard.tsx:180` | Desktop + Mobile | WCAG 1.4.3 (4.5:1 text) | "Awaiting Finish" pill uses `--text-amber-soft #9a6700` on `--surface-pending #fff4d6` = **4.44:1** (0.06 below threshold) | Med | Use `--text-amber-deep` (`#92400e`, 6.47:1) or darken `--text-amber-soft` to ≥4.5:1 on the pending tint. |
| `apps/web/src/app/components/ActiveIncubatorCard.tsx:92` | Desktop + Mobile | typography-guidelines (11px minimum label; tokens only) | Stale badge uses `text-[10px]` at every viewport, bypassing `--type-label`/`--type-caption` | Low | Use `text-(length:--type-label)` (11px desktop / 9px phone per experimental contract) or `text-(length:--type-caption)`. |
| `apps/web/src/app/components/detail/DeviceSettingsTab.tsx:220,231,433,444,606,617` | Mobile + Desktop | typography tokens | `text-[14px]` and `text-[10px]` duplicate values already covered by `--type-heading-sm`, `--type-caption`, and `--type-body-sm` | Low | Replace with `text-(length:--type-heading-sm)` and `text-(length:--type-caption) md:text-(length:--type-body-sm)`. |
| `apps/web/src/app/components/incubators/IncubatorToolbar.tsx:215`; `apps/web/src/app/components/screens/CandlingLogsScreen.tsx:619` (`hover:bg-stone-50`); `apps/web/src/app/components/trends/EnvironmentalTrends.tsx:199` (`hover:bg-amber-50/60`); `apps/web/src/app/components/screens/AlertsScreen.tsx:400` (`hover:bg-amber-100/60`); `apps/web/src/app/components/detail/CandlingJournalTab.tsx:1515` (`bg-red-600`/`hover:bg-red-700`); `apps/web/src/app/components/figma/ImageWithFallback.tsx:20` (`bg-gray-100`); `apps/web/src/app/features/account/profile-photo.ts:27` (`#ffffff`) | Desktop + Mobile | color-guidelines (components must consume tokens, not raw hex/palette) | Raw Tailwind palette classes and one literal hex sit outside `theme.css`; several are one-off hover/overlay colors that will not follow theme changes | Low | Map to semantic tokens (`--nav-hover-bg`, `--surface-action-hover`, `--status-danger-fg/bg`, `--border-default`) and move `#ffffff` into a token (for example `--on-brand` / `--surface-card`). |
| `apps/web/src/app/components/detail/CandlingJournalTab.tsx:2363` (`h-[34px] w-[34px]`); `apps/web/src/app/components/settings/FarmAccountPanel.tsx:139,165`, `CandlingJournalTab.tsx:2347,2363` (`rounded-[12px]`); `SegmentedBattery.tsx:100`, `EnvironmentalTrends.tsx:425`, `IncubationCalendar.tsx:314`, `CandlingJournalTab.tsx:1744` (`borderRadius: 2px`) | Desktop + Mobile | token discipline (ui-control-size; design tokens) | Hardcoded values duplicate `--control-height-mobile` (34px), `--radius-dialog` (12px), and `--radius-bar` (3px) | Low | Replace with `h-[var(--control-height-mobile)]`, `rounded-[var(--radius-dialog)]`, and `border-radius: var(--radius-bar)` (or document 2px bar caps as an intentional physical exception). |
| `apps/web/src/app/App.tsx:361` (1.4), `apps/web/src/app/components/incubators/CreateIncubatorDialog.tsx:103` (1.45), `apps/web/src/app/components/detail/CandlingJournalTab.tsx:369` (1.45), plus numeric 1.2/1.0 in `LiveDateTime.tsx`, `Timeline.tsx`, `CandlingJournalTab.tsx` | Desktop + Mobile | typography-guidelines (unitless leading tokens) | Prose line-heights fall between `--leading-snug 1.25` and `--leading-normal 1.5`; numerals use 1.0/1.2 | Low | Map prose to `--leading-normal`/`--leading-snug`; keep 1.0/1.2 only for numerals/icons and note the exception. |
| `apps/web/src/app/components/screens/TrendsScreen.tsx:132-166` | Desktop + Mobile | ARIA tabs pattern / ui-control guidelines | `role="tablist"`/`role="tab"` + roving focus + `aria-selected`, but no `aria-controls` and no `role="tabpanel"` on the swapped panes (Settings and Detail use navigation semantics instead) | Low | Add ids to the four panes and `aria-controls`/`role="tabpanel"`/`aria-labelledby`, or switch to the `FilterBar navigation` pattern used elsewhere for consistency. |
| `apps/web/src/app/components/ui/pagination-bar.tsx:87-93` | Desktop + Mobile (latent) | WCAG 2.5.8 | The `dots` mini-pager renders 4px-high buttons; **no call site currently passes `dots`**, so this is dead code today but a trap for future use | Low | Fix the shared component before adopting it: wrap or pad to ≥24px, darken `--dot-idle`, and add a page counter. |
| `apps/web/src/app/components/screens/DetailScreen.tsx:554` (in-progress benchmark feature) | Desktop + Mobile | component consistency / control-size contract | Benchmark confirmation uses a raw `<input type="checkbox">` instead of the shared `Checkbox`; the wrapping `<label>` makes it accessible, but the native target is ~13px and styling diverges | Low | Use the shared `Checkbox` with `id` + `<label htmlFor>`, and keep the 44px touch wrapper pattern. |
| `docs/guide/typography-guidelines.md` vs `docs/guide/typography-experimental.md`; `apps/web/src/app/components/ui/typography.tsx` comment | n/a (documentation) | single source of truth | Stable guide says "no essential prose ≤10px, 11px minimum"; experimental doc supersedes it with blanket phone decreases (caption 10 / label 9 / compact 8) and `theme.css` implements the experimental values; the `typography.tsx` comment still claims "never below 11px" | Low | Consolidate into one guide, update the `typography.tsx` comment, and make the experimental status explicit at both call sites. |
| `docs/guide/ui-control-size-guidelines.md` | n/a (documentation) | supersession clarity | The dated contract section says it supersedes older screen-specific 40px examples, but the "Screen application" section below still lists 40px toolbars; code is compliant (34/36px) | Low | Remove or link the superseded 40px examples so implementation and doc can't be read as conflicting. |

---

## 3. Action Plan

### 3.1 Quick wins (one focused day or less)

1. **Give every dot and index a 24px+ hit area (biggest score gain).**
   - `ChamberList.tsx:149`, `CandlingLogsScreen.tsx:720`: keep `h-1.5 w-1` visual bar, wrap in a `flex h-6 w-4 items-center justify-center` button (or add `before:absolute before:-inset-2`), and bump `gap-1` to `gap-2`.
   - `OverviewScreen.tsx:481,723`, `HatchSummaryPanel.tsx:220`, `IncubationCalendar.tsx:667`: add `relative` + `before:absolute before:-inset-[9px] before:content-['']` (or wrap in a 44px button on touch) so the 6px visual stays but the hit area meets 24px (44px on mobile). Add `aria-label` counters (`Go to slide 2 of 5`) which are already partly present.
   - `Timeline.tsx:388`: wrap the 20px node in `min-h-11 min-w-11` mobile / `min-h-8 min-w-8` desktop transparent button; keep the dot visual inside.
2. **Associate the nine unlabeled inputs.**
   - `ModeLibraryPanel.tsx`: add `const fieldId = useId()` (or a slug from `label`) inside `draftField()`, set `id` on `Input`, `htmlFor` on `Label`; do the same for the mode-name field at line 932.
   - `CandlingJournalTab.tsx:294,1077`: add `aria-label="Quick note"` / `aria-label="Custom day"` (or ids + labels).
3. **Contrast token sweep (four pairs).**
   - Replace `--text-faint` with `--text-secondary` on the chevron/pencil/trash icon buttons (`OverviewScreen.tsx:204`, `ActiveIncubatorCard.tsx:69`, `CandlingJournalTab.tsx:2489,2498`).
   - `IncubationCalendar.tsx`: use `--text-muted` and drop `opacity: 0.5` for selectable out-of-cycle dates.
   - `ModeLibraryPanel.tsx` table headers and `HardwarePanel.tsx:248-252` chip: use `--text-secondary`.
   - `IncubatorCard.tsx:180`: use `--text-amber-deep` for the pending badge.
4. **Token hygiene pass.**
   - Replace the raw palette classes listed above with semantic tokens.
   - Replace `text-[10px]`/`text-[14px]` with `text-(length:--type-caption)` / `text-(length:--type-heading-sm)`.
   - Replace `h-[34px] w-[34px]`, `rounded-[12px]`, and `borderRadius: 2px` with the matching custom properties.
5. **Fix the compare row** (`EnvironmentalTrends.tsx:194-225`): make the row a `<label htmlFor>` and use the 44px `size-11` root at all breakpoints.
6. **Trends tabs**: add pane ids and `aria-controls`/`role="tabpanel"` (or switch to the `FilterBar navigation` pattern used by Settings/Detail).
7. **Benchmark checkbox** (`DetailScreen.tsx:554`): swap the raw input for the shared `Checkbox` with `id` + `htmlFor`.

### 3.2 Major refactors (multi-day / cross-cutting)

1. **Shared `DotPager` / carousel-navigation primitive.** Today five screens hand-roll the same 6px dot pattern with its own math, ids, and labels. One shared component with a 44px touch target, visible page counter, `aria-current`, reduced-motion handling, and tokenized active/idle colors removes the largest mobile risk class and the duplicated code behind it.
2. **Enforced form-field contract.** Introduce/require a `Field` wrapper that demands either `id`+`htmlFor` or an `aria-label`, and adopt it in `ModeLibraryPanel`, `CandlingJournalTab`, and the benchmark dialog. Add a lint rule so new inputs cannot ship unlabeled.
3. **Contrast + token governance in CI.** Add an automated check (axe-core in the Playwright pass, plus a stylelint rule banning raw hex and Tailwind palette classes in `apps/web/src/app`). Include the four failing pairs as regression fixtures.
4. **Type-scale cleanup.** Remove the four raw `text-[Npx]` classes, migrate the 1.4/1.45 prose leadings to `--leading-normal`, and consolidate the stable vs experimental typography docs into one contract; update the stale `typography.tsx` comment.
5. **Test-suite repair.** 33 failures block the suite as a merge gate: wrap components under test in `QueryClientProvider` (live-monitor harness), stop matching exact tab text when both mobile and desktop labels render in jsdom (assert on `aria-label` or `data-state` instead), and update the preferences DTO fixture for `sampling_interval_seconds`.

### 3.3 Suggested fix order vs. impact

| Order | Work | Score impact |
|---:|---|---|
| 1 | Dot/index/timeline hit areas | Mobile target check Fail → Partial/Pass; largest single gain |
| 2 | Form-label association (9 controls) | Label check Fail → Pass on both platforms |
| 3 | Contrast token sweep | Contrast Partial → Pass on both platforms |
| 4 | Raw type/geometry/palette token cleanup | Remaining Partial → Pass |
| 5 | Tabs ARIA + doc consolidation | Clears the last Partial checks |

---

## 4. Verification & Evidence

| Artifact | Content |
|---|---|
| `output/audit/reflow.json` | 375px + 720px/200%-zoom reflow across `/candling`, `/alerts`, `/trends`, `/settings`: zero overflow, zero clipped controls |
| `output/audit/control-runtime.json` | 30 width/path runs (320–1440px): zero horizontal overflow; sub-24px targets captured (12px vertical index, 18–21px inline links, 16px checkbox, 18.4px switch inner mark) |
| `output/audit/detail-panels.json` | Live Monitor / Candling panels at 1440/402/320: 20px timeline nodes and 6px calendar dots reproduced at all widths |
| `output/audit/settings-panels.json` | Hardware/notifications/preferences: switch inner marks measured (root is 44px — excluded false positive) |
| `output/audit/states.json` | Hover (brand), focus (3px ring), dialog controls with 44px close target |
| `output/playwright/`, `output/audit/*.png` | Phone screenshots used for spot-checking layout and contrast |
| `pnpm --filter eggcelerate-ui typecheck` | Pass |
| `pnpm --filter eggcelerate-ui build` | Pass |
| `pnpm --filter eggcelerate-ui test` | 340 pass / 33 fail (in-progress feature + stale assertions, detailed in §1) |

**False positives excluded after source verification**

- `Switch` renders an 18.4px inner visual mark inside a 44px `--control-hit-area-icon` root — target is compliant.
- Alert chamber-name buttons (~18–21px high) are inline links inside a sentence; WCAG 2.5.8 has an inline-text exception, and the hit width is the full phrase.
- Hidden file inputs (`FarmAccountPanel`, `ModeLibraryPanel`, `CandlingJournalTab`) are `display:none` and triggered by labeled buttons — not focusable, no label needed.
- `PaginationBar`'s 4px dots are currently unreachable dead code (`dots` prop unused).
- `index.html` `theme-color` hex is a meta tag; CSS variables cannot be used there.
- 1px hairlines, Recharts `strokeWidth`, the `PhotoLightbox` black scrim, and canvas marker colors are documented physical/chart exceptions.

**Known accepted exceptions (not scored)**

- The blanket phone type decrease (caption 10px / label 9px / compact 8px) is explicitly approved in `docs/guide/typography-experimental.md` and is implemented in `theme.css`. The audit records the documentation conflict but treats the runtime values as intentional.
- iOS focus-zoom below 16px input text was accepted with the experimental type scale; no evidence of layout breakage in the reflow pass (no horizontal overflow at 200% zoom).

---

## 5. Notes

1. Two unrelated workstreams are active in this worktree (firmware climate control and a benchmark feature). They were not audited beyond the UI they introduce; the benchmark checkbox note above is the only UI touchpoint.
2. Rendered evidence in `output/audit/` predates the last few benchmark edits; all cited source lines were re-verified against the current working tree at audit time.
3. This audit did not run a fresh browser pass against the modified benchmark screens. If those screens ship, re-run the 320/402px target-size and overflow checks before release.
4. No files were modified by this audit. The report itself is the only artifact added.
