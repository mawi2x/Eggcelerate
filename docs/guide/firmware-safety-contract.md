# EGGCELERATE Firmware Safety Contract (provisional)

> **Status:** Provisional — recorded 2026-09-04 to unblock architecture closure.
> Hardware verification (cutoff trip test, watchdog timing test, NVS
> persistence across reboot/network loss) has NOT been performed.
> Values below must be confirmed against the selected hardware before any
> actuator-affecting backend command path is enabled.

## 1. Authority hierarchy

1. Hardware cutoff and relay behavior default to a safe state.
2. Firmware watchdog enters a safe mode if control is stuck.
3. The local ESP32 controller continues thermal control with locally
   available readings and setpoints when Wi-Fi, MQTT, FastAPI, or the
   database is unavailable.
4. NVS retains the last accepted safe setpoints across reboot and
   network loss.
5. Backend/cloud services send validated changes, store telemetry, and
   report status on a best-effort basis only.

The ESP32 is the safety authority. The server is never in the safety
loop: a browser state update, API write, or MQTT publish is not proof
that a device is safe.

## 2. Provisional safety values

| Value | Provisional setting | Confirmation required |
|---|---|---|
| Hardware thermal cutoff | 42 °C | Trip test on target hardware |
| Temperature hysteresis | 0.2 °C | Firmware control-contract test |
| Humidity hysteresis | 3 % RH | Firmware control-contract test |
| Control watchdog timeout | 180 s | Stall-injection test |
| Research telemetry persist interval | 5 min | Backend persistence test (B1) |
| Live sampling | 10 s / 30 s / 1 min (configurable) | Device/plan agreement |

The UI condition helper (`deriveConditionSeverity`) applies warning and
critical thresholds for display only. It is not a stateful hysteresis
controller and must never be mistaken for one.

## 3. Command-path safety gates (required before hardware control)

Actuator-affecting controls require pending, acknowledged, rejected,
timeout, and rollback states end to end (UI → API → MQTT → ESP32 → ACK →
persistence → UI confirmation or rollback). Real actuator writes stay
disabled until the acknowledgement/timeout/rollback chain is tested
against the simulator.

## 4. Sources

- System Architecture Guide §8 (safety hierarchy, provisional values).
- ADR-001 (MQTT transport), ADR-002 (FastAPI backend), ADR-005 (system
  overview) — local-only ADRs under `docs/archive/adr/`.
- No firmware or simulator exists in the repository yet (planned).
