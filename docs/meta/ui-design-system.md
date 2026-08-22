# Eggcelerate — UI Inventory & Design System

> Verified from `src/styles/theme.css:1` + `src/app/components/**`. Token values are literal; component counts are file-verified.

---

## 1. Brand & typography

| Token | Value | Source |
|---|---|---|
| Display font | Baloo 2 | `theme.css:5` `--font-display` + `styles/fonts.css` |
| Body font | Nunito | `theme.css:6` `--font-body` |
| Base size | 16px | `theme.css:4` `--font-size:16px` |
| Headings | `h1–h6` → Baloo 2, weight 600 (medium) | `theme.css:134` |
| Body/inputs | Nunito, weight 400 | `theme.css:143` |
| Buttons/labels | Nunito, weight 600 | `theme.css:139` |

Fallback: `ui-rounded, system-ui, sans-serif` (`theme.css:5`).

---

## 2. Color tokens — `theme.css:3`

### 2.1 Light (brand — warm earthy)

```
--background: #FBFAF7   --foreground: #2D1A0E
--card: #FFFFFF         --card-foreground: #2D1A0E
--popover: #FFFFFF
--primary: #AD3A1D (rust) — used for CTAs, active nav, KPI watermark (#A84323 variant)
--secondary: #EFE1B7    --muted: #F5EDD8  --muted-foreground: #8A6B52
--accent: #D8BE65       --accent-foreground: #2D1A0E
--destructive: #AD3A1D  --border: rgba(173,58,29,0.12)
--input-background: #F5EDD8  --switch-background: #D8C9A0
--ring: #CB6036
--chart-1: #AD3A1D  --chart-2: #CB6036  --chart-3: #D8BE65  --chart-4: #3D9970  --chart-5: #8A6B52
--radius: 1rem (16px)
--sidebar: #FFFFFF  --sidebar-primary: #AD3A1D  --sidebar-accent: #F5EDD8
```

Inline-mapped via `@theme inline` (`theme.css:83`) so Tailwind utilities read CSS vars (`--color-primary` etc.).

### 2.2 Dark

Generic `oklch()` values (`theme.css:46`) — **not brand-tuned** (risk noted in `review.md` §8.8). If shipping dark mode, re-token with warm dark equivalents before release.

### 2.3 Frequent hard-coded colors (extracted from screens)

| Color | Usage |
|---|---|
| `#A84323` / `#AD3A1D` RUST | Primary actions, ring when alert, sidebar active |
| `#F9F6F0` CARD , `#FAF6F0` app bg (`App.tsx:291`), `#FFFFFF` surface | Backgrounds |
| `#E8E2D5` / `#EAE7E1` BORDER | Card borders |
| `#1A1A1A` TEXT | Headings |
| `#16A34A` / `#DCFCE7` OK | Optimal/status, fertile chip |
| `#D97706` / `#FEF3C7` WARN | Warning/uncertain |
| `#991B1B` / `#FEE2E2` / `#DC2626` critical | Alert, stopped-developing |
| `TARGET_BAND: rgba(22,163,74,0.12)` | Chart safe-range shading (`TrendsScreen.tsx:67`) |
| `CHAMBER_COLORS: [#3E5C76,#5E8B8B,#8C6A86,#7A6A9B,#A6795C,#6B8E5A]` | Multi-chamber lines (`TrendsScreen.tsx:89`) |

**Recommendation:** promote hard-coded screen colors into `theme.css` vars or `src/app/components/settings/tokens.tsx` to enforce single source.

---

## 3. Radius, shadow, spacing

- Radius: `theme.css:35` `--radius:1rem`; mapped `--radius-sm/md/lg/xl` (`theme.css:110`); cards use `16px` (`OverviewScreen.tsx:34`), detail cards `RADIUS` from `detail/types.ts`.
- Shadow: `cardStyle.boxShadow = "0 2px 12px rgba(0,0,0,0.04)"` (`OverviewScreen.tsx:35`); dialog `shadow-2xl`.
- Spacing: `gap-4` grids, `p-4/5/6` cards, `px-4 sm:px-6 lg:px-8` page (`App.tsx:306`), bottom padding `pb-28` mobile for bottom nav.

