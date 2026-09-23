# Phase 9 handoff checkpoint — 2026-09-24

**Status: implementation and local software gates are recorded; Phase 9 is not complete
or release-ready.** The main-repository changes are on branch `experiment`. This checkpoint
captures a safe stopping point for the release-readiness and electronics work.

**Implementation revisions:** `4c5c095` (`feat: harden owner and device onboarding`),
`48bfd7f` (secure MQTT client and isolated database restart drill), and simulator commit
`b04d304` (TLS/auth client support).

Production now keeps public registration disabled until email verification exists. An
operator can create an owner, reset passwords (revoking active sessions), and provision
globally unique device IDs. Login attempts are limited by an HMAC-keyed, persistent
15-minute email bucket. Authenticated chamber creation or reassignment requires the exact
device ID to be provisioned for that owner's farm. The simulator worker resolves registered
IDs across farms and only claims commands for those IDs. The local simulator overlay now
configures both API and worker to use sessions and PostgreSQL, with registration closed.

The bundled MQTT worker refuses `APP_ENV=production`. The worker and Python simulator now
support broker credentials over verified TLS and optional mutual TLS. The local broker still
allows anonymous plain connections on loopback; there is no broker-credential provisioning
flow, configured device ACL, or firmware-side credential yet.
The checkout at `../eggcelerate-simulate` is a Python MQTT simulator, not ESP32 firmware; it
already tracks device boot identity and rejects commands dispatched for a stale boot. No
ESP32 firmware source was found. **The API endpoints and registry can support simulator
wiring; the current setup does not yet authenticate or qualify a physical ESP32, relay,
motor, or heater.**

| Verification | Result |
| --- | --- |
| API integration tests | 113 passed; 2 upstream Starlette/httpx deprecation warnings |
| Web tests and coverage scope | 241 passed across 32 files; coverage scope passed |
| Live API/frontend contract | 28 passed; session-mode `/readyz` startup measured 959 ms locally |
| Fresh and populated migration upgrades | Both passed; populated data was preserved |
| `alembic check` | No new upgrade operations detected |
| Backup/restore drill | Restored migration `0014`, farm data, one Timescale telemetry sample, device registry, and owner membership into a clean disposable database; latest isolated archive 73,506 bytes and dump/restore interval 0.59 s |
| Persistent database restart drill | Passed in a newly created TimescaleDB container and named volume; migration `0014`, seeded farm, registered device, and telemetry sample survived restart; readiness returned in 0.63 s. The script removes only its unique container and volume. |
| Simulator suite | 27 tests passed, including command replay, stale-boot rejection, and TLS credential setup |
| API worker MQTT tests | 5 passed, including credential/TLS configuration and rejection when credentials lack a trusted CA |
| Simulator contract gate | 11 payload checks passed against the upstream Zod schemas |
| Broker authentication/ACL integration | Open; no authenticated broker configuration, per-device account provisioning, or ACL policy is installed. |
| Frontend production build | Main chunk 573.27 kB / 155.43 kB gzip; Vite reports the uncompressed chunk exceeds its 500 kB warning threshold |
| Ruff, mypy, Biome, Compose config | Passed; simulator config explicitly checked for session auth on API and worker, PostgreSQL, and disabled registration |

Integration tests and verification scripts now reject URLs outside loopback
`eggcelerate_test:55432`, reducing the chance that a developer database is mutated by a
test or temporary database drill.

The API factory now generates its OpenAPI route graph before serving requests. This avoids
a FastAPI 0.141 first-request race on shared header metadata; the concurrent storage tests
cover idempotent writes across separate running app instances.

The local measurements have provisional guardrails of 160 kB gzip for the entry chunk and
5 seconds to `/readyz`; they are not production SLOs. The restore drill and startup probe
use the disposable test service and do not demonstrate behavior on the deployment host.
`apps/api/scripts/verify_database_restart.py` creates its own randomly named TimescaleDB
container and volume, migrates and seeds it, restarts only that container, verifies the
registry and telemetry data, then removes the resources it created. The restore script
brackets `pg_restore` with Timescale's pre- and post-restore functions.

The API concurrency test now constructs its two FastAPI route graphs before launching
concurrent requests. It still verifies that separate API instances racing on the same
database idempotency key create one durable mode.

Still required before calling Phase 9 complete:

- Provision per-device broker credentials and implement the same TLS/auth settings in the
  actual ESP32 firmware. The simulator checkout is present; ESP32 firmware source is not.
- Add broker authentication, ACLs, and TLS, then exercise authenticated telemetry,
  acknowledgments, and farm-isolated command delivery with the intended device.
- Restart and outage-test the API, broker, and worker with retained volumes in an isolated
  deployment environment; run and review a production-like restore. The isolated database
  container restart drill now passes locally.
- Decide on email verification and self-service account recovery, or explicitly keep
  operator-managed account creation as a release requirement.
- Re-measure bundle and startup budgets on the deployment host, inspect production secrets
  and auth boundaries there, and record a release decision.

Do not expose the local simulator broker or enable the bundled worker for production. No
hardware operation or service deployment was performed in this checkpoint.
