#pragma once
#include <stdint.h>

namespace egg_climate {
// Provisional Chicken tuning. Not learned/calibrated physical parameters.
constexpr float kTrendTimeMs = 30000.0f;
constexpr float kTemperatureTrendTimeMs = 5000.0f;
constexpr float kHeatLookaheadSeconds = 25.0f;
constexpr float kCoolingLookaheadSeconds = 10.0f;
constexpr float kHumidityLookaheadSeconds = 20.0f;
constexpr float kMaxTemperatureLeadC = 0.35f;
constexpr uint32_t kHeatWindowMs = 20000;
constexpr float kHeatProportional = 2.0f, kHeatIntegralSeconds = 90.0f;
constexpr float kHeatPowerLookaheadSeconds = 10.0f;
constexpr float kInitialHeatIntegral = 0.2f;
constexpr float kHeatDeadbandC = 0.05f;
constexpr uint32_t kDryReviewMs = 300000, kDryObserveOnMs = 120000, kDryBackoffMs = 120000;
constexpr uint32_t kDryLimitedRestMs = 60000;
constexpr float kInitialMistGain = 4.0f; // RH points / on-second; conservative until observed.
constexpr uint32_t kMistObserveMs = 15000, kFirstMistMaxMs = 1000;
constexpr float kDryEffortSeconds = 300.0f;
constexpr uint32_t kAdaptiveHeatMinOnMs = 5000, kAdaptiveHeatMinOffMs = 5000;
constexpr uint32_t kAdaptiveVentMinMs = 20000, kAdaptiveVentMaxMs = 60000;
constexpr uint8_t kHumidityThermalDutySpan = 50;
constexpr uint32_t kDryStableMs = 30000;
constexpr uint32_t kVentTestMs = 600000;
constexpr float kDryStableRateCMin = 0.35f, kDryComparableTemperatureC = 0.2f;
constexpr float kVentHeatFeedForward = 0.20f; // Provisional bounded heater-power fraction at full exhaust.
constexpr uint32_t kAdaptiveMistMinMs = 500, kAdaptiveMistMaxMs = 3000;
constexpr uint32_t kAdaptiveMistMinRestMs = 20000, kAdaptiveMistMaxRestMs = 60000;
static_assert(kHeatWindowMs >= kAdaptiveHeatMinOnMs + kAdaptiveHeatMinOffMs, "Relay timing fits heater window");
static_assert(kAdaptiveMistMaxMs <= 3000 && kAdaptiveMistMinRestMs >= 20000,
              "Preserve existing mist pulse/rest safety bounds");
} // namespace egg_climate
