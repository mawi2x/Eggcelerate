# Phase 5 handoff — continuous telemetry and dashboard freshness

Date: 2026-09-23. Main repository base: `e391a1e`.
Main implementation commits: Phase 4 `0db4a94`, Phase 5 `6b53341`, CI and
migration verification `d5f6b44`. Simulator contract commit:
`5746c94` in `/home/mawi/Projects/eggcelerate-simulate` (base `e112a25`).
Scope: refinement Phase 5, within B4 simulator integration. The separate B5 LED
hardware harness remains outside this completion. Next: Phase 6 authentication.

## Implementation

Migration `0009` stores each device's latest temperature, humidity, water,
battery, power source, boot identity, sequence, observation time, accepted receipt
time, and last-seen receipt time. Both scoped reads and mutation hydration use
this projection. Raw historical readings retain their existing identity and
five-minute research aggregation.

Live telemetry now requires `boot_id` and `booted_at` alongside the existing
schema-v1 fields. Update the sibling simulator/firmware with the API together.
Within a boot, sequence and observation time must advance. A different boot must
have a later boot time and observation time. Old/replayed messages can be stored
as history but cannot refresh liveness or replace the projection. Conflicting
reuse of the current sequence is rejected. Devices require a synchronized UTC
clock; a clock that moves backwards can delay projection recovery until corrected.

Freshness uses the server receipt of advancing telemetry: fresh through 45s,
stale through 180s, offline afterwards. The dashboard polls summaries/readings
at 15s while visible; query observers share requests and pause polling in hidden
tabs. A local 5s timer ages cached status during API outages. The monitor shows
observation age separately, and explicitly identifies development sensor previews
where no telemetry exists. Historical chart points are no longer overwritten by
current summary values.

The browser proof discovered and fixed an existing native-fetch receiver bug:
`ApiRepository` now binds default fetch to `globalThis`. A regression test covers
this browser requirement.

Rejected-message diagnostics are throttled by error code, avoiding an unbounded
per-topic diagnostic map. The worker queue remains bounded at 1,000 messages.
QoS0 telemetry can be lost during outages or overload; subsequent fresh samples
restore the live view. This is not a guaranteed telemetry delivery/archive service.

## Verification

- Full PostgreSQL-required API suite: 87 passed, zero skips. After the final
  connection-state adjustment, affected API tests were rerun.
- Frontend: 298 tests across 36 files; coverage thresholds passed (90.87% lines,
  82.78% branches, 89.01% functions). Lint, typecheck and production build pass.
  The existing bundle warning remains: main chunk 558.04 kB (152.18 kB gzip).
- Ruff lint/format and mypy pass.
- Fresh and populated migrations pass through `0009`.
- Shared live repository contract: the earlier 28/28 result is superseded. A
  current isolated rerun fails the HTTP reconnect case (27 passed, 1 failed);
  the memory adapter passes. See GATE-01 and Phase 1 of the project review plan.
- Simulator unit tests: 24 passed.
- MQTT → worker → durable projection → REST integration proof passed on an
  isolated test farm with a temporary loopback broker.
- Browser proof: actual Chromium, local Vite/API, simulator on the 15s cadence;
  the already-open monitor changed Live → Stale → Offline during broker shutdown.
  At 390 × 844 there was no horizontal overflow. After broker restart, Live did
  not return within 45 seconds, so automatic recovery remains unverified.
- Six-client, 60-request local benchmark: p95 114.33 ms, 440 SQL statements,
  10 mutation locks, below the existing 150 ms local budget. This is a regression
  fixture, not a production capacity measurement.

Target for a healthy visible dashboard: up to 15s until the next device sample,
2s ingestion allowance and 15s until the next dashboard poll (32s total from a
physical change; 17s from an emitted observation). Five-minute research buckets
are independent of this target. Hidden tabs catch up after returning to view.

## Resume and deployment boundaries

1. Review main migration `0009`, `mqtt/telemetry.py`, `database/incubators.py`,
   `features/farm/telemetry.ts`, and the telemetry/API-repository tests.
2. Review sibling `/home/mawi/Projects/eggcelerate-simulate` separately:
   `sim/physics.py`, `sim/mqtt.py`, `tests/test_physics.py`, `tests/test_mqtt_logic.py`.
3. Apply migrations and rebuild intentionally before using the existing preview;
   the running preview containers were not upgraded by this phase.
4. Rollback live polling with build-time `VITE_LIVE_REFRESH_ENABLED=false` while
   retaining REST reads and ageing labels. Stop the worker to pause ingestion.
5. Begin Phase 6 with the user's chosen app-managed email/password accounts,
   server sessions, and farm authorization. Auth is still disabled in the protected
   preview. Shared/public broker TLS, credentials/ACLs and hardware qualification
   remain future work. Device setpoint/LED/calibration commands remain unavailable.

This note was originally written under ignored `docs/refine`. Phase 4 later applied
D-2 and tracks the note with the B4 contract and backend guide.
