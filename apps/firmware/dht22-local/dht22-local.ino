// Local sensor check: no Wi-Fi, MQTT, VPS, or config.h needed.
// Arduino IDE: install Adafruit DHT sensor library and Adafruit Unified Sensor.
// DHT22 VCC -> 3V3, GND -> GND, DATA -> GPIO4.
// Bare sensors need a 10k pull-up from DATA to 3V3.

#include <DHT.h>
#include <math.h>

constexpr uint8_t kDhtPin = 4;
constexpr uint32_t kReadIntervalMs = 2500;
DHT dht(kDhtPin, DHT22);
uint32_t lastReadMs = 0;
uint32_t successfulReads = 0;
uint32_t failedReads = 0;

void setup() {
  Serial.begin(115200);
  delay(300);
  dht.begin();
  lastReadMs = millis();
  Serial.println("EGGCELERATE local DHT22 check | DATA: GPIO4 | 115200 baud");
  Serial.println("Waiting for the first sensor reading...");
}

void loop() {
  const uint32_t nowMs = millis();
  if (nowMs - lastReadMs < kReadIntervalMs) {
    delay(10);
    return;
  }
  lastReadMs = nowMs;

  const float humidity = dht.readHumidity();
  const float temperature = dht.readTemperature();
  if (!isfinite(humidity) || !isfinite(temperature) ||
      humidity < 0.0f || humidity > 100.0f) {
    ++failedReads;
    Serial.printf("Sensor read failed | OK: %lu | Failed: %lu\n",
                  static_cast<unsigned long>(successfulReads),
                  static_cast<unsigned long>(failedReads));
    Serial.println("Check 3V3, GND, GPIO4, sensor pin labels, and DATA pull-up.");
    return;
  }

  ++successfulReads;
  Serial.printf("Temperature: %.1f C (%.1f F) | Humidity: %.1f %% RH | OK: %lu | Failed: %lu\n",
                temperature, temperature * 1.8f + 32.0f, humidity,
                static_cast<unsigned long>(successfulReads),
                static_cast<unsigned long>(failedReads));
}
