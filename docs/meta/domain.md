# Eggcelerate — Domain Model & Data Contracts

> All types, rules, and formulas are code-verified against `src/app/domain/cycle.ts:1` and `src/app/data/mockData.ts:1`. Spec references are to `flow/EGGCELERATE_Final_Dashboard_Specification.md:1` (§ numbers).

---

## 1. Core entities

### 1.1 Mode — `mockData.ts:29`
Reusable incubation preset. **Not edited per incubator.**

```ts
interface Mode {
  id: string;                // e.g. "broiler", "duck"
  name: string;              // display — "Broiler"
  builtIn: boolean;          // true = protected preset, false = user custom
  targetTemp: Range;         // {min,max} °C
  targetHumidity: Range;     // {min,max} %
  incubationDays: number;    // 17–36 in fixtures
  defaultTurnInterval: number; // hours
}
interface Range { min:number; max:number } // mockData.ts:17
```

**Fixtures:** 10 modes in `mockData.ts:175` — 6 built-in (Broiler 21d, Duck 28d, Quail 18d, Goose 30d, Turkey 28d, Pheasant 24d, Peafowl 28d, Swan 36d) + 2 custom (`broiler-hh`, `rapid-quail`). Built-ins are not deletable; customs are `builtIn:false`.

**Spec §27:** customs belong under `Advanced → Custom Incubation Mode` with warning to follow verified poultry requirements. Do not expose tray capacity via mode (spec §2).

### 1.2 Incubator — `mockData.ts:88`

```ts
interface Incubator {
  id: string;                // "chamber-1" … chamber-12
  name: string;              // "Chamber One" (spec §4: rename to Incubator 1 / EGGCELERATE 01 in production)
  deviceId: string;          // "EGG-1003" — manual pairing `EGG-0001` per spec §33
  modeId: string;            // FK → Mode
  dayOfIncubation: number;   // 0 = Ready, 1…N
  totalEggsLoaded?: number;  // eggs at cycle start (38 max tray — mockData.ts:41)
  fertileEggs?: number;      // from candling, if known
  temp: number; humidity: number;
  waterOk: boolean;          // binary float switch — closed=sufficient (§22)
  tempTrend, humidityTrend: number;
  powerSource: "grid"|"battery"; batteryPct: number;
  status: "optimal"|"warning"|"alert";           // farmer-facing
  cyclePhase: CyclePhase;                        // lifecycle
  conditionSeverity: ConditionSeverity;           // Urgent/Needs Attention/Reminder
  connectionState: ConnectionState;              // offline/connecting/connected/failed
  lastTurned: string; nextTurn: string;          // ISO
  turnInterval: number; autoTurn: boolean;       // per-chamber, defaults from mode
  paired: boolean;
  candled: Record<number, boolean>;              // keyed by candling day
  candlingLog: CandlingLogEntry[];
}
```

**Fixtures:** 12 chambers `mockData.ts:219` (chamber-1 … chamber-12) with derived `cyclePhase/conditionSeverity/connectionState` computed in `mockData.ts:318`. `autoTurn` forced `false` in lockdown/hatching/awaiting_finish (`mockData.ts:342`).

### 1.3 CandlingLogEntry — `mockData.ts:73`

```ts
interface CandlingLogEntry {
  day: number; label: string; date: string; // YYYY-MM-DD
  fertile: number; clear: number; uncertain: number;
  note: string; photos: string[]; checks: DevelopmentCheck[];
  checkpointType?: "first"|"later";
  developing?: number; stoppedDeveloping?: number;
}
type DevelopmentCheck = "veining"|"airCell"|"movement"; // mockData.ts:65
```

Spec §13–§17: first checkpoint = Fertile/Clear/Uncertain; later = Developing/Clear/Uncertain/StoppedDeveloping. Counts are **current-condition, not additive** (§16). Lockdown blocks `uncertain>0` (`CandlingJournalTab.tsx:872`). 5 MB photo limit (`detail/types.ts:MAX_PHOTO_BYTES`).

### 1.4 Reading / Alert / Hatch records

