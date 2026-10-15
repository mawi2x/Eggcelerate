#include <Arduino.h>
#include <WebServer.h>
#include <WiFi.h>
#include <esp_system.h>
#include "MotorTimer.h"
#include "MotorPage.h"

// Confirmed wiring: tray IN2 GPIO25, active LOW. Other loads remain OFF.
constexpr uint8_t kTrayPin = 25;
WebServer server(80);
SemaphoreHandle_t motorMutex;
MotorTimer motor;
String token;
String seenIds[32];
uint8_t seenCount = 0;
bool controllerReady = false;

void applyOutput() { digitalWrite(kTrayPin, motor.running ? LOW : HIGH); }

// High-priority task owns timeout enforcement even if HTTP handling stalls.
void controlTask(void*) {
  for (;;) {
    xSemaphoreTake(motorMutex, portMAX_DELAY);
    motor.tick(millis());
    applyOutput();
    xSemaphoreGive(motorMutex);
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

void error(int code, const char* message) {
  server.send(code, "application/json", String("{\"error\":\"") + message + "\"}");
}
bool authorize() {
  if (controllerReady && server.header("X-Motor-Token") == token) return true;
  error(403, "Reload the motor page; controller must be ready.");
  return false;
}
void sendState() {
  MotorTimer snapshot;
  xSemaphoreTake(motorMutex, portMAX_DELAY);
  snapshot = motor;
  xSemaphoreGive(motorMutex);
  uint32_t elapsed = snapshot.running ? uint32_t(millis() - snapshot.started) : snapshot.elapsed;
  uint32_t remaining = snapshot.running && elapsed < snapshot.duration ? snapshot.duration - elapsed : 0;
  const char* reasons[] = {"Ready", "Timed run active", "Timer ended", "Stop requested", "Browser connection lost"};
  String body = "{\"ready\":" + String(controllerReady ? "true" : "false")
    + ",\"running\":" + String(snapshot.running ? "true" : "false")
    + ",\"elapsed_ms\":" + String(elapsed)
    + ",\"remaining_ms\":" + String(remaining)
    + ",\"reason\":\"" + reasons[snapshot.reason]
    + "\",\"token\":\"" + token + "\",\"max_seconds\":120}";
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", body);
}

void setup() {
  // Set output latches before enabling pins. Never touch pairing/Wi-Fi NVS.
  for (uint8_t pin : {uint8_t(27), uint8_t(25), uint8_t(14)}) {
    digitalWrite(pin, HIGH); pinMode(pin, OUTPUT);
  }
  for (uint8_t pin : {uint8_t(18), uint8_t(19)}) {
    digitalWrite(pin, LOW); pinMode(pin, OUTPUT);
  }
  Serial.begin(115200);
  motorMutex = xSemaphoreCreateMutex();
  if (!motorMutex) { Serial.println("Mutex unavailable. Motor stays OFF."); return; }
  controllerReady = xTaskCreate(controlTask, "motor-cutoff", 3072, nullptr, 3, nullptr) == pdPASS;
  if (!controllerReady) { Serial.println("Control task unavailable. Motor stays OFF."); return; }
  char randomToken[33];
  snprintf(randomToken, sizeof(randomToken), "%08lx%08lx%08lx%08lx",
    (unsigned long)esp_random(), (unsigned long)esp_random(),
    (unsigned long)esp_random(), (unsigned long)esp_random());
  token = randomToken;
  WiFi.persistent(false);
  WiFi.mode(WIFI_AP);
  if (!WiFi.softAP("Eggcelerate-Motor-Test", "mango123", 1, false, 1)) {
    Serial.println("AP unavailable. Motor stays OFF."); return;
  }
  const char* headers[] = {"X-Motor-Token"};
  server.collectHeaders(headers, 1);
  server.on("/", HTTP_GET, []() {
    server.sendHeader("Cache-Control", "no-store");
    server.send_P(200, "text/html; charset=utf-8", kMotorPage);
  });
  server.on("/api/state", HTTP_GET, sendState);
  server.on("/api/start", HTTP_POST, []() {
    if (!authorize()) return;
    String seconds = server.arg("seconds"), id = server.arg("id");
    const String movement = server.arg("movement");
    if (movement != "" && movement != "custom" && movement != "opposite" && movement != "level") {
      error(400, "Unknown movement."); return;
    }
    if (movement == "opposite" || movement == "level") {
      if (server.arg("from_plus") != "1") {
        error(400, "Visually confirm the tray is at +45 degrees before this movement."); return;
      }
      seconds = movement == "opposite" ? "10" : "5";
    }
    if (!seconds.length() || seconds.length() > 3 || id.length() != 32) {
      error(400, "Use whole seconds from 1 to 120 and a fresh run ID."); return;
    }
    for (char c : seconds) if (c < '0' || c > '9') { error(400, "Seconds must be a whole number."); return; }
    for (char c : id) if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) {
      error(400, "Invalid run ID."); return;
    }
    for (uint8_t i = 0; i < seenCount; ++i) if (seenIds[i] == id) { sendState(); return; }
    if (seenCount == 32) { error(409, "32-run bench limit reached. Reboot for another session."); return; }
    xSemaphoreTake(motorMutex, portMAX_DELAY);
    bool accepted = motor.start(millis(), seconds.toInt());
    if (accepted) applyOutput();
    xSemaphoreGive(motorMutex);
    if (!accepted) { error(409, "Use 1-120 seconds; stop first and allow one second between runs."); return; }
    seenIds[seenCount++] = id;
    sendState();
  });
  server.on("/api/heartbeat", HTTP_POST, []() {
    if (!authorize()) return;
    xSemaphoreTake(motorMutex, portMAX_DELAY);
    motor.tick(millis()); // A late heartbeat cannot revive an expired run.
    if (motor.running) motor.heartbeat = millis();
    applyOutput();
    xSemaphoreGive(motorMutex);
    sendState();
  });
  server.on("/api/stop", HTTP_POST, []() {
    if (!authorize()) return;
    xSemaphoreTake(motorMutex, portMAX_DELAY);
    motor.stop(millis(), MotorTimer::ManualStop);
    applyOutput();
    xSemaphoreGive(motorMutex);
    sendState();
  });
  server.onNotFound([]() { error(404, "Unknown motor endpoint."); });
  server.begin();
  Serial.println("Motor-only bench: IN2 GPIO25. Other equipment OFF.");
  Serial.println("Join Eggcelerate-Motor-Test / mango123; open http://192.168.4.1");
}

void loop() { server.handleClient(); delay(2); }
