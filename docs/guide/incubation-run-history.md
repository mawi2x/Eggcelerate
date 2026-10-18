# Preparation and incubation run history

**Status:** deployed to the VPS (2026-10-18).

## Farmer workflow

Open **Trends → Incubation History**. Filter by chamber, mode, or status, then
choose **View trends** on a run. Temperature and humidity charts use that run's
saved targets and observation period. **See all readings → Export complete CSV**
uses the same run scope.

Runs are saved automatically; no Save history button is needed. A run begins
when preparation starts, keeps the same identity when eggs are loaded, and ends
when the cycle completes or is stopped. Cancelled preparation remains available
as **Preparation only**. Choosing another mode or restarting preparation ends
the previous preparation run and creates a separate record.

Current runs remain visible while they are preparing or incubating. The history
refreshes every 30 seconds and provides Load more runs for older records.
The existing Hatch History tab retains its completed-cycle outcome summaries.

## Saved record

Schema migration **0026** adds `incubation_runs`, without changing sensor or
controller tables. Each run stores:

- Farm, chamber identity and name, and the internal device identity.
- A snapshot of the selected mode, including target temperature and humidity.
- Preparation start, incubation start, end time, status, and end reason.
- Cycle identity and egg count when incubation starts.
- An explicit approximation flag for imported older records.

The lifecycle hook runs inside the existing farm-locked database transaction,
so failed mutations and idempotent replays do not create extra runs. A partial
unique index permits only one open run per chamber. Terminal records are kept
when a later cycle begins. Renaming a chamber does not rewrite old snapshots.

Run history uses server-side transaction timestamps going forward. Preparation
and incubation are separate phases of one saved run; charts include both.

## Reading and export scope

- `GET /api/v1/runs` supports chamber/mode/status filters and keyset pagination.
- Chart and raw-preview requests accept `run_id`. The server verifies farm
  ownership, chamber identity and stored device identity, and derives the run's
  start/end bounds. Client timestamps cannot expand the run period.
- Completed run observation bounds are fixed. An open run extends to current
  server time. Bounds are start-inclusive and end-exclusive.
- Existing chart aggregation remains bounded to 600 points per chamber. Saved
  mode targets determine the chart's safe band, even if the current mode differs.
- Raw preview/export freezes its receipt-time cutoff when opened, preserving
  consistent inclusion of offline uploads already received at preview time.
- Choosing another chamber, a preset, custom dates, or chamber comparison exits
  the selected-run view. A visible banner identifies when a run is selected.
- Run records do not duplicate sensor samples. Future late uploads can therefore
  add historical samples to a run; a previously opened signed CSV scope remains
  fixed by its receipt cutoff.

## Older data and deletion

The operator import recovers existing completed/stopped/active cycles and captures
current preparation without changing equipment. Old cycles only had date-level
start information, and their original target values were not recorded. Imported
runs are labelled **Earlier record. Times or saved targets may be approximate.**
A completed date is treated as a date-wide observation interval and clipped at
current time and the next saved run where known. No exact times are invented.
Cancelled preparation that happened before this feature cannot be reconstructed
because its identity was not persisted. Existing preparation retains its known
start timestamp, but its targets are marked approximate because they were first
captured during import.

Chamber deletion retains run metadata and closes an open run. The existing
chamber deletion operation still removes that device's sensor samples. The UI
disables View trends for a removed chamber rather than claiming data is present.
Historical modes deleted from the current catalog may use current-mode target
values as an explicitly approximate import fallback.

This first release is for connected API accounts. Mock-demo accounts show that
run history requires the server; no fake durable run history is presented.

## Deployment and rollback

- Backup: `/opt/eggcelerate/rollback-run-history-20261018-hd02pxcr/`.
- Private local mirror: `output/backups/vps-pre-run-history-20261018/`.
- Release: `/opt/eggcelerate/releases/run-history-20261018/` and
  `output/releases/vps-run-history-20261018/`.
- Images: `eggcelerate-api:run-history-20261018` and
  `eggcelerate-web:run-history-20261018`.
- A prior-application compatibility image,
  `eggcelerate-api:pre-run-history-compatible-20261018`, accepts schemas 0025 and
  0026. Its rollback overlay lets the prior dashboard/API run while preserving
  the new history table and its records. Do not drop the table to roll back.
  New run tracking is unavailable while running that compatibility image.
- Deployment applies the additive migration, runs the idempotent legacy import,
  and recreates API/web. The MQTT worker and ESP32 firmware remain unchanged.
- Database/config/source backups were mirrored with matching hashes. The dump
  listing parsed; no database restore rehearsal was run. pg_dump emitted the
  existing Timescale continuous-aggregate circular-constraint warning.
- Local TypeScript and targeted Python lint/type checks passed. Functional,
  integration and browser acceptance tests were not run for this change.

## Activation result

- Schema 0026 is active; API and web containers report healthy. Public HTTPS
  readiness returned `ready: true`.
- Current preparation and one earlier stopped cycle were captured. At activation
  there were 1,305 raw sensor samples, and device telemetry was still arriving.
- API image: `eggcelerate-api:run-history-20261018`. Final web image:
  `eggcelerate-web:run-history-ui-20261018`, including short mobile tab labels.
- The first migration attempt found a pre-existing unreadable migration file in
  the image and rolled back to the compatibility application. The API Dockerfile
  now grants read/traverse permission to the public Alembic files before dropping
  to the app user; the retry migrated and imported successfully.
- The MQTT worker retained its existing container and image. No firmware was
  flashed and no actuator commands were sent by this deployment.
- Production builds, TypeScript, targeted Python lint/type checks and whitespace
  checks passed. Functional, integration and browser tests remain unrun.
- Earlier cancelled preparation cannot be recovered; imported timestamps/targets
  are explicitly marked approximate where original precision was unavailable.
