# Filter Bar Drift Audit — Alerts / Incubators / Trends

> **Date:** 2026-08-27 · **Images:** 3 red-boxed screenshots 2026-08-26 (Trends `LAST 24H` / Incubators `ALL (12)` / Alerts `All (12)`)
> **Method:** `grep -R filter|Filter|RangeKey|pill` `apps/web/src` + visual capture + `theme.css` token check · All citations `file:line` · Read alongside `docs/refine/filter-bar-refinement-plan.md` (reasoning) + `docs/superpowers/plans/2026-08-26-filter-bar-consistency.md` (execution plan)
> **Scope:** 3 filter/horizon controls only. Search, sort, compare toggles excluded (they are separate controls).

## Summary

**Same interaction, 3 different components.** The red-boxed bars each filter a list by preset, but they diverge on radius, type scale, casing, spacing, padding, active/inactive colors, and `aria` — so farmer perceives 3 different patterns for 1 concept.

| Bar | File:Line (bar) | Visual from image | Drift vs canonical |
|---|---|---|---|
| **Alerts** `All (12) Urgent (2)…` | `AlertsScreen.tsx:75-99` | `Title Case` `14px` `px-4 py-2` `rounded-full` `gap-2` | active `var(--brand-primary)`/`#fff` ok, inactive `#F5EDD8`/`#5C4636` raw hex, `fontSize var(--type-body-sm) 13px` `weight 600` `line-height normal` — not `11/700 uppercase 0.05em` |
| **Incubators** `ALL (12) OPTIMAL…` | `IncubatorsScreen.tsx:288-311` | `UPPERCASE 11/700 0.05em` `px-3.5 py-1.5` `rounded-full` `gap-2` | **Closest to canonical** — `var(--type-label)` via `11`, `uppercase` `700` `0.05em` correct, active `RUST/var(--on-brand)` `1px` border, inactive `CARD/var(--surface-subtle)` + `BORDER/var(--border-default)` — but `fontSize:11` raw number not `var(--type-label)` token |
| **Trends** `LAST 24H / 7 DAYS / FULL INCUBATION` | `TrendsScreen.tsx:540-566` | `UPPERCASE 11/700 0.05em` `px-4 py-2` `rounded-xl` `gap-2` | **Wrong radius** `rounded-xl 12` vs `pill 9999`, `px-4` vs `px-3.5`, inactive `var(--surface-card)` ok but border `1px` missing semicolon? `active ? "none"` no border — inconsistent with Incubators `1px solid` |

**Verdict:** Incubators is reference; Alerts is type/color outlier; Trends is radius/padding outlier. All 3 bypass shared primitive — raw `<button>` with per-file `style={{}}`.

---

## 1. Exhaustive Inventory — Every Filter Bar Instance

### A. Alerts — `AlertsScreen.tsx:75` `filters:29` `Filter = "all"|critical|warning|info`

```tsx
// AlertsScreen.tsx:29 filters:29
const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },            // Title Case
  { key: "critical", label: "Urgent" },
  { key: "warning", label: "Needs Attention" },
  { key: "info", label: "Reminder" },
];
// AlertsScreen.tsx:80-98 bar
<button
  className="rounded-full px-4 py-2"               // pill OK, but 16px horiz vs 14px canonical
  style={{
    backgroundColor: active ? RUST : "#F5EDD8",    // RUST=var(--brand-primary) OK, inactive raw #F5EDD8 bypasses var(--surface-subtle) #F9F6F0
    color: active ? "#fff" : "#5C4636",            // raw #fff/#5C4636 vs var(--on-brand)/var(--text-secondary)
    fontFamily: "var(--font-body)",                 // OK
    fontSize: "var(--type-body-sm)",                // 0.8125rem 13px — should be var(--type-label) 0.6875rem 11px per canonical
    fontWeight: "var(--weight-semibold)",            // 600 — should be 700
    lineHeight: "var(--leading-normal)",             // 1.5 — should be 1.25 snug
    // missing: letterSpacing var(--tracking-label) 0.05em, textTransform uppercase
  }}
  aria-pressed={active}                             // OK
>
  {f.label} <span>({count})</span>                  // Title Case All/Urgent
</button>
```

