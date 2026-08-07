# Plan: Eggcelerate — IoT Egg Incubation Dashboard

## Context
Build a warm, friendly, multi-screen React dashboard for "Eggcelerate," an IoT poultry egg incubation monitoring system for small-scale farmers and IT usability evaluators. The brief is explicit about aesthetics (warm smart-farm tool, not cold industrial), a fixed brand palette, rounded bouncy typography, and five specific screens. We honor the brief literally.

The project uses **React 18 + Tailwind v4** with a full **shadcn/ui** component library already present at `src/app/components/ui/` (Card, Button, Badge, Tabs, Select, Switch, Checkbox, Slider, Progress, Sonner, etc.) and **recharts 2.15.2** for charts. There is NO `@make-kits` design system — shadcn/ui is our component source of truth. `src/app/App.tsx` is currently an empty placeholder.

## Aesthetic Decisions

**Stance:** Warm smart-farm tool. Generous whitespace, card-based, high legibility, approachable, rounded corners (12–20px).

**Fonts (added ONLY to `src/styles/fonts.css`):**
```css
@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&family=Nunito:wght@400;500;600;700&display=swap');
```
- Display: `Baloo 2` (headings, brand, nav)
- Body: `Nunito` (body, labels, data)

**Palette → `src/styles/theme.css` `:root` token VALUES (keep all token names, `.dark`, and `@theme inline` intact):**
- `--background`: #FBFAF7 · `--foreground`: #2D1A0E
- `--card`: #FFFFFF · `--card-foreground`: #2D1A0E
- `--primary`: #AD3A1D (rust red) · `--primary-foreground`: #FFFFFF
- `--secondary`: #EFE1B7 (cream) · `--secondary-foreground`: #2D1A0E
- `--muted`: #F5EDD8 · `--muted-foreground`: #8A6B52
- `--accent`: #D8BE65 (mustard gold) · `--accent-foreground`: #2D1A0E
- `--border`: rgba(173,58,29,0.12) · `--ring`: #CB6036 · `--radius`: 1rem

Wire Baloo 2 into headings and Nunito into body via `@layer base` in theme.css. Do not add font-size/weight Tailwind utilities unless overriding.

**State color semantics (utility classes / inline styles, NOT new tokens):**
- Optimal: green (#3D9970) · Warning: burnt orange (#CB6036) · Critical: rust red (#AD3A1D) · Offline/Battery: mustard gold (#D8BE65)

## Architecture

Single-page, tab-driven navigation via `useState` in `App.tsx` (no router needed). Selecting an incubator card sets both active screen and selected unit id.

**File structure — create component files under `src/app/components/`:**
- `App.tsx` — shell: layout, nav state, selected-unit state, mock-data source, renders active screen
- `data/mockData.ts` — typed mock data + TypeScript interfaces (single source of truth)
- `components/AppSidebar.tsx` — desktop left nav (240px) + mobile bottom tab bar (uses `use-mobile.ts`)
- `components/StatusBadge.tsx` — Optimal / Needs Attention / Alert pill (wraps ui/badge)
- `components/GaugeDial.tsx` — SVG arc gauge (value, range, safe-band) for temp & humidity
- `components/IncubatorCard.tsx` — overview card (wraps ui/card + StatusBadge)
- `components/AlertBanner.tsx` — top banner when any unit critical
- `components/Mascot.tsx` — inline SVG cracked-egg chick (empty states + sidebar accent)
- `components/screens/OverviewScreen.tsx`
- `components/screens/DetailScreen.tsx`
- `components/screens/TrendsScreen.tsx`
- `components/screens/AlertsScreen.tsx`
- `components/screens/SettingsScreen.tsx`

Import ui components as `import { Card } from "../ui/card"` etc. Use `lucide-react` for icons (Plug, Sun, BatteryMedium, Thermometer, Droplets, RotateCw, Egg, Bell, Settings, etc.).

## Mock Data (`data/mockData.ts`)
- **3 incubator chambers**, varied states: #1 Optimal (grid power), #2 Needs Attention (humidity low, solar), #3 Alert (temp high, battery/offline). Each: id, name, eggType, dayOfIncubation/totalDays, temp, humidity, targetTemp/targetHumidity ranges, powerSource, batteryPct, status, lastTurned, nextTurn.
- **Historical readings**: ~96 points (5-min steps ≈ 8h) per chamber, temp 37.3–38.1°C, humidity 58–68%, with a realistic excursion for the Alert unit.
- **Alerts**: ~12 entries, mixed severity (critical/warning/info), timestamps, unit name, message.
- **Egg profiles**: Broiler Chicken, Native/Free-Range Chicken, Duck — target temp/humidity ranges, incubation days, turning interval, candling checkpoints.

## Screens

1. **Overview** — `AlertBanner` (if any unit critical, friendly wording), responsive grid of `IncubatorCard` (2-col desktop / 1-col mobile). Each card: name + egg type + day badge, temp & humidity with inline trend arrows, power icon, `StatusBadge`, "View Details" button → Detail.
2. **Detail** — back button + header; two large `GaugeDial`s (temp 35–40°C safe 37.5–37.8; humidity 40–80% safe 55–65%); egg-turning module (next-turn countdown, last-turned, "Turn Now" via sonner toast); candling checkpoints (checkboxes, upcoming highlighted); power status (source, battery %, outage list); egg-type `Select` that updates target ranges.
3. **Trends** — recharts `ComposedChart`: `Line` temp + `Line` humidity, `ReferenceArea` safe bands, dual y-axes, formatted tooltip (°C / %). Range filter chips: 24h / 7d / full incubation. Unit selector.
4. **Alerts** — filter chips All/Critical/Warning/Info (state-driven), chronological rows with severity icon+color, timestamp, unit, message. `Mascot` empty state when filter yields none.
5. **Settings** — egg-profile cards (edit target ranges + days), turning schedule (interval input + auto/manual `Switch`), notifications (`Checkbox` list + placeholder phone/email `Input`), device pairing status chips per chamber.

## Layout / Responsiveness
- Desktop (≥1024px): fixed left sidebar 240px + scrollable main.
- <1024px: sidebar → fixed bottom tab bar; content full-width; overview cards stack 1-col; gauges stack. Use existing `src/app/components/ui/use-mobile.ts`.

## Mascot
Inline SVG: egg oval outline + crack zigzag, small chick head peeking, beak triangle, two round goggle circles with highlight dots. Cartoon/simple. Used only in Alerts empty state + small sidebar brand accent.

## Packages
All required packages already in `package.json` (recharts, lucide-react, sonner, shadcn/radix ui). No installs expected. Mount `<Toaster />` from `ui/sonner` once in `App.tsx` for "Turn Now" feedback.

## Verification
1. Dev server is already running — do NOT start it; view via preview surface.
2. Navigate all 5 tabs via sidebar/bottom bar.
3. Confirm `AlertBanner` shows on Overview (Chamber #3 is critical).
4. Click a card → Detail loads with that chamber's data; gauges render with safe bands; "Turn Now" fires a toast.
5. Trends: chart renders, safe-range bands visible, range chips switch data.
6. Alerts: filter chips work; filtering to an empty result shows the mascot empty state.
7. Settings: all four sections render; switches/checkboxes interactive.
8. Resize to ~768px → sidebar collapses to bottom tabs, cards/gauges stack to 1-col.
