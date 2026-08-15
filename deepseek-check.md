# EGGCELERATE — Dashboard Spec Crosscheck (deepseek-check)

Audit date: 2026-08-14
Reference: `flow/EGGCELERATE_Final_Dashboard_Specification.md` (894 lines)
System audited: `src/app` — screens, components, mock data (`src/app/data/mockData.ts`, `account.ts`)
Method: read-only crosscheck of every spec section (1–38 + paper/hardware notes) against the current implementation.

Legend: **OK** = compliant · **PARTIAL** = partly compliant · **FAIL** = not compliant / contradicts spec

---

## Verdict summary

| # | Spec section | Verdict | Short reason |
|---|--------------|---------|--------------|
| 1 | Product positioning | OK | Paper wording task; no UI impact |
| 2 | Incubator capacity | FAIL | Species-based capacity table still active; caps egg input |
| 3 | Multiple incubators | FAIL | 12 fake incubators + "12 Active" shown; demo must show only the real prototype |
| 4 | Terminology: Incubator vs Chamber | FAIL | "Chamber" used everywhere (names, labels, table headers, max-char constant) |
| 5 | Overview dashboard | FAIL | Shows Total Capacity + 12 Active; missing Eggs Incubating / Needs Attention |
| 6 | Phase vs condition | PARTIAL | Condition field exists (`status`); no explicit phase field; "Completed" conflated |
| 7 | Lockdown | FAIL | No lockdown phase banner/guidance ("Do Not Open / Turning Stopped") |
| 8 | Finish Cycle | PARTIAL | Farmer enters only Chicks Hatched (good); read-only summary of fertile/clear/etc. missing |
| 9 | Hatchability calculation | FAIL | Computed as Chicks ÷ Eggs Loaded; no fertile-based calc, no "Not Available" |
| 10 | Completed vs Hatching | FAIL | Auto-"Completed" badge the moment hatch day is reached; no "Awaiting Finish" |
| 11 | Overtime / late hatch | OK | "Some eggs may still be hatching", day keeps counting, no forced termination |
| 12 | Early termination | FAIL | No "Stop Cycle / Aborted" flow anywhere |
| 13 | Candling — first checkpoint | OK | Fertile / Clear / Uncertain used |
| 14 | Candling — later checkpoints | FAIL | Later checkpoints still use "Fertile"; no Developing / Stopped Developing |
| 15 | Stopped Developing | FAIL | Category does not exist |
| 16 | Cumulative candling logic | PARTIAL | Summary uses latest snapshot (cumulative-ish); no validation against removals |
| 17 | Uncertain eggs before lockdown | FAIL | No resolution enforcement |
| 18 | Previous candling results | OK | Previous entry carried forward and shown; must review before save |
| 19 | Fertility Rate | FAIL | "Viability Rate" still displayed; not renamed to Fertility Rate |
| 20 | Candling photos | OK | Optional; upload/view/zoom/delete/download all present |
| 21 | Timeline + calendar | OK | Both kept |
| 22 | Water-level monitoring | PARTIAL | UI is binary Normal/Low (good); alert messages + history data use fake % |
| 23 | Battery monitoring | OK | Kept for development; provisional status respected in UI |
| 24 | SMS and Email | OK | Toggles + phone/email fields kept; in-app only is the working path |
| 25 | Alert terminology | PARTIAL | Severity (Critical/Warning/Info) shown to farmer; not Urgent/Needs Attention/Reminder |
| 26 | Mode switching | FAIL | "Force Switch Mode" still implemented (with ack dialog); mode not locked mid-cycle |
| 27 | Custom Modes | PARTIAL | Available as top-level Settings category; not under Advanced; no advisory warning |
| 28 | Environmental control logic | FAIL | Heater ON when temp < max; mist ON when humidity < max — exactly the anti-hysteresis pattern the spec forbids |
| 29 | Turning schedule | PARTIAL | Full turning UI present; no auto-stop at lockdown |
| 30 | Sampling vs research logging | PARTIAL | Telemetry interval select exists; no fixed "Research Logging — Every 5 minutes" display |
| 31 | Sensor calibration | FAIL | Calibration offset exposed as everyday setting; no warning/reference/save flow; not under Advanced |
| 32 | Reconnect | FAIL | Reconnect button instantly fakes success (paired: true + toast) |
| 33 | Device pairing | OK | Manual Device ID (EGG-####) with simulated handshake + failure states |
| 34 | Firmware controls | FAIL | "firmware v2.4.1" + "Automatic firmware updates" still in Hardware panel |
| 35 | Settings save behavior | FAIL | Global "Save Changes" bar that only toasts; no local save/confirm pattern |
| 36 | Trends | OK | Temperature/humidity, target bands, timestamps, deviations, raw readings, CSV export |
| 37 | Hatch History | PARTIAL | Records/avg/total present; "Top Performing Mode" still shown; rate uses eggs set not fertile |
| 38 | UX features that stay | OK | Search/filters/sort/pagination/grid-list/photos/dialogs/CSV/account present |

**Compliance: 9 OK · 6 PARTIAL · 13 FAIL** (of 28 auditable sections)

---

## Detailed findings

### Spec 2 — Incubator capacity (FAIL)

- `src/app/data/mockData.ts:31-42` — `NOMINAL_EGGS_PER_MODE` hardcodes species capacities the spec explicitly says to remove: `broiler: 42`, `quail: 60`, etc.
- `src/app/data/mockData.ts:44-46` — `nominalEggCapacity()` is the fallback used everywhere a cycle lacks `totalEggsLoaded`.
- `src/app/components/screens/DetailScreen.tsx:2053,2060-2063` — Start Cycle validates the farmer's egg count against `nominalEggCapacity(mode)` ("Enter between 1 and {capacity} eggs"). Species should NOT determine capacity; the tray is 38.
- Mock data also seeds species-based counts: `totalEggsLoaded: 42` (broiler, mockData.ts:218,266), `60` (quail, 234,281).
- `Installed Tray Capacity: 38` device setting (future) — not implemented, correctly deferred.

### Spec 3 — Multiple incubators (FAIL)

- `src/app/data/mockData.ts:214-311` — 12 incubators ("Chamber One"…"Chamber Twelve"), two of them `paired: false` but still listed.
- `src/app/components/screens/OverviewScreen.tsx:213` — KPI literally shows "12 Active" — the exact fake claim the spec forbids during a research demo. Only the real physical prototype (1) should be shown; extras only when physically paired.

### Spec 4 — Terminology (FAIL)

"Chamber" is pervasive; spec wants "Incubator 1" / "EGGCELERATE 01" for a whole device, reserving "chamber" for the physical chamber inside:
- `mockData.ts:216-310` — names "Chamber One"…"Chamber Twelve"
- `src/app/components/screens/IncubatorsScreen.tsx:345,398` — table header "CHAMBER", "…of N chambers"
- `IncubatorsScreen.tsx:475,482` — "Chamber Name" field, "Chamber Thirteen" placeholder
- `src/app/components/IncubatorCard.tsx:140` — "Chamber Ready"
- `src/app/App.tsx:194` — "Manage each chamber…"
- `src/app/data/account.ts:13` — `CHAMBER_NAME_MAX`

### Spec 5 — Overview dashboard (FAIL)

- `OverviewScreen.tsx:211-217` — KPIs are INCUBATORS ("12 Active"), TOTAL CAPACITY, UPCOMING HATCH, AVG HATCH RATE.
- Spec wants: Active Incubators · Eggs Incubating · Upcoming Hatch · Needs Attention. "Eggs Incubating" and "Needs Attention" do not exist; Total Capacity stays (spec says reconsider/remove when only one prototype). "Top Performing Mode" already removed here — good.
- `OverviewScreen.tsx:157` — Total Capacity is summed from species-based nominal capacities (compounds spec 2).

### Spec 6 — Phase vs condition (PARTIAL)

- Condition exists as `status: "optimal" | "warning" | "alert"` (`mockData.ts:3`) and is displayed as pills (`StatusBadge.tsx:11-21`, `IncubatorCard.tsx:28-37`).
- No explicit phase field on `Incubator`; phases are derived from `dayOfIncubation` vs `incubationDays` in `IncubatorCard.tsx:31-36` ("Ready"/"Incubating"/"Hatching"/"Completed").
- "Completed" (see spec 10) is derived too early, and there is no "Lockdown" phase and no "Awaiting Finish" anywhere. Phase/condition stay separate in the data model but the displayed "phase" is wrong.

### Spec 7 — Lockdown (FAIL)

- Lockdown appears only as: a candling checkpoint label "Lockdown check" (`mockData.ts:58`, `DetailScreen.tsx:78,1971`), a calendar phase band (`DetailScreen.tsx:225,242,299-335`), and a milestone node.
- No farmer-facing "Lockdown Active · Do Not Open · Turning Stopped" guidance card/banner.
- Turning is not auto-stopped at lockdown (see spec 29).

### Spec 8 — Finish Cycle (PARTIAL)

- `src/app/components/HarvestModal.tsx:61-89` — farmer enters only "Chicks hatched" — matches "only manually enter Chicks Hatched".
- Missing: the read-only display (Eggs Loaded 38 · Developing 30 · Clear 4 · Stopped 4 · Chicks Hatched [27] · Hatchability 90%). The modal shows only eggs loaded + derived rate (`HarvestModal.tsx:90-105`), and the rate uses eggs loaded, not fertile (spec 9).

### Spec 9 — Hatchability calculation (FAIL)

- `mockData.ts:513` (`recordHarvest`) and `HarvestModal.tsx:25` — `rate = hatched / totalEggsLoaded × 100`.
- Spec: `Hatchability = Chicks Hatched ÷ Fertile Eggs × 100`; if no fertility/candling data exists → "Hatchability: Not Available" (cycle still finishable).
- `TrendsScreen.tsx:296,305` — same wrong denominator for hatch history rows and the Average Hatch Rate KPI.

### Spec 10 — Completed vs Hatching (FAIL)

- `IncubatorCard.tsx:32` — `dayOfIncubation >= incubationDays` → "Completed" badge, before any harvest is recorded. Chamber Twelve (day 22 of 21) will show "Completed" even though the cycle is un-finished.
- Spec: reach hatch day → "Hatching", then "Awaiting Finish" until the farmer enters the final chick count; only "Save & Finish Cycle" → "Completed". No "Awaiting Finish" state exists.

### Spec 11 — Overtime (OK)

- `DetailScreen.tsx:2139,2214-2224` — "Past Hatch Day" card with "Some eggs may still be hatching." and a Finish Cycle button; day counter ticks past the target (`DetailScreen.tsx:2142-2149`); no forced termination. Matches spec.

### Spec 12 — Early termination (FAIL)

- No "Advanced → Stop Cycle" path, no confirmation, no "Stopped Early / Aborted" cycle state. Only normal Finish Cycle exists.

### Spec 13/14/15 — Candling categories (FAIL)

- First checkpoint: Fertile/Clear/Uncertain — correct (OK).
- Later checkpoints: the same three fields are used everywhere; there is no "Developing", no "Stopped Developing" (`CandlingLogEntry` at `mockData.ts:78-88` has only fertile/clear/uncertain).
- Mock logs violate the spec's own example: `chamberTwelveLog` day-18 "Lockdown check" still records "fertile: 33" (`mockData.ts:211`); `chamberOneLog` repeatedly labels everything "Fertile" up to day 9 (`mockData.ts:197-204`).
- The journal delete dialog even says "recalculate the cycle's viability rate" (`DetailScreen.tsx:2525`).

### Spec 16 — Cumulative candling (PARTIAL)

- `DetailScreen.tsx:2124-2133` — cycle summary uses the latest snapshot as the whole-batch description, which is the intended cumulative semantics.
- No cross-checkpoint continuity logic (e.g. prevented totals from growing after eggs were removed), and the UI does not guide the farmer that each checkpoint describes the whole batch.

### Spec 17 — Uncertain resolution before lockdown (FAIL)

- Uncertain eggs can stay "uncertain" forever; nothing nudges the farmer to resolve them into Developing/Clear/Stopped before lockdown.

### Spec 18 — Previous inspection (OK)

- `DetailScreen.tsx:88-97` — `emptyForm` carries the previous entry's counts forward; `LogModalBody` shows/uses `previousEntry` (`DetailScreen.tsx:1397,1493`), and the farmer must explicitly save the new record. Matches "carry forward, require review".

### Spec 19 — Fertility Rate (FAIL)

- `DetailScreen.tsx:2135,2594-2601` — "Viability Rate" label and calculation (fertile ÷ inspected). Spec: remove "Viability Rate", use "Fertility Rate = Fertile ÷ Eggs Set". Also in the delete dialog copy (`DetailScreen.tsx:2525`).

### Spec 20 — Candling photos (OK)

- Optional (save warning dialog, `DetailScreen.tsx:1814-1821,1844-1870`), upload + drag-drop (`DetailScreen.tsx:1766-1806`), view/zoom/pan/fullscreen/download/delete lightbox (`DetailScreen.tsx:766-1125`). Matches spec.

### Spec 21 — Timeline + calendar (OK)

- Horizontal milestone timeline (`DetailScreen.tsx:634-746`) and monthly calendar (`DetailScreen.tsx:202-413`) both present.

### Spec 22 — Water level (PARTIAL)

- Good: UI is binary — `waterOk` boolean (`mockData.ts:100-101`), "Normal"/"Low" (`mockData.ts:123-127`, `WaterDroplet.tsx:18-100`, `IncubatorCard.tsx:151-162`).
- Bad: alert messages use fake percentages — "Water reservoir low (12%)" (`mockData.ts:371`), "at 34%" (`mockData.ts:407`), "refilled to 100%" (`mockData.ts:452`); `buildHistory` generates a water % sawtooth (`mockData.ts:335`, though unused in the main UI).

### Spec 23 — Battery (OK)

- Battery %, charging indicator, mains/battery distinction, low-battery warning all present (`SegmentedBattery`, `IncubatorCard.tsx:126`, `DetailScreen.tsx:2804-2810`, `mockData.ts:147`). Provisional status respected (no claims made in UI).

### Spec 24 — SMS/Email (OK)

- `NotificationsPanel.tsx:127-176` — SMS/email toggles + phone/email fields with validation; spec says keep UI ready, only in-app required now.

### Spec 25 — Alert terminology (PARTIAL)

- `AlertsScreen.tsx:27-32,204` + `alertStyle.ts:5-12` — farmer sees "Critical"/"Warning"/"Info" labels. Spec: internal severity stays, but farmer-facing labels should be Urgent / Needs Attention / Reminder.
- `statusLabels` (`mockData.ts:541-545`): "Optimal"/"Needs Attention"/"Alert" — "Alert" should be "Urgent".

### Spec 26 — Mode switching (FAIL)

- `DetailScreen.tsx:2009-2014,2817-2875` — mid-cycle mode switch is allowed via an acknowledgement dialog whose confirm button is literally "Force Switch Mode". Spec: remove Force Switch Mode; mode is locked once incubation begins; change requires stop/reset first. (Safe adjustments — turning interval, notifications — correctly remain editable.)

### Spec 27 — Custom Modes (PARTIAL)

- Custom modes exist (`ModeLibraryPanel.tsx`), but as a top-level Settings category, not under "Advanced → Custom Incubation Mode", and there is no warning that values should follow verified poultry requirements.

### Spec 28 — Environmental control logic (FAIL)

- `DetailScreen.tsx:1930-1933`:
  - `heaterOn = unit.temp < mode.targetTemp.max` — exactly the "heater ON when temperature < target maximum" the spec forbids (no lower threshold / hysteresis band).
  - `mistOn = unit.humidity < mode.targetHumidity.max && unit.waterOk` — same anti-hysteresis pattern for the mist maker.
- No lower-threshold → ON / setpoint → OFF logic anywhere.

### Spec 29 — Turning schedule (PARTIAL)

- Auto turn, interval select, next/last turn, Turn Now (+ early-turn guard dialog), overdue indication all present (`DetailScreen.tsx:2016-2048,2279-2296,2731-2770`).
- Missing: automatic turning stop when lockdown begins (no lockdown phase to key off).

### Spec 30 — Sampling vs research logging (PARTIAL)

- `HardwarePanel.tsx:86-104` — "Telemetry interval" select (10s/30s/60s/5min) exists. 
- Missing: the fixed "Research Logging Interval — Every 5 minutes" row and the explicit UI distinction between the two.

### Spec 31 — Sensor calibration (FAIL)

- `HardwarePanel.tsx:105-121` — "Temperature calibration offset" is a plain number input in the everyday Hardware panel; no warning, no trusted-reference step, no Save/Confirm, not under Advanced.

### Spec 32 — Reconnect (FAIL)

- `DetailScreen.tsx:2791-2799` — Reconnect button does `onUpdate({ paired: true })` + success toast instantly. Spec requires Connecting… → Connected / Connection Failed, no fake guarantees.

### Spec 33 — Device pairing (OK)

- `IncubatorsScreen.tsx:170-229` — manual Device ID entry with format check, duplicate check, simulated handshake ("Verifying hardware ID…"), offline/invalid failure states. Matches "keep manual Device ID now".

### Spec 34 — Firmware controls (FAIL)

- `HardwarePanel.tsx:53` — "firmware v2.4.1" shown per device; `HardwarePanel.tsx:139-149` — "Automatic firmware updates" switch. Spec says remove firmware version, auto updates, and OTA controls.

### Spec 35 — Settings save behavior (FAIL)

- `SettingsScreen.tsx:100-119` — global sticky "Save Changes" bar that only fires `toast.success("Settings saved")` with no pending-state semantics — exactly the misleading global save bar the spec says to remove. Most panels actually apply changes immediately (toggles, account fields) with no local Save/Confirm for consequential settings (mode edits do have a modal Save — good — but calibration/turning interval don't).

### Spec 36 — Trends (OK)

- `TrendsScreen.tsx` — environmental chart with target-range bands, timestamps, per-point deviation status in tooltip, raw readings table, CSV export (`TrendsScreen.tsx:277-290,775-812`). Spec calls this the strongest research-aligned part; fully present.

### Spec 37 — Hatch History (PARTIAL)

- Present: completed cycles, average hatchability, total chicks hatched, per-cycle eggs set/hatched/dates/mode (`TrendsScreen.tsx:301-323,678-771`).
- Failures: "Top Performing Mode" KPI still shown (`TrendsScreen.tsx:626-630` — spec: removed/do not return); hatchability computed from eggs set, not fertile eggs; mock history exists as dev data (spec: do not present as research results during evaluation).

### Spec 38 — UX features that stay (OK)

- Search, filters, sorting, pagination, grid/list views, photo viewer, confirmation dialogs, CSV export, profile/farm name, account settings — all present and unproblematic.

---

## Mock-data-specific issues

| Location | Issue | Spec ref |
|----------|-------|----------|
| `mockData.ts:31-42` | Species → capacity table (broiler 42, quail 60…) | §2 |
| `mockData.ts:214-311` | 12 incubators; "12 Active Incubators" demo problem | §3 |
| `mockData.ts:216-310` | "Chamber One…Twelve" naming | §4 |
| `mockData.ts:218,234,266,281` | `totalEggsLoaded` seeded from species capacity (42/60) instead of 38-tray reality | §2 |
| `mockData.ts:197-204` | Chamber One log: "Fertile" label reused across all checkpoints | §14 |
| `mockData.ts:208-212` | Chamber Twelve day-18 lockdown entry uses "fertile: 33" | §14/15 |
| `mockData.ts:371,407,452` | Water-level alert messages with fake percentages | §22 |
| `mockData.ts:477` | Comment "Duck the top-performing mode" (Top Performing Mode) | §5/37 |
| `mockData.ts:478-491` | Hatch history rate uses eggs set | §9 |
| `mockData.ts:541-545` | statusLabels "Alert" instead of farmer-facing "Urgent" | §25 |

---

## Priority actions (suggested order)

1. **Hatchability & finish flow** (§9/10/8): fertile-based hatchability + "Not Available" fallback; replace auto-"Completed" badge with Hatching → Awaiting Finish; add read-only cycle summary to the Finish Cycle modal. Highest research-integrity impact.
2. **Remove Force Switch Mode / lock mode mid-cycle** (§26) and add **Advanced → Stop Cycle (aborted)** (§12).
3. **Hysteresis control logic** (§28): heater ON below lower threshold, OFF at setpoint; same for mist maker.
4. **Candling categories** (§13-15, 19): add Developing / Stopped Developing to later checkpoints; rename Viability Rate → Fertility Rate; enforce uncertain resolution before lockdown.
5. **Single-prototype demo data** (§2/3): one real incubator (38-egg tray), drop species-capacity table, drop "12 Active".
6. **Terminology sweep** (§4): Chamber → Incubator / EGGCELERATE 01.
7. **Remove firmware controls** (§34); move calibration under Advanced with warning/reference/confirm (§31); add research-logging-5-min row (§30); real reconnect state flow (§32); remove global Save bar (§35).
8. **Farmer-friendly alert labels** (§25) and drop fake water % in alert copy (§22).
9. **Lockdown phase** (§7/29): real phase with "Do Not Open / Turning Stopped" guidance and auto-stop turning.

---

## Not in the app (gap list)

- No "Awaiting Finish" phase; no "Lockdown" phase; no "Stopped Early/Aborted" cycle status.
- No "Installed Tray Capacity" device setting (deferred — fine).
- No QR pairing (deferred — fine).
- No hysteresis band constants (target temp/humidity only have min/max range).
- No research-logging interval display.
- No lockdown auto-stop for turning.
