#pragma once
// EGGCELERATE preparation/incubation climate, sensor/display, Wi-Fi and cloud firmware. DHT22 DATA -> GPIO4.
// Install Adafruit DHT sensor library, Adafruit Unified Sensor, PubSubClient, and hd44780 by Bill Perry.
// Copy CloudConfig.example.h to CloudConfig.h to configure verified MQTT TLS. Serial Monitor: 115200 baud, Newline.
#include <Arduino.h>
#include "ClimateRuntime.h"
#include <Preferences.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <time.h>
#if __has_include("LocalCloudConfig.h")
#include "LocalCloudConfig.h"
#elif __has_include("CloudConfig.h")
#include "CloudConfig.h"
#else
#include "CloudConfig.example.h"
#endif
#include <esp_random.h>
#include <ctype.h>
#include <math.h>
#include <string.h>
#include "LcdDisplay.h"
#include "OledDisplay.h"

namespace {
// Embedded commissioning identity. Use EGG-002, EGG-003, etc. for other boards.
constexpr char kDeviceId[] = "EGG-001";
// Fixed short pilot code. Assign a unique code and enroll it for each new board.
constexpr char kPairingCode[] = "EGG01";
constexpr char kSetupApPassword[] = "eggcelerate";
static_assert(sizeof(kDeviceId) <= 17, "Device ID exceeds the saved record capacity");
constexpr uint32_t kIdentityMagic = 0x45474731;
constexpr uint32_t kWifiMagic = 0x57494631;
constexpr uint32_t kConnectMs = 25000;
constexpr uint32_t kRetryMs = 10000;
constexpr uint32_t kRecoveryMs = 30000;
constexpr uint32_t kPortalIdleMs = 120000;
constexpr char kAlphabet[] = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const IPAddress kPortalIp(10, 10, 10, 10);

// Each configuration is one NVS blob: interrupted saves cannot mix fields.
struct Identity {
  uint32_t magic;
  char deviceId[17]; // Preserve the original NVS record layout for migration.
  char code[11];
  char apPassword[17];
};
struct WifiSettings {
  uint32_t magic;
  char ssid[33];
  char password[65];
};
Identity identity = {};
WifiSettings savedWifi = {};
WifiSettings candidateWifi = {};
DNSServer setupDns;
WebServer portal(kPortalIp, 80); // Bind to setup AP, not the home-network interface.
bool identityReady = false;
bool identityDamaged = false;
bool storageReady = false;
bool radioReady = false;
bool serialOverflow = false;
bool apActive = false;
bool candidateActive = false;
bool candidateQueued = false;
bool candidateConnecting = false;
bool previouslyConnected = false;
bool sensorValid = false;
float temperatureC = NAN;
float humidityPct = NAN;
uint32_t sensorAt = 0;
uint32_t successes = 0;
uint32_t failures = 0;
uint32_t candidateAt = 0;
uint32_t retryAt = 0;
uint32_t disconnectedAt = 0;
uint32_t userActivityAt = 0;
String csrfToken;
String portalMessage = "Enter your 2.4 GHz Wi-Fi details.";
String serialLine;
WiFiClientSecure cloudTls;
PubSubClient cloudMqtt(cloudTls);
char cloudTopic[100];
char receiptTopic[100];
char cloudBootId[64] = {};
char cloudBootedAt[25] = {};
uint32_t cloudSequence = 0;
uint32_t cloudAttemptAt = 0;
uint32_t cloudPublishedAt = 0;
uint32_t cloudReceiptAt = 0;
uint32_t cloudLastSent = 0;
uint32_t cloudReportingMs = 15000;
bool cloudEnabled = false;
bool cloudClockStarted = false;
bool cloudAttempted = false;
bool cloudHasPublished = false;
bool cloudHasReceipt = false;

const char *cloudStatus() {
  if (!cloudEnabled) return "not configured";
  if (WiFi.status() != WL_CONNECTED) return "waiting for Wi-Fi";
  if (time(nullptr) < 1704067200) return "waiting for UTC clock";
  if (!cloudMqtt.connected()) return "MQTT disconnected";
  if (cloudHasReceipt && millis() - cloudReceiptAt < 45000) return "database receipt confirmed";
  return "MQTT connected; waiting for database receipt";
}

bool cloudUtc(time_t epoch, char *output, size_t capacity) {
  tm utc = {};
  return gmtime_r(&epoch, &utc) && strftime(output, capacity, "%Y-%m-%dT%H:%M:%SZ", &utc);
}

void receiveCloudReceipt(char *topic, byte *body, unsigned int length) {
  if (strcmp(topic, receiptTopic) != 0 || !cloudLastSent) return;
  if (length > 5 && length < 256 && memcmp(body,"tray|",5)==0) {
    char packet[256]; memcpy(packet,body,length); packet[length]=0;
    char *save=nullptr; char *fields[8]={}; uint8_t count=0;
    for (char *part=strtok_r(packet,"|",&save);part&&count<8;part=strtok_r(nullptr,"|",&save)) fields[count++]=part;
    if (count!=7 || strcmp(fields[1],cloudBootId)) return;
    for (uint8_t n : {2,3,4,5,6}) {
      if (!fields[n][0] || strlen(fields[n])>10) return;
      for(char *c=fields[n];*c;++c) if(*c<'0'||*c>'9') return;
    }
    const uint64_t seq=strtoull(fields[2],nullptr,10), id=strtoull(fields[3],nullptr,10);
    const uint64_t action=strtoull(fields[4],nullptr,10), from=strtoull(fields[5],nullptr,10), expires=strtoull(fields[6],nullptr,10);
    const uint64_t now=time(nullptr);
    if(seq!=cloudLastSent || !id || id>UINT32_MAX || action>6 || from>3 || expires<=now || expires>now+95 || now<1704067200) return;
    egg_climate::requestTray({static_cast<egg_climate::TrayAction>(action),uint32_t(id),uint32_t(expires),uint8_t(from),true});
    return;
  }
  if (length > 8 && length < 256 && memcmp(body, "climate|", 8) == 0) {
    char packet[256]; memcpy(packet, body, length); packet[length] = 0;
    char *save = nullptr; char *fields[8] = {};
    uint8_t count = 0;
    for (char *part = strtok_r(packet, "|", &save); part && count < 8; part = strtok_r(nullptr, "|", &save)) fields[count++] = part;
    if (count != 8 || strcmp(fields[1], cloudBootId)) return;
    // Strict numeric fields; no trailing junk, signs, or unbounded expiry.
    for (uint8_t n : {2, 5, 6, 7}) {
      if (!fields[n][0] || strlen(fields[n]) > 13) return;
      for (char *c = fields[n]; *c; ++c) if (*c < '0' || *c > '9') return;
    }
    if (strtoul(fields[2], nullptr, 10) != cloudLastSent || strlen(fields[3]) != 36) return;
    for (uint8_t n = 0; n < 36; ++n) {
      const char c = fields[3][n];
      if (n == 8 || n == 13 || n == 18 || n == 23) { if (c != '-') return; }
      else if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return;
    }
    egg_climate::Command cmd;
    if (!strcmp(fields[4], "prepare")) cmd.action = egg_climate::Action::Prepare;
    else if (!strcmp(fields[4], "incubate")) cmd.action = egg_climate::Action::Incubate;
    else if (!strcmp(fields[4], "stop")) cmd.action = egg_climate::Action::Stop;
    else if (!strcmp(fields[4], "reset")) cmd.action = egg_climate::Action::Reset;
    else return;
    const unsigned long mode = strtoul(fields[5], nullptr, 10);
    const uint64_t expires = strtoull(fields[6], nullptr, 10);
    cmd.order = strtoull(fields[7], nullptr, 10);
    const uint64_t utc = static_cast<uint64_t>(time(nullptr));
    if (mode > 2 || expires <= utc || expires > utc + 95 || !cmd.order || cmd.order > utc * 1000ULL + 5000ULL) return;
    cmd.mode = mode; cmd.expires = static_cast<uint32_t>(expires);
    strlcpy(cmd.id, fields[3], sizeof(cmd.id));
    if (cmd.order <= egg_climate::snapshot().commandOrder) return;
    egg_climate::request(cmd);
    return;
  }
  char configPrefix[112];
  snprintf(configPrefix, sizeof(configPrefix), "interval:%s:%lu:", cloudBootId, static_cast<unsigned long>(cloudLastSent));
  const size_t prefixLength = strlen(configPrefix);
  if (length > prefixLength && length <= prefixLength + 2 && memcmp(body, configPrefix, prefixLength) == 0) {
    unsigned int seconds = 0;
    for (size_t i = prefixLength; i < length; ++i) {
      if (body[i] < '0' || body[i] > '9') return;
      seconds = seconds * 10 + (body[i] - '0');
    }
    if (seconds == 5 || seconds == 10 || seconds == 15 || seconds == 30) {
      const uint32_t nextMs = seconds * 1000UL;
      if (cloudReportingMs != nextMs) Serial.printf("Cloud: reporting interval updated to %u seconds. Sensor reads remain every 2.5 seconds.\n", seconds);
      cloudReportingMs = nextMs;
    }
    return;
  }
  char expected[96];
  snprintf(expected, sizeof(expected), "%s:%lu", cloudBootId, static_cast<unsigned long>(cloudLastSent));
  if (length == strlen(expected) && memcmp(body, expected, length) == 0) {
    cloudReceiptAt = millis();
    cloudHasReceipt = true;
    Serial.printf("Cloud: database accepted reading %lu.\n", static_cast<unsigned long>(cloudLastSent));
  }
}

void initializeCloud() {
  cloudEnabled = EggCloudConfig::MQTT_HOST[0] && EggCloudConfig::MQTT_USERNAME[0] &&
    EggCloudConfig::MQTT_PASSWORD[0] && EggCloudConfig::MQTT_ROOT_CA[0];
  if (!cloudEnabled) { Serial.println("Cloud disabled: complete private CloudConfig.h first."); return; }
  snprintf(cloudTopic, sizeof(cloudTopic), "eggcelerate/v1/devices/%s/telemetry", kDeviceId);
  snprintf(receiptTopic, sizeof(receiptTopic), "eggcelerate/v1/devices/%s/receipt", kDeviceId);
  cloudTls.setCACert(EggCloudConfig::MQTT_ROOT_CA);
  cloudTls.setConnectionTimeout(3000);
  cloudTls.setHandshakeTimeout(3);
  cloudMqtt.setServer(EggCloudConfig::MQTT_HOST, EggCloudConfig::MQTT_PORT);
  cloudMqtt.setBufferSize(1536);
  cloudMqtt.setKeepAlive(30);
  cloudMqtt.setSocketTimeout(3);
  cloudMqtt.setCallback(receiveCloudReceipt);
}

void serviceCloud(uint32_t now) {
  if (!cloudEnabled || !identityReady) return;
  if (WiFi.status() != WL_CONNECTED || candidateActive || candidateQueued) {
    if (cloudMqtt.connected()) cloudMqtt.disconnect();
    return;
  }
  if (!cloudClockStarted) {
    configTime(0, 0, "pool.ntp.org", "time.google.com");
    cloudClockStarted = true;
  }
  const time_t epoch = time(nullptr);
  if (epoch < 1704067200) return; // Never bypass certificate or timestamp checks.
  if (!cloudBootId[0]) {
    const time_t bootEpoch = epoch - millis() / 1000;
    if (!cloudUtc(bootEpoch, cloudBootedAt, sizeof(cloudBootedAt))) return;
    snprintf(cloudBootId, sizeof(cloudBootId), "%s-%llu-%08lX", kDeviceId,
      static_cast<unsigned long long>(bootEpoch), static_cast<unsigned long>(esp_random()));
  }
  if (!cloudMqtt.connected()) {
    if (cloudAttempted && now - cloudAttemptAt < 10000) return;
    cloudAttempted = true;
    cloudAttemptAt = now;
    const String clientId = "eggcelerate-" + String(kDeviceId);
    if (!cloudMqtt.connect(clientId.c_str(), EggCloudConfig::MQTT_USERNAME, EggCloudConfig::MQTT_PASSWORD)) {
      Serial.printf("Cloud MQTT connection failed: %d.\n", cloudMqtt.state()); return;
    }
    if (!cloudMqtt.subscribe(receiptTopic, 1)) { cloudMqtt.disconnect(); return; }
    cloudHasReceipt = false;
    Serial.println("Cloud MQTT connected. Waiting for database receipt.");
  }
  cloudMqtt.loop();
  now = millis();
  if (cloudHasPublished && now - cloudPublishedAt < cloudReportingMs) return;
  // Send only a fresh sample. No chamber/farm IDs, codes, or passwords in telemetry.
  if (cloudSequence >= 2147483647UL) { Serial.println("Cloud sequence exhausted; restart required."); return; }
  char observedAt[25];
  if (!cloudUtc(time(nullptr), observedAt, sizeof(observedAt))) return;
  char payload[1400];
  const auto climate = egg_climate::snapshot();
  const auto tray = egg_climate::traySnapshot();
  char sampleFields[128];
  const bool freshSensor = climate.valid && now - climate.sampledAt <= 5000;
  if (freshSensor) snprintf(sampleFields, sizeof(sampleFields), "\"temperature_c\":%.2f,\"humidity_pct\":%.2f,\"battery_pct\":100,\"power_source\":\"grid\",", climate.temperature, climate.humidity);
  else strlcpy(sampleFields, "\"climate_only\":true,", sizeof(sampleFields));
  const uint32_t sequence = ++cloudSequence;
  const int size = snprintf(payload, sizeof(payload),
    "{\"schema_v\":1,\"device_id\":\"%s\",\"boot_id\":\"%s\",\"booted_at\":\"%s\","
    "\"seq\":%lu,\"observed_at\":\"%s\",%s"
    "\"climate_test\":{\"halted\":%s,\"resuming\":%s,\"lifecycle\":1,\"phase\":%u,\"stop_all\":true,\"sensor_valid\":%s,\"running\":%s,\"mode\":%u,\"heater\":%s,\"mist\":%s,\"upper\":%s,\"exhaust\":%s,"
    "\"fault\":%u,\"command_id\":\"%s\",\"accepted\":%s,"
    "\"tray_capability\":true,\"tray_running\":%s,\"tray_position\":%u,\"tray_status\":%u,\"tray_id\":%lu,\"tray_highest\":%lu,\"tray_ack\":%lu,\"tray_accepted\":%s}}",
    kDeviceId, cloudBootId, cloudBootedAt, static_cast<unsigned long>(sequence), observedAt, sampleFields, climate.halted ? "true" : "false", climate.resuming ? "true" : "false", climate.phase, freshSensor ? "true" : "false",
    climate.running ? "true" : "false", climate.mode, climate.out.heater ? "true" : "false", climate.out.mist ? "true" : "false",
    climate.out.upper ? "true" : "false", climate.out.exhaust ? "true" : "false", static_cast<unsigned int>(climate.fault),
    climate.commandId, climate.accepted ? "true" : "false",
    tray.running?"true":"false",tray.position,unsigned(tray.status),(unsigned long)tray.id,(unsigned long)tray.highestId,(unsigned long)tray.ackId,tray.accepted?"true":"false");
  cloudPublishedAt = now;
  cloudHasPublished = true;
  if (size > 0 && static_cast<size_t>(size) < sizeof(payload) && cloudMqtt.publish(cloudTopic, payload, false)) {
    cloudLastSent = sequence;
    Serial.printf("Cloud reading %lu sent; database confirmation pending.\n", static_cast<unsigned long>(sequence));
  } else Serial.println("Cloud publish failed; next fresh sample will retry.");
}


String legacyHardwareId() {
  char output[17];
  snprintf(output, sizeof(output), "EGG-%012llX",
           static_cast<unsigned long long>(ESP.getEfuseMac() & 0xFFFFFFFFFFFFULL));
  return String(output);
}

String randomSecret(size_t length) {
  // Wi-Fi radio is started before this is used, supplying hardware RNG entropy.
  String output;
  output.reserve(length);
  const uint32_t count = sizeof(kAlphabet) - 1;
  const uint32_t limit = UINT32_MAX - (UINT32_MAX % count);
  while (output.length() < length) {
    const uint32_t number = esp_random();
    if (number < limit) output += kAlphabet[number % count];
  }
  return output;
}

bool validSecret(const char *secret, size_t length) {
  if (strlen(secret) != length) return false;
  for (size_t i = 0; i < length; ++i)
    if (strchr(kAlphabet, secret[i]) == nullptr) return false;
  return true;
}

bool validPairingCode(const char *code) {
  if (strlen(code) == 5 && strncmp(code, "EGG", 3) == 0 &&
      code[3] >= '0' && code[3] <= '9' && code[4] >= '0' && code[4] <= '9' &&
      !(code[3] == '0' && code[4] == '0')) return true;
  return validSecret(code, 10);
}

template <typename T>
bool saveBlob(const char *space, const T &value) {
  Preferences preferences;
  if (!preferences.begin(space, false)) return false;
  const bool stored = preferences.putBytes("config", &value, sizeof(value)) == sizeof(value);
  T check = {};
  const bool readBack = preferences.getBytes("config", &check, sizeof(check)) == sizeof(check);
  preferences.end();
  return stored && readBack && memcmp(&check, &value, sizeof(value)) == 0;
}

template <typename T>
bool loadBlob(const char *space, T &value, bool &exists) {
  Preferences preferences;
  if (!preferences.begin(space, false)) return false;
  const size_t size = preferences.getBytesLength("config");
  exists = size != 0;
  const bool loaded = !exists || (size == sizeof(value) &&
    preferences.getBytes("config", &value, sizeof(value)) == sizeof(value));
  preferences.end();
  return loaded;
}

bool validApPassword(const char *password) {
  const size_t length = strlen(password);
  if (length < 8 || length > 16) return false; // NVS layout retains 17-byte field.
  for (size_t n = 0; n < length; ++n)
    if (password[n] < 32 || password[n] > 126) return false;
  return true;
}

bool validIdentityRecord(const Identity &value) {
  return value.magic == kIdentityMagic && value.deviceId[16] == '\0' &&
    value.code[10] == '\0' && value.apPassword[16] == '\0' &&
    validPairingCode(value.code) &&
    validApPassword(value.apPassword) && String(value.apPassword).indexOf(value.code) < 0;
}

String groupedCode() {
  if (strlen(identity.code) == 5) return String(identity.code);
  return String(identity.code).substring(0, 5) + "-" + String(identity.code).substring(5);
}

bool validIdentity(const Identity &value) {
  return validIdentityRecord(value) && String(value.deviceId) == kDeviceId;
}

String setupSsid() {
  return "Eggcelerate-" + String(kDeviceId).substring(4);
}

void printIdentity() {
  if (!identityReady) {
    Serial.println(identityDamaged ? "Identity storage needs controlled restore." :
      "Not commissioned. First board setup: send commission. Previously enrolled board: restore from your record.");
    return;
  }
  Serial.printf("Device ID: %s\nFixed pairing code: %s\nSetup Wi-Fi: %s\nAP password: %s\n",
    identity.deviceId, groupedCode().c_str(), setupSsid().c_str(), identity.apPassword);
  Serial.println("Keep this commissioning record private. Enroll this code on the server before dashboard pairing.");
}

String escapeHtml(String value) {
  value.replace("&", "&amp;"); value.replace("<", "&lt;");
  value.replace(">", "&gt;"); value.replace("\"", "&quot;");
  value.replace("'", "&#39;");
  return value;
}

void redirectToSetup() {
  if (!apActive) { portal.send(404, "text/plain", "Setup is closed."); return; }
  portal.sendHeader("Cache-Control", "no-store");
  portal.sendHeader("Location", "http://10.10.10.10/");
  portal.send(302, "text/plain", "Open Eggcelerate Wi-Fi setup: http://10.10.10.10/");
}

bool localRequest() {
  const String host = portal.hostHeader();
  if (apActive && (host == "10.10.10.10" || host == "10.10.10.10:80")) return true;
  // OS connectivity probes arrive under their original HTTP hostname. Redirect
  // reads to the canonical AP address; never accept Wi-Fi credential writes there.
  if (apActive && portal.method() == HTTP_GET) { redirectToSetup(); return false; }
  portal.send(403, "text/plain", "Use http://10.10.10.10 while connected to the setup Wi-Fi.");
  return false;
}

void noCache() {
  portal.sendHeader("Cache-Control", "no-store");
  portal.sendHeader("X-Content-Type-Options", "nosniff");
  portal.sendHeader("Referrer-Policy", "no-referrer");
}

void servePage() {
  if (!localRequest()) return;
  userActivityAt = millis();
  noCache();
  String page = F("<!doctype html><html lang='en'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Eggcelerate setup</title><style>body{font:16px system-ui;background:#faf7f1;color:#24211d;margin:0;padding:24px}main{max-width:440px;margin:auto;background:white;padding:24px;border-radius:16px}label{display:block;margin-top:18px}input,button{box-sizing:border-box;width:100%;font:inherit;padding:12px;border:1px solid #aaa;border-radius:8px;margin-top:6px}button{background:#a83c20;color:white;cursor:pointer}code{font-size:20px}p{line-height:1.5}#status{min-height:3em}small{color:#555}</style><main><h1>Eggcelerate setup</h1>");
  page += F("<p id='status' role='status'>");
  page += escapeHtml(portalMessage) + "</p>";
  page += "<form method='post' action='/wifi'><input type='hidden' name='token' value='" + csrfToken + "'>";
  page += "<label for='ssid'>Wi-Fi name (2.4 GHz)</label><input id='ssid' name='ssid' maxlength='32' required value='" + escapeHtml(savedWifi.ssid) + "'>";
  page += F("<label for='password'>Wi-Fi password</label><input id='password' name='password' type='password' maxlength='64' autocomplete='new-password'><small>Leave blank only for an open network.</small><button type='submit'>Connect and save</button></form><script>async function refresh(){try{const r=await fetch('/status',{cache:'no-store'});const s=await r.json();document.getElementById('status').textContent=s.message+(s.connected?' Connected to Wi-Fi. Cloud: '+s.cloud+'.':'');}catch(e){document.getElementById('status').textContent='Setup page disconnected. Reconnect to the setup Wi-Fi if needed.';}}setInterval(refresh,3000);refresh();</script></main></html>");
  portal.send(200, "text/html; charset=utf-8", page);
}

void serveStatus() {
  if (!localRequest()) return;
  noCache();
  // Messages are fixed firmware strings; credentials are never included in JSON.
  String data = "{\"message\":\"" + portalMessage + "\",\"connected\":";
  data += WiFi.status() == WL_CONNECTED ? "true" : "false";
  data += ",\"sensorValid\":"; data += sensorValid ? "true" : "false";
  if (sensorValid) data += ",\"temperature\":" + String(temperatureC, 1) + ",\"humidity\":" + String(humidityPct, 1);
  data += ",\"cloud\":\"" + String(cloudStatus()) + "\"}";
  portal.send(200, "application/json", data);
}

bool validPassword(const String &password) {
  if (password.length() == 0) return true;
  if (password.length() >= 8 && password.length() <= 63) return true;
  if (password.length() != 64) return false;
  for (size_t i = 0; i < password.length(); ++i)
    if (!isxdigit(static_cast<unsigned char>(password[i]))) return false;
  return true;
}

void receiveWifi() {
  if (!localRequest()) return;
  noCache();
  if (!portal.hasArg("token") || portal.arg("token") != csrfToken) {
    portal.send(403, "text/plain", "Setup session expired. Open the setup page again."); return;
  }
  if (candidateActive || candidateQueued) {
    portal.send(409, "text/plain", "Connection attempt in progress. Return to the setup page."); return;
  }
  const String ssid = portal.arg("ssid");
  const String password = portal.arg("password");
  if (ssid.length() == 0 || ssid.length() > 32 || !validPassword(password)) {
    portal.send(400, "text/plain", "Use a Wi-Fi name of 1-32 bytes and a password of 8-63 characters (or 64 hex digits). Leave password blank for an open network."); return;
  }
  candidateWifi = {};
  candidateWifi.magic = kWifiMagic;
  ssid.toCharArray(candidateWifi.ssid, sizeof(candidateWifi.ssid));
  password.toCharArray(candidateWifi.password, sizeof(candidateWifi.password));
  candidateQueued = true;
  userActivityAt = millis();
  portalMessage = "Trying the new network. Please wait up to 25 seconds.";
  portal.sendHeader("Location", "http://10.10.10.10/");
  portal.send(303, "text/plain", "Connecting. Your phone may need to reconnect to the setup Wi-Fi.");
}

void openPortal() {
  if (!identityReady) return;
  if (!apActive) {
    if (!WiFi.mode(WIFI_AP_STA) ||
        !WiFi.softAPConfig(kPortalIp, kPortalIp, IPAddress(255, 255, 255, 0))) {
      WiFi.softAPdisconnect(true); WiFi.mode(WIFI_STA);
      Serial.println("Could not configure setup AP. Send setup to retry."); return;
    }
    const String ssid = setupSsid();
    if (!WiFi.softAP(ssid.c_str(), identity.apPassword)) {
      WiFi.softAPdisconnect(true); WiFi.mode(WIFI_STA);
      Serial.println("Could not start setup AP. Send setup to retry."); return;
    }
    if (!WiFi.AP.enableDhcpCaptivePortal())
      Serial.println("Captive portal DHCP hint unavailable; manual setup URL still works.");
    setupDns.setTTL(30);
    if (!setupDns.start(53, "*", kPortalIp))
      Serial.println("Captive portal DNS unavailable; open http://10.10.10.10 manually.");
    csrfToken = randomSecret(32);
    apActive = true;
    portal.begin();
  }
  userActivityAt = millis();
  printIdentity();
  Serial.println("Connect to setup Wi-Fi, keep connected without internet, then open http://10.10.10.10");
}

void connectSaved() {
  retryAt = millis();
  if (savedWifi.ssid[0]) WiFi.begin(savedWifi.ssid, savedWifi.password);
}

void commission(const String &code = "", const String &apPassword = "") {
  if (!radioReady || !storageReady || identityReady || (identityDamaged && code.length() == 0)) {
    Serial.println("Cannot generate a replacement identity. Use status or controlled restore."); return;
  }
  Identity next = {};
  next.magic = kIdentityMagic;
  String(kDeviceId).toCharArray(next.deviceId, sizeof(next.deviceId));
  const String pairing = code.length() ? code : String(kPairingCode);
  const String access = apPassword.length() ? apPassword : String(kSetupApPassword);
  pairing.toCharArray(next.code, sizeof(next.code));
  access.toCharArray(next.apPassword, sizeof(next.apPassword));
  if (!validIdentity(next) || !saveBlob("egg-ident", next)) {
    Serial.println("Identity could not be saved/verified. No setup AP started."); return;
  }
  identity = next;
  identityReady = true;
  identityDamaged = false;
  openPortal();
}

void serialCommand(String command) {
  command.trim();
  if (egg_climate::serialCommand(command)) return;
  if (command == "status") {
    printIdentity();
    egg_climate::printState();
    Serial.printf("Cloud: %s\n", cloudStatus());
    Serial.printf("Sensor OK: %lu | Failed: %lu | Wi-Fi: %s | Setup AP: %s\n",
      static_cast<unsigned long>(successes), static_cast<unsigned long>(failures),
      WiFi.status() == WL_CONNECTED ? "connected" : "disconnected", apActive ? "open" : "closed");
  } else if (command == "commission") {
    commission();
  } else if (command.startsWith("restore ")) {
    const int split = command.indexOf(' ', 8);
    if (split < 0) { Serial.println("Use restore CODE APPASSWORD from your commissioning record."); return; }
    const String code = command.substring(8, split);
    const String password = command.substring(split + 1);
    if (!validPairingCode(code.c_str()) || !validApPassword(password.c_str())) {
      Serial.println("Restore needs the saved short/legacy code and an 8-16 character AP password."); return;
    }
    commission(code, password);
  } else if (command == "setup") {
    openPortal();
  } else if (command == "forget-wifi") {
    if (!identityReady || candidateActive || candidateQueued) { Serial.println("Finish commissioning/connection attempt first."); return; }
    WifiSettings empty = {}; empty.magic = kWifiMagic;
    if (!saveBlob("egg-wifi", empty)) { Serial.println("Wi-Fi reset failed; old settings retained."); return; }
    savedWifi = empty;
    WiFi.disconnect(false, false);
    disconnectedAt = millis();
    portalMessage = "Saved Wi-Fi cleared. Device identity and pairing code are unchanged.";
    openPortal();
  } else {
    Serial.println("Commands: commission (first setup only), status, setup, forget-wifi, restore CODE APPASSWORD");
  }
}

void serviceSerial() {
  while (Serial.available()) {
    const char character = Serial.read();
    if (character == '\n' || character == '\r') {
      if (!serialOverflow && serialLine.length()) serialCommand(serialLine);
      serialLine = "";
      serialOverflow = false;
    } else if (serialOverflow) {
      continue;
    } else if (serialLine.length() < 100) {
      serialLine += character;
    } else {
      serialLine = "";
      serialOverflow = true; // Discard the whole overlong line, including its suffix.
    }
  }
}

void serviceSensor(uint32_t) {
  static uint32_t lastSample = 0;
  const egg_climate::State state = egg_climate::snapshot();
  sensorValid = state.valid;
  sensorAt = state.sampledAt;
  temperatureC = state.temperature;
  humidityPct = state.humidity;
  successes = state.successes;
  failures = state.failures;
  if (state.sampleNumber == lastSample) return;
  lastSample = state.sampleNumber;
  egg_climate::printState();
}

void serviceWifi(uint32_t now) {
  if (!identityReady) return;
  if (candidateQueued) {
    candidateQueued = false;
    candidateActive = true;
    candidateAt = now;
    WiFi.disconnect(false, false);
    candidateConnecting = false;
    return;
  }
  const bool connected = WiFi.status() == WL_CONNECTED;
  if (candidateActive) {
    // Observe the previous connection ending before trying even the same SSID.
    // Otherwise its old IP could be mistaken for successful new credentials.
    if (!candidateConnecting && !connected) {
      WiFi.begin(candidateWifi.ssid, candidateWifi.password);
      candidateConnecting = true;
      candidateAt = now;
      return;
    }
    if (connected && candidateConnecting && now - candidateAt >= 1000 &&
        WiFi.SSID() == candidateWifi.ssid && WiFi.localIP() != IPAddress(0, 0, 0, 0)) {
      if (saveBlob("egg-wifi", candidateWifi)) {
        savedWifi = candidateWifi;
        portalMessage = "New Wi-Fi connected and saved. You may close this page.";
        Serial.println("New Wi-Fi connected and saved. Pairing code unchanged.");
      } else {
        portalMessage = "Storage save failed. Previous saved network retained.";
        WiFi.disconnect(false, false); connectSaved();
      }
      candidateActive = false;
      candidateWifi = {};
      userActivityAt = now;
    } else if (now - candidateAt >= kConnectMs) {
      candidateActive = false;
      candidateWifi = {};
      WiFi.disconnect(false, false);
      connectSaved();
      portalMessage = "New connection failed. Previous saved network retained. Try again.";
      Serial.println("New Wi-Fi failed; restoring previous saved network.");
      userActivityAt = now;
    }
    return;
  }
  if (connected) {
    if (!previouslyConnected) {
      Serial.printf("Wi-Fi connected. Local IP: %s. Cloud service will connect when configured.\n", WiFi.localIP().toString().c_str());
      if (apActive) userActivityAt = now;
    }
    previouslyConnected = true;
    disconnectedAt = now;
    if (apActive && now - userActivityAt >= kPortalIdleMs) {
      setupDns.stop(); portal.stop(); WiFi.softAPdisconnect(true); WiFi.mode(WIFI_STA);
      apActive = false; csrfToken = "";
      Serial.println("Setup AP closed. Send setup to open it again.");
    }
  } else {
    if (previouslyConnected) { previouslyConnected = false; disconnectedAt = now; }
    if (savedWifi.ssid[0] && now - retryAt >= kRetryMs) connectSaved();
    if (!apActive && (!savedWifi.ssid[0] || now - disconnectedAt >= kRecoveryMs)) openPortal();
  }
}
} // namespace