Container: `flex flex-wrap gap-2` `AlertsScreen.tsx:75` — correct `gap-2 8px`.

### B. Incubators — `IncubatorsScreen.tsx:288` `filterPills:182` `Filter = "all"|UnitStatus`

```tsx
// IncubatorsScreen.tsx:182
const filterPills: { key: Filter; label: string; count: number }[] = [
  { key: "all", label: "ALL", count: counts.all },           // UPPERCASE correct
  { key: "optimal", label: "OPTIMAL", count: counts.optimal },
  { key: "warning", label: "NEEDS ATTENTION", count: counts.warning },
  { key: "alert", label: "URGENT", count: counts.alert },
];
// IncubatorsScreen.tsx:290-310 bar
<button
  className={`rounded-full px-3.5 py-1.5 ... focus-visible:ring-2`} // pill 9999 correct, padding canonical 14×6 vs Trends 16×8
  style={{
    backgroundColor: active ? RUST : CARD,                     // RUST=var(--brand-primary) CARD=var(--surface-subtle) OK
    color: active ? "var(--on-brand)" : "var(--text-muted)",   // OK — only bar using semantic var for text
    border: `1px solid ${active ? RUST : BORDER}`,             // 1px hairline correct, border color matches bg
    fontWeight: 700, fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", // correct but 11 raw not var(--type-label) 0.6875rem
  }}
>
  {p.label} ({p.count})
</button>
```

Container: `flex flex-wrap gap-2` `IncubatorsScreen.tsx:289` — correct. Hover: `hover:!border-[var(--nav-hover-border)] hover:!bg-[var(--nav-hover-bg)]` only on inactive.

### C. Trends — `TrendsScreen.tsx:540` `ranges:80` `RangeKey = "24h"|"7d"|"full"`

```tsx
// TrendsScreen.tsx:80
const ranges: { key: RangeKey; label: string; hours: number|null }[] = [
  { key: "24h", label: "LAST 24H", hours: 24 },               // UPPERCASE correct
  { key: "7d", label: "LAST 7 DAYS", hours: 24*7 },
  { key: "full", label: "FULL INCUBATION", hours: null },
];
// TrendsScreen.tsx:544-565 bar
<button
  className="rounded-xl px-4 py-2 ..."                         // rounded-xl 12 — WRONG should be rounded-full pill 9999 per standardization-report P1 #2
  style={{
    backgroundColor: active ? RUST : SURFACE,                 // RUST=var(--brand-primary) SURFACE=var(--surface-card) #FFFFFF — OK but differs from Incubators CARD #F9F6F0
    color: active ? "var(--on-brand)" : "var(--text-muted)",  // OK
    fontFamily: "var(--font-body)", fontSize: "var(--type-label)", fontWeight: "var(--weight-bold)", // correct via token — only bar using var(--type-label)
    letterSpacing: "var(--tracking-label)", lineHeight: "var(--leading-snug)", textTransform: "uppercase", // correct
    border: active ? "none" : `1px solid ${BORDER}`,          // active no border vs Incubators 1px RUST — inconsistent; spec says 1px always
  }}
>
  {r.label}
</button>
```

Container: `flex flex-wrap gap-2 pt-4` with `borderTop 1px solid BORDER` `TrendsScreen.tsx:541` — extra top divider not in other bars (Trends has 2-row toolbar `chamber + metric` then `horizon` row).

---

## 2. Token vs Hardcoded — Where Each Bar Bypasses `theme.css:3`

