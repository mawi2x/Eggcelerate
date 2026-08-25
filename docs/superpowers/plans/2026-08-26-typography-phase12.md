# Typography Phase 1-2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scalable typography tokens and migrate shared primitives (PageHeader, SectionCard, buttons/inputs/selects, sidebar) to use `rem` tokens without breaking dashboard density, per `docs/refine/typography-refinement-plan.md` Phases 1-2.

**Architecture:** Tokens in `theme.css:3` `:root` as source of truth (`--type-*`, `--weight-*`, `--leading-*`, `--tracking-*`); change root `16px` → `100%`; migrate high-reuse primitives first with `var(--font-display/body)` + `var(--type-*)` inline styles (token-direct Approach A), keep `px` for 1px borders/hairlines, validate at 100%/200% zoom before screen batches.

**Tech Stack:** Vite 6.3.5, React 18.3.1, TypeScript 5.6.3 strict, Tailwind 4.1.12, Radix/shadcn, pnpm 9.12.3, `pnpm --filter eggcelerate-ui build` + `typecheck` gates

## Global Constraints

- pnpm 9.12.3 only `package.json:4` — use `pnpm --filter eggcelerate-ui build`, never `npm`
- TypeScript strict `noUnusedLocals` `apps/web/tsconfig.json:15` — zero `any`
- Colors via `var(--*)` only `docs/guide/color-guidelines.md:7` — no raw hex in new code (keep `var(--text-primary)` etc. when touching typography)
- No `mockData` import outside `data/` boundary
- `vite.config.ts:7` `figmaAssetResolver` + `react()` + `tailwindcss()` must remain
- Keep Baloo 2 / Nunito `typography-refinement-plan.md:41` — do not replace families
- Use `rem` for type, keep `px` for 1px borders/hairlines/icon geometry/chart constraints `typography-refinement-plan.md:48`
- Bundle gate initial `dist/assets/index-*.js` <500kB `docs/plan/chunk-fix-plan.md:15` must stay green

---

## File Structure

**Modify:**
- `apps/web/src/styles/theme.css:3` — add type/weight/leading/tracking tokens, change `html{font-size:100%}`
- `apps/web/src/app/components/PageHeader.tsx:85` — h1 24→`var(--type-page-title)` etc.
- `apps/web/src/app/components/detail/primitives.tsx:60` — `SectionCard` h3 16→`var(--type-heading-sm)` etc.
- `apps/web/src/app/components/ui/button.tsx:8` — `text-sm` kept or token
- `apps/web/src/app/components/ui/input.tsx` — input 14→`var(--type-body)`
- `apps/web/src/app/components/ui/select.tsx` — select triggers
- `apps/web/src/app/components/ui/label.tsx` — label 14→`var(--type-body)`
- `apps/web/src/app/components/AppSidebar.tsx:289` — brand 18→`var(--type-heading-md)`
- `apps/web/src/app/components/UtilityHeader.tsx` — if exists, similar

**Create:**
- `apps/web/src/tests/typography-tokens.test.ts` — inventory grep test for tokens + no `fontSize: 9/10` essential prose
- `docs/audit/typography-baseline-2026-08-26.md` — refreshed counts (optional, gitignored)

**Reuse:**
- `apps/web/src/app/components/detail/types.ts:10` `TEXT/MUTED` color tokens stay
- `apps/web/src/styles/theme.css:15` color tokens untouched

---

### Task 1: Refresh Baseline + Add Tokens + Root 100% (Phase 0-1)

**Files:**
- Modify: `apps/web/src/styles/theme.css:3`
- Create: `apps/web/src/tests/typography-tokens.test.ts`

**Interfaces:**
- Consumes: existing `theme.css:3` `--font-display`/`--font-body`/`--font-size`
- Produces: `--type-*`, `--weight-*`, `--leading-*`, `--tracking-*` vars used by Task 2-3

- [ ] **Step 1: Rerun inventory (record counts)**

```bash
grep -R "fontSize" apps/web/src --include="*.tsx" --include="*.ts" | wc -l
# Expected: ~334 (was 331 in plan, now 334) — record in commit message
grep -R "fontFamily" apps/web/src --include="*.tsx" | wc -l
# Expected: 26
grep -R "fontSize: 8\|fontSize: 9" apps/web/src --include="*.tsx" | cat
# Expected: 2 hits (IncubationCalendar 8px, CandlingJournalTab 9px) — outliers for Phase 4
```

- [ ] **Step 2: Write failing token test**

```typescript
// apps/web/src/tests/typography-tokens.test.ts
import { describe, it, expect } from "vitest";
import fs from "fs";
describe("typography tokens", () => {
  it("theme.css defines type tokens", () => {
    const css = fs.readFileSync("src/styles/theme.css", "utf-8");
    expect(css).toContain("--type-page-title: 1.5rem");
    expect(css).toContain("--type-body: 0.875rem");
    expect(css).toContain("--weight-bold: 700");
    expect(css).toContain("--leading-snug: 1.25");
    expect(css).toContain("--tracking-label: 0.05em");
  });
  it("root is 100% not 16px", () => {
    const css = fs.readFileSync("src/styles/theme.css", "utf-8");
    expect(css).toMatch(/html\s*\{\s*font-size:\s*100%/);
    expect(css).not.toContain("--font-size: 16px");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter eggcelerate-ui test src/tests/typography-tokens.test.ts -v`
