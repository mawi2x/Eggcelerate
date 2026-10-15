#include <Arduino.h>
#include <WebServer.h>
#include <WiFi.h>
#include <esp_system.h>
#include "BenchConfig.h"
#include "BenchPage.h"

WebServer server(80);
bool outputsReady = false;
bool armed = false;
bool relayOn[3] = {false, false, false};
bool fanOn[2] = {false, false};
uint32_t lastOff[3] = {0, 0, 0};
uint32_t onAt[3] = {0, 0, 0};
uint32_t armedAt = 0;
uint32_t heartbeatAt = 0;
String sessionToken;
String message = "Confirm output wiring and relay polarity in BenchConfig.h.";

void setRelay(uint8_t channel, bool on) {
  if (!outputsReady) return;
  digitalWrite(kRelayPins[channel], on ? kRelayActiveLevel :
               (kRelayActiveLevel == LOW ? HIGH : LOW));
  if (relayOn[channel] && !on) lastOff[channel] = millis();
  relayOn[channel] = on;
}

void setFan(uint8_t channel, bool on) {
  if (!outputsReady) return;
  digitalWrite(kFanPins[channel], on ? HIGH : LOW);
  fanOn[channel] = on;
}

void stopAll(const String& reason) {
  for (uint8_t channel = 0; channel < 3; ++channel) setRelay(channel, false);
  for (uint8_t channel = 0; channel < 2; ++channel) setFan(channel, false);
  armed = false;
  message = reason;
  Serial.println(reason);
}

void enforceTimeouts() {
  uint32_t now = millis();
  for (uint8_t channel = 0; channel < 3; ++channel) {
    if (relayOn[channel] && now - onAt[channel] >= kChannelOnLimitMs) {
      setRelay(channel, false);
      message = "A relay reached its ten-second limit and switched off.";
    }
  }
  if (!armed) return;
  if (now - armedAt >= kSessionLimitMs) stopAll("Test session ended. Outputs inactive.");
  else if (now - heartbeatAt >= kHeartbeatTimeoutMs)
    stopAll("Browser heartbeat lost. Outputs inactive.");
}

void reject(int code, const char* error) {
  server.send(code, "application/json", String("{\"error\":\"") + error + "\"}");
}

bool authorize() {
  if (server.header("X-Bench-Token") == sessionToken) return true;
  reject(403, "Reload the combined test page.");
  return false;
}

void sendState() {
  uint32_t elapsed = millis() - armedAt;
  uint32_t remaining = armed && elapsed < kSessionLimitMs
    ? (kSessionLimitMs - elapsed) / 1000 : 0;
  String body = "{\"ready\":" + String(outputsReady ? "true" : "false")
    + ",\"armed\":" + String(armed ? "true" : "false")
    + ",\"remaining\":" + String(remaining)
    + ",\"heater\":" + String(relayOn[0] ? "true" : "false")
    + ",\"tray\":" + String(relayOn[1] ? "true" : "false")
    + ",\"mist\":" + String(relayOn[2] ? "true" : "false")
    + ",\"upper\":" + String(fanOn[0] ? "true" : "false")
    + ",\"lower\":" + String(fanOn[1] ? "true" : "false")
    + ",\"token\":\"" + sessionToken + "\",\"message\":\"" + message + "\"}";
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", body);
}

