# Typography Phase 3-5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize remaining fonts by migrating screens in batches + fixing outliers + validating zoom, completing `docs/refine/typography-refinement-plan.md` Phases 3-5 without breaking density.

**Architecture:** Reuse `theme.css:7` role tokens `var(--type-*)`/`--weight-*`/`--leading-*`/`--tracking-*` from Phase 1 (html 100% rem), migrate screens batch-wise with token-direct style `fontFamily:"var(--font-display/body)"` + `fontSize:"var(--type-*)"`, keep `px` for 1px borders/hairlines/chart props, preserve `var(--text-*)` colors.

**Tech Stack:** Vite 6.3.5, React 18.3.1, TypeScript 5.6.3 strict, Tailwind 4.1.12, Radix/shadcn, pnpm 9.12.3, `pnpm --filter eggcelerate-ui build` gate

## Global Constraints

- pnpm 9.12.3 only `package.json:4` — use `pnpm --filter eggcelerate-ui build`
- TypeScript strict `noUnusedLocals` `apps/web/tsconfig.json:15` — zero `any`
- Colors via `var(--*)` only `docs/guide/color-guidelines.md:7` — no raw hex in new code
- No `mockData` import outside `data/` boundary
- `vite.config.ts:7` `figmaAssetResolver` + `react()` + `tailwindcss()` must remain
- Keep Baloo 2 / Nunito `typography-refinement-plan.md:41`
- Use `rem` for type, keep `px` for 1px borders/hairlines/icon geometry/chart constraints `typography-refinement-plan.md:48`
- Bundle gate initial `dist/assets/index-*.js` <500kB `docs/plan/chunk-fix-plan.md:15`

---

## File Structure

**Modify:**
- `apps/web/src/app/components/screens/OverviewScreen.tsx:71` — KPI 22/800 Baloo → `var(--type-panel-title)`
- `apps/web/src/app/components/IncubatorCard.tsx:202` — card title 16, badge 11→`var(--type-label)`
- `apps/web/src/app/components/screens/AlertsScreen.tsx:152` — empty 24→`var(--type-page-title)`, pills 11→`var(--type-label)`
- `apps/web/src/app/components/screens/SettingsScreen.tsx` + `settings/ModeLibraryPanel.tsx:110` table 13→`var(--type-body-sm)`
- `apps/web/src/app/components/screens/TrendsScreen.tsx:581` — chart title 18→`var(--type-heading-md)`, axis 11→`var(--type-label)`
- `apps/web/src/app/components/detail/LiveMonitorTab.tsx:90` — gauge 20→`var(--type-heading-lg)`, label 11→`var(--type-label)`
- `apps/web/src/app/components/detail/CandlingJournalTab.tsx:300` — 9px Photo→`var(--type-label)`, summary 24→`var(--type-page-title)` etc.
- `apps/web/src/app/components/detail/IncubationCalendar.tsx:187` — 8px phase→`var(--type-label)` + `IncubationCalendar:116` weekday 10→`var(--type-label)`
- `apps/web/src/app/components/detail/Timeline.tsx:61` — 10→`var(--type-label)` + `Timeline:50` 11→`var(--type-label)`

**Reuse:**
- `apps/web/src/styles/theme.css:7` tokens from Phase 1
- `apps/web/src/app/components/detail/types.ts:31` `TEXT/MUTED` color tokens

---

### Task 1: Migrate Overview + Incubators Batch (Phase 3a)

**Files:**
- Modify: `apps/web/src/app/components/screens/OverviewScreen.tsx:71`
- Modify: `apps/web/src/app/components/IncubatorCard.tsx:202`

**Interfaces:**
- Consumes: tokens `var(--type-panel-title)` `var(--type-body-sm)` etc. from Phase 1
- Produces: Overview/Incubators using tokens, validated build

- [ ] **Step 1: Write failing test for Overview KPI token**

```typescript
// apps/web/src/tests/typography-batch-a.test.ts
import fs from "fs";
import { describe, it, expect } from "vitest";
describe("Overview batch", () => {
  it("KPI uses panel-title token", () => {
    const s = fs.readFileSync("src/app/components/screens/OverviewScreen.tsx","utf-8");
    expect(s).toContain("var(--type-panel-title)");
    expect(s).toContain("var(--font-display)");
    expect(s).not.toMatch(/fontSize:\s*22[^r]/);
  });
});
```