Expected: FAIL "Cannot find module" or missing tokens (before edit)

- [ ] **Step 4: Add tokens + root change**

```css
/* apps/web/src/styles/theme.css:3 — replace :root top */
:root {
  --font-display: "Baloo 2", ui-rounded, system-ui, sans-serif;
  --font-body: "Nunito", ui-rounded, system-ui, sans-serif;

  /* Type scale — role-named */
  --type-page-title: 1.5rem;      /* 24px */
  --type-panel-title: 1.375rem;   /* 22px */
  --type-heading-lg: 1.25rem;     /* 20px */
  --type-heading-md: 1.125rem;    /* 18px */
  --type-heading-sm: 1rem;        /* 16px */
  --type-body: 0.875rem;          /* 14px */
  --type-body-sm: 0.8125rem;      /* 13px */
  --type-caption: 0.75rem;        /* 12px */
  --type-label: 0.6875rem;        /* 11px */

  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --weight-extrabold: 800;

  --leading-tight: 1.1;
  --leading-snug: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.6;

  --tracking-label: 0.05em;
  --tracking-tight: -0.01em;
```

```css
/* theme.css:182 — change html */
html {
  font-size: 100%;
}
```

Keep color primitives `theme.css:8` untouched. Keep `--font-display`/`--font-body` names.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter eggcelerate-ui test src/tests/typography-tokens.test.ts -v`
Expected: PASS 2 tests

- [ ] **Step 6: Verify build still <500kB and typecheck**

Run: `pnpm --filter eggcelerate-ui typecheck` Expected PASS
Run: `pnpm --filter eggcelerate-ui build 2>&1 | grep -E "kB|warning"` Expected no warning, `index 289k` etc.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/styles/theme.css apps/web/src/tests/typography-tokens.test.ts
git commit -m "feat(typography): add type/weight/leading/tracking tokens + root 100%

Phase 1 tokens var(--type-page-title) etc., html 100% for zoom, keep Baloo/Nunito"
```

---

### Task 2: Migrate PageHeader + SectionCard Primitives (Phase 2a)

**Files:**
- Modify: `apps/web/src/app/components/PageHeader.tsx:85`
- Modify: `apps/web/src/app/components/detail/primitives.tsx:60`

**Interfaces:**
- Consumes: tokens from Task 1 `var(--type-*)` etc.
- Produces: `PageHeader` and `SectionCard` using semantic tokens, consumed by all screens

- [ ] **Step 1: Write failing test for PageHeader token usage**

```typescript
// add to apps/web/src/tests/typography-tokens.test.ts
it("PageHeader uses type tokens not hardcoded 24/14", () => {
  const s = fs.readFileSync("src/app/components/PageHeader.tsx", "utf-8");
  expect(s).toContain("var(--type-page-title)");
  expect(s).toContain("var(--type-body)");
  expect(s).not.toMatch(/fontSize:\s*24[^r]/); // no raw 24px
});
```

- [ ] **Step 2: Run test fails**

Run: `pnpm --filter eggcelerate-ui test src/tests/typography-tokens.test.ts -v` Expected FAIL missing `var(--type-page-title)`

- [ ] **Step 3: Migrate PageHeader**

```tsx
// apps/web/src/app/components/PageHeader.tsx:85
<h1 style={{
  fontFamily: "var(--font-display)",
  fontSize: "var(--type-page-title)",
  fontWeight: "var(--weight-bold)",
  lineHeight: "var(--leading-snug)",
  color: "var(--text-primary)"
}}> {title} </h1>

<p style={{
  fontFamily: "var(--font-body)",
  fontSize: "var(--type-body)",
  fontWeight: "var(--weight-regular)",
  lineHeight: "var(--leading-normal)",
  color: "var(--text-secondary)"
}}> {subtitle} </p>
```

Keep `px` borders `1px solid var(--border-subtle)` unchanged. No new hex.

- [ ] **Step 4: Migrate SectionCard primitives**

```tsx
// apps/web/src/app/components/detail/primitives.tsx:60
<h3 style={{
  fontFamily: "var(--font-display)",
  fontSize: "var(--type-heading-sm)",
  fontWeight: "var(--weight-semibold)",
  lineHeight: "var(--leading-snug)",
  color: "var(--text-primary)"
}}>{title}</h3>

<p style={{
  fontFamily: "var(--font-body)",
  fontSize: "var(--type-caption)",
  fontWeight: "var(--weight-regular)",
  lineHeight: "var(--leading-normal)",
  color: "var(--text-secondary)"
}}>{subtitle}</p>
```

Replace `fontFamily: "Baloo 2, sans-serif"` → `var(--font-display)`.

- [ ] **Step 5: Run tests pass**