void setup() {
  egg_climate::beginOutputs();
  Serial.begin(115200);
  delay(300);
  eggcelerate_display::begin();
  eggcelerate_oled::begin();
  if (!egg_climate::begin()) Serial.println("Climate control task could not start; outputs remain off.");
  Serial.println("CLIMATE: website Prepare -> stable targets -> load eggs -> confirm incubation. Authorized operation resumes after fresh sensor checks; manual Stop remains stopped.");
  initializeCloud();
  sensorAt = millis();
  WiFi.persistent(false); // Only our validated NVS blob commits Wi-Fi settings.
  WiFi.setAutoReconnect(false); // Reconnect timing is managed by loop().
  if (!WiFi.mode(WIFI_STA)) {
    Serial.println("Wi-Fi initialization failed. Restart before commissioning."); return;
  }
  radioReady = true;
  bool identityExists = false;
  bool wifiExists = false;
  const bool identityLoaded = loadBlob("egg-ident", identity, identityExists);
  const bool wifiLoaded = loadBlob("egg-wifi", savedWifi, wifiExists);
  storageReady = identityLoaded || identityExists;
  // Migrate only this board's original MAC-based ID; retain its fixed secrets.
  // Unknown IDs are never silently overwritten (including another embedded ID).
  if (identityLoaded && identityExists && validIdentityRecord(identity) &&
      String(identity.deviceId) == legacyHardwareId()) {
    Identity migrated = identity;
    memset(migrated.deviceId, 0, sizeof(migrated.deviceId));
    String(kDeviceId).toCharArray(migrated.deviceId, sizeof(migrated.deviceId));
    if (saveBlob("egg-ident", migrated)) {
      identity = migrated;
      Serial.printf("Saved device ID updated to %s. Pairing code and AP password retained.\n", kDeviceId);
    } else {
      Serial.println("Device ID migration failed. Saved identity retained; inspect storage before continuing.");
    }
  }
  // Pilot-only code migration. Keep record size, AP password and Wi-Fi unchanged.
  if (identityLoaded && identityExists && validIdentity(identity) &&
      String(kDeviceId) == "EGG-001" && validSecret(identity.code, 10)) {
    Identity migrated = identity;
    memset(migrated.code, 0, sizeof(migrated.code));
    String(kPairingCode).toCharArray(migrated.code, sizeof(migrated.code));
    if (saveBlob("egg-ident", migrated)) {
      identity = migrated;
      Serial.println("Pilot pairing code updated to EGG01. Wi-Fi and AP password retained.");
    } else Serial.println("Pairing code migration failed; previous code retained.");
  }
  // User-approved setup password change; preserve identity, pairing and router Wi-Fi.
  if (identityLoaded && identityExists && validIdentity(identity) &&
      strcmp(identity.apPassword, kSetupApPassword) != 0) {
    Identity migrated = identity;
    memset(migrated.apPassword, 0, sizeof(migrated.apPassword));
    strlcpy(migrated.apPassword, kSetupApPassword, sizeof(migrated.apPassword));
    if (saveBlob("egg-ident", migrated)) {
      identity = migrated;
      Serial.println("Setup Wi-Fi password updated and saved.");
    } else Serial.println("Setup password update failed; previous saved password retained.");
  }
  identityReady = identityLoaded && identityExists && validIdentity(identity);
  identityDamaged = identityExists && !identityReady;
  const bool wifiValid = wifiLoaded && (!wifiExists ||
    (savedWifi.magic == kWifiMagic && savedWifi.ssid[32] == '\0' && savedWifi.password[64] == '\0' && validPassword(String(savedWifi.password))));
  if (!wifiValid) { savedWifi = {}; Serial.println("Saved Wi-Fi unavailable. Reconfigure through setup."); }
  if (!storageReady) Serial.println("Identity storage could not be opened. Restart and inspect storage before commissioning.");
  portal.on("/", HTTP_GET, servePage);
  portal.on("/status", HTTP_GET, serveStatus);
  portal.on("/wifi", HTTP_POST, receiveWifi);
  // Android /generate_204, Apple /hotspot-detect.html, Windows /connecttest.txt
  // and other unknown HTTP probe paths must signal a portal rather than success.
  portal.onNotFound([]() {
    if (apActive && portal.method() == HTTP_GET) redirectToSetup();
    else if (localRequest()) portal.send(404, "text/plain", "Open http://10.10.10.10/");
  });
  disconnectedAt = millis();
  printIdentity();
  Serial.println("Serial commands: climate status/stop/reset, climate mode chicken|duck|quail, commission, status, setup, forget-wifi, restore CODE APPASSWORD");
  if (identityReady) {
    if (savedWifi.ssid[0]) connectSaved(); else openPortal();
  }
}

void loop() {
  serviceSensor(millis());
  serviceSerial();
  if (apActive) { setupDns.processNextRequest(); portal.handleClient(); }
  serviceWifi(millis());
  serviceCloud(millis());
  const uint32_t displayNow = millis();
  const bool serverOnline = cloudEnabled && WiFi.status() == WL_CONNECTED &&
    cloudMqtt.connected() && cloudHasReceipt && displayNow - cloudReceiptAt < 45000;
  eggcelerate_display::service(displayNow, sensorValid, sensorAt, temperatureC,
    humidityPct);
  eggcelerate_oled::service(displayNow, apActive, serverOnline, identityReady, identity.code);
  delay(2);
}
