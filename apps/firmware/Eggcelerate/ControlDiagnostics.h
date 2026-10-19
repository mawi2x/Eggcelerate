#pragma once
#ifdef EGG_DIAGNOSTICS_HOST_TEST
#include "../tests/DiagnosticsHost.h"
#else
#include <Arduino.h>
#include <esp_timer.h>
#include <esp_random.h>
#endif
#include "ClimateControl.h"
#include "SensorDiagnostics.h"
#include "AdaptiveDiagnostics.h"

// Control task is producer only. LittleFS and serial I/O belong to storage task.
namespace egg_diagnostics {
constexpr uint32_t kMagic = 0x45474431;
constexpr uint16_t kVersion = 3;
constexpr uint8_t kQueueLength = 32;
struct __attribute__((packed)) Record {
  uint32_t magic;
  uint16_t version, size;
  uint64_t session, monotonicMs, sampleMonotonicMs;
  int64_t utcMs;
  uint32_t sequence, sample, control, sampleAgeMs;
  float temperature, humidity, temperatureRate, humidityRate;
  uint32_t heaterElapsedMs, mistElapsedMs, ventElapsedMs, dropped;
  uint16_t flags;
  uint8_t mode, phase, fault, requestedDuty, appliedDuty, cause;
  char reason[12];
  uint32_t lastGoodAgeMs, successes, failures, consecutiveFailures, recoveries;
  uint32_t lastFailureAt, lastRecoveryAt, faultAt;
  float lastGoodTemperature, lastGoodHumidity;
  uint8_t sensorHold, consecutiveGood, resetReason, reserved;
  egg_climate::AdaptiveDiagnostics adaptive;
  uint32_t crc;
};
static_assert(sizeof(Record) == 256, "Version 3 decoder requires the 256-byte layout");
QueueHandle_t events = nullptr;
portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;
uint64_t session = 0;
uint32_t sequence = 0, dropped = 0, written = 0, writeFailures = 0, rotations = 0;
bool storageAvailable = false;
uint8_t dumpRequested = 0;

uint32_t checksumBytes(const uint8_t *p, size_t length) {
  uint32_t crc = ~0U;
  for (size_t i = 0; i < length; ++i) {
    crc ^= p[i];
    for (uint8_t b = 0; b < 8; ++b) crc = (crc >> 1) ^ (0xedb88320U & (0U - (crc & 1)));
  }
  return ~crc;
}
uint32_t checksum(const Record &r) { return checksumBytes(reinterpret_cast<const uint8_t *>(&r), offsetof(Record, crc)); }
void begin() {
  esp_fill_random(&session, sizeof(session));
  events = xQueueCreate(kQueueLength, sizeof(Record));
}
uint16_t flags(const egg_climate::State &s) {
  const auto &d = s.diagnostics;
  return uint16_t(s.valid) | (uint16_t(s.running) << 1) | (uint16_t(s.out.heater) << 2) |
    (uint16_t(s.out.mist) << 3) | (uint16_t(s.out.upper) << 4) | (uint16_t(s.out.exhaust) << 5) |
    (uint16_t(d.heatDemand) << 6) | (uint16_t(d.dryDemand) << 7) | (uint16_t(d.mistDemand) << 8) |
    (uint16_t(d.temperatureCooling) << 9) | (uint16_t(d.ventOn) << 10) | (uint16_t(s.pwmReady) << 11) |
    (uint16_t(s.halted) << 12) | (uint16_t(s.cooldown) << 13) | (uint16_t(s.resuming) << 14) |
    (uint16_t(d.trendValid) << 15);
}
void capture(const egg_climate::State &s) {
  static bool first = true;
  static uint32_t lastSample = 0, lastControl = 0;
  static uint16_t lastFlags = 0;
  static uint8_t lastFault = 0, lastMode = 0, lastPhase = 0;
  static char lastReason[12] = {};
  const uint16_t bits = flags(s);
  const uint8_t cause = (first ? 1 : 0) | (s.sampleNumber != lastSample ? 2 : 0) |
    (s.controlSequence != lastControl ? 4 : 0) |
    (bits != lastFlags || uint8_t(s.fault) != lastFault || s.mode != lastMode || s.phase != lastPhase ||
     strcmp(s.exhaustReason, lastReason) ? 8 : 0);
  if (!cause) return;
  first = false; lastSample = s.sampleNumber; lastControl = s.controlSequence;
  lastFlags = bits; lastFault = uint8_t(s.fault); lastMode = s.mode; lastPhase = s.phase;
  strlcpy(lastReason, s.exhaustReason, sizeof(lastReason));
  Record r = {};
  r.magic = kMagic; r.version = kVersion; r.size = sizeof(r); r.session = session;
  r.monotonicMs = uint64_t(esp_timer_get_time() / 1000);
  r.sampleAgeMs = uint32_t(r.monotonicMs) - s.sampledAt;
  r.sampleMonotonicMs = r.sampleAgeMs <= r.monotonicMs ? r.monotonicMs - r.sampleAgeMs : 0;
  r.lastGoodAgeMs = s.successes ? uint32_t(r.monotonicMs) - s.lastGoodAt : UINT32_MAX;
  r.lastGoodTemperature = s.lastGoodTemperature; r.lastGoodHumidity = s.lastGoodHumidity;
  r.successes = s.successes; r.failures = s.failures;
  r.consecutiveFailures = s.sensor.consecutiveFailures; r.recoveries = s.sensor.recoveries;
  r.lastFailureAt = s.sensor.lastFailureAt; r.lastRecoveryAt = s.sensor.lastRecoveryAt; r.faultAt = s.sensor.faultAt;
  r.sensorHold = s.sensor.recovering; r.consecutiveGood = s.consecutiveGood; r.resetReason = s.sensor.resetReason;
  r.adaptive = s.diagnostics.adaptive;
  r.sequence = ++sequence; r.sample = s.sampleNumber; r.control = s.controlSequence;
  r.temperature = s.temperature; r.humidity = s.humidity;
  const auto &d = s.diagnostics;
  r.temperatureRate = d.temperatureRate; r.humidityRate = d.humidityRate;
  r.heaterElapsedMs = d.heaterElapsedMs; r.mistElapsedMs = d.mistElapsedMs; r.ventElapsedMs = d.ventElapsedMs;
  r.flags = bits; r.mode = s.mode; r.phase = s.phase; r.fault = uint8_t(s.fault);
  r.requestedDuty = s.out.exhaustRequestedDuty; r.appliedDuty = s.out.exhaustDuty; r.cause = cause;
  strlcpy(r.reason, s.exhaustReason, sizeof(r.reason));
  portENTER_CRITICAL(&mux); r.dropped = dropped; portEXIT_CRITICAL(&mux);
  // Zero wait: storage stalls or missing storage cannot delay regulation.
  if (!events || xQueueSend(events, &r, 0) != pdTRUE) {
    portENTER_CRITICAL(&mux); ++dropped; portEXIT_CRITICAL(&mux);
  }
}
void statusJson(char *out, size_t capacity) {
  portENTER_CRITICAL(&mux);
  const uint32_t lost = dropped, saved = written, failures = writeFailures, rolls = rotations;
  const bool available = storageAvailable;
  portEXIT_CRITICAL(&mux);
  snprintf(out, capacity, "{\"version\":3,\"available\":%s,\"written\":%lu,\"dropped\":%lu,\"write_failures\":%lu,\"rotations\":%lu}",
    available ? "true" : "false", (unsigned long)saved, (unsigned long)lost,
    (unsigned long)failures, (unsigned long)rolls);
}
bool reportJson(const egg_climate::State &s, char *out, size_t capacity) {
  char status[192], temperatureRate[32], humidityRate[32];
  static char adaptive[1800];
  if (!adaptiveJson(s.diagnostics.adaptive,adaptive,sizeof(adaptive))) return false;
  static char sensor[640]; // Network task only; keep enlarged JSON off loopTask stack.
  if (!sensorJson(s, s.diagnostics.evaluatedAt, sensor, sizeof(sensor))) return false;
  statusJson(status, sizeof(status));
  const auto &d = s.diagnostics;
  if (d.trendValid) {
    snprintf(temperatureRate, sizeof(temperatureRate), "%.4f", d.temperatureRate);
    snprintf(humidityRate, sizeof(humidityRate), "%.4f", d.humidityRate);
  } else {
    strlcpy(temperatureRate, "null", sizeof(temperatureRate)); strlcpy(humidityRate, "null", sizeof(humidityRate));
  }
  const int length = snprintf(out, capacity,
    "{\"version\":1,\"sample\":%lu,\"evaluated_ms\":%lu,\"temperature_rate_c_min\":%s,\"humidity_rate_pct_min\":%s,"
    "\"heat_demand\":%s,\"dry_demand\":%s,\"mist_demand\":%s,\"temperature_cooling\":%s,\"vent_on\":%s,"
    "\"heater_elapsed_ms\":%lu,\"mist_elapsed_ms\":%lu,\"vent_elapsed_ms\":%lu,\"journal\":%s,\"sensor\":%s,\"adaptive\":%s}",
    (unsigned long)s.sampleNumber, (unsigned long)d.evaluatedAt, temperatureRate, humidityRate,
    d.heatDemand ? "true" : "false", d.dryDemand ? "true" : "false", d.mistDemand ? "true" : "false",
    d.temperatureCooling ? "true" : "false", d.ventOn ? "true" : "false",
    (unsigned long)d.heaterElapsedMs, (unsigned long)d.mistElapsedMs, (unsigned long)d.ventElapsedMs, status, sensor, adaptive);
  return length > 0 && size_t(length) < capacity;
}
bool serialCommand(const String &command) {
  if (command == "diagnostics status") {
    char status[192]; statusJson(status, sizeof(status)); Serial.println(status); return true;
  }
  if (command == "diagnostics dump") {
    portENTER_CRITICAL(&mux); dumpRequested = 1; portEXIT_CRITICAL(&mux);
    Serial.println("Diagnostic dump requested; DIAG lines contain CRC-protected records."); return true;
  }
  return false;
}
} // namespace egg_diagnostics
