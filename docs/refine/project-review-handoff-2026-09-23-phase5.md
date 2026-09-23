# Phase 5 handoff — deployment and CI hygiene

**Status:** complete. Phase 6 (verification integrity) is next.

**Commit:** `10e32e5` (`ci: harden deployment runtime configuration`).

## What changed

- Wired `VITE_LIVE_REFRESH_ENABLED` through the web Docker build and Compose args. A
  false build disables the 15-second incubator-summary refetch while the five-second
  local freshness clock continues to age displayed state.
- Aligned the Python floor, mypy target, CI and API image on Python 3.14. The API image
  now runs as UID/GID `10001:10001`.
- Added per-workflow/ref concurrency groups that cancel superseded CI runs.
- Published the local Mosquitto broker on host loopback so the companion simulator can
  reach it; the API worker still reaches the broker over the Compose network.
- Pinned the clean simulator checkout at `2b85e15`, documented its local connection
  command, and narrowed the documented guarantee of the web image's loopback guard.
- Updated the B4 guide's simulator revision and current migration/test references.

## Verification

- Base, production and simulator-overlay `docker compose config` passed. The simulator
  overlay resolves the broker mapping to `127.0.0.1:1883`.
- Web Docker image built with API mode and live refresh disabled. Its bundle has the
  incubator query compiled with `refetchInterval: false`; the separate UI clock remains.
- API Docker image built on Python 3.14, ran as UID/GID `10001:10001`, and returned
  `/healthz` **200**.
- Host-run simulator revision `2b85e15` published valid EGG-1003 telemetry to the
  Compose broker through `127.0.0.1:1883`. Simulator unit tests: **25 passed**; payload
  contract gate: **all checks passed**.
- PostgreSQL API suite: **104 passed, 0 skipped, 3 warnings**. Ruff passed for check and
  format across 72 files; mypy passed for 36 source files.

The API warnings are two dependency deprecations and the known Pydantic field-alias
warning carried to Phase 6. The web build retains the existing 500 kB chunk-size warning.
The loopback broker and simulator verify local software connectivity only; they do not
provide LAN access, broker TLS/authentication, or physical-device qualification.

## Next phase

Phase 6 hardens verification: replace source-text UI assertions with behavior checks,
extend rendered-component coverage, stabilize the warning gate, and derive seeded
chamber counts instead of pinning a literal. See the exact work items and exit gate in
[`project-review-execution-plan-2026-09-23.md`](project-review-execution-plan-2026-09-23.md#phase-6--verification-integrity).