- [ ] **Step 2: Run fails**

Run: `pnpm --filter eggcelerate-ui test src/tests/typography-batch-a.test.ts -- --reporter=verbose`
Expected: FAIL missing `var(--type-panel-title)`

- [ ] **Step 3: Migrate OverviewScreen**

```tsx
// OverviewScreen.tsx:71 KPI value was 22/800 Baloo
<span style={{
  fontFamily: "var(--font-display)",
  fontSize: "var(--type-panel-title)",
  fontWeight: "var(--weight-extrabold)",
  lineHeight: "var(--leading-tight)",
  color: "var(--text-primary)"
}}>{value}</span>

// Table cells 13px -> var(--type-body-sm)
<td style={{
  fontFamily: "var(--font-body)",
  fontSize: "var(--type-body-sm)",
  fontWeight: "var(--weight-regular)",
  lineHeight: "var(--leading-normal)"
}}>{cell}</td>
```

Keep `1px solid var(--border-subtle)` px.

- [ ] **Step 4: Migrate IncubatorCard**

```tsx
// IncubatorCard.tsx card title 16 -> var(--type-heading-sm)
<h3 style={{
  fontFamily: "var(--font-display)",
  fontSize: "var(--type-heading-sm)",
  fontWeight: "var(--weight-semibold)",
  lineHeight: "var(--leading-snug)"
}}>{title}</h3>

// micro-badge 11px uppercase -> var(--type-label)
<span style={{
  fontFamily: "var(--font-body)",
  fontSize: "var(--type-label)",
  fontWeight: "var(--weight-bold)",
  letterSpacing: "var(--tracking-label)",
  lineHeight: "var(--leading-snug)",
  textTransform: "uppercase"
}}>{label}</span>
```

- [ ] **Step 5: Run passes**

Run: `pnpm --filter eggcelerate-ui test src/tests/typography-batch-a.test.ts -- --reporter=verbose` Expected PASS
Run: `pnpm --filter eggcelerate-ui typecheck` PASS; `pnpm --filter eggcelerate-ui build 2>&1 | grep -E "kB|warning"` no warning

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/components/screens/OverviewScreen.tsx apps/web/src/app/components/IncubatorCard.tsx apps/web/src/tests/typography-batch-a.test.ts
git commit -m "refactor(typography): Overview/Incubators to type tokens"
```

---

### Task 2: Migrate Alerts + Settings Batch (Phase 3b)

**Files:**
- Modify: `apps/web/src/app/components/screens/AlertsScreen.tsx:152`
- Modify: `apps/web/src/app/components/settings/ModeLibraryPanel.tsx:110`

**Interfaces:**
- Consumes: Task 1 batch
- Produces: Alerts/Settings tokenized

- [ ] **Step 1: Failing test**

```typescript
// apps/web/src/tests/typography-batch-b.test.ts
it("Alerts empty uses page-title", () => {
  const s = fs.readFileSync("src/app/components/screens/AlertsScreen.tsx","utf-8");
  expect(s).toContain("var(--type-page-title)");
});
```

- [ ] **Step 2: Run fails**

Run: `pnpm --filter eggcelerate-ui test src/tests/typography-batch-b.test.ts -- --reporter=verbose` FAIL

- [ ] **Step 3: Migrate AlertsScreen**

```tsx
// empty state was fontSize 24
<h3 style={{
  fontFamily: "var(--font-display)",
  fontSize: "var(--type-page-title)",
  fontWeight: "var(--weight-bold)",
  lineHeight: "var(--leading-snug)"
}}>All clear</h3>

// pill 11px uppercase
<span style={{
  fontFamily: "var(--font-body)",
  fontSize: "var(--type-label)",
  fontWeight: "var(--weight-bold)",
  letterSpacing: "var(--tracking-label)"
}}>{severity}</span>
```

- [ ] **Step 4: Migrate ModeLibraryPanel**

```tsx
// table cell 13px -> var(--type-body-sm)
<span style={{
  fontFamily: "var(--font-body)",
  fontSize: "var(--type-body-sm)",
  lineHeight: "var(--leading-normal)"
}}>{mode.name}</span>
```

- [ ] **Step 5: Verify**

Run: `pnpm --filter eggcelerate-ui test src/tests/typography-batch-b.test.ts -- --reporter=verbose` PASS; `typecheck` PASS; `build` no warning

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/components/screens/AlertsScreen.tsx apps/web/src/app/components/settings/ModeLibraryPanel.tsx apps/web/src/tests/typography-batch-b.test.ts
git commit -m "refactor(typography): Alerts/Settings to type tokens"
```

