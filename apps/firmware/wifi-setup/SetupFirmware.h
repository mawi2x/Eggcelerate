#pragma once
// EGGCELERATE Phases 1-2 bench firmware. DHT22 DATA -> GPIO4.
// Install Adafruit DHT sensor library and Adafruit Unified Sensor.
// No VPS configuration required. Serial Monitor: 115200 baud, Newline.
#include <Arduino.h>
#include <DHT.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include <esp_random.h>
#include <ctype.h>
#include <math.h>
#include <string.h>

namespace {
constexpr uint32_t kIdentityMagic = 0x45474731;
constexpr uint32_t kWifiMagic = 0x57494631;
constexpr uint32_t kSensorMs = 2500;
constexpr uint32_t kConnectMs = 25000;
constexpr uint32_t kRetryMs = 10000;
constexpr uint32_t kRecoveryMs = 30000;
constexpr uint32_t kPortalIdleMs = 120000;
constexpr char kAlphabet[] = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const IPAddress kPortalIp(192, 168, 4, 1);

// Each configuration is one NVS blob: interrupted saves cannot mix fields.
struct Identity {
  uint32_t magic;
  char deviceId[17]; // EGG- + 12 hex MAC digits + terminator
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
DHT dht(4, DHT22);
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

String hardwareId() {
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

bool validIdentity(const Identity &value) {
  return value.magic == kIdentityMagic && value.deviceId[16] == '\0' &&
    value.code[10] == '\0' && value.apPassword[16] == '\0' &&
    String(value.deviceId) == hardwareId() && validSecret(value.code, 10) &&
    validSecret(value.apPassword, 16) && String(value.apPassword).indexOf(value.code) < 0;
}

String groupedCode() {
  return String(identity.code).substring(0, 5) + "-" + String(identity.code).substring(5);
}

void printIdentity() {
  if (!identityReady) {
    Serial.println(identityDamaged ? "Identity storage needs controlled restore." :
      "Not commissioned. First board setup: send commission. Previously enrolled board: restore from your record.");
    return;
  }
  Serial.printf("Device ID: %s\nFixed pairing code: %s\nSetup Wi-Fi: Eggcelerate-Setup-%s\nAP password: %s\n",
    identity.deviceId, groupedCode().c_str(), String(identity.deviceId).substring(10).c_str(), identity.apPassword);
  Serial.println("Keep this commissioning record private. Dashboard pairing is not connected yet.");
}

String escapeHtml(String value) {
  value.replace("&", "&amp;"); value.replace("<", "&lt;");
  value.replace(">", "&gt;"); value.replace("\"", "&quot;");
  value.replace("'", "&#39;");
  return value;
}

bool localRequest() {
  const String host = portal.hostHeader();
  if (apActive && (host == "192.168.4.1" || host == "192.168.4.1:80")) return true;
  portal.send(403, "text/plain", "Use http://192.168.4.1 while connected to the setup Wi-Fi.");
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
  page += "<p>Device: " + escapeHtml(identity.deviceId) + "<br>Fixed pairing code: <code>" + groupedCode() + "</code></p>";
  page += F("<small>Keep your code private. Dashboard pairing will be available after server integration.</small><p id='status' role='status'>");
  page += escapeHtml(portalMessage) + "</p><p id='sensor'>Waiting for a sensor reading...</p>";
  page += "<form method='post' action='/wifi'><input type='hidden' name='token' value='" + csrfToken + "'>";
  page += "<label for='ssid'>Wi-Fi name (2.4 GHz)</label><input id='ssid' name='ssid' maxlength='32' required value='" + escapeHtml(savedWifi.ssid) + "'>";
  page += F("<label for='password'>Wi-Fi password</label><input id='password' name='password' type='password' maxlength='64' autocomplete='new-password'><small>Leave blank only for an open network.</small><button type='submit'>Connect and save</button></form><p>Details stay on this incubator. If connection fails, your previous saved network is retained.</p><small>After connection, setup closes after two minutes without a page visit or submission. Serial command: setup.</small><script>async function refresh(){try{const r=await fetch('/status',{cache:'no-store'});const s=await r.json();document.getElementById('status').textContent=s.message+(s.connected?' Connected to Wi-Fi. VPS connection is not configured yet.':'');document.getElementById('sensor').textContent=s.sensorValid?'Temperature: '+s.temperature.toFixed(1)+' °C | Humidity: '+s.humidity.toFixed(1)+'% RH':'Sensor reading unavailable; check wiring.';}catch(e){document.getElementById('status').textContent='Setup page disconnected. Reconnect to the setup Wi-Fi if needed.';}}setInterval(refresh,3000);refresh();</script></main></html>");
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
  data += "}";
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
  portal.sendHeader("Location", "http://192.168.4.1/");
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
    const String ssid = "Eggcelerate-Setup-" + String(identity.deviceId).substring(10);
    if (!WiFi.softAP(ssid.c_str(), identity.apPassword)) {
      WiFi.softAPdisconnect(true); WiFi.mode(WIFI_STA);
      Serial.println("Could not start setup AP. Send setup to retry."); return;
    }
    csrfToken = randomSecret(32);
    portal.begin();
    apActive = true;
  }
  userActivityAt = millis();
  printIdentity();
  Serial.println("Connect to setup Wi-Fi, keep connected without internet, then open http://192.168.4.1");
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
  hardwareId().toCharArray(next.deviceId, sizeof(next.deviceId));
  const String pairing = code.length() ? code : randomSecret(10);
  String access = apPassword.length() ? apPassword : randomSecret(16);
  while (!apPassword.length() && access.indexOf(pairing) >= 0) access = randomSecret(16);
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
  if (command == "status") {
    printIdentity();
    Serial.printf("Sensor OK: %lu | Failed: %lu | Wi-Fi: %s | Setup AP: %s\n",
      static_cast<unsigned long>(successes), static_cast<unsigned long>(failures),
      WiFi.status() == WL_CONNECTED ? "connected" : "disconnected", apActive ? "open" : "closed");
  } else if (command == "commission") {
    commission();
  } else if (command.startsWith("restore ")) {
    const int split = command.indexOf(' ', 8);
    if (split < 0) { Serial.println("Use restore RAW10CHARCODE AP16CHARPASSWORD from your commissioning record."); return; }
    const String code = command.substring(8, split);
    const String password = command.substring(split + 1);
    if (code.length() != 10 || password.length() != 16) {
      Serial.println("Restore needs the original ungrouped 10-character code and 16-character AP password."); return;
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

void serviceSensor(uint32_t now) {
  if (now - sensorAt < kSensorMs) return;
  sensorAt = now;
  humidityPct = dht.readHumidity();
  temperatureC = dht.readTemperature();
  sensorValid = isfinite(humidityPct) && isfinite(temperatureC) && humidityPct >= 0 && humidityPct <= 100;
  if (!sensorValid) { ++failures; Serial.println("DHT22 read failed. Check GPIO4, supply, and GND."); return; }
  ++successes;
  Serial.printf("Temperature: %.1f C | Humidity: %.1f %% RH | OK: %lu | Failed: %lu\n",
    temperatureC, humidityPct, static_cast<unsigned long>(successes), static_cast<unsigned long>(failures));
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
      Serial.printf("Wi-Fi connected. Local IP: %s. VPS not configured yet.\n", WiFi.localIP().toString().c_str());
      if (apActive) userActivityAt = now;
    }
    previouslyConnected = true;
    disconnectedAt = now;
    if (apActive && now - userActivityAt >= kPortalIdleMs) {
      portal.stop(); WiFi.softAPdisconnect(true); WiFi.mode(WIFI_STA);
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
  Serial.begin(115200);
  delay(300);
  dht.begin();
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
  identityReady = identityLoaded && identityExists && validIdentity(identity);
  identityDamaged = identityExists && !identityReady;
  const bool wifiValid = wifiLoaded && (!wifiExists ||
    (savedWifi.magic == kWifiMagic && savedWifi.ssid[32] == '\0' && savedWifi.password[64] == '\0' && validPassword(String(savedWifi.password))));
  if (!wifiValid) { savedWifi = {}; Serial.println("Saved Wi-Fi unavailable. Reconfigure through setup."); }
  if (!storageReady) Serial.println("Identity storage could not be opened. Restart and inspect storage before commissioning.");
  portal.on("/", HTTP_GET, servePage);
  portal.on("/status", HTTP_GET, serveStatus);
  portal.on("/wifi", HTTP_POST, receiveWifi);
  portal.onNotFound([]() { if (localRequest()) portal.send(404, "text/plain", "Open http://192.168.4.1/"); });
  disconnectedAt = millis();
  printIdentity();
  Serial.println("Serial commands: commission, status, setup, forget-wifi, restore CODE APPASSWORD");
  if (identityReady) {
    if (savedWifi.ssid[0]) connectSaved(); else openPortal();
  }
}

void loop() {
  serviceSensor(millis());
  serviceSerial();
  if (apActive) portal.handleClient();
  serviceWifi(millis());
  delay(2);
}
