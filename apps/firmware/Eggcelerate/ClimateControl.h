#pragma once
#include <stdint.h>
#include <math.h>
#include <string.h>
#include "FanConfig.h"
#include "AdaptiveConfig.h"
#include "BenchmarkControl.h"

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
constexpr uint32_t kSensorRecoveryMs = 6000; // From first failed attempt; never extended by partial recovery.
constexpr uint32_t kFanLeadMs = 3000;
constexpr uint32_t kRelayOffMs = 3000;
constexpr uint32_t kMistPulseMs = 3000;
constexpr uint32_t kMistRestMs = 20000;
constexpr uint32_t kVentPulseMs = 10000;
constexpr uint32_t kVentRestMs = 20000;
constexpr uint32_t kCooldownMs = 60000;
constexpr uint32_t kFaultBlindVentMs = 60000; // Max age of ordinary last-known-hot cooling evidence.
constexpr uint32_t kHeaterLimitMs = 30UL * 60UL * 1000UL;
constexpr float kOverheatC = 39.0f;
constexpr float kHtmOverheatC = egg_benchmark::kHtmOvertempC;
enum class Fault : uint8_t { None, Sensor, Stale, Overheat, HeaterTimeout, Storage, ControllerReset, FanOutput };
enum class Action : uint8_t { None, Start, Stop, Reset, SetMode, Prepare, Incubate, VentTest, Cancel, HTM, LTM, LHM };
struct Command {
  Action action = Action::None; uint8_t mode = 0;
  char id[37] = {}; uint64_t order = 0; uint32_t expires = 0; uint8_t testDuty = 0;
};
struct Outputs {
  bool heater = false, mist = false, upper = false, exhaust = false;
  uint8_t exhaustRequestedDuty = 0, exhaustDuty = 0;
};
// Logged observations. Chicken uses the smoothed rates for bounded prediction.
struct __attribute__((packed)) AdaptiveDiagnostics {
  float moisture=NAN, moistureRate=NAN, humidityForecast=NAN;
  float heatForecast=NAN, coolingForecast=NAN, powerForecast=NAN;
  float thermalTarget=NAN, heatingPower=0, heatIntegral=0, heatFeedForward=0;
  float dryEffort=0, dryBaseline=NAN, reviewDelta=NAN, dutySeconds=0;
  float lastReviewBaseline=NAN, lastReviewDutySeconds=0;
  uint32_t lastReviewEligibleMs=0, lastReviewExhaustMs=0;
  uint32_t stableMs=0, reviewElapsedMs=0, eligibleMs=0, exhaustMs=0, reviewCount=0;
  uint8_t dryHeld=1, mayDry=0, dryLimited=0, thermalCeiling=0, reviewResult=0;
  uint8_t boostActive=0, heatWindowPosition=0, testDuty=0;
};
static_assert(sizeof(AdaptiveDiagnostics)==100, "Adaptive diagnostic layout");
struct Diagnostics {
  AdaptiveDiagnostics adaptive;
  float temperatureRate = NAN, humidityRate = NAN; // units per minute
  bool trendValid = false;
  bool heatDemand = false, dryDemand = false, mistDemand = false;
  bool temperatureCooling = false, ventOn = false;
  uint32_t evaluatedAt = 0, heaterElapsedMs = 0, mistElapsedMs = 0, ventElapsedMs = 0;
};
struct SensorHealth {
  uint32_t consecutiveFailures = 0, recoveries = 0;
  uint32_t lastFailureAt = 0, lastRecoveryAt = 0, faultAt = 0;
  uint8_t resetReason = 0;
  bool recovering = false;
};
struct State {
  SensorHealth sensor;
  char commandId[37] = {};
  uint64_t commandOrder = 0;
  bool accepted = false;
  Outputs out;
  Diagnostics diagnostics;
  uint8_t mode = 0, phase = 0;
  bool running = false, valid = false, cooldown = false, halted = true, resuming = false;
  Fault fault = Fault::None;
  float temperature = NAN, humidity = NAN;
  uint32_t sampledAt = 0, sampleNumber = 0, successes = 0, failures = 0;
  uint8_t consecutiveGood = 0;
  uint32_t lastGoodAt = 0;
  float lastGoodTemperature = NAN, lastGoodHumidity = NAN;
  uint32_t controlSequence = 0;
  bool pwmReady = false;
  const char *exhaustReason = "stopped";
  const char *message = "Idle; use Begin Preparation on the website";
};
inline const char *faultName(Fault fault) {
  switch (fault) {
    case Fault::Sensor: return "Sensor failure";
    case Fault::Stale: return "Stale sensor";
    case Fault::Overheat: return "Overtemperature limit reached";
    case Fault::HeaterTimeout: return "Heater on for 30 minutes";
    case Fault::Storage: return "Run-state storage failure";
    case Fault::ControllerReset: return "Controller reset after a crash";
    case Fault::FanOutput: return "Fan PWM output failure; restart required";
    default: return "None";
  }
}
class Controller {
public:
  State state;
  egg_benchmark::Controller benchmark;
  bool accepted = false;
  bool fanOutputAvailable = true;
  void fanOutputFailed() { fanOutputAvailable = false; trip(Fault::FanOutput); }
  void sensorRecoveryFailed() { trip(Fault::Sensor); }
  void sample(uint32_t now, float temperature, float humidity) {
    // Check deadlines BEFORE a late sample can make the stream look fresh.
    if (state.running || htmCooldown) {
      if (state.sensor.recovering && now - sensorHoldAt >= kSensorRecoveryMs) trip(Fault::Sensor);
      else if (!state.sensor.recovering && now - state.sampledAt > kStaleMs) trip(Fault::Stale);
    }
    const bool previousValid = state.valid;
    const float previousTemperature = state.temperature, previousHumidity = state.humidity;
    const uint32_t elapsed = now - state.sampledAt;
    state.sampledAt = now;
    ++state.sampleNumber;
    state.temperature = temperature;
    state.humidity = humidity;
    state.valid = isfinite(temperature) && isfinite(humidity) &&
      temperature >= 0.0f && temperature <= 60.0f && humidity >= 1.0f && humidity <= 100.0f;
    auto &d = state.diagnostics;
    d.trendValid = previousValid && state.valid && elapsed > 0 && elapsed <= kStaleMs;
    if (d.trendValid) {
      const float alpha = float(elapsed) / (kTrendTimeMs + elapsed);
      const float temperatureAlpha = float(elapsed) / (kTemperatureTrendTimeMs + elapsed);
      temperatureRate += temperatureAlpha * (limit((temperature - previousTemperature) * 60000.0f / elapsed, -3.0f, 3.0f) - temperatureRate);
      const float previousMoisture = equivalentHumidity(previousTemperature, previousHumidity);
      const float currentMoisture = equivalentHumidity(temperature, humidity);
      moistureRate += alpha * (limit((currentMoisture - previousMoisture) * 60000.0f / elapsed, -30.0f, 30.0f) - moistureRate);
      humidityRate += alpha * (limit((humidity - previousHumidity) * 60000.0f / elapsed, -30.0f, 30.0f) - humidityRate);
    } else { temperatureRate = humidityRate = moistureRate = 0.0f; }
    d.temperatureRate = d.trendValid ? temperatureRate : NAN;
    d.humidityRate = d.trendValid ? humidityRate : NAN;
    if (state.valid) {
      state.lastGoodAt = now;
      state.lastGoodTemperature = temperature; state.lastGoodHumidity = humidity;
      ++state.successes;
      state.sensor.consecutiveFailures = 0;
      if (state.consecutiveGood < 2) ++state.consecutiveGood;
      if (state.consecutiveGood >= 2 && sensorRecoveryPending) {
        sensorRecoveryPending = false;
        ++state.sensor.recoveries; state.sensor.lastRecoveryAt = now;
      }
      const bool htmProtection = (benchmark.state.active() && benchmark.state.kind==egg_benchmark::HTM) || htmCooldown;
      if (temperature >= (htmProtection ? kHtmOverheatC : kOverheatC)) trip(Fault::Overheat);
      if (htmCooldown && temperature <= kModes[0].tempMax && state.consecutiveGood >= 2) {
        htmCooldown = false;
        confirmedOverheat = false;
      }
      if (state.sensor.recovering && state.consecutiveGood >= 2 && state.fault == Fault::None) {
        state.sensor.recovering = false;
        state.message = "Sensor recovered; regulation continues";
      }
    } else {
      ++state.failures;
      ++state.sensor.consecutiveFailures; state.sensor.lastFailureAt = now;
      sensorRecoveryPending = true;
      state.consecutiveGood = 0;
      if ((state.running || htmCooldown) && !state.sensor.recovering) {
        state.sensor.recovering = true; sensorHoldAt = now;
        state.message = "Checking sensor; heater and mist paused";
      }
    }
  }
  void command(uint32_t now, Command cmd) {
    accepted = false;
    if (cmd.action==Action::HTM || cmd.action==Action::LTM || cmd.action==Action::LHM) {
      if (state.running || benchmark.state.active() || state.fault!=Fault::None || !ready(now) || !cmd.id[0]) return;
      const auto kind=cmd.action==Action::HTM?egg_benchmark::HTM:cmd.action==Action::LTM?egg_benchmark::LTM:egg_benchmark::LHM;
      if(kind==egg_benchmark::HTM&&state.temperature>=egg_benchmark::kCeilingC)return;
      Command base; base.action=Action::Prepare; base.mode=0; command(now,base);
      if(accepted){benchmark.start(now,kind,cmd.id);state.phase=0;state.message="Benchmark running; empty chamber only";}
      return;
    }
    if (benchmark.state.active() && cmd.action!=Action::Stop && cmd.action!=Action::Cancel) return;
    if (cmd.action == Action::VentTest) {
      if (!cmd.testDuty) { testDuty = 0; accepted = true; ++state.controlSequence; return; }
      if ((cmd.testDuty != 60 && cmd.testDuty != 100) || !state.running || state.mode != 0 || state.phase != 1 ||
          state.fault != Fault::None || !ready(now) || state.temperature < kModes[0].tempMin || state.temperature > kModes[0].tempMax) {
        state.message = "Vent test refused; requires healthy Chicken preparation in temperature range"; return;
      }
      testDuty = cmd.testDuty; testStartedAt = now; accepted = true; ++state.controlSequence;
      state.message = "Timed ventilation comparison active; temperature safety remains enabled"; return;
    }
    if (cmd.action == Action::Stop || cmd.action == Action::Cancel) {
      benchmark.finish(now,egg_benchmark::Cancelled);
      testDuty = 0;
      htmCooldown = false;
      state.sensor.recovering = false;
      outputsStopped = true; state.halted = true;
      state.running = false; state.phase = 0;
      state.cooldown = false;
      state.out = Outputs{};
      ++state.controlSequence;
      accepted = true;
      state.message = "Stopped: heater, mist, both fans and tray off; monitoring continues";
      return;
    }
    if (cmd.action == Action::SetMode) {
      if (state.running) { state.message = "Stop before changing mode"; return; }
      if (cmd.mode < 3) { accepted = true; state.mode = cmd.mode; ++state.controlSequence; state.message = "Mode selected; controller remains stopped"; }
      return;
    }
    if (cmd.action == Action::Reset) {
      if (!fanOutputAvailable) {
        state.message = "Fan output failed; inspect output configuration and restart controller"; return;
      }
      if (state.running) { state.message = "Stop before reset"; return; }
      if (!ready(now) || state.temperature > kModes[state.mode].tempMax) {
        state.message = "Reset refused; need two fresh readings and temperature within/below target"; return;
      }
      accepted = true;
      state.halted = true;
      state.fault = Fault::None;
      ventilatingFault = Fault::None; faultCooling = confirmedOverheat = false;
      ++state.controlSequence;
      state.cooldown = !outputsStopped; coolingUntilStarted = now;
      state.message = "Fault reset; still stopped. Resume from the website";
      return;
    }
    if (cmd.action != Action::Prepare && cmd.action != Action::Incubate) return;
    if (cmd.mode >= 3) return;
    // The confirmation handoff changes lifecycle only, never interrupts regulation.
    if (state.running && state.mode == cmd.mode) {
      state.phase = cmd.action == Action::Prepare ? 1 : 2;
      ++state.controlSequence;
      accepted = true;
      state.message = state.phase == 1 ? "Preparing: regulating selected targets" : "Incubation: regulation continues";
      return;
    }
    if (state.fault != Fault::None) { state.message = "Fault latched; resolve it, then climate reset"; return; }
    if (!ready(now)) { state.message = "Start refused; need two fresh valid sensor readings"; return; }
    if (state.temperature >= kOverheatC) { trip(Fault::Overheat); return; }
    accepted = true;
    state.mode = cmd.mode; state.phase = cmd.action == Action::Prepare ? 1 : 2;
    ++state.controlSequence;
    state.halted = false;
    state.sensor.recovering = false;
    ventilatingFault = Fault::None; faultCooling = confirmedOverheat = false;
    htmCooldown = false;
    outputsStopped = false;
    testDuty = 0;
    state.running = true; state.cooldown = false;
    startedAt = now; heaterAt = now; mistAt = now;
    heatDemand = false; mistDemand = false; dryDemand = false; temperatureCooling = false;
    ventOn = false; wasDrying = false; ventAt = now;
    mistGain = kInitialMistGain; mistGainKnown = mistObserve = false;
    heatIntegral = kInitialHeatIntegral; heatWindowAt = now; heatWindowUsed = false;
    dryReviewAt = now; dryOnMs = 0; dryBaseline = NAN; dryLimited = false;
    dryStableAt = now; dryEligibleMs = 0; dryDutySeconds = 0; dryStable = false;
    state.diagnostics.adaptive = AdaptiveDiagnostics{};
    dryEffort = 0.0f; dryHeld = true; adaptiveSample = state.sampleNumber;
    adaptiveAt = now; mistPulse = kAdaptiveMistMinMs; mistRest = kAdaptiveMistMaxRestMs;
    state.message = "Running; upper fan starts before heater";
  }
  void tick(uint32_t now) {
    const Mode &mode = kModes[state.mode];
    if (testDuty && !benchmark.state.active() && (!state.running || state.phase != 1 || state.mode != 0 || !ready(now) ||
        state.temperature < mode.tempMin || now-testStartedAt >= kVentTestMs)) {
      testDuty = 0; ++state.controlSequence;
      state.message = "Vent comparison ended; normal regulation continues";
    }
    if (state.running || htmCooldown) {
      if (state.sensor.recovering && now - sensorHoldAt >= kSensorRecoveryMs) trip(Fault::Sensor);
      else if (now - state.sampledAt > kStaleMs) trip(Fault::Stale);
    }
    if (state.running && state.out.heater && now - heaterAt >= kHeaterLimitMs)
      trip(Fault::HeaterTimeout);
    if (state.cooldown && now - coolingUntilStarted >= kCooldownMs) state.cooldown = false;
    const bool wasBenchmark=benchmark.state.active();
    if(wasBenchmark){
      const uint8_t duty=benchmark.duty();
      const bool healthy=state.running&&ready(now)&&!state.sensor.recovering&&state.fault==Fault::None;
      const bool qualified=healthy&&(benchmark.state.kind!=egg_benchmark::LHM ||
        (state.temperature>=37.5f&&state.temperature<=37.8f&&state.out.exhaustDuty==duty&&state.out.exhaustRequestedDuty==duty&&strcmp(state.exhaustReason,"temperature")));
      if(healthy || !state.running || state.fault!=Fault::None)
        benchmark.tick(now,healthy,state.sampleNumber,state.temperature,state.humidity,qualified);
      else benchmark.pause(now); // Outputs below enforce sensor_wait until recovery or a latched fault.
      if(!benchmark.state.active()){
        if(benchmark.state.kind==egg_benchmark::HTM&&benchmark.state.outcome==egg_benchmark::Ceiling){
          htmCooldown=true;
          confirmedOverheat=true;
        }
        state.running=false;state.phase=0;state.halted=true;testDuty=0;++state.controlSequence;
        // Fault cooling remains independent; ordinary completion cools if hot.
        state.message="Benchmark ended; result retained";
      }
    }
    Outputs next;
    const char *reason = "stopped";
    bool immediateFan = false;
    if (outputsStopped) {
      // Explicit stop latches every actuator off, including fault/cooldown fans.
    } else if (state.fault != Fault::None) {
      // Fault stays latched; ventilation is separate from permission to heat.
      faultVentilation(now, mode, next, reason);
      immediateFan = true;
    } else if (!state.running) {
      const bool stillHot = ready(now) && state.temperature > mode.tempMax;
      next.upper = state.cooldown || htmCooldown || stillHot;
      next.exhaust = next.upper;
      reason = htmCooldown ? "benchmark_cooldown" : next.exhaust ? "cooldown" : "idle";
      immediateFan = true;
    } else if (state.sensor.recovering || !ready(now)) {
      // No heating/misting on invalid, stale or only one recovered sample.
      // Keep circulation and the existing exhaust request during the short
      // recovery window. No new drying decision uses held readings.
      next.upper = true;
      next.exhaustRequestedDuty = state.out.exhaustRequestedDuty;
      next.exhaust = next.exhaustRequestedDuty != 0;
      reason = "sensor_wait";
      heatDemand = mistDemand = false;
      mistObserve = false;
      dryStable = false; dryBaseline = NAN; dryOnMs = dryEligibleMs = 0;
      adaptiveAt = adaptiveTickAt = now;
      adaptiveSample = state.sampleNumber;
    } else {
      next.upper = true;
      if (benchmark.state.active() && benchmark.state.kind!=egg_benchmark::LHM) {
        reason="benchmark";
        next.exhaustRequestedDuty=benchmark.duty();next.exhaust=next.exhaustRequestedDuty!=0;
        immediateFan=true;
        const float forecast=state.temperature+fmaxf(0.0f,temperatureRate)*25.0f/60.0f;
        next.heater=benchmark.state.kind==egg_benchmark::HTM && now-startedAt>=kFanLeadMs &&
          forecast<egg_benchmark::kCeilingC && state.temperature<egg_benchmark::kCeilingC &&
          (state.out.heater||now-heaterAt>=kAdaptiveHeatMinOffMs);
      } else if (state.mode == 0) {
        const bool bench=benchmark.state.active();
        if(bench){testDuty=benchmark.duty();testStartedAt=now;}
        adaptive(now, mode, next, reason);
        if(bench){next.mist=false;if(state.temperature<mode.tempMin){next.exhaustRequestedDuty=0;next.exhaust=false;reason="heat_hold";}else if(testDuty&&!temperatureCooling)reason="benchmark";}

      } else {
        immediateFan = true;
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
        reason = temperatureCooling ? "temperature" : (next.exhaust ? "humidity" : "idle");
        if (next.exhaust) next.exhaustRequestedDuty = 100;
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
    }
    if (next.exhaust && !next.exhaustRequestedDuty) next.exhaustRequestedDuty = 100;
    next.exhaustDuty = fanDuty(now, next.exhaustRequestedDuty, immediateFan);
    next.exhaust = next.exhaustDuty != 0;
    state.exhaustReason = reason;
    if (next.heater != state.out.heater || next.mist != state.out.mist ||
        next.upper != state.out.upper || next.exhaustDuty != state.out.exhaustDuty ||
        next.exhaustRequestedDuty != state.out.exhaustRequestedDuty) ++state.controlSequence;
    if (next.heater != state.out.heater) heaterAt = now;
    if (next.mist != state.out.mist) mistAt = now;
    state.out = next;
    if (state.fault != observedFault) {
      if (state.fault != Fault::None) state.sensor.faultAt = now;
      observedFault = state.fault;
    }
    auto &d = state.diagnostics;
    if (!state.running || state.sensor.recovering || state.mode != 0) {
      d.adaptive.heatingPower=0; d.adaptive.heatFeedForward=0;
      d.adaptive.mayDry=0; d.adaptive.testDuty=0;
    }
    d.evaluatedAt = now;
    d.heatDemand = heatDemand; d.dryDemand = dryDemand; d.mistDemand = mistDemand;
    d.temperatureCooling = temperatureCooling; d.ventOn = ventOn;
    d.heaterElapsedMs = now - heaterAt; d.mistElapsedMs = now - mistAt; d.ventElapsedMs = now - ventAt;
  }
private:
  uint32_t startedAt = 0, heaterAt = 0, mistAt = 0, ventAt = 0, coolingUntilStarted = 0;
  bool outputsStopped = true, htmCooldown = false;
  uint8_t testDuty = 0; uint32_t testStartedAt = 0;
  Fault ventilatingFault = Fault::None;
  bool faultCooling = false, confirmedOverheat = false;
  bool sensorRecoveryPending = false;
  Fault observedFault = Fault::None;
  uint32_t sensorHoldAt = 0;
  bool heatDemand = false, mistDemand = false, dryDemand = false;
  bool temperatureCooling = false, ventOn = false, wasDrying = false;
  uint32_t fanStartedAt = 0, fanRampAt = 0;
  float temperatureRate = 0.0f, humidityRate = 0.0f, moistureRate = 0.0f, dryEffort = 0.0f;
  float mistGain = kInitialMistGain, mistBefore = 0.0f, mistTemperatureBefore = 0.0f;
  bool mistGainKnown = false, mistObserve = false, mistObservationValid = false;
  uint32_t mistObserveEnd = 0, mistDeliveredMs = 0, adaptiveTickAt = 0;
  float heatIntegral = kInitialHeatIntegral;
  uint32_t heatWindowAt = 0;
  bool heatWindowUsed = false;
  bool dryHeld = true, dryLimited = false;
  float dryBaseline = NAN;
  uint32_t dryReviewAt = 0, dryOnMs = 0, dryStableAt = 0, dryEligibleMs = 0;
  bool dryStable = false;
  float dryDutySeconds = 0, dryBaselineTemperature = 0;
  uint32_t adaptiveSample = 0, adaptiveAt = 0;
  uint32_t mistPulse = kAdaptiveMistMinMs, mistRest = kAdaptiveMistMaxRestMs;
  static float limit(float value, float low, float high) { return fminf(high, fmaxf(low, value)); }
  static float equivalentHumidity(float temperature, float humidity) {
    // NWS saturation-vapor-pressure formula, expressed as RH at Chicken midpoint.
    // https://www.weather.gov/media/epz/wxcalc/vaporPressure.pdf
    const float reference = (kModes[0].tempMin + kModes[0].tempMax) * 0.5f;
    return humidity * expf(17.269388f * (temperature / (237.3f + temperature) - reference / (237.3f + reference)));
  }
  void adaptive(uint32_t now, const Mode &mode, Outputs &next, const char *&reason) {
    const float middle = (mode.tempMin + mode.tempMax) * 0.5f;
    const float humidityMiddle = (mode.humidityMin + mode.humidityMax) * 0.5f;
    const float heatForecast = state.temperature + limit(temperatureRate * kHeatLookaheadSeconds / 60.0f,
      -kMaxTemperatureLeadC, kMaxTemperatureLeadC);
    const float coolingForecast = state.temperature + limit(temperatureRate * kCoolingLookaheadSeconds / 60.0f,
      -kMaxTemperatureLeadC, kMaxTemperatureLeadC);
    const float moisture = equivalentHumidity(state.temperature, state.humidity);
    const float humidityForecast = moisture + limit(moistureRate * kHumidityLookaheadSeconds / 60.0f, -2.0f, 2.0f);
    const uint32_t elapsedTick = now - adaptiveTickAt; adaptiveTickAt = now;
    if (mistObserve && state.out.mist && elapsedTick <= kStaleMs) mistDeliveredMs += elapsedTick;
    if (mistObserve && state.out.exhaust) mistObservationValid = false;
    if (mistObserve && !state.out.mist && mistObserveEnd && now - mistObserveEnd >= kMistObserveMs) {
      const float response = moisture - mistBefore;
      if (mistObservationValid && fabsf(state.temperature - mistTemperatureBefore) <= 0.2f && mistDeliveredMs >= kAdaptiveMistMinMs && response >= 0.2f) {
        const float observed = limit(response * 1000.0f / mistDeliveredMs, 0.25f, 10.0f);
        mistGain = limit(0.75f * mistGain + 0.25f * observed, 0.25f, 10.0f);
        mistGainKnown = true;
      }
      mistObserve = false;
    }
    if (state.temperature > mode.tempMax ||
        (state.temperature >= mode.tempMax && heatForecast > mode.tempMax)) temperatureCooling = true;
    else if (state.temperature <= middle + kHeatDeadbandC || coolingForecast <= middle) temperatureCooling = false;

    if (moisture > mode.humidityMax || (humidityForecast > mode.humidityMax && moisture >= humidityMiddle) || (state.temperature >= mode.tempMin && state.temperature <= mode.tempMax && state.humidity > mode.humidityMax)) dryDemand = true;
    else if (humidityForecast <= humidityMiddle && moisture <= mode.humidityMax && state.humidity <= mode.humidityMax) dryDemand = false;
    if (moisture < mode.humidityMin || state.humidity < mode.humidityMin || humidityForecast < mode.humidityMin) mistDemand = true;
    else if (moisture >= humidityMiddle || state.humidity >= mode.humidityMax) mistDemand = false;

    // Shared bounded forecast coordinates heating and ventilation. A lower
    // hold protects temperature; recovery need not wait for a warming forecast
    // to reach the midpoint before useful airflow is permitted again.
    if (state.temperature < mode.tempMin || heatForecast < mode.tempMin) dryHeld = true;
    else if (state.temperature >= middle && heatForecast >= mode.tempMin + 0.02f) dryHeld = false;
    const bool mayDry = dryDemand && !dryHeld && !temperatureCooling;
    auto &ad = state.diagnostics.adaptive;
    const bool comparable = ready(now) && state.temperature >= mode.tempMin && state.temperature <= mode.tempMax &&
      fabsf(temperatureRate) <= kDryStableRateCMin;
    if (dryLimited && now - dryReviewAt >= kDryBackoffMs) {
      dryLimited = false; dryStable = false; dryBaseline = NAN;
      dryOnMs = dryEligibleMs = 0; dryDutySeconds = 0;
    }
    if (!dryDemand || !comparable) {
      dryStable = false; dryBaseline = NAN; dryOnMs = dryEligibleMs = 0; dryDutySeconds = 0;
      if (!dryDemand) dryLimited = false;
    } else if (!dryLimited) {
      if (!dryStable) { dryStable = true; dryStableAt = now; }
      if (now - dryStableAt >= kDryStableMs) {
        if (!isfinite(dryBaseline)) {
          dryBaseline = moisture; dryBaselineTemperature = state.temperature;
          dryReviewAt = now; dryOnMs = dryEligibleMs = 0; dryDutySeconds = 0;
          ad.reviewResult = 1; // Qualified observation started; no verdict yet.
        } else if (fabsf(state.temperature - dryBaselineTemperature) > kDryComparableTemperatureC) {
          dryBaseline = NAN; dryStable = false; dryOnMs = dryEligibleMs = 0; dryDutySeconds = 0;
        } else if (elapsedTick <= kStaleMs) {
          dryEligibleMs += elapsedTick;
          // Credit only humidity-driven ventilation; temperature cooling is
          // logged independently and cannot satisfy the drying exposure gate.
          const bool humidityExposure = state.out.exhaust &&
            (!strcmp(state.exhaustReason,"humidity") || !strcmp(state.exhaustReason,"dry_limit"));
          if (humidityExposure) {
            dryOnMs += elapsedTick;
            dryDutySeconds += elapsedTick * 0.001f * state.out.exhaustDuty * 0.01f;
          }
          if (dryEligibleMs >= kDryReviewMs && dryOnMs >= kDryObserveOnMs) {
            ad.reviewDelta = dryBaseline - moisture; ++ad.reviewCount;
            ad.lastReviewBaseline=dryBaseline; ad.lastReviewDutySeconds=dryDutySeconds;
            ad.lastReviewEligibleMs=dryEligibleMs; ad.lastReviewExhaustMs=dryOnMs;
            dryLimited = moisture > mode.humidityMax && ad.reviewDelta < 0.5f;
            ad.reviewResult = dryLimited ? 3 : 2;
            if (dryLimited) dryEffort = fminf(dryEffort, 0.2f);
            dryReviewAt = now; dryBaseline = NAN; dryStable = false;
            dryOnMs = dryEligibleMs = 0; dryDutySeconds = 0;
          }
        }
      }
    }
    if (adaptiveSample != state.sampleNumber) {
      const float seconds = float(now - adaptiveAt) / 1000.0f;
      adaptiveSample = state.sampleNumber; adaptiveAt = now;
      // Freeze accumulation while thermal protection prevents useful drying.
      // Hard bounds prevent windup in both heat and moisture demand.
      if (seconds <= float(kStaleMs) / 1000.0f) {
        const float predicted = heatForecast;
        const float thermalTarget = dryDemand ? fminf(mode.tempMax - 0.1f, middle + 0.05f) : middle;
        const float error = thermalTarget - state.temperature;
        const float feedForward = mayDry && !dryLimited ? kVentHeatFeedForward * state.out.exhaustDuty * 0.01f : 0.0f;
        const float power = kHeatProportional * (thermalTarget - predicted) + heatIntegral + feedForward;
        // Conditional integration prevents saturation from storing a large demand.
        if (!((power >= 1.0f && error > 0.0f) || (power <= 0.0f && error < 0.0f)))
          heatIntegral = limit(heatIntegral + error * seconds / kHeatIntegralSeconds, 0.0f, 1.0f);
        if (mayDry && !dryLimited)
          dryEffort = limit(dryEffort + seconds * limit((moisture - humidityMiddle) / 5.0f, -1.0f, 1.0f) / kDryEffortSeconds, 0.0f, 0.7f);
        else if (moisture <= humidityMiddle)
          dryEffort = fmaxf(0.0f, dryEffort - seconds / kDryEffortSeconds);
      }
    }
    if (!dryDemand) dryEffort = 0.0f;
    const float requestedDrying = limit((moisture - humidityMiddle) / 10.0f + dryEffort +
      limit(moistureRate / 10.0f, -0.1f, 0.2f), 0.0f, 1.0f);
    const float drying = dryLimited ? fminf(requestedDrying, 0.2f) : requestedDrying;
    const uint32_t pulse = kAdaptiveVentMinMs + uint32_t((kAdaptiveVentMaxMs - kAdaptiveVentMinMs) * drying);
    const uint32_t rest = kDryLimitedRestMs;
    if (mayDry) {
      if (!dryLimited) { if (!ventOn) ventAt = now; ventOn = true; }
      else if (!wasDrying) { ventOn = true; ventAt = now; }
      else if (ventOn && now - ventAt >= pulse && rest > 0) { ventOn = false; ventAt = now; }
      else if (!ventOn && now - ventAt >= rest) { ventOn = true; ventAt = now; }
      wasDrying = true;
    } else if (!dryDemand) { ventOn = false; wasDrying = false; ventAt = now; }
    else if (ventOn) { ventOn = false; ventAt = now; } // Preserve rest through thermal holds.
    next.exhaust = temperatureCooling || (mayDry && ventOn);
    reason = temperatureCooling ? "temperature" : (next.exhaust ? (dryLimited ? "dry_limit" : "humidity") : (dryDemand && dryHeld ? "heat_hold" : "idle"));
    uint8_t thermalCeiling = 100;
    if (next.exhaust) {
      const float cooling = limit((state.temperature - middle) / 0.8f + fmaxf(0.0f, temperatureRate) / 3.0f, 0.0f, 1.0f);
      // Both demands influence speed when thermal cooling and high RH coexist.
      const float demand = temperatureCooling ? fmaxf(cooling, dryDemand ? drying : 0.0f) : drying;
      next.exhaustRequestedDuty = uint8_t(kExhaustMinDuty + lroundf((100 - kExhaustMinDuty) * demand));
      if (!temperatureCooling) {
        // Keep humidity duration demand independent of available thermal power:
        // sustained high RH can use continuous, thermally derated airflow.
        const float headroom = limit((coolingForecast - mode.tempMin) / (mode.tempMax - mode.tempMin), 0.0f, 1.0f);
        thermalCeiling = uint8_t(kExhaustMinDuty + lroundf(kHumidityThermalDutySpan * headroom));
        if (next.exhaustRequestedDuty > thermalCeiling) next.exhaustRequestedDuty = thermalCeiling;
      }
    }
    if (benchmark.state.active() && benchmark.state.kind==egg_benchmark::LHM && !benchmark.state.stage) {next.exhaust=false;next.exhaustRequestedDuty=0;reason="bench_warm";}
    if (testDuty) {
      next.exhaust = true; next.exhaustRequestedDuty = temperatureCooling ? 100 : testDuty;
      reason = temperatureCooling ? "temperature" : "vent_test";
      thermalCeiling = 100;
    }
    const bool fanReady = now - startedAt >= kFanLeadMs;
    const float predicted = heatForecast;
    const float thermalTarget = dryDemand ? fminf(mode.tempMax - 0.1f, middle + 0.05f) : middle;
    const float feedForward = ((mayDry && !dryLimited) || testDuty) && next.exhaust && !temperatureCooling ? kVentHeatFeedForward * next.exhaustRequestedDuty * 0.01f : 0.0f;
    const float heatingPower = limit(kHeatProportional * (thermalTarget - predicted) + heatIntegral + feedForward, 0.0f, 1.0f);
    if (now - heatWindowAt >= kHeatWindowMs) {
      heatWindowAt += ((now - heatWindowAt) / kHeatWindowMs) * kHeatWindowMs;
      heatWindowUsed = state.out.heater;
    }
    uint32_t onMs = uint32_t(heatingPower * kHeatWindowMs);
    if (onMs < kAdaptiveHeatMinOnMs) onMs = 0;
    else if (heatingPower < 0.98f && kHeatWindowMs - onMs < kAdaptiveHeatMinOffMs) onMs = kHeatWindowMs - kAdaptiveHeatMinOffMs;
    const bool heatHardStop = temperatureCooling || state.temperature >= mode.tempMax ||
      heatForecast >= mode.tempMax;
    heatDemand = heatingPower >= 0.98f || now - heatWindowAt < onMs;
    next.heater = fanReady && !heatHardStop && heatDemand &&
      (state.out.heater || (!heatWindowUsed && now - heaterAt >= kAdaptiveHeatMinOffMs));
    if (fanReady && !heatHardStop && state.out.heater && now - heaterAt < kAdaptiveHeatMinOnMs) next.heater = true;
    if (next.heater && !state.out.heater) heatWindowUsed = true;

    ad.moisture=moisture; ad.moistureRate=moistureRate; ad.humidityForecast=humidityForecast;
    ad.heatForecast=heatForecast; ad.coolingForecast=coolingForecast; ad.powerForecast=predicted;
    ad.thermalTarget=thermalTarget; ad.heatingPower=heatingPower; ad.heatIntegral=heatIntegral; ad.heatFeedForward=feedForward;
    ad.dryEffort=dryEffort; ad.dryBaseline=dryBaseline; ad.dutySeconds=dryDutySeconds;
    ad.stableMs=dryStable ? now-dryStableAt : 0; ad.reviewElapsedMs=isfinite(dryBaseline) ? now-dryReviewAt : 0;
    ad.eligibleMs=dryEligibleMs; ad.exhaustMs=dryOnMs; ad.dryHeld=dryHeld; ad.mayDry=mayDry; ad.dryLimited=dryLimited;
    ad.thermalCeiling=thermalCeiling;
    ad.boostActive=next.exhaust && (!state.out.exhaust || now-fanStartedAt < kExhaustBoostMs);
    ad.testDuty=testDuty;
    ad.heatWindowPosition=uint8_t((now-heatWindowAt)/1000);
    const bool mayMist = fanReady && mistDemand && !dryDemand && !temperatureCooling && !next.exhaust &&
      state.temperature >= mode.tempMin && state.temperature <= mode.tempMax && state.humidity < mode.humidityMax && humidityForecast < humidityMiddle;
    const float deficit = limit((humidityMiddle - humidityForecast) / 10.0f, 0.0f, 1.0f);
    // Freeze pulse duration at start. Safety/target interlocks may end it early.
    if (mayMist && !state.out.mist && now - mistAt >= mistRest) {
      const uint32_t maximum = mistGainKnown ? kAdaptiveMistMaxMs : kFirstMistMaxMs;
      mistPulse = uint32_t(limit((humidityMiddle - humidityForecast) * 500.0f / mistGain,
        float(kAdaptiveMistMinMs), float(maximum)));
      mistBefore = moisture; mistTemperatureBefore = state.temperature; mistDeliveredMs = 0; mistObserveEnd = 0;
      mistObserve = mistObservationValid = true;
      mistRest = kAdaptiveMistMaxRestMs - uint32_t((kAdaptiveMistMaxRestMs - kAdaptiveMistMinRestMs) * deficit);
      next.mist = true;
    } else next.mist = mayMist && state.out.mist && now - mistAt < mistPulse;
    if (state.out.mist && !next.mist && mistObserve) mistObserveEnd = now;
    if (next.exhaust && mistObserve) mistObservationValid = false;
    // Rest responds to new measurements even before a pulse begins.
    if (!state.out.mist) mistRest = kAdaptiveMistMaxRestMs - uint32_t((kAdaptiveMistMaxRestMs - kAdaptiveMistMinRestMs) * deficit);
  }
  uint8_t fanDuty(uint32_t now, uint8_t target, bool immediate) {
    // Stop and release of demand must never leave exhaust coasting in software.
    if (!target) return 0;
    if (!state.out.exhaustDuty) {
      fanStartedAt = fanRampAt = now;
      return 100;
    }
    if (immediate) return 100;
    if (now - fanStartedAt < kExhaustBoostMs) return 100;
    if (now - fanRampAt < kExhaustRampMs) return state.out.exhaustDuty;
    fanRampAt = now;
    const int previous = state.out.exhaustDuty;
    return uint8_t(previous < target ? fminf(target, previous + kExhaustRampStep)
                                    : fmaxf(target, previous - kExhaustRampStep));
  }
  void faultVentilation(uint32_t now, const Mode &mode, Outputs &next, const char *&reason) {
    if (ventilatingFault != state.fault) {
      ventilatingFault = state.fault;
      faultCooling = false;
      confirmedOverheat = confirmedOverheat || state.fault == Fault::Overheat;
    }
    next.upper = true; // Circulate residual heat while heating/mist remain off.
    const bool fresh = ready(now);
    const float middle = (mode.tempMin + mode.tempMax) * 0.5f;
    if (fresh) {
      if (state.temperature >= mode.tempMax) faultCooling = true;
      else if (state.temperature <= middle) {
        faultCooling = false;
        confirmedOverheat = false;
      }
      next.exhaust = faultCooling || confirmedOverheat;
    } else {
      // Ordinary sensor loss cannot command indefinite cooling. Last-good
      // values only justify bounded ventilation, never heater/mist operation.
      const bool recentHot = isfinite(state.lastGoodTemperature) &&
        now - state.lastGoodAt <= kFaultBlindVentMs &&
        (state.lastGoodTemperature >= mode.tempMax || faultCooling);
      // A confirmed over-temperature event is different: require fresh cooling evidence
      // before releasing emergency exhaust, even if the original fault differs.
      if (recentHot) faultCooling = true;
      next.exhaust = confirmedOverheat || recentHot;
    }
    if (!fanOutputAvailable) next.exhaust = false; // Cannot claim a working PWM output.
    reason = !fanOutputAvailable ? "fan_fault" : next.exhaust ? "fault_hot" : fresh ? "fault_cold" : "fault_wait";
  }
  bool ready(uint32_t now) const {
    return state.valid && state.consecutiveGood >= 2 && now - state.sampledAt <= kStaleMs;
  }
  void trip(Fault fault) {
    testDuty = 0;
    htmCooldown = false;
    state.sensor.recovering = false;
    if (fault == Fault::Overheat) confirmedOverheat = true;
    if (state.fault == Fault::None) { state.fault = fault; ++state.controlSequence; }
    state.running = false; state.phase = 0;
    state.message = outputsStopped ? "Fault latched; all outputs remain stopped" : "FAULT: heater/mist off; temperature-aware ventilation; manual reset required";
  }
};
} // namespace egg_climate
