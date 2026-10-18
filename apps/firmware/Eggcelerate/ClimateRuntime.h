#pragma once
#include <Arduino.h>
#include <DHT.h>
#include <Preferences.h>
#include <esp_system.h>
#include <esp_task_wdt.h>
#include "ClimateControl.h"
#include "TrayMotion.h"

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
egg_tray::Controller tray;
egg_tray::State trayPublished;
enum class TrayAction : uint8_t { Opposite=0, Level=1, ConfirmPlus=2, ConfirmMinus=3, ConfirmLevel=4, Stop=5, Tilt=6 };
struct TrayRequest { TrayAction action; uint32_t id; uint32_t expires=0; uint8_t from=0; bool remote=false; };
QueueHandle_t trayCommands = nullptr;
bool trayStopPending = false;
bool trayStorageReady = false;
bool fanPwmReady = false;
uint8_t lastExhaustDuty = 0;

bool writeExhaust(uint8_t duty) {
  if (!fanPwmReady) {
    // A failed PWM peripheral may only fall back to explicit full on/off.
    digitalWrite(kExhaustPin, duty ? HIGH : LOW);
    return duty == 0 || duty == 100;
  }
  if (duty == lastExhaustDuty) return true;
  if (!ledcWrite(kExhaustPin, (uint32_t(duty) * 255U + 50U) / 100U)) {
    ledcDetach(kExhaustPin);
    pinMode(kExhaustPin, OUTPUT);
    digitalWrite(kExhaustPin, duty ? HIGH : LOW);
    fanPwmReady = false;
    return false;
  }
  lastExhaustDuty = duty;
  return true;
}

