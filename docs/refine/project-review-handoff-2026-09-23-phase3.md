# Phase 3 handoff — telemetry projection robustness

**Status:** complete. Phase 4 (documentation truth pass and D-2 tracking decision) is
next.

**Commit:** API `5703ceb` (`fix(telemetry): recover projection across reboots`).

## What changed

- The latest telemetry projection now gives a strictly later device boot precedence
  over observation time. Within one boot, both sequence and observation time must
  advance. A message from an earlier boot cannot replace a newer projection.
- Boot timestamps more than the shared 60-second clock tolerance ahead of server
  receipt time are rejected.
- Telemetry ingestion locks the assigned chamber and device. On the first accepted
  sample after reassignment, it deletes any previous projection for that chamber or
  device, then records the new state. Raw Timescale samples remain available.
- Migration `0011` adds the claim-query index on `(farm_id, status, next_attempt_at)`
  and a restrictive composite foreign key from commands to their chamber. The existing
  command status check remains in place. Readiness now requires revision `0011`.
- The MQTT contract guide now records the actual projection precedence and timestamp
  tolerance.

## Verification

- Full PostgreSQL API suite: **104 passed, 0 skipped**, 2 Starlette/AnyIO deprecation
  warnings.
- Focused telemetry and migration checks: **8 passed**.
- Fresh and populated migration upgrades passed through `0011`.
- Alembic schema check reported no new upgrade operations.
- Ruff check and format passed for 68 files; mypy passed for 36 API source files.
- Shared live HTTP contract passed **28/28**.
- `git diff --check` passed before commit.

The reassignment test changes a chamber's assigned device directly in PostgreSQL and
proves the new device's first accepted sample replaces the stale projection. The API
currently has no device-reassignment endpoint, so this covers the persistence boundary
that a future endpoint can use. No physical board or live broker-in-the-loop was
available.

## Next phase

Phase 4 applied D-2 to track `docs/refine`, repaired dead citations, and brought the
architecture, database and infrastructure guides into line with the implementation
through migration `0011`. The next phase is test-gate parity and coverage hardening.
