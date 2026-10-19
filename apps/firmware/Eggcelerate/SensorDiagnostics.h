#pragma once
#include <stdio.h>
#include "ClimateControl.h"
namespace egg_diagnostics {
// Pure formatting: no hardware, storage, network or controller side effects.
inline bool sensorJson(const egg_climate::State &s, uint32_t now, char *out, size_t capacity) {
  char age[16]="null", temperature[24]="null", humidity[24]="null";
  if (s.successes) {
    snprintf(age,sizeof(age),"%lu",(unsigned long)(now-s.lastGoodAt));
    snprintf(temperature,sizeof(temperature),"%.2f",s.lastGoodTemperature);
    snprintf(humidity,sizeof(humidity),"%.2f",s.lastGoodHumidity);
  }
  const auto &h=s.sensor;
  const int n=snprintf(out,capacity,
    "{\"successes\":%lu,\"failures\":%lu,\"consecutive_failures\":%lu,\"consecutive_good\":%u,\"recovery_hold\":%s,"
    "\"recoveries\":%lu,\"last_good_age_ms\":%s,\"last_good_temperature_c\":%s,\"last_good_humidity_pct\":%s,"
    "\"last_failure_ms\":%lu,\"last_recovery_ms\":%lu,\"fault_at_ms\":%lu,\"reset_reason\":%u}",
    (unsigned long)s.successes,(unsigned long)s.failures,(unsigned long)h.consecutiveFailures,s.consecutiveGood,
    h.recovering?"true":"false",(unsigned long)h.recoveries,age,temperature,humidity,
    (unsigned long)h.lastFailureAt,(unsigned long)h.lastRecoveryAt,(unsigned long)h.faultAt,h.resetReason);
  return n>0&&size_t(n)<capacity;
}
} // namespace egg_diagnostics
