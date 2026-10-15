#pragma once
#include <Arduino.h>

// User confirmed connected hardware/readiness and explicitly requested activation.
constexpr bool kWiringAndInterfaceConfirmed = true;
// Configure LOW-trigger for the pictured optocoupler board's apparent circuit.
// OFF drives HIGH; ON drives LOW. Actual click/contact observation is still needed.
constexpr int kRelayActiveLevel = LOW;
static_assert(kRelayActiveLevel == -1 || kRelayActiveLevel == LOW ||
              kRelayActiveLevel == HIGH, "Use -1 (unknown), LOW, or HIGH");
constexpr uint8_t kRelayPins[3] = {27, 25, 14};
// IN1 heater/GPIO27, IN2 tray/GPIO25, IN3 mist/GPIO14.
// Move the GPIO14 signal wire from IN4 to IN3. IN4 is unused; GPIO26 is not driven.
// Active-HIGH fan MOSFETs: full ON/OFF only; no supply PWM.
constexpr uint8_t kFanPins[2] = {18, 19}; // Upper, lower.
constexpr uint32_t kChannelOnLimitMs = 10000;
constexpr uint32_t kMinimumOffMs = 1000;
constexpr uint32_t kHeartbeatTimeoutMs = 10000;
constexpr uint32_t kSessionLimitMs = 120000;
constexpr char kApName[] = "Eggcelerate-Relay-Test";
constexpr char kApPassword[] = "mango123";