```ts
interface Reading { ts:number; time:string; temp:number; humidity:number; water:number } // mockData.ts:156
interface AlertEntry { id:string; severity:"critical"|"warning"|"info"; title:string; unit:string; message:string; timestamp:string; acknowledged:boolean } // mockData.ts:164
interface HatchRecord { id:string; chamber:string; modeName:string; startDate:string; endDate:string; totalEggs:number; fertileEggs:number|null; hatchedEggs:number } // mockData.ts:505
interface AbortedCycleRecord { id:string; incubator:string; modeName:string; stoppedOn:string; dayStopped:number; totalEggs:number; fertileEggs:number|null } // mockData.ts:532
```

---

## 2. Cycle phase — `cycle.ts:80`

| Phase | Rule | Display |
|---|---|---|
| `ready` | `day <= 0` | Ready |
| `incubating` | `0 < day < lockdownDay` and `day < incubationDays` | Incubating |
| `lockdown` | `day >= lockdownDay` and `day < incubationDays` | Lockdown |
| `hatching` | `day === incubationDays` | Hatching |
| `awaiting_finish` | `day > incubationDays` | Awaiting Finish |
| `completed` | after `Save & Finish` (`resetChamberToReady`) | Completed |
| `stopped_early` | via `Advanced → Stop Cycle` | Stopped Early |

`lockdownDay` = third candling checkpoint (`computeCandling(...)[2].day` in `mockData.ts:320`), defaults to 18. Spec §§7,10,11,12,28 require: lockdown shows `Do Not Open · Turning Stopped`, autoTurn stops, hatching/awaiting_finish are distinct from completed, cycle increments `Day 22,23…` until farmer finishes, early termination is separate `Stopped Early/Aborted`.

---

## 3. Condition severity — `cycle.ts:40` + `mockData.ts:142`

Farmer labels: `critical → Urgent`, `warning → Needs Attention`, `info → Reminder` (`cycle.ts:28`). Mapping to status: `critical→alert, warning→warning, info→optimal` (`cycle.ts:34`).

### 3.1 Severity derivation (pure)

```ts
deriveConditionSeverity({paired,temp,targetTemp,humidity,targetHumidity,waterOk,batteryPct,powerSource,nextTurn})
```

| Check | Critical if | Warning if |
|---|---|---|
| Temp | `temp < min -0.5` or `> max+0.5` | `< min` or `> max` |
| Humidity | `< min -5` or `> max+5` | `< min` or `> max` |
| Water | `!waterOk` | — |
| Battery | `powerSource==="battery" && pct<=15` | `pct<=25` |
| Turning | `Date(nextTurn) < now` | same (warning tier) |
| Paired | `!paired` → critical | — |

Precedence: any critical → `critical`; else any warning → `warning`; else `info`. `getUnitIssues()` (`mockData.ts:143`) mirrors this for human-readable list.

**ConnectionState:** `paired ? "connected" : "offline"` (`cycle.ts:76`); also `"connecting"` / `"connection_failed"` enum values for live flow (spec §32).

---

## 4. Candling & calendar — `mockData.ts:41` + `cycle.ts:80`

- **Tray capacity:** `CURRENT_TRAY_CAPACITY = 38` (`mockData.ts:41`) — prototype tray, not architecture limit (spec §2). Future: `Installed Tray Capacity: 38 eggs` device setting.
- **Checkpoints:** proportional to duration — `CANDLE_PROPORTIONS [6/21, 13/21, 18/21]` (`mockData.ts:52`) → for 21-day `computeCandling(21)` = Day 6, 13, 18. DayRange: ±1 except last is exact Day (`mockData.ts:59`).
- **Validation (enforced in `CandlingJournalTab.tsx:915`):** non-zero tally, `inspected ≤ totalEggsSet`, no `uncertain` on lockdown check, day in `1…totalDays`.
- **Carry-forward:** `previousEntry` shown for reference but not auto-saved; `emptyForm` seeds from previous (`detail/types.ts:emptyForm`), save required (spec §18).

---

## 5. Calculations — `mockData.ts:562`

| Formula | Code | Null if |
|---|---|---|
| Fertility Rate | `fertile/eggsSet*100` → 1 decimal | `eggsSet<=0` or `fertile<0` |
| Hatchability | `hatched/fertile*100` → 1 decimal | `fertile===null` or `<=0` |
| getKnownFertileEggs | `fertileEggs` else earliest log `fertile` | none → null |
| daysUntilHatch | `max(0, incubationDays - day)` | — |
| isHatchingSoon | `daysUntilHatch <=2` | — |

