# Combined relay and fan MOSFET bench

Updated October 15, 2026. Upload **relay-bench.ino** to test three relays and two
fan MOSFETs from one ESP32-hosted page. The existing folder, sketch name and
Wi-Fi credentials are retained. The earlier standalone fan sketch remains a
fallback; use this combined sketch for the current upper/lower allocation.

| Output | ESP32 GPIO | Electrical command |
| --- | --- | --- |
| Relay IN1 — heater | 27 | LOW on / HIGH off |
| Relay IN2 — DC tray motor | 25 | LOW on / HIGH off |
| Relay IN3 — mist maker | 14 | LOW on / HIGH off |
| Upper fan MOSFET | 18 | HIGH on / LOW off |
| Lower fan MOSFET | 19 | HIGH on / LOW off |

**Move the GPIO14 signal wire from relay IN4 to IN3.** IN4 is unused and
GPIO26 is unassigned. GPIO4/21/23 are left untouched. Fan control is full ON/OFF
only; supply PWM is not enabled. `kWiringAndInterfaceConfirmed` remains true
following the earlier user confirmation; `kRelayActiveLevel` remains LOW.

## Upload and test

1. Turn load power off before uploading. Keep external +5 V disconnected from
   ESP32 5V/VIN while USB powers the board, retaining the confirmed common DC
   ground arrangement. Keep relay contact loads disconnected for click tests.
2. Open **relay-bench.ino** in Arduino IDE. Select **NodeMCU-32S**, the correct
   USB port, and **Erase All Flash Before Sketch Upload: Disabled**. Upload.
   Serial Monitor at **115200 baud** prints the complete output mapping.
3. Join **Eggcelerate-Relay-Test**, password **mango123**, then open
   **http://192.168.4.1**. Reload the page after flashing the combined revision.
4. Confirm all outputs start off. Power the fan load circuit using its confirmed
   12 V wiring and the relay board using its confirmed 5 V wiring. The fan power
   circuit must pass through its MOSFET module.
5. Press **Arm test**. Test each relay's **On/Off** and each fan's **Full on/Off**
   separately. Confirm upper GPIO18, lower GPIO19, and mist relay IN3.
6. Once individual outputs are correct, leave fans running and click a relay to
   check combined operation. Each output is independent. **All off** switches
   all five outputs off and disarms the session.

The UI reports commanded GPIO state; it does not measure fan rotation or relay
contacts. During relay click tests, leave contact loads disconnected. With all
contact supplies disconnected, a meter can check COM–NO/COM–NC continuity.

This is still a separate bench program. Sensor/display/cloud services are not
running while this sketch is flashed. Pairing/settings storage is not accessed;
restore the main Eggcelerate sketch after bench work.

## Timing and shutdown behavior

- Each relay switches off after ten seconds and has a one-second minimum off
  interval. Repeated On commands do not extend its cutoff.
- Fans stay on until individually switched off, All off, or session shutdown.
- The session ends after two minutes or ten seconds without browser heartbeat.
  Closing/hiding the page requests All off; the heartbeat timeout covers a lost
  connection or an undelivered stop request.
- On requires an armed session. Individual Off remains available while disarmed.
- Boot and access-point failure leave all five outputs off. The firmware sets
  inactive levels before configuring pins as outputs. Reset/startup behavior
  before firmware runs and timing under stalled WebServer calls require physical
  verification; these are software limits, not production load protection.

Only ESP32 core WiFi/WebServer libraries are needed. No automatic environment
control, tray positioning or VPS commands are included in this bench program.

## Page maintenance

After editing `site/index.html`, regenerate the embedded page:

```sh
python3 apps/firmware/relay-bench/embed-page.py
```

For a preview with hardware controls disabled:

```sh
python3 -m http.server 18720 --bind 127.0.0.1 --directory apps/firmware/relay-bench/site
```

Open **http://127.0.0.1:18720/?preview=1**. Actual control uses the ESP32 page.

Related: [relay reference](../hardware/relay-reference.md),
[fan reference](../hardware/fan-reference.md), [pin map](../hardware-pin-map.md),
[roadmap](../../../ROADMAP.md).