Run: `pnpm --filter eggcelerate-ui test src/tests/typography-tokens.test.ts -v` Expected PASS
Run: `pnpm --filter eggcelerate-ui build 2>&1 | tail -n 10` Expected no warning

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/components/PageHeader.tsx apps/web/src/app/components/detail/primitives.tsx apps/web/src/tests/typography-tokens.test.ts
git commit -m "refactor(typography): PageHeader + SectionCard to type tokens

h1 var(--type-page-title) Baloo 700, subtitle var(--type-body) Nunito, keep px borders"
```

---

### Task 3: Migrate Buttons/Inputs/Selects/Sidebar + Validate Zoom (Phase 2b)

**Files:**
- Modify: `apps/web/src/app/components/ui/button.tsx:8`
- Modify: `apps/web/src/app/components/ui/input.tsx`
- Modify: `apps/web/src/app/components/ui/select.tsx`
- Modify: `apps/web/src/app/components/ui/label.tsx`
- Modify: `apps/web/src/app/components/AppSidebar.tsx:289`

**Interfaces:**
- Consumes: tokens from Task 1, migrated PageHeader from Task 2
- Produces: All shared controls using tokens, validated 200% zoom

- [ ] **Step 1: Write test for controls**

```typescript
it("button/input/label use body token", () => {
  const btn = fs.readFileSync("src/app/components/ui/button.tsx", "utf-8");
  // allow Tailwind text-sm (0.875rem = var(--type-body)) or var(--type-body)
  expect(btn).toMatch(/text-sm|var\(--type-body\)/);
  const label = fs.readFileSync("src/app/components/ui/label.tsx", "utf-8");
  expect(label).toContain("var(--type-body)");
});
```

- [ ] **Step 2: Run fails**

Run: `pnpm --filter eggcelerate-ui test src/tests/typography-tokens.test.ts -v` Expected FAIL

- [ ] **Step 3: Migrate controls**

```tsx
// button.tsx: keep text-sm (already rem) or add:
// className="text-sm" stays (0.875rem = var(--type-body)) — no change needed if exists
// else: style={{ fontFamily:"var(--font-body)", fontSize:"var(--type-body)", fontWeight:"var(--weight-medium)", lineHeight:"var(--leading-normal)" }}

// input.tsx
<input style={{ fontFamily:"var(--font-body)", fontSize:"var(--type-body)", fontWeight:"var(--weight-regular)", lineHeight:"var(--leading-normal)" }} />

// label.tsx
<label style={{ fontFamily:"var(--font-body)", fontSize:"var(--type-body)", fontWeight:"var(--weight-medium)", lineHeight:"var(--leading-snug)" }} />

// select.tsx Trigger
<SelectTrigger style={{ fontFamily:"var(--font-body)", fontSize:"var(--type-body)" }} />

// AppSidebar.tsx:289 brand
<span style={{ fontFamily:"var(--font-display)", fontSize:"var(--type-heading-md)", fontWeight:"var(--weight-bold)", lineHeight:"var(--leading-snug)", color:"var(--text-primary)" }}>Eggcelerate</span>
```

Keep sidebar nav 11px labels as `var(--type-label)` `typography-refinement-plan.md:72`:

```tsx
<span style={{ fontFamily:"var(--font-body)", fontSize:"var(--type-label)", fontWeight:"var(--weight-bold)", lineHeight:"var(--leading-snug)", letterSpacing:"var(--tracking-label)" }}>{label}</span>
```

- [ ] **Step 4: Validate zoom and build**

Run: `pnpm --filter eggcelerate-ui typecheck` PASS
Run: `pnpm --filter eggcelerate-ui build 2>&1 | grep -E "kB|warning"` no warning
Manual: `pnpm --filter eggcelerate-ui dev` → test 100%/125%/150%/200% zoom, 320/375px, long names, focus visible — no clip per `typography-refinement-plan.md:156`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/components/ui/button.tsx apps/web/src/app/components/ui/input.tsx apps/web/src/app/components/ui/select.tsx apps/web/src/app/components/ui/label.tsx apps/web/src/app/components/AppSidebar.tsx apps/web/src/tests/typography-tokens.test.ts
git commit -m "refactor(typography): controls + sidebar to body/label tokens, validate zoom

button/input/label var(--type-body), sidebar brand var(--type-heading-md) Baloo, labels var(--type-label) 11px"
```

---

## Self-Review

**Spec coverage:** Phase 1 tokens+root covered Task1, Phase 2 primitives split Task2 (PageHeader/SectionCard) + Task3 (controls/sidebar), audit rerun Task1 Step1, 8/9px outlier deferred to Phase 4 (out of scope per spec's Phases 1-2 first) — no gap.

**Placeholder scan:** No TBD — all code blocks concrete with `var(--type-*)` values `1.5rem` etc., test commands explicit.

**Type consistency:** Token names `--type-page-title` etc. match `typography-refinement-plan.md:58` in Task1 and reused identically in Task2-3; `var(--font-display)` replaces hardcoded `"Baloo 2, sans-serif"` consistently.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-26-typography-phase12.md`. Two execution options:

**1. Subagent-Driven (recommended)** - dispatch fresh subagent per task, review between tasks

**2. Inline Execution** - execute tasks in this session using executing-plans, batch with checkpoints

**Which approach?**
