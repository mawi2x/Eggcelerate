# Eggcelerate main firmware

Open **Eggcelerate.ino** in Arduino IDE with every file in this folder beside it.
Target: **NodeMCU-32S**, ESP32 core 3.3.11, upload speed 115200, flash erasure
**disabled**. Libraries: Adafruit DHT sensor library, Adafruit Unified Sensor,
PubSubClient and hd44780 by Bill Perry; WiFi/WebServer/DNSServer are bundled.

## Normal website flow

**Prepare → select mode → Begin Preparation → five minutes of stable readings →
Ready to load eggs notification → enter 1–38 eggs → confirm Start Incubation.**

The website commands the ESP32, which acknowledges after processing and saving
run authorization. Day 1 begins at owner confirmation; climate regulation continues
through the handoff. There is no separate Start Test panel or 60-minute timer.
See the [preparation guide](../../../docs/guide/incubator-preparation-guide.md)
for readiness, power recovery and commissioning limits.

Heater IN1 GPIO27 and mist IN3 GPIO14 are active-low. Upper circulation fan GPIO18
and lower exhaust GPIO19 are active-high. DHT22 is GPIO4. LCD/OLED share SDA21/SCL23.
Tray IN2 GPIO25 remains off; IN4 is vacant and GPIO26 is not driven.

| Mode | Temperature | Humidity |
|---|---|---|
| Chicken | 37.5–37.8°C | 55–60% RH |
| Duck | 37.4–37.6°C | 62–68% RH |
| Quail | 37.5–37.8°C | 55–60% RH |

Modified/custom presets are rejected by the automatic-control API. Normal targets
remain unchanged throughout this implementation; no new lockdown profile is added.
The heater stops at the upper bound, with circulation maintained. High humidity
uses full-speed exhaust pulses (10 seconds on/20 off) once within 0.5°C below the
lower target; overheating runs both fans. Low humidity uses mist bursts of at most
three seconds with twenty seconds rest near temperature targets. PWM is not enabled.

## Stop and recovery

Cancel preparation, Stop Cycle and completion queue an all-equipment Stop.
Explicit Stop turns off heater, mist, both fans and tray until an explicit new
preparation/resume. Sensors, LCD/OLED, Wi-Fi and recording keep operating.

Authorization/phase/mode are saved in a separate checksummed NVS record. Normal
power recovery waits for two fresh valid sensor readings and fan lead before
resuming. Manual Stop, saved faults, corrupt storage and crash/watchdog recovery
prevent automatic heat/mist restart. Fault reset stays stopped; use the website
recovery action after resolving the cause. Ten minutes continuous commanded heat,
sensor invalid/stale readings and >=39°C latch faults. No physical feedback can
detect a welded relay, blocked fan or empty mist reservoir.

Serial 115200/Newline: `status`, `setup`, `climate status`, `climate stop`,
`climate reset`. Start regulation through the existing website preparation flow.
The reported laptop-USB/UPS EN-button problem requires separate diagnosis; this
firmware cannot recover until the board actually boots.

## Wi-Fi setup

- Network: **Eggcelerate-001**
- Password: **egg12345**
- Page: **http://10.10.10.10**
- Pairing code: **EGG01**; device ID: **EGG-001**

Send `setup` to open setup Wi-Fi. Supported clients offer a captive-portal prompt;
otherwise open the HTTP address manually. Canonical-host and CSRF checks protect
credential submission. AP DNS stops with setup; successful connection closes the
AP after two minutes without a page visit/submission. Saved router Wi-Fi and
identity remain in NVS; a verified migration applies the approved setup password.

## Local Docker recording

Open **https://127.0.0.1:18443**. The local broker is configured at
**192.168.1.115:18883** with TLS, per-device credentials and ACLs.
`LocalCloudConfig.h`, when present, overrides the original private `CloudConfig.h`.
These files and upload artifacts contain private configuration: keep them private.
If laptop LAN IP changes, run `python3 apps/firmware/scripts/prepare-local-recorder.py
--host YOUR_LAN_IP`, recreate the broker/worker and recompile/upload.

`./hardware-local-compose.sh` manages the isolated persistent local stack. API and
worker require CLIMATE_CONTROL_ENABLED=true (enabled in the local overlay); normal
farm sessions/CSRF protect controls. Sensor reporting is saved at 5/10/15/30-second
cadence; DHT reads independently every 2.5 seconds and research logging stays five
minutes. The device can regulate while networking is absent, but cannot record to
an unavailable server. This update does not deploy to the VPS.

## Physical acceptance still required

Build success is not physical commissioning. Check real target stability, output
polarity, all-equipment Stop, reliable boot/UPS behavior, recovery and the complete
owner flow. Tray motion, PWM, calibration and hardware feedback are not implemented
here. Earlier bench sketches remain separate fallbacks.
