# EGGCELERATE API

This directory is reserved for the future backend. Accepted technology
decisions (local-only ADRs under `docs/docs/adr/`):

- Backend framework: **Python + FastAPI** (ADR-002, accepted 2026-07-27).
- IoT transport: **MQTT via Mosquitto**, QoS 1 commands / QoS 0 telemetry (ADR-001).
- Database: **PostgreSQL + TimescaleDB** (ADR-003).
- Device safety authority: **local ESP32**, server best-effort only
  (`docs/guide/firmware-safety-contract.md`, provisional values pending
  hardware verification).

Nothing is implemented yet: no service, database integration,
authentication system, or container. The frontend `ApiRepository` must
not be added until endpoint and authentication contracts are defined
(see System Architecture Guide §10 phase B1).
