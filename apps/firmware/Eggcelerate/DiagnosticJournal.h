#pragma once
#include "ControlDiagnostics.h"

// Called ONLY by the existing LittleFS owner (egg-storage). Never formats,
// changes environmental queue metadata, or participates in actuator decisions.
namespace egg_diagnostics {
constexpr size_t kFileLimit = 64 * 1024, kFreeReserve = 64 * 1024;
constexpr char kCurrent[] = "/egg-diagnostics/current.bin";
constexpr char kPrevious[] = "/egg-diagnostics/previous.bin";
File dumpFile;
uint32_t dumpRemaining = 0;
uint8_t dumpPart = 0;
uint32_t lastWriteAt = 0;
void emit(const uint8_t *bytes, size_t size) {
  static const char hex[] = "0123456789abcdef";
  char line[sizeof(Record) * 2 + 7] = "DIAG ";
  for (size_t i = 0; i < size; ++i) {
    line[5 + i * 2] = hex[bytes[i] >> 4]; line[6 + i * 2] = hex[bytes[i] & 15];
  }
  line[5 + size * 2] = 0; Serial.println(line);
}
void emitControl(const Record &r) {
  // Preserve readable commissioning output, but move serial I/O off control task.
  Serial.printf("CONTROL ms=%llu sample=%lu change=%lu mode=%u phase=%u T=%.2f RH=%.2f valid=%u running=%u heater=%u mist=%u upper=%u exhaust_request=%u exhaust_duty=%u reason=%s fault=%u pwm=%u dropped=%lu sensor_hold=%u good=%u consecutive_failures=%lu total_failures=%lu recoveries=%lu last_good_age_ms=%lu last_failure_ms=%lu last_recovery_ms=%lu fault_at_ms=%lu reset_reason=%u\n",
    (unsigned long long)r.monotonicMs, (unsigned long)r.sample, (unsigned long)r.control,
    r.mode, r.phase, r.temperature, r.humidity, unsigned(bool(r.flags & 1)), unsigned(bool(r.flags & 2)),
    unsigned(bool(r.flags & 4)), unsigned(bool(r.flags & 8)), unsigned(bool(r.flags & 16)),
    r.requestedDuty, r.appliedDuty, r.reason, r.fault, unsigned(bool(r.flags & (1U << 11))), (unsigned long)r.dropped, r.sensorHold, r.consecutiveGood, (unsigned long)r.consecutiveFailures,
    (unsigned long)r.failures, (unsigned long)r.recoveries, (unsigned long)r.lastGoodAgeMs,
    (unsigned long)r.lastFailureAt, (unsigned long)r.lastRecoveryAt, (unsigned long)r.faultAt, r.resetReason);
}
void lost(uint32_t count) {
  portENTER_CRITICAL(&mux); dropped += count; ++writeFailures; storageAvailable = false; portEXIT_CRITICAL(&mux);
}
void journalTick(bool filesystemReady, int64_t anchor) {
  const uint32_t now = millis();
  if (!filesystemReady) {
    portENTER_CRITICAL(&mux); storageAvailable = false; portEXIT_CRITICAL(&mux);
    return;
  }
  if (now - lastWriteAt >= 1000) {
    lastWriteAt = now;
    static Record batch[16]; uint8_t count = 0;
    while (events && count < 16 && xQueueReceive(events, &batch[count], 0) == pdTRUE) ++count;
    if (count) {
      bool ok = LittleFS.exists("/egg-diagnostics") || LittleFS.mkdir("/egg-diagnostics");
      File existing = LittleFS.open(kCurrent, FILE_READ);
      const size_t size = existing ? existing.size() : 0;
      struct __attribute__((packed)) { uint32_t magic; uint16_t version, size; } header = {};
      const bool sameVersion = !size || (existing.read(reinterpret_cast<uint8_t *>(&header),sizeof(header)) == sizeof(header) &&
        header.magic == kMagic && header.version == kVersion && header.size == sizeof(Record));
      existing.close();
      // Drop a partial trailing record by rotating rather than appending after it.
      if (ok && (!sameVersion || size % sizeof(Record) || size + count * sizeof(Record) > kFileLimit)) {
        ok = !LittleFS.exists(kPrevious) || LittleFS.remove(kPrevious);
        if (ok && LittleFS.exists(kCurrent)) ok = LittleFS.rename(kCurrent, kPrevious);
        if (ok) { portENTER_CRITICAL(&mux); ++rotations; portEXIT_CRITICAL(&mux); }
      }
      const size_t total = LittleFS.totalBytes(), used = LittleFS.usedBytes();
      ok = ok && used <= total && total - used >= kFreeReserve + count * sizeof(Record);
      File out;
      if (ok) { out = LittleFS.open(kCurrent, FILE_APPEND); ok = bool(out); }
      uint8_t saved = 0;
      for (; ok && saved < count; ++saved) {
        Record &r = batch[saved];
        r.utcMs = anchor ? anchor + int64_t(r.monotonicMs) : 0;
        r.crc = checksum(r);
        if (out.write(reinterpret_cast<const uint8_t *>(&r), sizeof(r)) != sizeof(r)) { ok = false; break; }
      }
      if (out) { out.flush(); out.close(); }
      for (uint8_t i = 0; i < count; ++i) emitControl(batch[i]);
      portENTER_CRITICAL(&mux); written += saved; storageAvailable = ok; portEXIT_CRITICAL(&mux);
      if (!ok) lost(count - saved);
    }
  }
  // Export one record per storage iteration: no bulk serial dump on control task.
  portENTER_CRITICAL(&mux); const bool requested = dumpRequested; dumpRequested = 0; portEXIT_CRITICAL(&mux);
  if (requested) { dumpFile.close(); dumpPart = 1; dumpRemaining = 0; }
  while (dumpPart && !dumpRemaining) {
    dumpFile.close();
    if (dumpPart > 2) { dumpPart = 0; Serial.println("DIAG END"); break; }
    dumpFile = LittleFS.open(dumpPart++ == 1 ? kPrevious : kCurrent, FILE_READ);
    dumpRemaining = dumpFile ? dumpFile.size() : 0;
  }
  if (dumpRemaining) {
    Record r = {};
    auto *bytes = reinterpret_cast<uint8_t *>(&r);
    const bool header = dumpRemaining >= 8 && dumpFile.read(bytes,8) == 8;
    const bool supported = header && r.magic == kMagic &&
      ((r.version == 1 && r.size == 112) || (r.version == 2 && r.size == 156) || (r.version == kVersion && r.size == sizeof(Record)));
    if (!supported || r.size > dumpRemaining) {
      dumpRemaining = 0; Serial.println("DIAG CORRUPT");
    } else {
      const size_t size = r.size;
      const bool read = dumpFile.read(bytes+8,size-8) == size-8;
      dumpRemaining -= size;
      uint32_t crc = 0; memcpy(&crc,bytes+size-4,4);
      if (!read) { dumpRemaining = 0; Serial.println("DIAG READ_ERROR"); }
      else if (crc == checksumBytes(bytes,size-4)) emit(bytes,size);
      else Serial.println("DIAG CORRUPT");
    }
  }
}
} // namespace egg_diagnostics