void setup() {
  Serial.begin(115200);
  // Initialize the confirmed active-HIGH MOSFETs off before starting Wi-Fi.
  for (uint8_t pin : kFanPins) { digitalWrite(pin, LOW); pinMode(pin, OUTPUT); }
  if (kWiringAndInterfaceConfirmed && kRelayActiveLevel != -1) {
    int inactive = kRelayActiveLevel == LOW ? HIGH : LOW;
    for (uint8_t channel = 0; channel < 3; ++channel) {
      digitalWrite(kRelayPins[channel], inactive);
      pinMode(kRelayPins[channel], OUTPUT);
      lastOff[channel] = millis();
    }
    outputsReady = true;
    message = "Ready. Relays and fan MOSFETs are off. Arm to test.";
  }
  char token[33];
  snprintf(token, sizeof(token), "%08lx%08lx%08lx%08lx",
    (unsigned long)esp_random(), (unsigned long)esp_random(),
    (unsigned long)esp_random(), (unsigned long)esp_random());
  sessionToken = token;
  WiFi.persistent(false);
  WiFi.mode(WIFI_AP);
  if (!WiFi.softAP(kApName, kApPassword, 1, false, 1)) {
    stopAll("Access point failed. Outputs inactive."); return;
  }
  const char* headers[] = {"X-Bench-Token"};
  server.collectHeaders(headers, 1);
  server.on("/", HTTP_GET, []() {
    server.sendHeader("Cache-Control", "no-store");
    server.send_P(200, "text/html; charset=utf-8", kBenchPage);
  });
  server.on("/api/state", HTTP_GET, []() { enforceTimeouts(); sendState(); });
  server.on("/api/arm", HTTP_POST, []() {
    enforceTimeouts(); if (!authorize()) return;
    if (!outputsReady) { reject(409, "Confirm wiring and relay polarity first."); return; }
    if (armed) { reject(409, "Already armed. Stop before rearming."); return; }
    armedAt = heartbeatAt = millis();
    armed = true;
    message = "Armed. Relays have a ten-second cutoff; fans stop at session end.";
    sendState();
  });
  server.on("/api/heartbeat", HTTP_POST, []() {
    enforceTimeouts(); if (!authorize()) return;
    if (armed) heartbeatAt = millis();
    sendState();
  });
  server.on("/api/stop", HTTP_POST, []() {
    if (!authorize()) return;
    stopAll("All off requested. Outputs inactive."); sendState();
  });
  server.on("/api/relay", HTTP_POST, []() {
    enforceTimeouts(); if (!authorize()) return;
    if (!outputsReady) { reject(409, "Confirm wiring and polarity first."); return; }
    String name = server.arg("channel");
    int channel = name == "heater" ? 0 : name == "tray" ? 1 : name == "mist" ? 2 : -1;
    if (channel < 0) { reject(400, "Unknown or reserved relay channel."); return; }
    String value = server.arg("on");
    if (value != "0" && value != "1") { reject(400, "Use on=0 or on=1."); return; }
    bool on = value == "1";
    if (on && !armed) { reject(409, "Arm the test first."); return; }
    // Repeated ON is idempotent and cannot extend the maximum on time.
    if (on && relayOn[channel]) { sendState(); return; }
    if (on && millis() - lastOff[channel] < kMinimumOffMs) {
      reject(409, "Wait one second before repeating this relay."); return;
    }
    if (on) onAt[channel] = millis();
    setRelay(channel, on);
    message = on ? "Relay ON applied. Automatic cutoff in ten seconds."
                 : "Relay OFF applied. Observe the physical contacts.";
    sendState();
  });
  server.on("/api/fan", HTTP_POST, []() {
    enforceTimeouts(); if (!authorize()) return;
    if (!outputsReady) { reject(409, "Confirm wiring and polarity first."); return; }
    String name = server.arg("channel");
    int channel = name == "upper" ? 0 : name == "lower" ? 1 : -1;
    if (channel < 0) { reject(400, "Use upper or lower fan."); return; }
    String value = server.arg("on");
    if (value != "0" && value != "1") { reject(400, "Use on=0 or on=1."); return; }
    bool on = value == "1";
    if (on && !armed) { reject(409, "Arm the test first."); return; }
    setFan(channel, on);
    message = on ? "Fan full ON applied. Observe the physical fan."
                 : "Fan OFF applied. Observe the physical fan.";
    sendState();
  });
  server.onNotFound([]() { reject(404, "Unknown endpoint."); });
  server.begin();
  Serial.println("\nEggcelerate combined relay and fan bench");
  Serial.println("IN1 heater: GPIO27; IN2 tray: GPIO25; IN3 mist: GPIO14; IN4 unused.");
  Serial.println("Upper fan: GPIO18; lower fan: GPIO19; HIGH-on/LOW-off; PWM disabled.");
  Serial.println(String("Wi-Fi: ") + kApName);
  Serial.println(String("Password: ") + kApPassword);
  Serial.println(String("Open http://") + WiFi.softAPIP().toString());
  Serial.println(message);
}

void loop() {
  enforceTimeouts(); server.handleClient(); enforceTimeouts(); delay(2);
}
