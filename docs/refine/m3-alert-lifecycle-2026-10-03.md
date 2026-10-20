# M3 alert lifecycle — October 3, 2026

M3 is implemented and verified locally for the PostgreSQL dashboard pilot. Migration
`0015` adds device ownership, episode lifecycle fields and durable monitoring state.
Existing alerts retain null lifecycle fields; their read/dismiss behavior is preserved.
Updated October 11: water checks are manual daily reminders in both the PostgreSQL and memory implementations. Water sensor readings no longer affect chamber conditions.
Updated October 20: environmental alert timing and dashboard refresh wording below
match the current backend and frontend contracts.

## Condition rules

| Condition | Threshold source | Persistence before opening | Severity | Recovery |
| --- | --- | --- | --- | --- |
| Temperature | Assigned mode's temperature minimum/maximum | 90 seconds | Critical | Fresh reading within the recovery band |
| Humidity | Assigned mode's humidity minimum/maximum | 90 seconds | Warning | Fresh reading within the recovery band |
| Water reminder | Active cycle, once per UTC day | None | Reminder | Next day or monitoring ends |
| Offline | Server receipt time of advancing telemetry | More than 180 seconds | Critical | Advancing telemetry received |

Temperature and humidity use the active incubator mode's configured boundaries,
including Chicken, Duck, Quail and custom modes. The system does not substitute a
universal temperature or humidity range. An out-of-range condition must remain
continuous for 90 seconds before an episode is created. This is the current
notification rule; it is not a recommendation about incubation setpoints.

Temperature and humidity require a paired chamber in an active cycle:
incubating, lockdown, hatching or awaiting finish. Offline monitoring applies to all
paired assigned devices, including chambers without an active cycle. A device with
no telemetry uses the later chamber/device creation timestamp as its offline anchor.
Reassigning an existing device does not create a new grace timestamp. Water reminders require an active cycle only; they do not require pairing or fresh sensor telemetry.

The device sends environmental measurements only with a valid sensor sample, and the
API validates measurements before updating its latest projection. Environmental
evidence must be fresh: its server receipt time can be at most 45 seconds old. Stale,
invalid or missing evidence is unknown; it cannot confirm recovery. Stale evidence
clears pending candidate timing but does not resolve an open episode. A telemetry gap
also resets pending timing before a new reading replaces the stale projection,
including after an API restart. Device timestamps do not determine offline freshness.

Opening uses the mode's actual target boundaries. Recovery moves inward by the mode
hysteresis value, capped at one quarter of the target band width so narrow modes
retain a reachable recovery interval. Recovery needs one fresh qualifying reading;
there is no additional recovery dwell. After confirmed recovery, a later deviation
starts a new 90-second monitoring period and creates a new episode only if it lasts
through that period. Mode/binding changes close affected episodes with
`configuration_changed`; unpairing, removal of an assignment or ending a cycle closes
affected monitoring with `monitoring_ended`. Neither reason claims recovery.
Configuration changes are picked up by telemetry or the next periodic evaluation.

Water notifications are manual reminders to inspect and refill the reservoir. They
are created once per UTC day during an active cycle; they are not based on a water
level sensor.

Fresh controller reports with confirmed hardware fault codes create critical alerts
without the 90-second environmental dwell. Persistent reports and repeated backend
evaluations keep one active episode. Stale or missing controller reports do not clear
the fault; a fresh report showing fault-free status is required for recovery. Controller
notification handling does not change or delay ESP32 autonomous safety behavior.

## Episodes and operator actions

Condition identity is farm + device UUID + condition. A durable monitor records
candidate start, source configuration, current episode and recurrence generation.
Episode UUIDs derive from farm/device/condition/generation. All writers lock the farm
first, so concurrent API evaluators and telemetry cannot create duplicate episodes.
Telemetry, latest projection and episode transitions commit or roll back together.
Duplicate or non-advancing telemetry cannot refresh the projection or open an episode.

Acknowledgment marks a notification read. Dismissal hides it and keeps a tombstone.
Neither action resolves its condition. A dismissed active episode continues to be
tracked without creating replacement notifications. After recovery, a later sustained
recurrence creates a new identity. Seeding and restart preserve candidates, episodes,
acknowledgments and tombstones. Retrying mutations uses the existing idempotency receipt
contract; a delete without the same receipt key may return 404 after dismissal.

