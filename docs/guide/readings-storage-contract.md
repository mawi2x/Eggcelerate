# B3 readings storage contract (2026-09-14)

Migration 0007 adds the internal storage boundary. The dashboard endpoint still
uses generated readings; this is a foundation checkpoint, not the B3 exit.
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

## Next integration gate

Connect PostgreSQL-backed dashboard reads and an explicit development ingestion
command. Generated demo data must be opt-in and must not mask missing telemetry.
Decide the public `full` window's cycle boundary before replacing the current
age-based generated series. Update contract tests to assert actual time boundaries
and ordered stored values, rather than requiring generated 13/85/109 point counts.
Expose research data through an additive, documented DTO/endpoint when needed.
Before calling readings complete, prove populated migration downgrade/upgrade,
real database restart survival, concurrent retries and the dashboard/live HTTP
contract matrix. Durable manual-turn replay and remaining frontend retry gaps
still gate full B3; MQTT execution remains B4.
