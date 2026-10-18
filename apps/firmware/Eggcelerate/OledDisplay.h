#pragma once
// Provisional SSD1306 driver for the user's 0.96-inch 128x64 I2C OLED.
// The purchase title does not establish its controller; confirm on hardware.
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

namespace eggcelerate_oled {
Adafruit_SSD1306 display(128, 64, &Wire, -1, 100000, 100000);
bool available = false;
uint8_t address = 0;
uint32_t refreshedAt = 0;
char previousFrame[100] = {};

void printLeftAlignedLabel(const char *text, int16_t y) {
  display.setTextSize(1);
  display.setCursor(0, y);
  display.print(text);
}

bool responds(uint8_t at) {
  Wire.beginTransmission(at);
  return Wire.endTransmission() == 0;
}

void begin() {
  if (!eggcelerate_display::busReady) return;
  const bool at3c = responds(0x3C);
  const bool at3d = responds(0x3D);
  if (at3c && at3d) {
    Serial.println("OLED ambiguous: both 0x3C and 0x3D respond. Confirm device addresses.");
    return;
  }
  address = at3c ? 0x3C : at3d ? 0x3D : 0;
  if (!address) { Serial.println("OLED unavailable at 0x3C/0x3D. Sensor/cloud continue."); return; }
  // Reuse the configured SDA21/SCL23 bus; never call Wire.begin with defaults.
  if (!display.begin(SSD1306_SWITCHCAPVCC, address, false, false)) {
    Serial.println("OLED allocation/init failed. Sensor/cloud continue.");
    return;
  }
  available = true;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextWrap(false);
  Serial.printf("OLED SSD1306 driver initialized at 0x%02X; confirm visible output.\n", address);
}

void service(uint32_t now, bool setupOpen, bool online, bool commissioned,
             const char *pairingCode, uint32_t queued=0, bool recordingReady=false) {
  if (!available || now - refreshedAt < 1000) return;
  refreshedAt = now;
  char code[18];
  if (commissioned && strlen(pairingCode) == 5)
    snprintf(code, sizeof(code), "%s", pairingCode);
  else if (commissioned && strlen(pairingCode) == 10)
    snprintf(code, sizeof(code), "%.5s-%.5s", pairingCode, pairingCode + 5);
  else snprintf(code, sizeof(code), "Not commissioned");
  char frame[100];
  snprintf(frame, sizeof(frame), "%d:%d:%s:%lu:%d", setupOpen, online, code, (unsigned long)queued, recordingReady);
  if (strcmp(frame, previousFrame) == 0) return;
  if (!responds(address)) {
    available = false;
    Serial.println("OLED disconnected. Sensor/cloud continue; restart after reconnecting.");
    return;
  }
  display.clearDisplay();
  printLeftAlignedLabel(setupOpen ? "SETUP" : "EGGCELERATE", 0);
  display.setCursor(86,0);
  if(recordingReady)display.printf("Q:%lu",(unsigned long)queued);
  else display.print("REC OFF");
  display.setTextSize(2);
  display.setCursor(0, 12);
  display.print(online ? "ONLINE" : "OFFLINE");
  printLeftAlignedLabel("PAIRING CODE", 28);
  const bool shortCode = commissioned && strlen(pairingCode) == 5;
  // Five characters at size 3 occupy 90x24 pixels and fit on the final row.
  display.setTextSize(shortCode ? 3 : 1);
  display.setCursor(0, shortCode ? 40 : 50);
  display.print(code);
  display.display();
  memcpy(previousFrame, frame, strlen(frame) + 1);
}
} // namespace eggcelerate_oled