`notification_enabled.temp/humidity/water/offline` controls creation of new episodes.
A missing key defaults to enabled. Disabling a rule resets its pending candidate and
suppresses new alerts; existing episodes remain tracked until recovery or closure.
No condition is mandatory in this phase. Mode thresholds apply independently of these
notification switches. Other saved notification preferences do not gain generators
in M3. Email/push/hardware control delivery is outside this implementation.

The PostgreSQL API owns a background evaluator: wait 15 seconds, evaluate every farm,
then repeat. New advancing telemetry also triggers evaluation. Multiple API workers
serialize farm evaluation. A farm error is logged and does not prevent other farms
from being evaluated; a later pass retries it. Unchanged monitor rows are not
rewritten. Timing includes evaluation duration and lock contention; this is not a
hard real-time deadline. An API must be running for periodic offline detection.
Restart resumes from durable state. No new device message or open dashboard is
required. Cancellation finishes before the API closes its pool.

## From sensor reading to dashboard alert

1. **Sensor reading:** the device sends an environmental sample only when its sensor
   reading is valid. The API validates the sample and records its server receipt time;
   an invalid sensor status does not refresh the environmental projection.
2. **Condition detection:** telemetry ingestion and the periodic backend evaluator
   compare fresh readings with the incubator's active mode. Evidence older than 45
   seconds is stale. A temperature or humidity deviation must persist for 90 seconds;
   a device is offline only after more than 180 seconds without advancing telemetry.
3. **Alert episode creation:** after a condition is confirmed, the backend saves one
   durable alert for that active episode. Replayed telemetry, repeated evaluations and
   frontend refreshes do not create another episode. Recovery follows the rules above.
4. **Dashboard refresh:** the authenticated frontend polls the alert list about every
   15 seconds while its page is visible. Polling pauses in a background tab and
   refreshes when the user returns. Alert creation and dashboard display are separate;
   a newly created alert may not appear until the next successful poll.
5. **External delivery:** Resend email, SMS and browser push are not integrated in
   this milestone. Saving an in-app episode does not send an external message.

## UI and transport

Alert responses add nullable `device_id`, `condition_state`, `resolved_at` and
`resolution_reason`. The web adapter preserves lifecycle state and accepts old
payloads without these fields. The bell and full feed show Active condition,
Resolved · recovered, or Closed with its reason. The Active filter counts visible
active device episodes, including read ones. Unread remains acknowledgment based,
so recovery does not silently mark a notification read. Dismissed conditions are
absent from notification counts; Monitoring remains the current device view.

The existing M2 alert polling refreshes lifecycle state quietly without page reloads.
M3 does not add repeated toasts for sustained device conditions. Fetch-failure notices
retain their separate M2 grouping/toast policy and are excluded from the Active filter.
Notification settings describe the real dwell and offline thresholds. Mobile filters
scroll with arrows; sticky group headers follow the measured toolbar height so narrow
layouts and enlarged text do not hide the first day header.

## Verification and rollout

- 121 API tests passed, zero skips, including six new lifecycle tests: threshold
  timing, restart, duplicate/concurrent evaluation, stale evidence, recovery,
  recurrence, idempotent dismissal, settings, configuration/end-of-cycle closure,
  independent farm ownership, atomic rollback and API-timer offline detection.
- 276 frontend tests across 37 files passed with coverage; two new tests cover
  transport recovery/read independence and the Active filter.
- Live API/web repository contract: 28 tests passed.
- Fresh and populated migration upgrades passed; historical downgrade preservation
  test passed. Alembic metadata check reported no new upgrade operations.
- Ruff, format checks, mypy, Biome, TypeScript and production build passed.
- Firefox 320px and 393px: active/read filtering, lifecycle labels in feed and bell, horizontal
  filter access and toolbar/day-header placement verified with browser-only fixtures.
  Mark-all-read changed the bell to zero unread while the active condition remained.
  Screenshot: `output/playwright/m3-active-mobile.png` (ignored local artifact).

Two existing Python dependency deprecation warnings remain. The Vite >500 kB chunk
warning remains tracked under M5. These checks validate local software and simulator
telemetry, not a real-device soak or production rollout.

Before running the changed PostgreSQL API, upgrade its database to Alembic head
`0015`. Only the disposable test database was migrated during this work; the main
local database and hardware services were not started. Deploy API and web together
so the strict transport decoder understands the new fields. The simulator-only MQTT
worker and its production dispatch guard remain in place.

Next: M4, bound telemetry queries and preserve complete exports. M0 pilot owners,
environment and hardware availability remain pending in the roadmap.