**Spec §9,19:** hatchability uses fertile, not eggs loaded. If `fertile===null` display `Not Available` (`TrendsScreen.tsx:703`). Spec §8 Finish Cycle displays `Eggs Loaded — Developing/Fertile — Clear — Stopped Developing — Chicks Hatched — Hatchability 90%` and only asks for `Chicks Hatched`.

---

## 6. History & telemetry — `mockData.ts:352`

- `buildHistory(unit, mode)` generates `stepHours=2` points over `elapsedDays = max(1, dayOfIncubation)` → `(elapsedDays*24)/2` readings per unit, seeded wobble + deterministic hash noise, last 8/12 points add alert excursions (`mockData.ts:377`).
- `hatchHistory` 12 records (`mockData.ts:517`) — totals 167 chicks; `abortedCycleHistory` empty (`mockData.ts:542`); `recordHarvest` pushes + returns rate (`mockData.ts:591`); `resetChamberToReady` patches chamber to `ready` (`mockData.ts:615`).
- **Research vs sampling (spec §30):** sensor sampling configurable (10s/30s/1m) but research logging is fixed **every 5 minutes**. Mock uses 2-hour steps; production must store Timescale hypertable per `ADR-003` and distinguish intervals in UI.

---

## 7. API contracts (proposed — for backend wiring)

> None implemented. Use these DTOs when replacing `mockData.ts:1`. Based on `docs/review-adr.md:104` + spec.

```ts
// DTOs — mirror mock types but with versioning + timestamps
type ModeDTO = Mode & { version:number; createdAt:string; updatedAt:string }
type IncubatorDTO = Omit<Incubator,"cyclePhase"|"conditionSeverity"|"connectionState">
                 & { cyclePhase:CyclePhase; conditionSeverity:ConditionSeverity; connectionState:ConnectionState; updatedAt:string }
type ReadingDTO = Reading & { deviceId:string }
type SyncSetpointsCMD = { cmd:"sync_setpoints"; ts:string; mode_id:string; setpoints:{
  target_temp_c:number; temp_hysteresis_c:number; max_safe_temp_c:number; min_safe_temp_c:number;
  target_humidity_pct:number; humidity_hysteresis_pct:number; fan_base_speed_pct:number; turn_interval_min:number
}} // review-adr.md:104
type AckDTO = { ts:string; ack:"sync_setpoints"; status:"stored_nvs"; mode_id:string }
```

**Result type:** `type Result<T> = { ok:true; data:T } | { ok:false; error:{code:string; message:string} }`

**Endpoint sketch:**

```
GET  /api/v1/incubators              → IncubatorDTO[]
GET  /api/v1/incubators/{id}/history?from&to → ReadingDTO[]
GET  /api/v1/modes                    → ModeDTO[]
POST /api/v1/incubators/{id}/command → { pending:true } + WS ack
WS   ws://api/v1/ws/telemetry        → ReadingDTO frames → patch Query cache
```

**Error surfaces to implement:** browser offline / backend unavailable / device offline but backend reachable / stale telemetry / command pending→ack/reject/timeout.

---

## 8. Validation & constraints summary

- `totalEggsLoaded ≤ CURRENT_TRAY_CAPACITY (38)` — enforce on cycle start.
- Mode reassignment **locked** once `dayOfIncubation > 0` (spec §26); safe mid-cycle edits: turning interval, notification prefs, connection controls only.
- Custom mode params must be confirmed with Save/Confirm under `Advanced` (spec §31, §35).
- `waterOk` is binary; do not render percentages (spec §22). Low-water alert + mist-maker protection required.
- Battery % is provisional until hardware module selected — do not claim validated percentage (spec §23).
- SMS/email toggles are future — in-app only for evaluation (spec §24).

---

*Source-of-truth files: `cycle.ts:1` (90 lines), `mockData.ts:1` (645 lines), `account.ts`, `detail/types.ts`. When domain logic changes, update this file and add unit tests first.*
