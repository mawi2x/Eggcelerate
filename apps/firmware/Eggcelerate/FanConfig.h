#pragma once
#include <stdint.h>

namespace egg_climate {
// Initial engineering settings, NOT recovered measurements from the user's
// working slider test. Keep these visible in reports and revise independently
// of species targets. Supply PWM uses GPIO19; GPIO18 remains full circulation.
constexpr uint32_t kExhaustPwmHz = 1000;
constexpr uint8_t kExhaustPwmBits = 8;
constexpr uint8_t kExhaustMinDuty = 50;
constexpr uint32_t kExhaustBoostMs = 1000;
constexpr uint32_t kExhaustRampMs = 500;
constexpr uint8_t kExhaustRampStep = 5;
constexpr const char *kClimateBuild = "climate-tray-cancel-return-v7";
static_assert(kExhaustPwmHz > 0 && kExhaustPwmHz <= 20000, "MOSFET frequency range");
static_assert(kExhaustMinDuty > 0 && kExhaustMinDuty <= 100, "Nonzero fan floor");
static_assert(kExhaustPwmBits == 8, "Duty conversion uses 8-bit output");
} // namespace egg_climate