| Token | Canonical | Alerts `AlertsScreen.tsx:87` | Incubators `IncubatorsScreen.tsx:297` | Trends `TrendsScreen.tsx:551` |
|---|---|---|---|---|
| `fontFamily` | `var(--font-body)` | `var(--font-body)` ✓ | `—` (inherits) partial | `var(--font-body)` ✓ |
| `fontSize` | `var(--type-label) 0.6875rem 11px` | `var(--type-body-sm) 13px` ✗ | `11` raw number ✗ | `var(--type-label)` ✓ |
| `fontWeight` | `var(--weight-bold) 700` | `var(--weight-semibold) 600` ✗ | `700` raw ✓ but not var | `var(--weight-bold)` ✓ |
| `tracking` | `var(--tracking-label) 0.05em` | missing ✗ | `0.05em` raw ✓ | `var(--tracking-label)` ✓ |
| `casing` | `uppercase` | `Title Case` ✗ | `UPPERCASE` ✓ | `UPPERCASE` ✓ |
| `active bg` | `var(--brand-primary)` | `var(--brand-primary)` ✓ | `var(--brand-primary)` ✓ | `var(--brand-primary)` ✓ |
| `active fg` | `var(--on-brand)` | `#fff` raw ✗ | `var(--on-brand)` ✓ | `var(--on-brand)` ✓ |
| `inactive bg` | `var(--surface-card)` or `var(--surface-subtle)` | `#F5EDD8` raw ✗ | `var(--surface-subtle)` partial | `var(--surface-card)` ✓ |
| `inactive fg` | `var(--text-muted)` | `#5C4636` raw ✗ | `var(--text-muted)` ✓ | `var(--text-muted)` ✓ |
| `border` | `1px solid var(--border-default)` | `none` ✗ | `1px solid` ✓ | `1px` but active `none` ✗ |
| `radius` | `9999 pill` | `9999 pill` ✓ | `9999 pill` ✓ | `rounded-xl 12` ✗ |
| `padding` | `px-3.5 py-1.5` | `px-4 py-2` ✗ | `px-3.5 py-1.5` ✓ | `px-4 py-2` ✗ |
| `gap` | `gap-2 8px` | `gap-2` ✓ | `gap-2` ✓ | `gap-2` ✓ |
| `focus` | `ring-2 ring-ring ring-offset-2` | `none` ✗ | `ring-2 offset-2` ✓ | `ring-2 offset-2` ✓ |
| `aria` | `aria-pressed` | `aria-pressed` ✓ | missing ✗ | missing ✗ |

**Counts:** Raw hex still present: `AlertsScreen.tsx:88 #F5EDD8/#5C4636` (2), `TrendsScreen.tsx` none after token fix, `IncubatorsScreen.tsx:11` `fontSize:11` raw still counts toward `colors-report.md:310` hex audit residual `446`.

---

## 3. Visual Drift — What Farmer Sees (Red Boxes)

| Image | Expected (canonical) | Actual | Impact |
|---|---|---|---|
| **1 Trends** `HISTORICAL TRENDS` toolbar row 2 | `LAST 24H` pill dark rust, 11px bold uppercase 0.05em, 14px horizontal pad | `LAST 24H` rounded-xl 12 (not pill), 16px pad, no border when active | Same control looks like segmented control, not pill filter — trust dip |
| **2 Incubators** `ALL (12)` row | `ALL (12)` pill, rust/white active vs cream/border inactive, 11px 700 uppercase | Matches canonical most closely — but `fontSize 11` not token so `200%` zoom may not scale as `rem` | Reference — use as base |
| **3 Alerts** `All (12)` row | `ALL (12)` pill 11px 700 uppercase | `All (12)` Title Case 13px 600, cream `#F5EDD8` not `var(--surface-card)`, no tracking, no focus ring | Looks like different component family; `13px` heavier, `All` vs `ALL` casing breaks scan pattern |

All 3 bars have `gap-2` and `rounded-full vs xl` only visible difference at `320px` — at `375px` `Trends` wraps to 2 lines due to `px-4` vs `px-3.5`.

---

## 4. A11y & Behavior

| Check | Alerts `AlertsScreen.tsx:95` | Incubators `IncubatorsScreen.tsx:293` | Trends `TrendsScreen.tsx:549` |
|---|---|---|---|
| `aria-pressed` | ✓ `95` | ✗ missing — screen reader can't tell active filter | ✗ missing |
| `focus-visible:ring` | ✗ none — keyboard Tab invisible | ✓ `ring-2 offset-2` | ✓ `ring-2 offset-2` |
| `keyboard` | `button` native OK | `button` OK | `button` OK |
| `counts` | `All (12)` dynamic `78` OK | `ALL (12)` dynamic `182` OK | No counts (horizon is not filtered list) — OK distinct |
| `color contrast` | `#fff` on `var(--brand-primary)` `6.18:1` AA ✓ `colors-report.md:10` | `var(--on-brand)` on `var(--brand-primary)` ✓ | same ✓ |
| `inactive contrast` | `#5C4636` on `#F5EDD8` `~7:1` OK but token bypass | `var(--text-muted)` on `var(--surface-subtle)` audited ✓ | `var(--text-muted)` on `white` ✓ |

