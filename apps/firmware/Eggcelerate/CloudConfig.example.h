#pragma once
#include <stdint.h>

// Copy to CloudConfig.h beside Eggcelerate.ino and fill in the actual broker
// settings locally. CloudConfig.h is ignored by Git. Blank settings disable cloud uploads. Complete all four strings to enable
// verified TLS uploads in the main sketch. Never use setInsecure().
// Users configure only home Wi-Fi in the setup portal and enter their fixed
// pairing code in the dashboard. These are developer/commissioning settings.
namespace EggCloudConfig {
// Recorded from the user's VPS screenshot, not a verified MQTT endpoint.
static constexpr char VPS_PUBLIC_IP[] = "4.193.224.4";

// Actual TLS hostname, listener port, individual device credentials, and CA.
// An IP is usable only if the broker certificate explicitly covers that IP.
static constexpr char MQTT_HOST[] = "";
static constexpr uint16_t MQTT_PORT = 8883; // Proposed TLS port; confirm on VPS.
static constexpr char MQTT_USERNAME[] = "";
static constexpr char MQTT_PASSWORD[] = "";
static constexpr char MQTT_ROOT_CA[] = "";

// Do not put home Wi-Fi, a farm ID, chamber ID, or pairing code here.
// Wi-Fi and the fixed code remain in the existing persistent device storage.
// Cloud assignment must be resolved from authenticated device enrollment.
} // namespace EggCloudConfig