---

### Task 3: Migrate Trends + Detail Batches (Phase 3c/d)

**Files:**
- Modify: `apps/web/src/app/components/screens/TrendsScreen.tsx:581`
- Modify: `apps/web/src/app/components/detail/LiveMonitorTab.tsx:90`
- Modify: `apps/web/src/app/components/detail/CandlingJournalTab.tsx:300`
- Modify: `apps/web/src/app/components/detail/IncubationCalendar.tsx:187`
- Modify: `apps/web/src/app/components/detail/Timeline.tsx:61`

**Interfaces:**
- Consumes: prior batches
- Produces: all heavy screens tokenized

- [ ] **Step 1: Failing test**

```typescript
it("Trends chart title uses heading-md", () => {
  const s = fs.readFileSync("src/app/components/screens/TrendsScreen.tsx","utf-8");
  expect(s).toContain("var(--type-heading-md)");
});
it("Calendar 8px fixed", () => {
  const s = fs.readFileSync("src/app/components/detail/IncubationCalendar.tsx","utf-8");
  expect(s).not.toMatch(/fontSize:\s*8[^r]/);
  expect(s).toContain("var(--type-label)");
});
```

- [ ] **Step 2: Run fails**

Run: `pnpm --filter eggcelerate-ui test src/tests/typography-batch-c.test.ts -- --reporter=verbose` FAIL

- [ ] **Step 3: Migrate Trends**

```tsx
// chart title 18/700 Baloo
<h2 style={{
  fontFamily: "var(--font-display)",
  fontSize: "var(--type-heading-md)",
  fontWeight: "var(--weight-bold)",
  lineHeight: "var(--leading-snug)"
}}>Trends</h2>

// axis 11px
<g style={{
  fontFamily: "var(--font-body)",
  fontSize: "var(--type-label)",
  fontWeight: "var(--weight-medium)"
}} />
// keep Recharts numeric props like dot radius 4 px unchanged (chart constraint)
```

- [ ] **Step 4: Migrate Detail/Candling/Calendar**

```tsx
// LiveMonitorTab gauge 20/700
<span style={{
  fontFamily: "var(--font-display)",
  fontSize: "var(--type-heading-lg)",
  fontWeight: "var(--weight-bold)",
  lineHeight: "var(--leading-tight)"
}}>{value}</span>

// Candling 9px Photo -> 11px label token
<span style={{
  fontFamily: "var(--font-body)",
  fontSize: "var(--type-label)",
  fontWeight: "var(--weight-semibold)",
  letterSpacing: "var(--tracking-label)"
}}>Photo</span>

// IncubationCalendar 8px phase label -> 11px + non-text indicator
<span style={{
  fontFamily: "var(--font-body)",
  fontSize: "var(--type-label)",
  fontWeight: "var(--weight-bold)",
  letterSpacing: "var(--tracking-label)"
}}>{phase}</span>
// also add dot indicator alongside text per typography-refinement-plan.md:148

// Timeline 10px -> label
<span style={{
  fontFamily: "var(--font-body)",
  fontSize: "var(--type-label)",
  letterSpacing: "var(--tracking-label)"
}}>{marker}</span>
```

Keep `1px` borders px, chart library numbers px.

- [ ] **Step 5: Verify**

