#pragma once
#include <Arduino.h>
#include <DHT.h>
#include <Preferences.h>
#include <esp_system.h>
#include <esp_task_wdt.h>
#include "ClimateControl.h"

namespace egg_climate {
constexpr uint8_t kHeaterPin = 27, kMistPin = 14, kTrayPin = 25;
constexpr uint8_t kUpperPin = 18, kExhaustPin = 19;
portMUX_TYPE stateMux = portMUX_INITIALIZER_UNLOCKED;
State published;
QueueHandle_t commands = nullptr;
bool stopPending = false, runtimeReady = false;
Command priorityStop;
TaskHandle_t controlTask = nullptr;
DHT controlDht(4, DHT22);

void applyOutputs(const Outputs &out) {
  // Remove heat/mist first; establish circulation before energizing heat.
  if (!out.heater) digitalWrite(kHeaterPin, HIGH);
  if (!out.mist) digitalWrite(kMistPin, HIGH);
  digitalWrite(kUpperPin, out.upper ? HIGH : LOW);
  digitalWrite(kExhaustPin, out.exhaust ? HIGH : LOW);
  if (out.heater && out.upper) digitalWrite(kHeaterPin, LOW);
  if (out.mist) digitalWrite(kMistPin, LOW);
  digitalWrite(kTrayPin, HIGH); // Tray motion is deliberately disabled.
}
void beginOutputs() {
  for (uint8_t pin : {kHeaterPin, kMistPin, kTrayPin}) { digitalWrite(pin, HIGH); pinMode(pin, OUTPUT); }
  for (uint8_t pin : {kUpperPin, kExhaustPin}) { digitalWrite(pin, LOW); pinMode(pin, OUTPUT); }
  applyOutputs(Outputs{});
}
State snapshot() {
  portENTER_CRITICAL(&stateMux);
  const State result = published;
  portEXIT_CRITICAL(&stateMux);
  return result;
}
bool request(Command cmd) {
  portENTER_CRITICAL(&stateMux);
  const bool active = runtimeReady;
  const bool ready = active && !stopPending;
  if (runtimeReady && cmd.action == Action::Stop) {
    // Never let an older network stop overwrite a newer stop request.
    if (!stopPending || !cmd.order || cmd.order >= priorityStop.order) priorityStop = cmd;
    stopPending = true;
  }
  portEXIT_CRITICAL(&stateMux);
  if (cmd.action == Action::Stop) return active;
  return ready && commands && xQueueSend(commands, &cmd, 0) == pdTRUE;
}

struct RunRecord {
  uint32_t magic = 0x45475232;
  uint8_t phase = 0, mode = 0, fault = 0, reserved = 0;
  uint32_t checksum = 0;
};
uint32_t runChecksum(const RunRecord &record) {
  return record.magic ^ (uint32_t(record.phase)<<24) ^ (uint32_t(record.mode)<<16) ^ (uint32_t(record.fault)<<8) ^ 0x73C4A19B;
}
bool saveRun(const State &state) {
  RunRecord record;
  record.phase = state.running ? state.phase : 0;
  record.mode = state.mode; record.fault = uint8_t(state.fault);
  record.checksum = runChecksum(record);
  Preferences prefs;
  if (!prefs.begin("egg-run",false)) return false;
  bool ok = prefs.putBytes("state",&record,sizeof(record))==sizeof(record);
  RunRecord check;
  ok = prefs.getBytes("state",&check,sizeof(check))==sizeof(check) && ok && !memcmp(&record,&check,sizeof(record));
  prefs.end(); return ok;
}
bool loadRun(RunRecord &record, bool &exists) {
  Preferences prefs;
  if (!prefs.begin("egg-run",false)) return false;
  const size_t size = prefs.getBytesLength("state"); exists = size != 0;
  bool ok = !exists || (size==sizeof(record) && prefs.getBytes("state",&record,sizeof(record))==sizeof(record)
    && record.magic==0x45475232 && record.phase<=2 && record.mode<3 && record.fault<=6 && record.checksum==runChecksum(record));
  prefs.end(); return ok;
}
void storageFault(Controller &controller) {
  controller.command(millis(),Command{Action::Stop,0});
  controller.state.fault = Fault::Storage;
  controller.state.accepted = false;
  controller.state.message = "Run-state storage failed; all equipment off";
}
void execute(Controller &controller, const Command &cmd) {
  const bool remote = cmd.id[0];
  if (remote && cmd.order <= controller.state.commandOrder) return;
  if (remote) {
    controller.state.commandOrder = cmd.order;
    strlcpy(controller.state.commandId,cmd.id,sizeof(controller.state.commandId));
    controller.state.accepted = false;
    if (time(nullptr)>=cmd.expires || time(nullptr)<1704067200) return;
  }
  if (cmd.action == Action::Stop) applyOutputs(Outputs{});
  controller.command(millis(),cmd);
  if (controller.accepted && cmd.action != Action::SetMode && !saveRun(controller.state)) {
    storageFault(controller); applyOutputs(Outputs{}); return;
  }
  if (remote) controller.state.accepted = controller.accepted;
}

void task(void *) {
  Controller controller;
  // Register only this task; networking/display stalls cannot stall regulation.
  esp_task_wdt_config_t config = {};
  config.timeout_ms = 6000;
  config.idle_core_mask = (1U << portNUM_PROCESSORS) - 1U;
  config.trigger_panic = true;
  esp_err_t configured = esp_task_wdt_init(&config);
  if (configured == ESP_ERR_INVALID_STATE) configured = esp_task_wdt_reconfigure(&config);
  const esp_err_t watchdog = configured == ESP_OK ? esp_task_wdt_add(nullptr) : configured;
  if (watchdog != ESP_OK) {
    controller.state.message = "Control watchdog unavailable; start disabled";
    portENTER_CRITICAL(&stateMux); published = controller.state; portEXIT_CRITICAL(&stateMux);
    vTaskDelete(nullptr);
    return;
  }
  RunRecord saved;
  bool savedExists = false;
  bool resume = loadRun(saved,savedExists) && savedExists && saved.phase>0 && !saved.fault;
  if (!savedExists) { if (!saveRun(controller.state)) storageFault(controller); }
  else if (saved.magic!=0x45475232 || saved.checksum!=runChecksum(saved) || saved.mode>=3 || saved.phase>2 || saved.fault>6) {
    storageFault(controller); resume = false;
  } else {
    controller.state.mode = saved.mode;
    controller.state.fault = Fault(saved.fault);
    const auto reason = esp_reset_reason();
    if (reason==ESP_RST_PANIC || reason==ESP_RST_INT_WDT || reason==ESP_RST_TASK_WDT || reason==ESP_RST_WDT) {
      controller.state.fault = Fault::ControllerReset; resume = false;
      saveRun(controller.state);
    }
  }
  controlDht.begin();
  uint32_t sampledAt = millis();
  portENTER_CRITICAL(&stateMux); runtimeReady = true; portEXIT_CRITICAL(&stateMux);
  for (;;) {
    const uint32_t now = millis();
    if (now - sampledAt >= kSampleMs) {
      sampledAt = now;
      const float humidity = controlDht.readHumidity();
      const float temperature = controlDht.readTemperature();
      controller.sample(millis(), temperature, humidity);
    }
    if (resume && controller.state.fault != Fault::None) resume = false;
    if (resume && controller.state.valid && controller.state.consecutiveGood>=2 && millis()-controller.state.sampledAt<=kStaleMs) {
      resume = false;
      execute(controller,Command{saved.phase==1 ? Action::Prepare : Action::Incubate,saved.mode});
    }
    portENTER_CRITICAL(&stateMux);
    const bool stop = stopPending;
    const Command stopCmd = priorityStop;
    stopPending = false;
    portEXIT_CRITICAL(&stateMux);
    if (stop) {
      xQueueReset(commands);
      resume = false;
      execute(controller, stopCmd);
    } else {
      Command cmd;
      for (uint8_t n = 0; n < 8 && xQueueReceive(commands, &cmd, 0) == pdTRUE; ++n) {
        if (cmd.action==Action::Prepare || cmd.action==Action::Incubate || cmd.action==Action::Reset) resume=false;
        execute(controller, cmd);
      }
    }
    controller.state.resuming = resume;
    const Fault previousFault = controller.state.fault;
    controller.tick(millis());
    if (controller.state.fault!=Fault::None && (previousFault!=controller.state.fault || saved.fault!=uint8_t(controller.state.fault))) {
      resume = false;
      if (!saveRun(controller.state)) storageFault(controller);
      saved.fault = uint8_t(controller.state.fault);
    }
    if (controller.state.fault == Fault::None) saved.fault = 0;
    applyOutputs(controller.state.out);
    portENTER_CRITICAL(&stateMux); published = controller.state; portEXIT_CRITICAL(&stateMux);
    esp_task_wdt_reset();
    vTaskDelay(pdMS_TO_TICKS(50));
  }
}
bool begin() {
  commands = xQueueCreate(8, sizeof(Command));
  if (!commands) return false;
  return xTaskCreatePinnedToCore(task, "egg-climate", 4096, nullptr, 2, &controlTask, ARDUINO_RUNNING_CORE) == pdPASS;
}
void printState() {
  const State state = snapshot();
  const Mode &mode = kModes[state.mode];
  Serial.printf("Climate: %s | Mode: %s %.1f-%.1f C / %.0f-%.0f %% RH | T=%.1f RH=%.1f | Fault: %s\n",
    state.running ? "RUNNING" : "STOPPED", mode.name, mode.tempMin, mode.tempMax, mode.humidityMin, mode.humidityMax,
    state.temperature, state.humidity, faultName(state.fault));
  Serial.printf("Heater:%s Mist:%s Upper:%s Exhaust:%s | %s\n",
    state.out.heater ? "ON" : "OFF", state.out.mist ? "ON" : "OFF", state.out.upper ? "ON" : "OFF", state.out.exhaust ? "ON" : "OFF", state.message);
}
bool serialCommand(String command) {
  if (command == "climate status") { printState(); return true; }
  Command cmd;
  if (command == "climate start") { Serial.println("Use Begin Preparation and Start Incubation on the website."); return true; }
  else if (command == "climate stop") cmd.action = Action::Stop;
  else if (command == "climate reset") cmd.action = Action::Reset;
  else if (command.startsWith("climate mode ")) {
    const String name = command.substring(13);
    cmd.action = Action::SetMode;
    if (name == "chicken") cmd.mode = 0;
    else if (name == "duck") cmd.mode = 1;
    else if (name == "quail") cmd.mode = 2;
    else { Serial.println("Use climate mode chicken|duck|quail"); return true; }
  } else if (command.startsWith("climate")) {
    Serial.println("Climate commands: climate status, climate stop, climate reset (start from website preparation)"); return true;
  } else return false;
  Serial.println(request(cmd) ? "Climate request queued; use climate status to confirm." : "Climate request refused: controller not ready or stop pending.");
  return true;
}
} // namespace egg_climate
