#pragma once
#include <stdint.h>
#include <math.h>

// Preparation and incubation climate regulator. Tray motion is not commissioned.
namespace egg_climate {
struct Mode {
  const char *name;
  float tempMin, tempMax, humidityMin, humidityMax;
};
constexpr Mode kModes[] = {
  {"Chicken", 37.5f, 37.8f, 55.0f, 60.0f},
  {"Duck", 37.4f, 37.6f, 62.0f, 68.0f},
  {"Quail", 37.5f, 37.8f, 55.0f, 60.0f},
};
constexpr uint32_t kSampleMs = 2500;
constexpr uint32_t kStaleMs = 6000;
constexpr uint32_t kFanLeadMs = 3000;
constexpr uint32_t kRelayOffMs = 3000;
constexpr uint32_t kMistPulseMs = 3000;
constexpr uint32_t kMistRestMs = 20000;
constexpr uint32_t kVentPulseMs = 10000;
constexpr uint32_t kVentRestMs = 20000;
constexpr uint32_t kCooldownMs = 60000;
constexpr uint32_t kHeaterLimitMs = 30UL * 60UL * 1000UL;
constexpr float kOverheatC = 39.0f;
enum class Fault : uint8_t { None, Sensor, Stale, Overheat, HeaterTimeout, Storage, ControllerReset };
enum class Action : uint8_t { None, Start, Stop, Reset, SetMode, Prepare, Incubate };
struct Command {
  Action action = Action::None; uint8_t mode = 0;
  char id[37] = {}; uint64_t order = 0; uint32_t expires = 0;
};
struct Outputs { bool heater = false, mist = false, upper = false, exhaust = false; };
struct State {
  char commandId[37] = {};
  uint64_t commandOrder = 0;
  bool accepted = false;
  Outputs out;
  uint8_t mode = 0, phase = 0;
  bool running = false, valid = false, cooldown = false, halted = true, resuming = false;
  Fault fault = Fault::None;
  float temperature = NAN, humidity = NAN;
  uint32_t sampledAt = 0, sampleNumber = 0, successes = 0, failures = 0;
  uint8_t consecutiveGood = 0;
  const char *message = "Idle; use Begin Preparation on the website";
};
inline const char *faultName(Fault fault) {
  switch (fault) {
    case Fault::Sensor: return "Sensor failure";
    case Fault::Stale: return "Stale sensor";
    case Fault::Overheat: return "Overheat >=39.0 C";
    case Fault::HeaterTimeout: return "Heater on for 30 minutes";
    case Fault::Storage: return "Run-state storage failure";
    case Fault::ControllerReset: return "Controller reset after a crash";
    default: return "None";
  }
}
class Controller {
public:
  State state;
  bool accepted = false;
  void sample(uint32_t now, float temperature, float humidity) {
    state.sampledAt = now;
    ++state.sampleNumber;
    state.temperature = temperature;
    state.humidity = humidity;
    state.valid = isfinite(temperature) && isfinite(humidity) &&
      temperature >= 0.0f && temperature <= 60.0f && humidity >= 1.0f && humidity <= 100.0f;
    if (state.valid) {
      ++state.successes;
      if (state.consecutiveGood < 2) ++state.consecutiveGood;
      if (temperature >= kOverheatC) trip(Fault::Overheat);
    } else {
      ++state.failures;
      state.consecutiveGood = 0;
      if (state.running) trip(Fault::Sensor);
    }
  }
  void command(uint32_t now, Command cmd) {
    accepted = false;
    if (cmd.action == Action::Stop) {
      outputsStopped = true; state.halted = true;
      state.running = false; state.phase = 0;
      state.cooldown = false;
      state.out = Outputs{};
      accepted = true;
      state.message = "Stopped: heater, mist, both fans and tray off; monitoring continues";
      return;
    }
    if (cmd.action == Action::SetMode) {
      if (state.running) { state.message = "Stop before changing mode"; return; }
      if (cmd.mode < 3) { accepted = true; state.mode = cmd.mode; state.message = "Mode selected; controller remains stopped"; }
      return;
    }
    if (cmd.action == Action::Reset) {
      if (state.running) { state.message = "Stop before reset"; return; }
      if (!ready(now) || state.temperature > kModes[state.mode].tempMax) {
        state.message = "Reset refused; need two fresh readings and temperature within/below target"; return;
      }
      accepted = true;
      state.halted = true;
      state.fault = Fault::None;
      state.cooldown = !outputsStopped; coolingUntilStarted = now;
      state.message = "Fault reset; still stopped. Resume from the website";
      return;
    }
    if (cmd.action != Action::Prepare && cmd.action != Action::Incubate) return;
    if (cmd.mode >= 3) return;
    // The confirmation handoff changes lifecycle only, never interrupts regulation.
    if (state.running && state.mode == cmd.mode) {
      state.phase = cmd.action == Action::Prepare ? 1 : 2;
      accepted = true;
      state.message = state.phase == 1 ? "Preparing: regulating selected targets" : "Incubation: regulation continues";
      return;
    }
    if (state.fault != Fault::None) { state.message = "Fault latched; resolve it, then climate reset"; return; }
    if (!ready(now)) { state.message = "Start refused; need two fresh valid sensor readings"; return; }
    if (state.temperature >= kOverheatC) { trip(Fault::Overheat); return; }
    accepted = true;
    state.mode = cmd.mode; state.phase = cmd.action == Action::Prepare ? 1 : 2;
    state.halted = false;
    outputsStopped = false;
    state.running = true; state.cooldown = false;
    startedAt = now; heaterAt = now; mistAt = now;
    heatDemand = false; mistDemand = false; dryDemand = false; temperatureCooling = false;
    ventOn = false; wasDrying = false; ventAt = now;
    state.message = "Running; upper fan starts before heater";
  }
  void tick(uint32_t now) {
    const Mode &mode = kModes[state.mode];
    if (state.running && (!state.valid || now - state.sampledAt > kStaleMs))
      trip(state.valid ? Fault::Stale : Fault::Sensor);
    if (state.running && state.out.heater && now - heaterAt >= kHeaterLimitMs)
      trip(Fault::HeaterTimeout);
    if (state.cooldown && now - coolingUntilStarted >= kCooldownMs) state.cooldown = false;
    Outputs next;
    if (outputsStopped) {
      // Explicit stop latches every actuator off, including fault/cooldown fans.
    } else if (state.fault != Fault::None) {
      // No automatic recovery. Fans remain on while heater and mist stay off.
      next.upper = true; next.exhaust = true;
    } else if (!state.running) {
      const bool stillHot = ready(now) && state.temperature > mode.tempMax;
      next.upper = state.cooldown || stillHot;
      next.exhaust = next.upper;
    } else {
      next.upper = true;
      const float tempMid = (mode.tempMin + mode.tempMax) / 2.0f;
      const float humidityMid = (mode.humidityMin + mode.humidityMax) / 2.0f;
      if (state.temperature > mode.tempMax) temperatureCooling = true;
      else if (state.temperature <= tempMid) temperatureCooling = false;
      if (state.temperature <= mode.tempMin) heatDemand = true;
      else if (state.temperature >= mode.tempMax) heatDemand = false;
      if (state.humidity > mode.humidityMax) dryDemand = true;
      else if (state.humidity <= humidityMid) dryDemand = false;
      if (state.humidity < mode.humidityMin) mistDemand = true;
      else if (state.humidity >= humidityMid) mistDemand = false;
      const bool mayDry = dryDemand && !temperatureCooling && state.temperature >= mode.tempMin - 0.5f;
      if (mayDry) {
        if (!wasDrying) { ventOn = true; ventAt = now; }
        else if (ventOn && now - ventAt >= kVentPulseMs) { ventOn = false; ventAt = now; }
        else if (!ventOn && now - ventAt >= kVentRestMs) { ventOn = true; ventAt = now; }
      } else { ventOn = false; ventAt = now; }
      wasDrying = mayDry;
      next.exhaust = temperatureCooling || (mayDry && ventOn);
      const bool fanReady = now - startedAt >= kFanLeadMs;
      next.heater = fanReady && !temperatureCooling && heatDemand &&
        state.temperature < mode.tempMax &&
        (state.out.heater || now - heaterAt >= kRelayOffMs);
      // Humidity-driven ventilation may run alongside temperature-limited heat.
      // Misting never opposes drying or temperature-driven cooling.
      const bool mayMist = fanReady && !temperatureCooling && !dryDemand && !next.exhaust &&
        state.temperature >= mode.tempMin - 0.5f && state.temperature <= mode.tempMax && mistDemand;
      next.mist = mayMist && (state.out.mist
        ? now - mistAt < kMistPulseMs
        : now - mistAt >= kMistRestMs);
    }
    if (next.heater != state.out.heater) heaterAt = now;
    if (next.mist != state.out.mist) mistAt = now;
    state.out = next;
  }
private:
  uint32_t startedAt = 0, heaterAt = 0, mistAt = 0, ventAt = 0, coolingUntilStarted = 0;
  bool outputsStopped = true;
  bool heatDemand = false, mistDemand = false, dryDemand = false;
  bool temperatureCooling = false, ventOn = false, wasDrying = false;
  bool ready(uint32_t now) const {
    return state.valid && state.consecutiveGood >= 2 && now - state.sampledAt <= kStaleMs;
  }
  void trip(Fault fault) {
    if (state.fault == Fault::None) state.fault = fault;
    state.running = false; state.phase = 0;
    state.message = outputsStopped ? "Fault latched; all outputs remain stopped" : "FAULT: heater/mist off, both fans on; manual reset required";
  }
};
} // namespace egg_climate