Run: `pnpm --filter eggcelerate-ui test src/tests/typography-batch-c.test.ts -- --reporter=verbose` PASS; `typecheck` PASS; `build` no warning

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/components/screens/TrendsScreen.tsx apps/web/src/app/components/detail/LiveMonitorTab.tsx apps/web/src/app/components/detail/CandlingJournalTab.tsx apps/web/src/app/components/detail/IncubationCalendar.tsx apps/web/src/app/components/detail/Timeline.tsx apps/web/src/tests/typography-batch-c.test.ts
git commit -m "refactor(typography): Trends/Detail/Candling/Calendar to type tokens, fix 8/9px"
```

---

### Task 4: Fix Outliers + Validate + Update Report (Phase 4-5)

**Files:**
- Modify: `apps/web/src/app/components/detail/CandlingJournalTab.tsx` (17/19/22 one-offs)
- Create: `docs/audit/typography-baseline-2026-08-26.md` (optional, gitignored — force-add if needed)

**Interfaces:**
- Consumes: all batches
- Produces: outliers normalized, inventory rerun, report updated

- [ ] **Step 1: Audit outliers**

```bash
grep -R "fontSize: 17\|fontSize: 19\|fontSize: 22" apps/web/src --include="*.tsx" | cat
# normalize: 17-> var(--type-heading-sm) 16 or var(--type-heading-md) 18 depending context; 19-> 18 or 20; 22-> var(--type-panel-title) 22 exact
grep -R "fontWeight: 800" apps/web/src --include="*.tsx" | grep -v "var(--font-display)" | cat
# add var(--font-display) or reduce to 700 if Nunito 800 not loaded
```

- [ ] **Step 2: Normalize one-offs**

```tsx
// example 17px DialogTitle -> closest role
<DialogTitle style={{
  fontFamily: "var(--font-display)",
  fontSize: "var(--type-heading-sm)", // was 17, closest 16
  fontWeight: "var(--weight-bold)"
}}>

// 800 weight without Baloo -> add display
<span style={{
  fontFamily: "var(--font-display)",
  fontSize: "var(--type-heading-md)",
  fontWeight: "var(--weight-extrabold)"
}}>{count}</span>
```

Give long labels `whiteSpace: normal; wordBreak: break-word` instead of `truncate` where needed `typography-refinement-plan.md:152`.

- [ ] **Step 3: Rerun inventory**

```bash
grep -R "fontSize" apps/web/src --include="*.tsx" | wc -l
# expect <150 (was 334)
grep -R "var(--type-" apps/web/src --include="*.tsx" | wc -l
# expect >50
grep -R "fontSize: 8\|fontSize: 9" apps/web/src --include="*.tsx" | wc -l
# expect 0
```

- [ ] **Step 4: Validate zoom/responsive**

Manual `pnpm --filter eggcelerate-ui dev` → check `docs/refine/typography-refinement-plan.md:156`:
- default, 125/150/200% no clip
- 320/375px no horizontal scroll
- long names wrap
- focus visible
- fallback `ui-rounded/system-ui` no shift

Run: `pnpm --filter eggcelerate-ui typecheck` PASS; `pnpm --filter eggcelerate-ui build 2>&1 | grep -E "kB|warning"` no warning

- [ ] **Step 5: Update report**

Update `docs/audit/typography-report.md` counts or create `docs/audit/typography-baseline-2026-08-26.md` with new counts + remaining exceptions (chart props px, illustration 17/22 if kept).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/components/detail/CandlingJournalTab.tsx apps/web/src/app/components/OverviewScreen.tsx docs/audit/typography-baseline-2026-08-26.md
git commit -m "refactor(typography): outliers 17/19/22 + 800-weight + long-label wrap, validate zoom"
```

---

## Self-Review

**Spec coverage:** Phase 3 batches Task1-3 cover `typography-refinement-plan.md:137` Overview/Incubators, Alerts/Settings, Trends/Detail/Candling/Calendar; Phase 4 outliers Task4 covers `typography-refinement-plan.md:147` 8/9px, 10/11px, 800-weight, 17/19/22; Phase 5 validation Task4 covers `typography-refinement-plan.md:154` zoom 200% etc. — no gap.

**Placeholder scan:** No TBD — all code blocks concrete `var(--type-*)` values, test commands exact.

**Type consistency:** Token names `--type-page-title` etc. match Task1 tokens `theme.css:7` reused identically in Tasks1-4; `var(--font-display)` replaces hardcoded Baloo consistently.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-26-typography-phase345.md`. Two execution options:

**1. Subagent-Driven (recommended)** - dispatch fresh subagent per task, review between tasks

**2. Inline Execution** - execute tasks in this session using executing-plans, batch with checkpoints

**Which approach?**
