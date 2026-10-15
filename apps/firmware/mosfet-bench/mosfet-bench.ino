#include <Arduino.h>
#include <WebServer.h>
#include <WiFi.h>
#include <esp_system.h>
#include "BenchConfig.h"
#include "BenchPage.h"

WebServer server(80);
bool outputsReady = false;
bool armed = false;
uint8_t percent[2] = {0, 0};
uint32_t armedAt = 0;
uint32_t heartbeatAt = 0;
String sessionToken;
String message = "Outputs disabled until wiring is confirmed in BenchConfig.h.";

bool applyOutput(uint8_t fan, uint8_t value) {
  if (!outputsReady) return value == 0;
  if (kSupplyPwmConfirmed) {
    if (!ledcWrite(kFanPins[fan], (value * 255U + 50U) / 100U)) return false;
  } else {
    digitalWrite(kFanPins[fan], value ? HIGH : LOW);
  }
  percent[fan] = value;
  return true;
}

void stopAll(const String& reason) {
  armed = false;
  for (uint8_t fan = 0; fan < 2; ++fan) {
    if (outputsReady) {
      if (kSupplyPwmConfirmed) ledcDetach(kFanPins[fan]);
      digitalWrite(kFanPins[fan], LOW);
      pinMode(kFanPins[fan], OUTPUT);
    }
    percent[fan] = 0;
  }
  message = reason;
  Serial.println(reason);
}

void enforceTimeouts() {
  if (!armed) return;
  uint32_t now = millis();
  if (now - armedAt >= kSessionLimitMs) stopAll("Two-minute session ended. Outputs off.");
  else if (now - heartbeatAt >= kHeartbeatTimeoutMs)
    stopAll("Browser heartbeat lost. Outputs off.");
}

void sendState() {
  server.sendHeader("Cache-Control", "no-store");
  uint32_t elapsed = millis() - armedAt;
  uint32_t remaining = armed && elapsed < kSessionLimitMs
    ? (kSessionLimitMs - elapsed) / 1000 : 0;
  String body = "{\"ready\":" + String(outputsReady ? "true" : "false")
    + ",\"armed\":" + String(armed ? "true" : "false")
    + ",\"pwm\":" + String(kSupplyPwmConfirmed ? "true" : "false")
    + ",\"frequency\":" + String(kPwmFrequencyHz)
    + ",\"remaining\":" + String(remaining)
    + ",\"upper\":" + String(percent[0]) + ",\"lower\":" + String(percent[1])
    + ",\"token\":\"" + sessionToken + "\",\"message\":\"" + message + "\"}";
  server.send(200, "application/json", body);
}

bool authorize() {
  // Custom header and boot token prevent cross-origin form submissions.
  // No CORS headers are served. Access is restricted to the protected local AP.
  if (server.header("X-Bench-Token") != sessionToken) {
    server.send(403, "application/json", "{\"error\":\"Reload the test page.\"}");
    return false;
  }
  return true;
}

void reject(int status, const char* text) {
  server.send(status, "application/json", String("{\"error\":\"") + text + "\"}");
}

void setup() {
  Serial.begin(115200);
  // Do not initialize proposed pins until actual hardware is confirmed.
  if (kWiringConfirmed) {
    for (uint8_t fan = 0; fan < 2; ++fan) {
      digitalWrite(kFanPins[fan], LOW);
      pinMode(kFanPins[fan], OUTPUT);
    }
    outputsReady = true;
    message = "Ready. Both GPIO outputs are off.";
  }
  char token[33];
  snprintf(token, sizeof(token), "%08lx%08lx%08lx%08lx",
    (unsigned long)esp_random(), (unsigned long)esp_random(),
    (unsigned long)esp_random(), (unsigned long)esp_random());
  sessionToken = token;
  WiFi.persistent(false);
  WiFi.mode(WIFI_AP);
  if (!WiFi.softAP(kApName, kApPassword, 1, false, 1)) {
    stopAll("Access point failed. Outputs off.");
    return;
  }
  const char* headers[] = {"X-Bench-Token"};
  server.collectHeaders(headers, 1);
  server.on("/", HTTP_GET, []() {
    server.sendHeader("Cache-Control", "no-store");
    server.send_P(200, "text/html; charset=utf-8", kBenchPage);
  });
  server.on("/api/state", HTTP_GET, []() { enforceTimeouts(); sendState(); });
  server.on("/api/arm", HTTP_POST, []() {
    enforceTimeouts();
    if (!authorize()) return;
    if (!outputsReady) { reject(409, "Confirm wiring in BenchConfig.h first."); return; }
    if (armed) { reject(409, "Session already active. Stop before rearming."); return; }
    if (kSupplyPwmConfirmed) {
      for (uint8_t fan = 0; fan < 2; ++fan) {
        if (!ledcAttach(kFanPins[fan], kPwmFrequencyHz, kPwmResolution)
            || !ledcWrite(kFanPins[fan], 0)) {
          stopAll("PWM initialization failed. Outputs off.");
          reject(500, "PWM initialization failed.");
          return;
        }
      }
    }
    armedAt = heartbeatAt = millis();
    armed = true;
    message = "Test session active. Observe the actual fans.";
    sendState();
  });
  server.on("/api/heartbeat", HTTP_POST, []() {
    enforceTimeouts();
    if (!authorize()) return;
    if (armed) heartbeatAt = millis();
    sendState();
  });
  server.on("/api/stop", HTTP_POST, []() {
    if (!authorize()) return;
    stopAll("All off requested. Both GPIO outputs are off.");
    sendState();
  });
  server.on("/api/fan", HTTP_POST, []() {
    enforceTimeouts();
    if (!authorize()) return;
    if (!armed) { reject(409, "Arm a test session first."); return; }
    String channel = server.arg("channel");
    String value = server.arg("percent");
    if ((channel != "upper" && channel != "lower") || value.isEmpty()
        || value.length() > 3) { reject(400, "Invalid fan or percentage."); return; }
    for (size_t i = 0; i < value.length(); ++i) {
      if (value[i] < '0' || value[i] > '9') { reject(400, "Use a whole percentage."); return; }
    }
    int duty = value.toInt();
    if (duty > 100 || (!kSupplyPwmConfirmed && duty != 0 && duty != 100)) {
      reject(400, "Only 0 and 100 are enabled until supply PWM is confirmed."); return;
    }
    if (!applyOutput(channel == "upper" ? 0 : 1, duty)) {
      stopAll("Output write failed. Outputs off.");
      reject(500, "Output write failed."); return;
    }
    sendState();
  });
  server.onNotFound([]() { reject(404, "Unknown endpoint."); });
  server.begin();
  Serial.println("\nEggcelerate local fan bench");
  Serial.println(String("Wi-Fi: ") + kApName);
  Serial.println(String("Password: ") + kApPassword);
  Serial.println(String("Open http://") + WiFi.softAPIP().toString());
  Serial.println(message);
}

void loop() {
  enforceTimeouts();
  server.handleClient();
  enforceTimeouts();
  delay(2);
}
