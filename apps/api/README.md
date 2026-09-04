# EGGCELERATE API

> **Current status:** Runtime implementation paused after frontend contract
> checkpoint B0A. Resume at B0B in
> `docs/guide/backend-dashboard-first-guide.md`; do not scaffold FastAPI yet.

This directory is reserved for the future backend. Accepted technology
decisions (local-only ADRs under `docs/archive/adr/`):

- Backend framework: **Python + FastAPI** (ADR-002, accepted 2026-07-27).
- IoT transport: **MQTT via Mosquitto**, QoS 1 commands / QoS 0 telemetry (ADR-001).
- Database: **PostgreSQL + TimescaleDB** (ADR-003).
- Device safety authority: **local ESP32**, server best-effort only
  (`docs/guide/firmware-safety-contract.md`, provisional values pending
  hardware verification).

Nothing is implemented yet: no service, database integration,
authentication system, or container. The dashboard-first backend keeps
authentication disabled and local-only initially, with a dormant request-context
boundary and a production startup guard. Do not add fake auth endpoints or JWT
storage during that milestone.

The frontend `ApiRepository` must not be added until the dashboard endpoint and
explicit command contracts are defined. See
`docs/guide/backend-dashboard-first-guide.md` and the System Architecture Guide
§10 phase B1.
