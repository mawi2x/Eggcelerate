// Simple DHT22 -> VPS MQTT connectivity checker.
// Configure test/config.h from config.example.h before flashing.

#include <DHT.h>
#include <math.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <time.h>

#include "config.h"

#define DHTPIN 4
#define DHTTYPE DHT22

namespace {
constexpr uint32_t kPublishIntervalMs = 15000;
constexpr uint32_t kReconnectIntervalMs = 5000;
constexpr uint32_t kClockSyncTimeoutMs = 30000;
constexpr int64_t kMinimumValidEpoch = 1704067200;  // 2024-01-01 UTC

DHT dht(DHTPIN, DHTTYPE);
WiFiClientSecure tlsClient;
PubSubClient mqtt(tlsClient);

char telemetryTopic[160];
char clientId[96];
char bootId[64];
char bootedAt[25];
uint32_t sequenceNumber = 0;
uint32_t lastPublishMs = 0;
uint32_t lastMqttAttemptMs = 0;
uint32_t lastWifiAttemptMs = 0;
bool bootIdentityReady = false;
bool hasAttemptedPublish = false;

bool formatUtc(int64_t epoch, char *output, size_t outputSize) {
  time_t value = static_cast<time_t>(epoch);
  struct tm utcTime;
  if (gmtime_r(&value, &utcTime) == nullptr) {
    return false;
  }
  return strftime(output, outputSize, "%Y-%m-%dT%H:%M:%SZ", &utcTime) > 0;
}

bool clockIsValid() {
  return static_cast<int64_t>(time(nullptr)) >= kMinimumValidEpoch;
}

bool initializeBootIdentity() {
  if (!clockIsValid()) {
    return false;
  }

  const int64_t now = static_cast<int64_t>(time(nullptr));
  if (!formatUtc(now, bootedAt, sizeof(bootedAt))) {
    return false;
  }

  const uint64_t chipId = ESP.getEfuseMac() & 0xFFFFFFFFFFFFULL;
  snprintf(
      bootId,
      sizeof(bootId),
      "%012llX-%lu",
      static_cast<unsigned long long>(chipId),
      static_cast<unsigned long>(now));
  bootIdentityReady = true;
  Serial.printf("Boot identity: %s at %s\n", bootId, bootedAt);
  return true;
}

void keepWifiConnected() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  const uint32_t nowMs = millis();
  if (nowMs - lastWifiAttemptMs < kReconnectIntervalMs) {
    return;
  }
  lastWifiAttemptMs = nowMs;
  Serial.println("Wi-Fi disconnected; reconnecting...");
  WiFi.reconnect();
}

bool keepMqttConnected() {
  if (mqtt.connected()) {
    return true;
  }
  if (WiFi.status() != WL_CONNECTED || !clockIsValid()) {
    return false;
  }

  const uint32_t nowMs = millis();
  if (nowMs - lastMqttAttemptMs < kReconnectIntervalMs) {
    return false;
  }
  lastMqttAttemptMs = nowMs;

  Serial.printf(
      "Connecting to MQTT at %s:%u...\n",
      MQTT_HOST,
      static_cast<unsigned>(MQTT_PORT));
  if (!mqtt.connect(clientId, MQTT_USERNAME, MQTT_PASSWORD)) {
    Serial.printf("MQTT connection failed (state %d).\n", mqtt.state());
    return false;
  }

  Serial.println("MQTT connected.");
  return true;
}

void publishReading() {
  const float humidity = dht.readHumidity();
  const float temperature = dht.readTemperature();
  const uint32_t nowMs = millis();
  lastPublishMs = nowMs;
  hasAttemptedPublish = true;

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("DHT22 read failed. Check the wiring and pin.");
    return;
  }
  if (humidity < 0.0f || humidity > 100.0f) {
    Serial.println("DHT22 humidity is outside the server's accepted range.");
    return;
  }

  const int64_t observedEpoch = static_cast<int64_t>(time(nullptr));
  char observedAt[25];
  if (!formatUtc(observedEpoch, observedAt, sizeof(observedAt))) {
    Serial.println("Could not format the UTC observation time.");
    return;
  }

  char payload[384];
  char temperatureText[16];
  char humidityText[16];
  dtostrf(temperature, 0, 2, temperatureText);
  dtostrf(humidity, 0, 2, humidityText);
  const int payloadLength = snprintf(
      payload,
      sizeof(payload),
      "{\"schema_v\":1,\"device_id\":\"%s\",\"incubator_id\":\"%s\","
      "\"boot_id\":\"%s\",\"booted_at\":\"%s\",\"seq\":%lu,"
      "\"observed_at\":\"%s\",\"temperature_c\":%s,"
      "\"humidity_pct\":%s,\"battery_pct\":100,\"power_source\":\"grid\"}",
      DEVICE_ID,
      INCUBATOR_ID,
      bootId,
      bootedAt,
      static_cast<unsigned long>(++sequenceNumber),
      observedAt,
      temperatureText,
      humidityText);

  if (payloadLength <= 0 || static_cast<size_t>(payloadLength) >= sizeof(payload)) {
    Serial.println("Telemetry payload formatting failed.");
    return;
  }

  Serial.printf("Publishing to %s: %s\n", telemetryTopic, payload);
  if (mqtt.publish(telemetryTopic, payload, false)) {
    Serial.println("MQTT publish sent (QoS 0; broker/database receipt is not confirmed).");
  } else {
    Serial.println("MQTT publish failed; it will retry on the next interval.");
  }
}
}  // namespace

void setup() {
  Serial.begin(115200);
  delay(300);
  dht.begin();

  snprintf(
      telemetryTopic,
      sizeof(telemetryTopic),
      "eggcelerate/v1/devices/%s/telemetry",
      DEVICE_ID);
  snprintf(clientId, sizeof(clientId), "eggcelerate-%s", DEVICE_ID);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("Connecting to Wi-Fi '%s'", WIFI_SSID);
  const uint32_t wifiStartMs = millis();
  while (WiFi.status() != WL_CONNECTED &&
         millis() - wifiStartMs < kClockSyncTimeoutMs) {
    delay(250);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("Wi-Fi connected; IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("Wi-Fi is not connected yet; reconnect will continue in loop().");
  }

  configTime(0, 0, "pool.ntp.org", "time.google.com");
  Serial.println("Waiting for a valid UTC clock for TLS and telemetry timestamps...");
  const uint32_t clockStartMs = millis();
  while (!clockIsValid() && millis() - clockStartMs < kClockSyncTimeoutMs) {
    delay(250);
  }
  if (!clockIsValid()) {
    Serial.println("Clock is not synchronized yet; MQTT will wait for NTP.");
  }

  tlsClient.setCACert(MQTT_ROOT_CA);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(512);
  mqtt.setKeepAlive(30);
  mqtt.setSocketTimeout(5);
}

void loop() {
  keepWifiConnected();
  if (WiFi.status() != WL_CONNECTED) {
    delay(10);
    return;
  }

  if (!clockIsValid()) {
    delay(10);
    return;
  }
  if (!bootIdentityReady && !initializeBootIdentity()) {
    delay(10);
    return;
  }

  if (!keepMqttConnected()) {
    delay(10);
    return;
  }
  mqtt.loop();

  const uint32_t nowMs = millis();
  if (!hasAttemptedPublish || nowMs - lastPublishMs >= kPublishIntervalMs) {
    publishReading();
  }
  delay(10);
}