---

## 4. Component inventory (verified file list)

### 4.1 UI primitives — `src/app/components/ui/` (11 files)

| File | Radix / role | Where used |
|---|---|---|
| `button.tsx` | `cva` button | Everywhere (CTA, toolbar, dialogs) |
| `card.tsx` | `Card/CardContent` | KPI, chart containers, candling cards |
| `dialog.tsx` | `Radix Dialog` | Candling LogModal, readings modal, harvest |
| `alert-dialog.tsx` | `Radix AlertDialog` | Stop cycle, delete confirm, mode delete guard |
| `select.tsx` | `Radix Select` | Chamber/mode pickers |
| `input.tsx` | input | Search, egg counts, farm name |
| `label.tsx` | label | Forms |
| `switch.tsx` | `Radix Switch` | Compare toggle, autoTurn, notifications |
| `checkbox.tsx` | `Radix Checkbox` | Compare popover multi-select |
| `popover.tsx` | `Radix Popover` | Compare chambers, notifications |
| `table.tsx` | table | Hatch history, readings |
| `progress.tsx` | `Radix Progress` | (present, lightly used) |
| `sonner.tsx` | sonner toaster | Toasts (`App.tsx:391`) |
| `utils.ts` | `cn()` → `clsx + tailwind-merge` | All primitives |
| `use-mobile.ts` | `useIsMobile` hook | `AppSidebar.tsx:49` |

### 4.2 App shell — `src/app/components/`

| Component | File | Notes |
|---|---|---|
| `AppSidebar` | `AppSidebar.tsx:48` | 256px expanded / 64px rail / bottom tabs; edge toggle + hover swap logo (`AppSidebar.tsx:87`) |
| `PageHeader` | `PageHeader.tsx:1` | Title/subtitle, badges, back, bell + `NotificationPopover` |
| `HelpWidget` | `HelpWidget.tsx:1` | Floating help |
| `IncubatorCard` | `IncubatorCard.tsx` | Grid card used by IncubatorsScreen |
| `GaugeDial` | `GaugeDial.tsx` | Temp/humidity gauges |
| `StatusBadge` | `StatusBadge.tsx` | Optimal/Needs Attention/Urgent pill |
| `PowerIndicator` | `PowerIndicator.tsx` | Grid/Battery + pct |
| `SegmentedBattery` | `SegmentedBattery.tsx` | Battery segments |
| `WaterDroplet` | `WaterDroplet.tsx` | Water binary indicator |
| `Mascot` | `Mascot.tsx` | Brand mascot |
| `AlertBanner` | `AlertBanner.tsx` | Alert callout |
| `HarvestModal` | `HarvestModal.tsx` | Finish cycle flow |
| `ViewToggle` | `ViewToggle.tsx` | Grid/list |
| `FieldCounterLabel` | `FieldCounterLabel.tsx` | Form counter |
| `figma/ImageWithFallback` | `figma/ImageWithFallback.tsx` | Asset fallback |

### 4.3 Screens — `src/app/components/screens/` (6)

`OverviewScreen.tsx:149` (224 lines), `IncubatorsScreen.tsx`, `DetailScreen.tsx`, `TrendsScreen.tsx:149` (825), `AlertsScreen.tsx`, `SettingsScreen.tsx`.

### 4.4 Detail — `src/app/components/detail/` (8)

`LiveMonitorTab.tsx`, `CandlingJournalTab.tsx:830` (1189+), `DeviceSettingsTab.tsx`, `Timeline.tsx`, `IncubationCalendar.tsx`, `PhotoLightbox.tsx`, `types.ts`, `primitives.tsx` (`SectionCard` etc.)

### 4.5 Settings — `src/app/components/settings/` (4)

