#pragma once
#include <stdio.h>
#include "ClimateControl.h"
namespace egg_diagnostics {
inline bool adaptiveJson(const egg_climate::AdaptiveDiagnostics &d, char *out, size_t capacity) {
  char numbers[16][24];
  const float values[]={d.moisture,d.moistureRate,d.humidityForecast,d.heatForecast,d.coolingForecast,d.powerForecast,
    d.thermalTarget,d.heatingPower,d.heatIntegral,d.heatFeedForward,d.dryEffort,d.dryBaseline,d.reviewDelta,d.dutySeconds,d.lastReviewBaseline,d.lastReviewDutySeconds};
  for(unsigned i=0;i<16;++i) {
    if (isfinite(values[i])) snprintf(numbers[i],sizeof(numbers[i]),"%.4f",values[i]);
    else snprintf(numbers[i],sizeof(numbers[i]),"null");
  }
  const int n=snprintf(out,capacity,
    "{\"equivalent_rh\":%s,\"moisture_rate_pct_min\":%s,\"humidity_forecast\":%s,\"heat_forecast_c\":%s,\"cooling_forecast_c\":%s,\"power_forecast_c\":%s,"
    "\"thermal_target_c\":%s,\"heating_power\":%s,\"heat_integral\":%s,\"heat_feed_forward\":%s,\"dry_effort\":%s,\"dry_baseline\":%s,\"review_delta\":%s,\"duty_seconds\":%s,"
    "\"last_review_baseline\":%s,\"last_review_duty_seconds\":%s,\"last_review_eligible_ms\":%lu,\"last_review_exhaust_ms\":%lu,\"stable_ms\":%lu,\"review_elapsed_ms\":%lu,\"eligible_ms\":%lu,\"exhaust_ms\":%lu,\"review_count\":%lu,"
    "\"dry_held\":%s,\"may_dry\":%s,\"dry_limited\":%s,\"thermal_ceiling\":%u,\"review_result\":%u,\"boost_active\":%s,\"heat_window_second\":%u,\"test_duty\":%u}",
    numbers[0],numbers[1],numbers[2],numbers[3],numbers[4],numbers[5],numbers[6],numbers[7],numbers[8],numbers[9],numbers[10],numbers[11],numbers[12],numbers[13],numbers[14],numbers[15],
    (unsigned long)d.lastReviewEligibleMs,(unsigned long)d.lastReviewExhaustMs,
    (unsigned long)d.stableMs,(unsigned long)d.reviewElapsedMs,(unsigned long)d.eligibleMs,(unsigned long)d.exhaustMs,(unsigned long)d.reviewCount,
    d.dryHeld?"true":"false",d.mayDry?"true":"false",d.dryLimited?"true":"false",d.thermalCeiling,d.reviewResult,d.boostActive?"true":"false",d.heatWindowPosition,d.testDuty);
  return n>0&&size_t(n)<capacity;
}
}
