# Phase 1 handoff — truthful telemetry baseline

**Status:** complete. Phase 2 (turn outcome truthfulness) is next.

**Commit:** `5221ca4` (`fix(telemetry): align offline state across adapters`).

## What changed

- API and memory adapters now report a chamber as connected only when it is paired
  and telemetry is fresh. A never-seen device resolves to `offline` in both adapters.
- The web fixtures and in-memory repository use the same offline default. The shared
  condition helper requires an explicit telemetry state, so callers cannot silently
  assume that pairing means live telemetry. New chambers are shown as offline while
  awaiting their first report.
- The shared HTTP contract now expects reconnecting to pair the chamber without claiming
  that it has reported. API tests pin the connection rule, compare seeded Postgres and
  memory state distributions, and check matching 404 behavior.
- The local verification guide now includes the web test command and checks the
  disposable Timescale image by image reference.

Offline telemetry remains `critical` because current chamber conditions are unknown. The
preview now reports all 12 never-seen chambers as offline/critical in both adapters; this
phase closes false-live behavior and adapter divergence, rather than suppressing a real
loss-of-telemetry condition.

## Verification

- API suite with required disposable database: **93 passed, 0 skipped**, 2 dependency
  deprecation warnings.
- Shared live HTTP contract: **28/28 passed**.
- Web suite: **299 passed across 36 files**.
- `pnpm lint`: passed, 174 files; web typecheck passed.
- Ruff check and format: passed, 68 files; mypy passed, 35 API source files.
- Compose base API, web and database services are healthy. API publishes
  `127.0.0.1:8000`; `/readyz` returns **200**. The API runs with the default memory
  backend while the database profile is up and healthy.
- Container build passed. Vite still reports the existing 500 kB chunk warning
  (main chunk about 558.5 kB); bundle work is tracked separately as SYS-08 / Phase 9.

The old host-network `egg-api2` probe occupied port 8000. It was stopped to allow the
Compose preview to be recreated; its container was retained and had no mounted data.

## Next phase

Phase 2 addresses the command/ACK path: do not lose acknowledged MQTT messages when the
worker queue is full, correlate ACKs with the device boot identity, and tolerate device
clock skew and late delivery without misreporting an executed turn as timed out. See
Phase 2 in [`project-review-execution-plan-2026-09-23.md`](project-review-execution-plan-2026-09-23.md).

**Tracking:** Phase 4 applied D-2 and added `!docs/refine` to `.gitignore`; this handoff
and the review evidence are now versioned.
