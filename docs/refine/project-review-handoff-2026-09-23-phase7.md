# Phase 7 handoff — frontend truthfulness and states

**Status:** complete. **Implementation commit:** `8d5252b` (`fix: make dashboard states truthful and actionable`).
**Next:** Phase 8, identity and farm authorization, using the selected app-managed email/password account approach.

## What changed

- Telemetry freshness uses the receipt timestamp consistently across API and in-memory
  adapters. Never-reported units are not called live, and stale/offline actuator tiles
  show unavailable states instead of inferred activity.
- Sensor history and Trends distinguish loading, failed, and empty states, offer retry,
  and keep cached readings visible with a refresh warning. Trends labels stale data,
  exports every compared chamber with chamber names in the CSV, and has one accessible
  pagination control.
- Manual turns now distinguish server acceptance from device execution. The accepted
  command is cached as pending and polled through the existing
  `GET /api/v1/incubators/{incubator_id}/commands/{command_id}` status route; the confirmed
  `lastTurned` value is not advanced on acceptance. The repository contract also validates
  command statuses and API error envelopes against the canonical error-code vocabulary.
- Cycle completion and stop return their committed history records directly, which lets
  the UI update history caches without a dependent follow-up read. Candling retries
  revalidate the current day-to-entry ID while retaining idempotent replay behavior.
- Incubator updates use explicit action intents, so partial field shapes cannot route a
  manual turn. Timeline milestones now target unique journal identities, including
  placeholders, and open the selected checkpoint in the journal.

## Verification

- `pnpm lint` passed.
- `pnpm --filter eggcelerate-ui typecheck` passed.
- `pnpm --filter eggcelerate-ui test` passed: **234 tests across 30 files**.
- `pnpm --filter eggcelerate-ui coverage` passed the configured thresholds and verified
  that all seven screen modules appear in the coverage report.
- `pnpm --filter eggcelerate-ui build` passed. Vite still warns that the main JavaScript
  chunk is 559.77 kB, above its 500 kB advisory limit.

## Electronics and integration limits

This phase makes the dashboard accurately represent telemetry and turn-command status;
it does not certify a physical controller or local-network installation. The web client
uses the existing turn acceptance and status contracts. The status route reads durable
command records and is available in the database-backed API mode; the API's in-memory
mode accepts a turn but reports status as unavailable. Before relying on a specific
electronics board, verify its MQTT command/ACK payload, device identity, timing, and
network reachability against the API and simulator, then exercise it on the actual board.

The production build's chunk-size advisory is unchanged as a build success, but remains
available for a later performance pass. No API, firmware, physical-device, or LAN hardware
qualification was performed as part of this UI phase.

See the [Phase 7 section of the execution plan](project-review-execution-plan-2026-09-23.md#phase-7--frontend-truthfulness-and-states).
