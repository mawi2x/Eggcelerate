# Project mode review — October 4, 2026

The project includes implemented software and deliberate development adapters.
It is not entirely a mock application, and it is not yet a qualified physical
incubator system. The protected dashboard pilot remains the first release scope.

The user confirmed the hosting method: rent an Azure VPS and run the existing
stack with Docker Compose. Azure-specific managed services are not part of this
deployment plan. Remaining deployment work means configuring and verifying that
server, its production environment, HTTPS, persistent storage and backups.

This review inspected source and checked-in configuration only. It did not inspect
private environment values, Azure resources, remote CI results, or actual hardware,
and did not rerun the full software baseline. Earlier evidence retains its original
checkpoint. Latest UI edits and M6 extractions remain uncommitted after `493f051`.

## Evidence

| Finding | Source |
| --- | --- |
| Mock frontend and development/memory/disabled-auth defaults | [Environment example](../../.env.example), [base Compose](../../compose.yaml), [web environment parser](../../apps/web/src/app/data/transport/env.ts), [repository selection](../../apps/web/src/app/data/repositories/app-repository.ts) |
| Fixture-backed data and simulated latency | [Memory repository](../../apps/web/src/app/data/repositories/in-memory-repository.ts), [synthetic readings](../../apps/web/src/app/data/fixtures/readings.ts) |
| Mock identity and local sign-in | [Auth providers](../../apps/web/src/app/providers/auth-context.tsx) |
| Real API session/persistence enforcement exists | [Production overlay](../../compose.production.yaml), [API configuration guards](../../apps/api/src/eggcelerate_api/config.py) |
| Actuator tiles use threshold inference rather than reported states | [Monitor tab](../../apps/web/src/app/components/detail/LiveMonitorTab.tsx), [device telemetry contract](../../apps/api/src/eggcelerate_api/mqtt/telemetry.py) |
| Device settings and calibration unavailable | [Hardware panel](../../apps/web/src/app/components/settings/HardwarePanel.tsx) |
| SMS/email provisional; password recovery disabled | [Notification preferences](../../apps/web/src/app/components/settings/NotificationsPanel.tsx), [sign-in screen](../../apps/web/src/app/components/auth/SignInScreen.tsx) |
| MQTT is simulator-only; production worker refuses startup | [Simulator overlay](../../compose.simulator.yaml), [broker config](../../infrastructure/mosquitto.conf), [infrastructure guide](../../infrastructure/README.md), [worker](../../apps/api/src/eggcelerate_api/mqtt/worker.py) |
| Firmware planning only; prototype electronics unqualified | [Firmware README](../../apps/firmware/README.md), [approved provisioning plan](../../apps/firmware/provisioning-plan.md) |
| Native mobile placeholder | [Mobile README](../../apps/mobile/README.md) |
| Outdated root deployment claim | [Root README](../../README.md), contrasted with the production overlay and API configuration guards above |
| CI workflows exist; execution evidence is separate | [Web workflow](../../.github/workflows/web.yml), [API workflow](../../.github/workflows/api.yml) |

## Follow-up order

1. Continue M6 farm query/mutation separation and remaining write/scale work.
   Track the actuator inference issue so fresh telemetry does not imply verified
   heater/fan/mist states.
2. Finish M0 firmware source, board and inventory discovery.
3. In M7 correct deployment instructions and establish API-mode Azure operation,
   HTTPS, accounts, monitoring, retention, encrypted backups and recovery evidence.
4. In M8 implement firmware and production device transport; qualify reported
   state, physical commands, safe local control and AP/pairing/offline behavior.
5. Before M9, decide whether SMS/email, photo uploads and public account recovery
   belong in the pilot. Either implement and verify them or explicitly exclude
   them from acceptance. Complete candidate tests, operator journeys and pilot soak.

The authoritative inventory and milestone assignments are in
[ROADMAP.md](../../ROADMAP.md). No PDF roadmap currently exists in the repository.
