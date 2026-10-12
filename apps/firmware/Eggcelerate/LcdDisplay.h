#pragma once
// 1602 HD44780 LCD with I2C backpack. Install hd44780 by Bill Perry.
// Shared bus from the user's schematic: SDA GPIO21, SCL GPIO23.
// Confirm safe 3.3V-side I2C wiring before enabling a powered 5V backpack.
#include <Wire.h>
#include <math.h>
#include <string.h>
#include <hd44780.h>
#include <hd44780ioClass/hd44780_I2Cexp.h>

namespace eggcelerate_display {
constexpr int kSda = 21;
constexpr int kScl = 23;
constexpr uint32_t kRefreshMs = 1000;
constexpr uint32_t kFreshSensorMs = 5000;
// Probe common LCD addresses only; never send LCD auto-detection commands to OLED 0x3C/0x3D.
hd44780_I2Cexp lcdCandidates[2] = {hd44780_I2Cexp(0x27), hd44780_I2Cexp(0x3F)};
constexpr uint8_t kLcdAddresses[2] = {0x27, 0x3F};
hd44780_I2Cexp *lcd = nullptr;
bool busReady = false;
bool available = false;
uint32_t refreshedAt = 0;
char previousRows[2][17] = {};

bool writeRow(uint8_t row, const char *text) {
  char padded[17];
  memset(padded, ' ', 16);
  padded[16] = '\0';
  const size_t length = strlen(text);
  memcpy(padded, text, length < 16 ? length : 16);
  if (memcmp(previousRows[row], padded, 16) == 0) return true;
  if (lcd->setCursor(0, row) != 0 ||
      lcd->write(reinterpret_cast<const uint8_t *>(padded), 16) != 16) {
    available = false;
    Serial.println("LCD write failed. Sensor/cloud continue; check display and restart.");
    return false;
  }
  memcpy(previousRows[row], padded, sizeof(padded));
  return true;
}

void begin() {
  // setPins also preserves the explicit pins if the LCD library calls Wire.begin().
  if (!Wire.setPins(kSda, kScl) || !Wire.begin(kSda, kScl, 100000)) {
    Serial.println("LCD I2C initialization failed. Sensor/cloud continue.");
    return;
  }
  Wire.setTimeOut(25);
  busReady = true;
  for (uint8_t i = 0; i < 2; ++i) {
    Wire.beginTransmission(kLcdAddresses[i]);
    if (Wire.endTransmission() != 0) continue;
    const int status = lcdCandidates[i].begin(16, 2);
    if (status == 0) {
      lcd = &lcdCandidates[i];
      Serial.printf("LCD address: 0x%02X\n", kLcdAddresses[i]);
      break;
    }
    Serial.printf("LCD initialization failed at 0x%02X (status %d).\n", kLcdAddresses[i], status);
  }
  if (!lcd) { Serial.println("LCD unavailable at 0x27/0x3F. Sensor/cloud continue."); return; }
  available = true;
  lcd->backlight();
  if (!writeRow(0, "Eggcelerate")) return;
  writeRow(1, "Waiting sensor");
  Serial.println("LCD ready: 16x2 HD44780, SDA21/SCL23.");
}

void service(uint32_t now, bool valid, uint32_t measuredAt,
             float temperature, float humidity) {
  if (!available || now - refreshedAt < kRefreshMs) return;
  refreshedAt = now;
  if (!valid || !isfinite(temperature) || !isfinite(humidity)) {
    if (!writeRow(0, "Sensor not ready")) return;
    writeRow(1, "Check DHT GPIO4");
    return;
  }
  if (now - measuredAt > kFreshSensorMs) {
    if (!writeRow(0, "Sensor stale")) return;
    writeRow(1, "Waiting reading");
    return;
  }
  char text[32];
  snprintf(text, sizeof(text), "Temp: %.1f C", temperature);
  if (!writeRow(0, text)) return;
  snprintf(text, sizeof(text), "Hum:  %.1f %%RH", humidity);
  writeRow(1, text);
}
} // namespace eggcelerate_display
