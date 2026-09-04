# Eggcelerate Guides

Project implementation and design handoff guides live here.
Source of truth for behavior is code + `../SYSTEM_ARCHITECTURE_GUIDE.md`.

- [Color guidelines](./color-guidelines.md) — semantic color tokens, navigation hierarchy, status contrast, chart exceptions, and accessibility rules.
- [Typography guidelines](./typography-guidelines.md) — semantic type/weight/leading/tracking tokens, hierarchy, component usage, and accessibility rules (Baloo 2 / Nunito, rem scale, 100% root).
- [UI control-size guidelines](./ui-control-size-guidelines.md) — search, select, button, chip, toggle, segment, and tab geometry.
- [Auth & Onboarding (routed mock boundary)](./auth-onboarding-guide.md) — public mock routes, tokens, provider/guard seam, and future server-auth handoff.
- [Frontend restructuring](./frontend-restructuring-guide.md) — active F0–F6 execution checklist (domain → repository → Query → routing/auth → states → gate).
- [Backend dashboard-first](./backend-dashboard-first-guide.md) — B0B resume point; refine mock writes to service commands before HTTP.
- [Database setup](./database-setup-guide.md) — contract-first FastAPI, PostgreSQL/TimescaleDB, migrations, adapter integration, verification, and operational handoff plan.
- [Firmware safety contract](./firmware-safety-contract.md) — provisional 42 °C cutoff, hysteresis, watchdog; hardware verification required before actuator writes.
