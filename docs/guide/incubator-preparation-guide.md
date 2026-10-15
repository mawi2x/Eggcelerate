# Incubator preparation and confirmed incubation

## Owner workflow

1. Connect the incubator to Wi-Fi and add it to the correct farm using its pairing
   code (EGG01 for EGG-001). DHT22 readings and LCD/OLED work before website pairing;
   pairing assigns recorded readings and commands to the farm's chamber.
2. Open the chamber, select **Prepare**, choose Chicken, Duck or Quail, and choose
   **Begin Preparation**. This saves preparation state and queues the selected
   mode's automatic climate command in the same database transaction.
3. Check **Live Monitor → Chamber status** for device confirmation. The upper fan
   circulates air, the heater regulates temperature, the mist maker raises low
   humidity, and lower exhaust removes excess heat/humidity. Tray relay stays off.
4. After acknowledgement, both actual readings must remain within the selected
   ranges for one minute, without sample gaps over 45 seconds. Stale sensor or
   controller reports, faults, or a changed mode prevent readiness.
5. The page shows **Ready to load eggs** and a durable **Ready to load eggs**
   notification is added to Alerts once for this preparation. Notification history
   is not proof of current readiness: the server checks readiness again at start.
6. Load eggs and enter the count **1–38**. Confirm **Start Incubation**. Only that
   confirmation starts Day 1. Regulation continues during the handoff; its mode,
   fan operation and heater timing are not restarted. There is no bench time limit.
7. **Stop Cycle** or completion queues all-equipment Stop atomically with the
   lifecycle record. **Cancel preparation** does the same without creating a hatch
   record. Heater, mist, both fans and tray stay off after device confirmation;
   sensors, LCD/OLED, Wi-Fi and database recording continue.

An idle/available chamber is not automatically ready for eggs. Changing the
preparation mode restarts the one-minute check. Current firmware accepts the
unchanged built-in normal-incubation target ranges; unsupported/edited presets
are rejected before preparation is committed.

## Faults and loss of power

Sensor failure/staleness, overheating (39°C), or ten minutes continuous commanded
heating stop heater/mist and latch a fault. Both fans ventilate during an active
fault; explicit Stop overrides ventilation and turns all outputs off. Resolve the
cause, use **Reset controller fault** in Chamber status, then explicitly resume
regulation. Reset alone never starts the equipment.

The firmware saves acknowledged preparation/incubation authorization and mode in
NVS. Following a normal power restart, outputs initialize off; authorized operation
resumes only after two fresh valid DHT22 readings and the circulation fan lead.
A saved manual Stop stays stopped. Faults are persisted; crash/watchdog resets
require recovery rather than an automatic heater restart. Corrupt/unwritable
run-state storage prevents operation. Server intent and boot-bound commands
reconcile when networking returns. Device recovery does not depend on the laptop
website being open, but recording requires the broker/database to be reachable.

The reported laptop-USB/UPS issue requiring EN is **not diagnosed or fixed** by
this workflow. The device must boot reliably before firmware can recover. Physical
outage/return-of-power acceptance remains required.

## Scope and acceptance

This update integrates the existing climate preparation/confirmation flow locally.
It does not commission physical tray turning, RPM/contact/water feedback, PWM fan
speed, a new lockdown humidity profile, calibration, or the live-server deployment.
The heater-facing upper fan is GPIO18; lower exhaust GPIO19. Hardware startup
levels, thermal protection, actual climate regulation, reliable reboot and the
full owner flow require supervised acceptance on the real incubator before eggs
are entrusted to it. Commanded output states do not prove physical operation.

The one-minute stability duration is the current product setting, not a validated
stabilization duration for every incubator. Readings and target ranges should be
checked against an independent reference during commissioning.
