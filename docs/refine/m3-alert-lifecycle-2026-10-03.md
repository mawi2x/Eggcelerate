# M3 alert lifecycle — October 3, 2026

M3 is implemented and verified locally for the PostgreSQL dashboard pilot. Migration
`0015` adds device ownership, episode lifecycle fields and durable monitoring state.
Existing alerts retain null lifecycle fields; their read/dismiss behavior is preserved.
The memory demo remains fixture based.

## Condition rules

| Condition | Threshold source | Persistence before opening | Severity | Recovery |
| --- | --- | --- | --- | --- |
| Temperature | Assigned mode's temperature minimum/maximum | 60 seconds | Critical | Fresh reading within the recovery band |
| Humidity | Assigned mode's humidity minimum/maximum | 60 seconds | Warning | Fresh reading within the recovery band |
| Water | Device `water_ok=false` | 30 seconds | Warning | Fresh `water_ok=true` |
| Offline | Server receipt time of advancing telemetry | More than 180 seconds | Critical | Advancing telemetry received |

Temperature, humidity and water require a paired chamber in an active cycle:
incubating, lockdown, hatching or awaiting finish. Offline monitoring applies to all
paired assigned devices, including chambers without an active cycle. A device with
no telemetry uses the later chamber/device creation timestamp as its offline anchor.
Reassigning an existing device does not create a new grace timestamp.

Environmental evidence must be fresh (at most 45 seconds old). Stale evidence clears
pending candidate timing but does not resolve an open episode. A telemetry gap also
resets pending timing before a new reading replaces the stale projection, including
after an API restart. Device timestamps do not determine offline freshness.

Opening uses the mode's actual target boundaries. Recovery moves inward by the mode
hysteresis value, capped at one quarter of the target band width so narrow modes
retain a reachable recovery interval. Recovery needs one fresh qualifying reading;
there is no additional recovery dwell. Mode/binding changes close affected episodes
with `configuration_changed`; unpairing, removal of an assignment or ending a cycle
closes affected monitoring with `monitoring_ended`. Neither reason claims recovery.
Configuration changes are picked up by telemetry or the next periodic evaluation.

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
then repeat. Multiple API workers serialize farm evaluation. A farm error is logged
and does not prevent other farms from being evaluated; a later pass retries it.
Unchanged monitor rows are not rewritten. Timing includes evaluation duration and
lock contention; this is not a hard real-time deadline. An API must be running for
periodic offline detection. Restart resumes from durable state. No new device message
or open dashboard is required. Cancellation finishes before the API closes its pool.

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
