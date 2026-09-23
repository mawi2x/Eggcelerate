# Eggcelerate Guides

Project implementation and design handoff guides live here.
Source of truth for behavior is code + `../SYSTEM_ARCHITECTURE_GUIDE.md`.

- [Color guidelines](./color-guidelines.md) — semantic color tokens, navigation hierarchy, status contrast, chart exceptions, and accessibility rules.
- [Typography guidelines](./typography-guidelines.md) — semantic type/weight/leading/tracking tokens, hierarchy, component usage, and accessibility rules (Baloo 2 / Nunito, rem scale, 100% root).
- [Typography — experimental](./typography-experimental.md) — EXPERIMENTAL filter-value/filter-label tablet+mobile tiers only; stable contract stays in Typography guidelines.
- [UI control-size guidelines](./ui-control-size-guidelines.md) — search, select, button, chip, toggle, segment, and tab geometry.
- [Auth & Onboarding](./auth-onboarding-guide.md) — app-managed API sessions, farm ownership, local mock flow, and remaining release gates.
- [Device provisioning](./device-provisioning-guide.md) — operator-owned device IDs, farm routing, and the local simulator-only boundary.
- [Frontend restructuring](./frontend-restructuring-guide.md) — active F0–F6 execution checklist (domain → repository → Query → routing/auth → states → gate).
- [Backend dashboard-first](./backend-dashboard-first-guide.md) — B0B resume point; refine mock writes to service commands before HTTP.
- [Database setup](./database-setup-guide.md) — contract-first FastAPI, PostgreSQL/TimescaleDB, migrations, adapter integration, verification, and operational handoff plan.
- [Firmware safety contract](./firmware-safety-contract.md) — provisional 42 °C cutoff, hysteresis, watchdog; hardware verification required before actuator writes.
