# B3 readings storage contract (2026-09-14)

Migration 0007 adds the storage boundary. The PostgreSQL dashboard endpoint now
reads stored telemetry; mock/memory mode retains generated readings. Full B3 remains open.
No new HTTP endpoints or wire fields are introduced in this checkpoint.

## Raw samples

`telemetry_samples` is a Timescale hypertable partitioned by `observed_at` in
seven-day chunks. Its primary key `(farm_id, device_id, observed_at)` also serves
farm/device/time-range queries. The composite foreign key prevents associating a
device with another farm. Device IDs are internal UUIDs, not chamber IDs.

The ingestion caller supplies a timezone-aware observed timestamp, finite
`temperature_c`, `humidity_pct` in 0–100 and boolean `water_ok`. The server assigns
`received_at` on first ingestion. PostgreSQL stores timestamp instants independently
of the input timezone. There is one measurement per device per observed instant:
exact retries are no-ops, including preservation of first receipt time; changed
values at that identity return conflict. A corrected timestamp is a new identity.
Callers own the transaction and must obtain farm/device scope from trusted routing.
There is no externally accessible ingestion interface yet.

## Queries and research

Internal queries use aware `[start, end)` bounds and return ascending observed
instants. Raw rows preserve the existing ReadingDTO field names. Research queries
use UTC-aligned five-minute buckets and return `bucket_start`, `count`,
`temperature_c_avg/min/max`, `humidity_pct_avg/min/max`, and
`water_not_ok_count`. Only samples inside the requested interval participate;
edge buckets can be partial. Empty buckets are omitted, and gaps are never filled.
Research values are calculated from durable raw samples at query time, so late
arrivals appear immediately. They are not persisted continuous aggregates.

No automatic retention or compression policy is installed. Raw data is retained
until an explicit retention decision; a materialized aggregate and refresh policy
can follow measured query load. The hypertable API and uniqueness rule follow
[Timescale's official documentation](https://github.com/timescale/docs/blob/latest/api/hypertable/create_hypertable.md).

## Dashboard and development ingestion

`GET /api/v1/incubators/{id}/readings?window=24h|7d|full` keeps the existing
five-field ReadingDTO envelope. PostgreSQL returns only stored samples, including
an empty array when none exist. Unknown chambers return 404, invalid windows 422,
and unavailable storage 503. There is no fallback to generated data.

`24h` and `7d` use `[request time - duration, request time)`. `full` starts at
midnight UTC on the current cycle's recorded start date and ends at request time.
The existing cycle model has date precision only: same-day samples before a cycle
started can therefore appear. Exact cycle-start timestamps and historical device
assignment would be needed for stricter attribution. A reset/ready chamber has an
empty full window; recent device windows remain available. Queries follow the
chamber's currently assigned device. Stopped cycles remain visible until reset.

Import a JSON array explicitly from `apps/api`, with DATABASE_URL and
DEFAULT_FARM_ID set for the intended local farm:

```sh
PYTHONPATH=src .venv/bin/python -m eggcelerate_api.database.ingest chamber-1 samples.json
```

Example `samples.json` (choose the actual observed timestamp):

```json
[{"observed_at":"2026-09-14T08:00:00Z","temperature_c":37.3,"humidity_pct":52,"water_ok":true}]
```

The entire batch is validated before writes and committed atomically. Exact retries
are counted separately; a conflicting value rolls the batch back. The importer
accepts development/test environments only. Normal configuration seeding creates
no telemetry, removes no existing data, and does not enable the frontend API switch.

Five-minute research queries remain internal; no new public research endpoint or
MQTT ingestion has been introduced. Durable manual-turn replay and remaining
frontend mode retries are next before the full B3 exit matrix and B4 MQTT.
