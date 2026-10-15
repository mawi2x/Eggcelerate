#pragma once

// User confirmed GPIO18/19 trigger connections and readiness for bench testing.
// Seller lists 3.3 V triggers; verify HIGH-on/default-off behavior on hardware.
// Expected assignment: GPIO19 upper, GPIO18 lower. Keep load power off to flash.
constexpr bool kWiringConfirmed = true;
constexpr uint8_t kFanPins[2] = {19, 18};  // Upper, lower; GPIO numbers.
// Fans identified by user: DeepCool XFAN 120, DP-FDC-XF120.
// Rated 12 V / 0.07 A / 0.84 W each. Initial test is full 12 V ON/OFF.

// Enable only after the fan supports supply PWM through this MOSFET module.
// Enter a frequency supported by the actual fan/module. No frequency is assumed.
// User's HW-517 listing: 5–36 V load supply, 3.3–20 V trigger, up to 20 kHz.
constexpr bool kSupplyPwmConfirmed = false;
constexpr uint32_t kPwmFrequencyHz = 0;
constexpr uint8_t kPwmResolution = 8;
static_assert(!kSupplyPwmConfirmed || kPwmFrequencyHz > 0,
              "Set a verified PWM frequency before enabling supply PWM");
static_assert(!kSupplyPwmConfirmed || kPwmFrequencyHz <= 20000,
              "The supplied module listing specifies a 20 kHz trigger limit");

constexpr uint32_t kHeartbeatTimeoutMs = 10000;
constexpr uint32_t kSessionLimitMs = 120000;
constexpr char kApName[] = "Eggcelerate-Fan-Test";
// Short fruit-based bench password; protected Wi-Fi requires at least 8 characters.
constexpr char kApPassword[] = "mango123";
