#pragma once

// Copy this file to config.h in this directory and fill in real values.
// Never commit config.h; it contains network and broker credentials.

static const char WIFI_SSID[] = "your-wifi-name";
static const char WIFI_PASSWORD[] = "your-wifi-password";

// Use the VPS MQTT DNS name covered by its TLS certificate, not its IP address.
static const char MQTT_HOST[] = "mqtt.example.com";
static constexpr uint16_t MQTT_PORT = 8883;
static const char MQTT_USERNAME[] = "device-specific-user";
static const char MQTT_PASSWORD[] = "device-specific-password";

// These IDs must match a device registered and assigned to this chamber in
// EGGCELERATE. Device IDs use letters, numbers, underscores, and hyphens.
static const char DEVICE_ID[] = "EGG-1003";
static const char INCUBATOR_ID[] = "chamber-1";

// Paste the trusted root CA certificate for the broker's TLS certificate.
// Keep the BEGIN/END lines and replace the placeholder with the real PEM body.
static const char MQTT_ROOT_CA[] = R"PEM(-----BEGIN CERTIFICATE-----
PASTE_THE_TRUSTED_ROOT_CA_CERTIFICATE_HERE
-----END CERTIFICATE-----
)PEM";
