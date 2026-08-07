# Plan: Eggcelerate IoT Dashboard

## Context
Build a full multi-screen React dashboard for "Eggcelerate," an IoT egg incubation monitoring system. The target users are small-scale poultry farmers and IT evaluators running usability tests. The brief is explicit about its aesthetic — warm, rounded, card-based, friendly — so we honor it literally rather than substituting an editorial/archival stance.

## Aesthetic Decisions

**Stance:** Warm smart-farm tool. Generous whitespace, card-based, high legibility, approachable.

**Fonts (Google Fonts):**
- Display: `Baloo 2` (headings, titles, nav labels — bouncy, rounded)
- Body: `Nunito` (body copy, labels, data — clean, rounded, highly legible)

**Palette (maps to theme.css tokens):**
- `--background`: #FBFAF7 (off-white)
- `--foreground`: #2D1A0E (warm dark brown)
- `--card`: #FFFFFF
- `--card-foreground`: #2D1A0E
- `--primary`: #AD3A1D (deep rust red)
- `--primary-foreground`: #FFFFFF
- `--secondary`: #EFE1B7 (cream)
- `--secondary-foreground`: #2D1A0E
- `--muted`: #F5EDD8 (warm muted surface)
- `--muted-foreground`: #8A6B52 (warm brown-gray)
- `--accent`: #D8BE65 (mustard gold)
- `--accent-foreground`: #2D1A0E
- `--border`: rgba(173, 58, 29, 0.12)
- `--ring`: #CB6036
- `--radius`: 1rem (16px — aligns with 12–20px rounded brief)

**State color semantics (utility classes, not new tokens):**
- Optimal/Normal: green tones (`#3D9970` / emerald) 
- Warning: `#CB6036` (burnt orange / amber)
- Critical: `#AD3A1D` (rust red — friendly, not alarming)
- Offline/Battery: `#D8BE65` (mustard gold — "handled," not scary)

## Architecture

Single `App.tsx` with React `useState` for active screen navigation. No routing library needed (single-page, tab-driven).

**Screens (rendered via tab state):**
1. `OverviewScreen` — incubator unit cards grid
2. `DetailScreen` — selected unit detail view
3. `TrendsScreen` — recharts line chart with date filter
4. `AlertsScreen` — chronological alerts list
5. `SettingsScreen` — profiles + preferences

**Shared components (defined inline in App.tsx):**
- `Sidebar` / `TopNav` — navigation with Baloo 2 brand logo + mascot hint
- `StatusBadge` — pill badge: Optimal / Needs Attention / Alert
- `GaugeDial` — SVG arc gauge for temperature and humidity
- `IncubatorCard` — card with live readings, power source, status badge
- `AlertBanner` — persistent top banner when any unit is out of range
- `MascotIllustration` — inline SVG of cracked-egg chick with goggles (used in empty states only)

## File Changes

### `src/styles/fonts.css`
Add Google Fonts imports:
```css
@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&family=Nunito:wght@400;500;600;700&display=swap');
```

### `src/styles/theme.css`
Update `:root` token values per palette above. Preserve all token names, `.dark` block, and `@theme inline` section — only update values in `:root`.

Set `--font-size: 16px`, add font-family custom properties and wire them into `@layer base` `body {}`.

### `src/app/App.tsx`
Full implementation. Key sections:

**Mock data:**
- 3 incubator chambers with varied states (1 optimal, 1 warning, 1 offline/battery)
- Historical readings array (96 data points × 5min = 8 hours, realistic temperature 37.3–38.1°C, humidity 58–68%)
- 12 alert entries of mixed severity
- 3 egg type profiles (Broiler Chicken, Native/Free-Range Chicken, Duck)

**Layout:**
- Desktop: fixed left sidebar (240px) + scrollable main content area
- Tablet/mobile (<1024px): sidebar collapses to bottom tab bar; main content full-width

**Screen 1 — Overview:**
- Alert banner at top (rust red background, friendly wording) if any unit critical
- Grid of `IncubatorCard` components (2-col desktop, 1-col mobile)
- Each card: chamber name + egg type + day badge, temp + humidity readings with small inline trend indicator, power source icon (plug/sun/battery), status badge, "View Details" button

**Screen 2 — Detail (clicking a card navigates here):**
- Back button + chamber name header
- Two large `GaugeDial` SVG components (temperature 35–40°C range, safe band 37.5–37.8°C shaded; humidity 40–80% range, safe band 55–65% shaded)
- Egg turning module: next-turn countdown, last-turned timestamp, "Turn Now" button
- Candling checkpoints: Day 5–7, Day 12–15, Day 18 — each with checkbox to mark complete, upcoming ones highlighted
- Power status module: source selector display, battery %, outage history list
- Egg type selector (dropdown affects displayed target ranges)

**Screen 3 — Historical Trends:**
- `recharts` `ComposedChart` with `Line` (temp), `Line` (humidity), `ReferenceArea` for safe bands
- Date filter: last 24h / 7 days / full incubation buttons
- Two y-axes (temp left, humidity right)
- Tooltip formatted with °C and % units

**Screen 4 — Alerts:**
- Filter chips: All / Critical / Warning / Info
- Chronological list rows with severity icon + color, timestamp, unit name, message
- Empty state with mascot illustration if filter yields no results

**Screen 5 — Settings:**
- Egg type profile cards (edit target temp/humidity ranges, incubation days)
- Turning schedule: interval input (every N hours), auto/manual toggle
- Notifications: checkboxes for alert types + placeholder phone/email fields
- Device pairing: status chips (paired/unpaired) for each chamber device

## Mascot
Inline SVG — a cute cracked egg with a chick head peeking out, wearing round goggle circles. Used only in empty state (Alerts screen when filtered to none) and as a small decorative accent in the sidebar brand mark. Kept simple/cartoon: egg oval outline, crack zigzag, small circular head, beak triangle, two goggle circles with highlight dots.

## Verification
After implementation:
1. Run dev server and navigate all 5 tabs
2. Confirm alert banner appears on Overview (Chamber 3 is "critical" in mock data)
3. Click an incubator card → Detail screen loads with correct chamber data
4. Trends chart renders with recharts, safe-range bands visible
5. Alerts filter chips work (state-driven filtering)
6. Settings screen renders all sections
7. Resize to ~768px width → sidebar collapses to bottom tabs, cards stack to 1-col
