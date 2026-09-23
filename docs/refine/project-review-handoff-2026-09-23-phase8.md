# Phase 8 handoff — identity and farm authorization

**Status:** complete for authenticated HTTP access and farm isolation.

**Implementation commit:** `0709075` (`feat: add farm-scoped account sessions`).

**Next:** Phase 9, release readiness, account safeguards, and device ownership.

## What changed

- Added migration `0012_app_managed_auth` for users, farm memberships, and revocable
  server-side sessions. Registration creates an empty farm and makes its first user the
  owner. Passwords are hashed with Argon2id; browsers receive an opaque `HttpOnly`
  session cookie, while only its digest is stored in the database.
- Added `/api/v1/auth/register`, `/login`, `/session`, and `/logout`. Sessions expire
  after 12 hours, or 30 days when “remember me” is selected. Writes require a session,
  a session-bound CSRF token, and an allowed origin.
- Protected farm reads and writes using the farm membership resolved from the session.
  Resource lookup, command status, telemetry history, and idempotent replay now use that
  verified farm scope.
- Connected the API-mode web app to account registration, sign-in, session hydration,
  logout, and private-query cache clearing. Mock authentication remains in mock-data mode.
- Made the production Compose overlay require session auth, a database URL, and HTTPS
  CORS origins. Added an unauthenticated `/readyz` route for service health checks.
- Updated the account, database, backend, and architecture guides for the implemented
  policy and endpoints.

## Verification

- Web lint, typecheck, tests (**239 passed across 32 files**), coverage, and production
  build passed. The build still reports a Vite main-chunk advisory at **571.97 kB**
  (**155.14 kB gzip**) against its 500 kB warning threshold.
- API database suite passed: **106 passed**, with two upstream TestClient deprecation
  warnings. Ruff passed, and mypy passed for 39 source files.
- Fresh and populated migration upgrades passed. `alembic check` reported no pending
  schema operations after upgrade.
- Production Compose configuration rendered successfully with required database and
  HTTPS-origin variables. This verifies configuration only; it is not a deployment.
- `git diff --check` passed. No live API contract was run against the running preview.

The disposable `eggcelerate-db-test` database was used for database-backed verification;
the development database and running services were not restarted or migrated.

## Current boundaries

App-managed email/password accounts are in place, but email addresses are not verified,
password recovery is not implemented, and registration/login are not rate-limited. Keep
open registration on a private preview until Phase 9 adds those controls or disables
public registration.

This phase makes the HTTP API authenticate users and isolate farm data. It does **not**
make electronics multi-tenant or certify hardware operation. The MQTT worker still opens
its store for `DEFAULT_FARM_ID` and dispatches only that farm's commands. The owner UI
accepts a device ID but does not prove device ownership or provision it. Phase 9 must map
farms to provisioned device identities and make telemetry, commands, and acknowledgments
tenant-bound before accounts can safely control electronics across farms. No physical
relay, motor, heater, board, or local-network test was performed.

No public deployment, backup restore, outage drill, penetration test, or browser test
against a newly deployed production stack was performed. Those remain Phase 9 release
evidence.

## Phase 9 entry

1. Add account abuse controls: verified email and recovery, rate limits, or a closed
   registration policy.
2. Provision device identities and bind them to authorized farms; remove the worker's
   single-default-farm dispatch assumption and test cross-farm MQTT isolation.
3. Record the startup and bundle budgets, migration evidence, restart/outage behavior,
   secret handling, and a clean-environment backup restore before making a release
   decision.
4. Test a specific electronics board against the authenticated API, simulator, MQTT
   command/ACK contract, and actual network before enabling physical actuators.

See the [Phase 8 section of the execution plan](project-review-execution-plan-2026-09-23.md#phase-8--identity-and-farm-authorization-b6)
and the [current account guide](../guide/auth-onboarding-guide.md).