Alert inactive `Title Case 13px 600` fails canonical `label` size — `10px` audit `typography-report.md:1` flagged `11px` as minimum label, `13px` is body-sm so not fail but inconsistent.

---

## 5. Recommendations — Single Source

**Canonical (from `refine/filter-bar-refinement-plan.md:35`):**

```tsx
// src/app/components/ui/filter-bar.tsx
export function FilterBar({ options, value, onChange, ariaLabel }: { options:{key:string,label:string,count?:number}[], value:string, onChange:(k:string)=>void, ariaLabel:string }) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map(o => {
        const active = value===o.key;
        return (
          <button
            key={o.key}
            onClick={()=>onChange(o.key)}
            aria-pressed={active}
            className="rounded-full px-3.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
            style={{
              backgroundColor: active ? "var(--brand-primary)" : "var(--surface-card)",
              color: active ? "var(--on-brand)" : "var(--text-muted)",
              border: `1px solid ${active ? "var(--brand-primary)" : "var(--border-default)"}`,
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-label)", // 0.6875rem 11px rem — scales at 200% zoom
              fontWeight: "var(--weight-bold)", // 700
              letterSpacing: "var(--tracking-label)", // 0.05em
              lineHeight: "var(--leading-snug)", // 1.25
              textTransform: "uppercase",
            }}
          >
            {o.label}{o.count!==undefined ? ` (${o.count})` : ""}
          </button>
        );
      })}
    </div>
  );
}
```

**Mapping:**

- Alerts `AlertsScreen.tsx:75` → `FilterBar options=[{All(12)},{Urgent(2)}...] value=filter` `Title Case → UPPERCASE` `13px 600 → 11px 700` `gap-2` keep
- Incubators `IncubatorsScreen.tsx:288` → `FilterBar` (already closest) — just tokenize `fontSize 11 → var(--type-label)` + add `aria-pressed`
- Trends `TrendsScreen.tsx:540` → `FilterBar` with `count` omitted + `rounded-xl→rounded-full` `px-4→px-3.5` `active border none→1px solid var(--brand-primary)` + keep `borderTop` divider for 2-row toolbar only

**Non-goals:** No logic change — `setFilter/setRange`, counts, `Sort: Name/Recent` selects, compare toggle unchanged.

---

## 6. Verification Before Merge

```bash
pnpm --filter eggcelerate-ui typecheck # 0 errors, no any
pnpm --filter eggcelerate-ui test src/tests/filter-bar.test.ts -v # grep `var(--type-label)` + snapshot pill
pnpm --filter eggcelerate-ui build # index <500kB, no warning
# Manual: 100%/200% zoom + 320/375px — no clip, Tab focus ring visible, aria-pressed toggles, counts (12)(5)(0)(7) correct
rg -n "fontSize: 11|#F5EDD8|#5C4636" apps/web/src/app/components/screens -- should be 0 in bars after
```

Execution plan with code blocks: `docs/superpowers/plans/2026-08-26-filter-bar-consistency.md:1` (5 tasks, TDD, self-review).

---

*Scoured 3 bars exhaustive: `AlertsScreen.tsx:75` `IncubatorsScreen.tsx:288` `TrendsScreen.tsx:540` + tokens `theme.css:3` `color-token-migration.md:11` + `standardization-report.md:5,11,14` + `typography-baseline-2026-08-26.md:13` — 0 missed filter instances across `apps/web/src`.*

---

## 7. Resolution 2026-08-27

Filter bars unified to FilterBar pills `pill 9999` `var(--type-label) 0.6875rem 700 0.05em uppercase` `gap-2` `RUST active` `surface-card inactive` `1px hairline`. Previously Alerts `#F5EDD8/#5C4636 600 13px Title Case` vs Incubators `11 raw` vs Trends `rounded-xl` — now consistent. Remaining raw pills `0` in filter bars. Verified `320/375px` `200%` `focus ring` `aria-pressed`.
