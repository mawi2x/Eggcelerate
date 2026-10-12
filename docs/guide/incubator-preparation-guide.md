# Incubator preparation

## Owner workflow

1. Pair the incubator. It begins idle and unassigned.
2. Open the chamber and choose **Prepare**, then select a species mode.
3. Choose **Begin Preparation**. Adjust the heater, humidifier, and fan manually.
4. Both live readings must remain inside that mode's targets for five minutes.
5. When **Ready to load eggs** appears, load the eggs and confirm a count from 1–38.
6. Confirm **Start cycle**. Only this starts Day 1 and the incubation schedule.

Changing the preparation mode restarts the stability check. Cancelling preparation
returns the chamber to idle/unassigned. Neither action starts a cycle or creates
a hatch record. Loading eggs can temporarily change conditions; the start action
remains available only while the server's readiness check passes.

## Preparation panel typography

The panel follows the active theme tokens, including the currently approved
phone scale in `typography-experimental.md`, rather than fixed Tailwind sizes.

| Role | Desktop default | Phone below 640px | Implementation |
| --- | --- | --- | --- |
| Preparation / status heading | 16px | 14px | headingSmall / --type-heading-sm |
| Target summary and instructions | 14px | 12px | body / --type-body |
| Cancel preparation action | 14px | 12px | --type-button-label |

Action labels use their mobile tier below 768px; body/headings use their phone
tier below 640px. Values above assume the default root size; rem tokens preserve
browser zoom. Heading/status fonts, weights and spacing remain the shared
SectionCard/StatusCallout styles. See [typography](typography-guidelines.md).

## Readiness

The preparation start time is persisted in PostgreSQL (migration 0019). The API
checks real telemetry samples on every chamber read and lifecycle mutation.
Five minutes of measured coverage is required, with no sample gap over 45 seconds
and a fresh latest reading. A value outside either range, a stale stream, or a
delayed sample interrupts the check. Only samples recorded after preparation
begins count. The server enforces readiness and the selected mode when starting;
the browser cannot bypass it by enabling a button.

The initial five-minute duration is a product setting in
`database/preparation.py`, not a sensor calibration or a validated stabilization
duration for every incubator. Preparation uses the same targets as the selected
mode and the existing 15-second polling cadence. Demo values cannot qualify.

## Current hardware scope

The main ESP32 firmware already publishes temperature and humidity. No reflash
is required for this dashboard/server feature. Actuator control remains manual;
the dashboard labels heater, mist maker, and fan states **Not reported** because
the sensor firmware does not send those states. The incubation schedule does not
yet drive physical turning in this sensors-only pilot.

Next work: local ESP32 control with safeguards, confirmed actuator telemetry and
command acknowledgements, followed by sensor calibration against a reference.