`ModeLibraryPanel.tsx`, `NotificationsPanel.tsx`, `FarmAccountPanel.tsx`, `HardwarePanel.tsx` + `tokens.tsx`.

### 4.6 Alerts/Candling — `src/app/components/alerts/` + `candling/`

`alerts/alertStyle.ts`, `alerts/NotificationPopover.tsx`, `candling/EggIcons.tsx`.

---

## 5. Layout patterns

- **Page shell:** `App.tsx:302` → `<AppSidebar collapsed={navCollapsed}>` + `<main class="lg:pl-16|64">` + centered `max-w-6xl` (`App.tsx:306`), `pt-6` + header `mb-5`.
- **KPI row:** `grid grid-cols-2 lg:grid-cols-4` with `KpiCard` + watermark icon `@ 7% opacity, -12deg` (`OverviewScreen.tsx:54`).
- **Chamber cards:** `grid-cols-2 lg:grid-cols-4`, `MiniCard` with 88px ring (`OverviewScreen.tsx:86`), `strokeLinecap round` + `strokeDashoffset` for pct.
- **Toolbar (Trends):** two-row `border p-4` container (`TrendsScreen.tsx:369`) — row1: chamber select + Compare switch + metric segmented toggle; row2: range pills (`LAST 24H/7D/FULL`).
- **Card container:** `cardStyle: { bg: #F9F6F0 or #FFFFFF, border: #E8E2D5, radius:16, shadow: 0 2px 12px }` repeated; next step: extract to `ui/card.tsx` variant.

---

## 6. Accessibility status

- **Good foundations:** Radix primitives handle focus, ARIA, keyboard. `MiniCard` has `focus-visible:ring-2` and `aria-label` on progress ring (`OverviewScreen.tsx:118`). Sidebar uses `aria-current="page"` (`AppSidebar.tsx:136`), mobile nav exposes labels.
- **Gaps (needs audit before production — per `review.md` + `docs/codex/README.md:180`):**
  - No `skip-to-content` link; focus order across 12-chamber grid untested.
  - Chart (`recharts`) has no keyboard/ARIA alternative; add data table fallback (readings modal is a start: `TrendsScreen.tsx:756`).
  - No `prefers-reduced-motion` handling beyond `tw-animate-css`; motion package animations should respect it.
  - Contrast: muted `#8A6B52` on `#F5EDD8` and `#78716C` on `#F2EEE5` need WCAG AA check.
  - Photo alt text is generic (`Candling photo 1`) — add day/egg count context.

---

## 7. Styling architecture

- **Tailwind v4** — no `tailwind.config.ts`; tokens via `@theme inline` in `theme.css:83`. `tailwind.css` is the entry; `globals.css` is empty.
- **Hybrid approach:** utilities + inline `style={}` + CSS vars. Works, but hard-coded hex in screens bypasses token system — migrate to vars (`--color-rust`, `--color-ok`, `--color-border`) or `tokens.tsx`.
- **Dark mode:** `next-themes` + `.dark` class toggles `theme.css:46`; brand dark palette missing — either remove dark toggle or design dark tokens.

---

## 8. Recommendations

1. **Token consolidation:** move `RUST`, `BORDER`, `OK_*`, `WARN_*`, `TARGET_BAND`, `CHAMBER_COLORS` into `theme.css` or `settings/tokens.tsx` barrel.
2. **Card variant:** add `<Card variant="kpi|panel">` so `cardStyle` is not duplicated in `OverviewScreen.tsx:34` and `TrendsScreen.tsx:334`.
3. **Lazy-load heavy screens:** `TrendsScreen` + `Detail/CandlingJournalTab` behind `React.lazy` — see `docs/meta/roadmap.md`.
4. **a11y pass:** run axe + keyboard + screen-reader audit; add `aria-describedby` for gauge values and table captions.
5. **Reduce inline styles:** prefer `className` with token utilities for hover/focus states.

---

*Counts verified via `glob`. If a new component is added under `src/app/components/`, list it here and decide its token deps.*
