# MASTER FIGMA AI PROMPT: EGGCELERATE SMART INCUBATION DASHBOARD

Redesign and unify the complete Eggcelerate Smart Incubation Monitor web application into a cohesive, highly accessible, production-ready Figma design system. Handle 10+ data items per view with clean scrolling, sticky headers, and responsive layout wrapping.

==================================================
1. GLOBAL DESIGN SYSTEM & TOKENS
==================================================
- Primary Accent: Brand Rust (#AD3A1D) for main call-to-action buttons, active navigation states, and primary fills.
- Surface Palette:
  - Main Background: Off-white (#FBFAF7)
  - Card & Container Surfaces: Warm Cream (#F9F6F0)
  - Card Borders: Muted Beige (#E8E2D5)
  - Form Inputs: Crisp Light Beige (#F2EEE5) with visible border (#D8D0C0)
- Semantic Status Palette (Strict WCAG AA):
  - Optimal / Active / Running: Muted Sage Green (#16A34A text, #DCFCE7 bg)
  - Warning / Attention / Heating: Warm Amber (#D97706 text, #FEF3C7 bg)
  - Alert / Critical / Low Level: Crimson Red (#DC2626 text, #FEE2E2 bg)
- Typography & Contrast Hierarchy:
  - Font Family: Nunito or Inter (Warm Sans-Serif).
  - Primary Headings: Bold Dark Brown (#2D241E).
  - Body Text: Medium Brown (#3D3228).
  - Captions & Secondary Text: Darkened Muted Brown (#5A4838) — STRICT 4.5:1 minimum contrast ratio against cream backgrounds.
- Component Specifications:
  - Cards: 16px corner radius (rounded-2xl) with 1px border (#E8E2D5) and subtle 12px blur drop-shadow (4% opacity).
  - Buttons: 12px corner radius (rounded-xl), 40px min-height, visible focus outline on keyboard tab.
  - Inputs: Visible 1px border (#D8D0C0), 12px radius, explicit focus ring (`focus:border-primary focus:ring-2 focus:ring-primary/20`).

==================================================
2. SCREEN 1: INCUBATORS DASHBOARD (GRID & LIST VIEWS)
==================================================
- Top Action Bar:
  - Page Title: 'Incubators' (28px bold) + Subtitle 'Manage each chamber, assign a Mode, and open its full configuration.'
  - Controls Row: Search Input ('Search chambers...') + Filter Pills ['All (12)', 'Optimal (7)', 'Needs Attention (3)', 'Alert (2)'] + View Switcher (Grid / List) + Primary Button '+ Add Incubator' (Rust #AD3A1D).
- Grid View Layout (Multi-Card Overflow):
  - Responsive 3-Column Grid (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`) displaying 12 incubator cards.
  - Incubator Card Structure:
    - Header: Chamber Name (e.g. 'Chamber One') + Mode Badge ('Broiler') + Status Badge ('Optimal' / 'Needs Attention' / 'Alert').
    - Metric Grid (3 Tiles): Temperature (with trend ↗0.1), Humidity (with trend ↘0.3), Water Level (%). Out-of-range metrics shown in Crimson Red with warning icon.
    - Cycle Progress: 'Day X of Y' subtext + horizontal rust progress bar on light track.
    - Footer: Power source badge ('Grid Power' / 'Solar' / 'Battery Backup 23%') + 'Configure →' primary button.
- List / Table View Layout:
  - Sticky table header (`sticky top-0 bg-surface z-10 border-b border-border`) for smooth scrolling through 12+ rows.
  - Columns: Chamber | Mode | Day | Temp | Humidity | Water | Status | Action.
  - Hover Effect: Row highlight (`hover:bg-amber-50/60`) signaling clickability.
  - Bottom Pagination Bar: 'Showing 1–10 of 12 chambers' with Page 1/2 controls and 'Rows per page: 10' dropdown.

==================================================
3. SCREEN 2: CHAMBER DETAIL SCREEN (3 SUB-TABS)
==================================================
- Header Bar: Breadcrumb '← Back to Incubators', Title 'Chamber One', 'Day 9 of 21' badge, Device ID 'EGG-1003', Top-Right Status Badge.
- Sub-Tab Navigation: Segmented pill control for ['Live Monitor' (active), 'Candling & Inspection', 'Device Settings'].
- Tab 1: Live Monitor
  - Incubation Snapshot Card: Progress timeline (D1 -> D6 -> Today -> D13 -> D18 -> Day 21) + 2 Semi-circular Gauges (Temp 37.6°C, Humidity 57.0%) with clear range sub-labels ('Safe range: 37.5–37.8°C').
  - Active Systems Card: Status list for Heater (Amber 'Heating'), Fan (Green 'Running'), Mist Maker (Green 'Active').
  - Schedule & Water Cards: Turning schedule card + Water reservoir card with 'Turn Now' and 'Mark as Refilled' buttons.
- Tab 2: Candling & Inspection
  - Timeline Header Card: Milestone timeline with status dots (Logged: Green, Due: Amber, Upcoming: Gray) + '+ Log Inspection' button.
  - Candling Form Card: Dropdown for Checkpoint, 3 Numeric Steppers (- / + buttons) for Fertile / Clear / Uncertain, Inspector Notes textarea, Dashed Photo Dropzone, 'Cancel' ghost button + 'Save Inspection' rust button.
  - Inspection History List: Stack of 10 historical log cards with count chips and photo thumbnails.
- Tab 3: Device Settings
  - Mode selector dropdown ('Broiler · 21 days').
  - Turning configuration card (Auto-turn toggle, 'Turn every X hours' input, 'Turn Now' button).
  - Water settings card + Device connection status card (2-column key-value grid for Power, Device ID, Pairing status).

==================================================
4. SCREEN 3: SETTINGS PAGE
==================================================
- Section 1: Mode Library Card
  - Action Header: Search input ('Filter modes...') + View toggle + 'Import' + 'Export' + '+ Add Custom Mode' button.
  - Mode Table (10+ Items): Columns: Mode Name | Temp Range | Humidity Range | Duration | Turn Every | Candling Days | Actions. Custom modes display a distinct 'Custom' badge.
  - Scroll & Pagination: Fixed max-height scroll container with sticky header and bottom pagination ('Showing 1-10 of 10 modes').
- Section 2: Notifications Card
  - Checkbox Grid (2 Columns): Evenly aligned checkboxes with explicit labels for Temperature out of range, Humidity out of range, Water level low, Egg turning reminders, Power source changes, Candling checkpoints, Hatch day approaching.
  - Form Fields: 'Phone (SMS)' and 'Email' inputs with visible borders (#D8D0C0) and focus rings.
- Section 3: Account Card
  - 2-Column Form Grid: 'Farm Name', 'Account Holder', 'Temperature Units' (Dropdown), 'Time Zone' (Dropdown).
- Sticky Page Action:
  - Sticky bottom action bar containing a prominent 'Save Changes' primary rust button, ensuring visibility regardless of page scroll depth.

==================================================
5. EMBEDDED MOCK DATA DIRECTIVES (10+ ITEMS EACH)
==================================================
- Incubators Dataset (12 Items):
  1. Chamber One | Broiler | Day 9/21 | 37.6°C | 57% | Water 78% | Grid Power | Optimal
  2. Chamber Two | Duck | Day 14/28 | 37.5°C | 51% | Water 34% | Solar | Needs Attention
  3. Chamber Three | Quail | Day 15/18 | 39.2°C (High) | 64% | Water 12% (Low) | Battery 23% | Alert
  4. Chamber Four | Goose | Day 22/30 | 37.4°C | 62% | Water 88% | Grid Power | Optimal
  5. Chamber Five | Turkey | Day 5/28 | 37.7°C | 58% | Water 65% | Solar | Optimal
  6. Chamber Six | Pheasant | Day 11/24 | 38.1°C | 49% | Water 18% | Grid Power | Needs Attention
  7. Chamber Seven | Broiler | Day 1/21 | 37.6°C | 56% | Water 100% | Grid Power | Optimal
  8. Chamber Eight | Peafowl | Day 18/28 | 39.8°C (High) | 42% | Water 8% (Low) | Battery 15% | Alert
  9. Chamber Nine | Quail | Day 17/18 | 37.5°C | 68% | Water 90% | Solar | Optimal
  10. Chamber Ten | Duck | Day 3/28 | 37.6°C | 55% | Water 82% | Grid Power | Optimal
  11. Chamber Eleven | Swan | Day 29/36 | 36.9°C | 71% | Water 25% | Solar | Needs Attention
  12. Chamber Twelve | Broiler Custom | Day 20/21 | 37.5°C | 65% | Water 92% | Grid Power | Optimal

- Mode Library Dataset (10 Items):
  Presets: Broiler (21d), Duck (28d), Quail (18d), Goose (30d), Turkey (28d), Pheasant (24d), Peafowl (28d), Swan (36d).
  Customs: Broiler High-Humidity (21d, Custom badge), Rapid Quail Experimental (17d, Custom badge).

- Inspection History Dataset (10 Logs):
  Logs spanning First Candling, Second Candling, Mid-Cycle Checks, and Pre-Hatch Inspections with fertile/clear/uncertain counts and inspector notes.

- System Notifications & Alerts Dataset (10 Items):
  Mix of Critical (Temp High, Battery Backup), Warning (Water Low, Humidity Drift), and Info (Candling Due, Hatch Day Approaching) alerts with timestamps.

==================================================
6. UNIVERSAL ACCESSIBILITY & EXECUTION DIRECTIVES
==================================================
- Ensure ALL text labels pass WCAG AA 4.5:1 contrast against their card backgrounds.
- Ensure ALL interactive elements (cards, table rows, buttons, inputs) feature explicit focus states (`focus-visible:ring-2 focus-visible:ring-primary`).
- Replace frameless beige input boxes with framed inputs featuring 1px visible borders.
- Include sticky headers for long tables and sticky action bars for form pages.