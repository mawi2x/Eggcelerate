# Later LCD/OLED temperature display integration

Current scope: ESP32 DHT22 → server → Eggcelerate dashboard. Physical LCD/OLED
temperature output is deferred. Serial and the setup portal remain diagnostics.

## Add to the main firmware later

1. Confirm each display's model, driver, supply voltage, interface, address, and
   wiring before selecting libraries or assigning pins. DATA for the DHT remains
   GPIO4; check display pins against the full incubator wiring.
2. Initialize displays once in `setup()` in `EggcelerateFirmware.h`. A missing
   display must not stop sensor sampling, Wi-Fi setup, or cloud uploads.
3. Add a timed `serviceDisplays(uint32_t now)` function at the marked point in
   `loop()`. Refresh only when needed; avoid delays or repeatedly clearing the
   screen. Read the existing `temperatureC`, `humidityPct`, `sensorValid`, and
   `sensorAt` values produced by `serviceSensor()` rather than querying the DHT
   separately for each display.
4. Show temperature and humidity with units. If the latest read failed or is
   older than the agreed freshness limit, show “Sensor unavailable” or “Stale”
   instead of presenting the previous value as current. Local sensor readings
   should remain visible during an internet outage.
5. Keep local sensor health separate from server delivery. Use `cloudStatus()`
   for connectivity/receipt status; “MQTT connected” alone does not confirm that
   a reading was stored by the server.
6. Agree on the physical display's unit preference. Telemetry remains Celsius;
   Fahrenheit is a presentation conversion. The dashboard preference does not
   currently synchronize to firmware.

Later hardware acceptance: compare both displays with Serial and dashboard,
disconnect the sensor, remove Wi-Fi, reboot, and check that display refresh does
not interfere with sensor timing or telemetry. These checks remain pending.
