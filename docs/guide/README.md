# Eggcelerate Guides

Project implementation and design handoff guides live here.
Source of truth for implemented behavior is the current code. The dated
[system architecture preparation](./system-architecture-preparation-2026-10-18.md)
records current boundaries and deployment status; the older architecture guide
needs reconciliation against the ESP32 pilot and current roadmap.

**Next-session reminder:** frontend and system audit is pending. Start with the
[October 12 current progress checkpoint](../current-progress-2026-10-12.md),
then follow its frontend/backend/firmware/operations checklist.

- [Troubleshooting](./troubleshooting.md) — environment selection and symptom-based checks for Docker/web, HTTPS/login, API/database, MQTT, and ESP32 issues.
- [Local startup](./local-startup-guide.md) — local Docker dashboard, database and device services, logs, and frontend updates.
- [Color guidelines](./color-guidelines.md) — semantic color tokens, navigation hierarchy, status contrast, chart exceptions, and accessibility rules.
- [Typography guidelines](./typography-guidelines.md) — semantic type/weight/leading/tracking tokens, hierarchy, component usage, and accessibility rules (Baloo 2 / Nunito, rem scale, 100% root).
- [UI wording](./ui-copy-guidelines.md) — numeric ranges use “to”; summaries use readable sentences instead of middle-dot separators.
- [Typography — experimental](./typography-experimental.md) — EXPERIMENTAL filter-value/filter-label tablet+mobile tiers only; stable contract stays in Typography guidelines.
- [UI control-size guidelines](./ui-control-size-guidelines.md) — search, select, button, chip, toggle, segment, and tab geometry.
- [Screen notes](./screen-note-guidelines.md) — bottom placement for standalone explanations and informational notices.
- [Auth & Onboarding](./auth-onboarding-guide.md) — app-managed API sessions, farm ownership, local mock flow, and remaining release gates.
- [Incubation run history](./incubation-run-history.md) — automatic preparation/cycle history, saved targets, and run-specific trends.
- [Custom trend dates](./custom-trends-date-range.md) — From/To environmental history filtering and matching raw exports.
- [Last-minute changes](./last-minute-change.md) — signed-in Settings password-change plan and interim shared-incubator access behavior.
- [System architecture preparation](./system-architecture-preparation-2026-10-18.md) — current system context, runtime components, device flows, deployment profiles, and open decisions.
- [Local user administration](./platform-admin-guide.md) — administrator sign-in, creating farm owners, and the local database bootstrap.
- [Device provisioning](./device-provisioning-guide.md) — operator-owned device IDs, farm routing, and the local simulator-only boundary.
- [Incubator preparation](./incubator-preparation-guide.md) — mode selection, measured stability, loading eggs, and starting Day 1.
- [Local climate PWM implementation](./climate-pwm-local-implementation.md) — initial exhaust speed control, command reporting, history migration and rollout limits.
- [VPS-connected local development](./vps-connected-local-development.md) — local frontend editing with VPS API/login, portable ESP32 connection and activation order.
- [ESP32 offline storage implementation](./esp32-offline-storage-implementation.md) — activation steps, wire contract, recovery limits, and operator guidance.
- [ESP32 offline storage plan](./esp32-offline-storage-plan-2026-10-18.md) — bounded persistent readings, committed upload receipts, safe historical replay, and rollout phases.
- [Hardware pin map](../../apps/firmware/hardware-pin-map.md) — schematic GPIO context, corrected DHT22 pin, and planned LCD/OLED/light connections.
- [Relay and fan integration](../../apps/firmware/actuator-integration-guide.md) — revised two-/four-channel relay allocation, proposed GPIOs, and later actuator implementation phases.
- [Frontend restructuring](./frontend-restructuring-guide.md) — active F0–F6 execution checklist (domain → repository → Query → routing/auth → states → gate).
- [Backend dashboard-first](./backend-dashboard-first-guide.md) — B0B resume point; refine mock writes to service commands before HTTP.
- [Database setup](./database-setup-guide.md) — contract-first FastAPI, PostgreSQL/TimescaleDB, migrations, adapter integration, verification, and operational handoff plan.
- [Firmware safety contract](./firmware-safety-contract.md) — provisional 42 °C cutoff, hysteresis, watchdog; hardware verification required before actuator writes.