bool applyOutputs(const Outputs &out, bool trayOn = false) {
  // Remove heat/mist first; establish circulation before energizing heat.
  if (!out.heater) digitalWrite(kHeaterPin, HIGH);
  if (!out.mist) digitalWrite(kMistPin, HIGH);
  digitalWrite(kUpperPin, out.upper ? HIGH : LOW);
  if (!writeExhaust(out.exhaustDuty)) {
    digitalWrite(kHeaterPin, HIGH);
    digitalWrite(kMistPin, HIGH);
    digitalWrite(kTrayPin, HIGH);
    return false;
  }
  if (out.heater && out.upper) digitalWrite(kHeaterPin, LOW);
  if (out.mist) digitalWrite(kMistPin, LOW);
  digitalWrite(kTrayPin, trayOn ? LOW : HIGH);
  return true;
}
void beginOutputs() {
  for (uint8_t pin : {kHeaterPin, kMistPin, kTrayPin}) { digitalWrite(pin, HIGH); pinMode(pin, OUTPUT); }
  for (uint8_t pin : {kUpperPin, kExhaustPin}) { digitalWrite(pin, LOW); pinMode(pin, OUTPUT); }
  fanPwmReady = ledcAttach(kExhaustPin, kExhaustPwmHz, kExhaustPwmBits);
  if (fanPwmReady && !ledcWrite(kExhaustPin, 0)) {
    ledcDetach(kExhaustPin); pinMode(kExhaustPin, OUTPUT);
    digitalWrite(kExhaustPin, LOW); fanPwmReady = false;
  }
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

egg_tray::State traySnapshot() {
  portENTER_CRITICAL(&stateMux);
  const auto result = trayPublished;
  portEXIT_CRITICAL(&stateMux);
  return result;
}
bool requestTray(TrayRequest req) {
  portENTER_CRITICAL(&stateMux);
  const bool ready = runtimeReady && (req.action == TrayAction::Stop || (!stopPending && !trayStopPending));
  portEXIT_CRITICAL(&stateMux);
  if (!ready || !trayCommands) return false;
  if (req.action == TrayAction::Stop) return xQueueOverwrite(trayCommands, &req) == pdTRUE;
  return xQueueSend(trayCommands, &req, 0) == pdTRUE;
}
void executeTray(const TrayRequest& req, bool allowed) {
  if (req.id && req.id <= tray.state.highestId) return;
  if (req.remote) { tray.state.ackId=req.id; tray.state.accepted=false; }
  if (req.expires && (time(nullptr)<1704067200 || time(nullptr)>=req.expires)) return;
  const bool confirmation = req.action==TrayAction::ConfirmPlus || req.action==TrayAction::ConfirmMinus || req.action==TrayAction::ConfirmLevel;
  if (req.action==TrayAction::ConfirmPlus && !req.remote) { if (allowed) tray.confirmPlus(millis()); return; }
  if (!trayStorageReady) return;
  Preferences prefs;
  bool stored=prefs.begin("egg-tray", false);
  if (stored) {
    stored=prefs.putUInt("last-id", req.id)==sizeof(uint32_t) && prefs.getUInt("last-id",0)==req.id;
    prefs.end();
  }
  if (!stored) { trayStorageReady=false; tray.stop(millis()); return; }
  // Consume rejected IDs as well, so a later lifecycle change cannot revive one.
  const uint32_t previous=tray.state.highestId;
  if (req.action==TrayAction::Stop) {
    tray.stop(millis()); tray.state.accepted=true;
  } else if (allowed && confirmation && !tray.state.running) {
    tray.confirmPlus(millis());
    tray.state.position=req.action==TrayAction::ConfirmPlus?1:req.action==TrayAction::ConfirmMinus?2:3;
    tray.state.status=egg_tray::Status::AwaitingObservation;
    tray.state.accepted=true;
  } else if (allowed && (!req.remote || req.from==tray.state.position)) {
    tray.state.accepted=tray.start(millis(), req.action==TrayAction::Level?egg_tray::Move::Level:req.action==TrayAction::Tilt?egg_tray::Move::Tilt:egg_tray::Move::Opposite, req.id, req.remote);
  }
  tray.state.highestId=previous>req.id?previous:req.id;
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
    && record.magic==0x45475232 && record.phase<=2 && record.mode<3 && record.fault<=7 && record.checksum==runChecksum(record));
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
  if (cmd.action == Action::Stop) {
    tray.stop(millis());
    xQueueReset(trayCommands);
    applyOutputs(Outputs{});
  }
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
  else if (saved.magic!=0x45475232 || saved.checksum!=runChecksum(saved) || saved.mode>=3 || saved.phase>2 || saved.fault>7) {
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
  if (!fanPwmReady) {
    resume = false; controller.fanOutputFailed();
    if (!saveRun(controller.state)) storageFault(controller);
  }
  controlDht.begin();
  // Only the replay high-water mark is persistent. Position and motion NEVER
  // restore on boot. Persist an ID before applying power, including failed runs.
  Preferences trayPrefs;
  trayStorageReady = trayPrefs.begin("egg-tray", false);
  if (trayStorageReady) {
    trayStorageReady = !trayPrefs.isKey("last-id") || trayPrefs.getType("last-id") == PT_U32;
    if (trayStorageReady) tray.state.highestId = trayPrefs.getUInt("last-id", 0);
    trayPrefs.end();
  }
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
    // Manual commissioning only during healthy, confirmed incubation. No
    // idle/preparation turns or inferred home arrival. Server schedules bounded requests.
    const bool trayAllowed = trayStorageReady && controller.state.running &&
      controller.state.phase == 2 && controller.state.fault == Fault::None &&
      controller.state.valid && millis() - controller.state.sampledAt <= kStaleMs;
    portENTER_CRITICAL(&stateMux);
    const bool stopTray = trayStopPending;
    trayStopPending = false;
    portEXIT_CRITICAL(&stateMux);
    if (stop || stopTray || !trayAllowed) {
      if (tray.state.running || tray.state.status == egg_tray::Status::PlusConfirmed || stop || stopTray)
        tray.stop(millis());
      if (stop || stopTray) xQueueReset(trayCommands);
    }
    TrayRequest req;
    if (!stop && !stopTray && xQueueReceive(trayCommands, &req, 0)==pdTRUE)
      executeTray(req, trayAllowed);
    tray.tick(millis());
    if (!trayStorageReady) tray.state.status = egg_tray::Status::StorageFault;
    if (!applyOutputs(controller.state.out, tray.state.running)) {
      tray.stop(millis());
      resume = false;
      controller.fanOutputFailed();
      controller.tick(millis());
      if (!saveRun(controller.state)) storageFault(controller);
      applyOutputs(controller.state.out);
    }
    controller.state.pwmReady = fanPwmReady;
    // Local event log is independent of MQTT cadence. Not a persistent queue.
    static uint32_t loggedSample = 0, loggedControl = 0;
    static Fault loggedFault = Fault::None;
    if (controller.state.sampleNumber != loggedSample ||
        controller.state.controlSequence != loggedControl || controller.state.fault != loggedFault) {
      const auto &s = controller.state;
      Serial.printf("CONTROL ms=%lu sample=%lu change=%lu mode=%u phase=%u T=%.2f RH=%.2f valid=%u running=%u heater=%u mist=%u upper=%u exhaust_request=%u exhaust_duty=%u reason=%s fault=%u pwm=%u\n",
        (unsigned long)millis(), (unsigned long)s.sampleNumber, (unsigned long)s.controlSequence,
        s.mode, s.phase, s.temperature, s.humidity, s.valid, s.running, s.out.heater,
        s.out.mist, s.out.upper, s.out.exhaustRequestedDuty, s.out.exhaustDuty,
        s.exhaustReason, unsigned(s.fault), fanPwmReady);
      loggedSample = s.sampleNumber; loggedControl = s.controlSequence; loggedFault = s.fault;
    }
    portENTER_CRITICAL(&stateMux);
    published = controller.state;
    trayPublished = tray.state;
    portEXIT_CRITICAL(&stateMux);
    esp_task_wdt_reset();
    vTaskDelay(pdMS_TO_TICKS(50));
  }
}
bool begin() {
  commands = xQueueCreate(8, sizeof(Command));
  trayCommands = xQueueCreate(1, sizeof(TrayRequest));
  if (!commands || !trayCommands) return false;
  return xTaskCreatePinnedToCore(task, "egg-climate", 4096, nullptr, 2, &controlTask, ARDUINO_RUNNING_CORE) == pdPASS;
}
void printState() {
  const State state = snapshot();
  const Mode &mode = kModes[state.mode];
  Serial.printf("Climate: %s | Mode: %s %.1f-%.1f C / %.0f-%.0f %% RH | T=%.1f RH=%.1f | Fault: %s\n",
    state.running ? "RUNNING" : "STOPPED", mode.name, mode.tempMin, mode.tempMax, mode.humidityMin, mode.humidityMax,
    state.temperature, state.humidity, faultName(state.fault));
  Serial.printf("Heater:%s Mist:%s Upper:%s Exhaust:%u%% (request %u%%, %s) PWM:%s | %s\n",
    state.out.heater ? "ON" : "OFF", state.out.mist ? "ON" : "OFF", state.out.upper ? "ON" : "OFF",
    state.out.exhaustDuty, state.out.exhaustRequestedDuty, state.exhaustReason,
    state.pwmReady ? "ready" : "unavailable", state.message);
}
bool serialCommand(String command) {
  if (command.startsWith("tray")) {
    portENTER_CRITICAL(&stateMux);
    const auto current = trayPublished;
    const bool ready = runtimeReady && !stopPending;
    portEXIT_CRITICAL(&stateMux);
    if (command == "tray status") {
      Serial.printf("Tray: %s | relay:%s | run ID:%lu | highest ID:%lu | elapsed:%lu ms\n",
        egg_tray::statusName(current.status), current.running ? "ON" : "OFF",
        (unsigned long)current.id, (unsigned long)current.highestId, (unsigned long)current.elapsed);
      return true;
    }
    if (command == "tray stop") {
      portENTER_CRITICAL(&stateMux); trayStopPending = true; portEXIT_CRITICAL(&stateMux);
      Serial.println("Tray Stop requested; climate monitoring/regulation continues."); return true;
    }
    TrayRequest req{TrayAction::ConfirmPlus, 0};
    if (command != "tray confirm plus") {
      const bool level = command.startsWith("tray level ");
      const bool opposite = command.startsWith("tray opposite ");
      if (!level && !opposite) {
        Serial.println("Tray: tray status | tray confirm plus | tray opposite ID | tray level ID | tray stop"); return true;
      }
      const String value = command.substring(level ? 11 : 14);
      uint64_t id = 0;
      if (!value.length() || value.length() > 10) { Serial.println("Use a positive numeric ID above highest ID."); return true; }
      for (char c : value) {
        if (c < '0' || c > '9') { Serial.println("Invalid tray ID."); return true; }
        id = id * 10 + (c - '0');
      }
      if (!id || id > UINT32_MAX || id <= current.highestId) { Serial.println("Tray ID already used or invalid; movement refused."); return true; }
      req = {level ? TrayAction::Level : TrayAction::Opposite, uint32_t(id)};
    }
    Serial.println(ready && trayCommands && xQueueSend(trayCommands, &req, 0) == pdTRUE
      ? "Tray request queued; use tray status to confirm. Healthy incubation and fresh +45 confirmation required."
      : "Tray request refused; controller unavailable or another request pending.");
    return true;
  }
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
