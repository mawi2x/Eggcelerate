# M4 telemetry scale — October 3, 2026

M4 is implemented and verified locally for the protected dashboard pilot. The
existing raw readings endpoint remains available for compatibility. Trends now use a
separate bounded chart contract; complete exports use a snapshot-scoped preview and
streamed CSV contract.

## Delivered behavior

- `GET /api/v1/incubators/{id}/readings/chart?window=24h|7d|full` returns at most
  600 sparse buckets per chamber. Each bucket contains the average, minimum and
  maximum temperature/humidity, sample count, water-not-ok count, and bucket width.
  Empty buckets are omitted; the web chart inserts null sentinels so gaps remain
  visible. A one-sample excursion remains visible through the extrema fields and
  tooltip/range guides instead of being hidden by the bucket average.
- Chart scopes preserve UTC `[start, end)` semantics, current chamber/device
  ownership, late samples received before the frozen request cutoff, and compare
  mode. The chart route never returns a full raw window.
- Historical chart refresh is five minutes for 7-day/full-cycle views; the 24-hour
  view refreshes every 30 seconds. Polling is paused in the background by the
  existing M2 visibility policy.
- `GET /api/v1/incubators/readings/raw-preview` validates 1–100 chambers, resolves
  the requested window, freezes assignments and the end cutoff, and returns at most
  200 preview rows plus the total count and signed one-hour scope token.
- `POST /api/v1/incubators/readings/export` validates that token, then streams every
  immutable raw sample in stable `(observed_at, chamber_id)` order as UTC CSV. It
  does not include samples received after the preview cutoff or samples from a later
  device assignment. The memory adapter implements the same preview/export contract.
- CSV names beginning with spreadsheet formula characters are escaped. Downloading
  uses a bounded long-transfer timeout and reports retryable errors through the
  existing UI notification path.
- Trends explains that lines are bucket averages, range guides retain extrema,
  gaps are preserved, and raw CSV is the complete-sample path. The raw readings
  dialog shows a bounded preview and clearly labels the complete export.

## Measurement

The disposable benchmark farm contained 100 chambers and 21 days of 30-second
samples: 6,048,000 raw samples. Results are recorded in the ignored local artifact
`output/m4-api-measurements.json`; the reproducible script is
[repro/m4_readings_scale.py](repro/m4_readings_scale.py). Request measurements are
local PostgreSQL query plus JSON serialization, not WAN transfer.

| Scope | Raw points / JSON | Bounded chart points / JSON | Chart query + serialization |
| --- | ---: | ---: | ---: |
| 1 chamber, 24h | 2,880 / 0.41 MB | 597 / 0.14 MB | 32 ms |
| 12 chambers, 7d | 241,920 / 34.6 MB | 7,200 / 1.76 MB | 714 ms |
| 100 chambers, full cycle | 6,048,000 / 864.9 MB | 60,000 / 14.9 MB | 2,705 ms |

The chart bound is per chamber; compare mode therefore has `600 × chamber count`
series points. The benchmark also measured browser work in Firefox with real chart
mappers: 100 chambers stayed at 600 axis rows; full-cycle JSON parsing was 148 ms,
DTO mapping 5.86 s, and axis merging 18 ms on this workstation. The UI normally
loads only the selected chamber or an explicit compare selection, so 100-chamber
figures are a capacity check rather than the default screen request.

## Verification

- 126 API tests passed with zero skips, including dense/sparse chart bounds,
  extrema, gaps, late arrivals, timezone range edges, complete export scope,
  assignment/rename freeze, token expiry, CSV formula escaping, memory parity and
  busy-farm periodic evaluation.
- 281 frontend tests across 38 files passed; coverage ran and all seven screen
  modules were included. The new tests cover chart aggregation, extrema, null gaps,
  slower historical polling, raw preview limits, complete CSV download and screen
  rendering.
- Live API/web repository contract: 30 tests passed.
- Fresh/populated migration checks, Alembic metadata check, Ruff, format, mypy,
  Biome, TypeScript and production build pass at the final checkpoint.
- Firefox visual check at the Trends route confirms the bounded chart loads, the
  raw readings action is visible, and stale/offline messaging remains available.

Two existing Python dependency deprecation warnings remain. The Vite >500 kB chunk
warning remains tracked for M5. The benchmark is local software/simulator evidence;
it does not qualify a real-device soak or production deployment.

## Operational boundary

M4 adds no new telemetry producer. The existing MQTT path and explicit development
JSON importer remain the only ingestion paths. Upgrade the database to Alembic head
`0015` before running the current PostgreSQL API. Deploy API and web together so the
new chart and export contracts are available to the strict web transport decoder.

Next: M5 loading and CI measurement. M0 owners, environment, hardware availability,
M7 operations, M8 physical qualification and M9 pilot sign-off remain pending.
