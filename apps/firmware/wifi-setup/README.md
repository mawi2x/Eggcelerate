# Phases 1–2: fixed identity and local Wi-Fi setup

Open **`wifi-setup.ino`** in Arduino IDE. `SetupFirmware.h` is its implementation
tab and must stay in the same folder. Keep the previous `dht22-local` sketch as
your sensor-only fallback. DHT22 DATA remains on **GPIO4**.

## Upload and first setup

1. Select **NodeMCU-32S** and the attached USB port as in the working sensor check.
2. Keep the installed **DHT sensor library by Adafruit** and **Adafruit Unified
   Sensor**. WiFi, WebServer, and Preferences come with the ESP32 board package.
3. Upload with flash erasure disabled so saved configuration survives later updates.
4. Open Serial Monitor at **115200 baud**, selecting **Newline** or **Both NL & CR**.
5. For this new, not-yet-enrolled board, send **`commission`** once.
6. Serial prints the permanent device ID, fixed pairing code, setup network name,
   and separate AP password. Save these in your private commissioning record.
7. On your phone, join **`Eggcelerate-Setup-…`** using the printed AP password.
   Choose to stay connected if the phone says this network has no internet.
8. Open **http://192.168.4.1** in the phone browser. Automatic captive-portal popup
   is not implemented; use this address directly. Disable mobile-data switching
   temporarily if your phone keeps leaving the setup network.
9. Enter your **2.4 GHz** Wi-Fi name and password. Submit **Connect and save**.
   Allow up to 25 seconds. AP/STA channel changes may briefly disconnect the phone;
   reconnect to setup Wi-Fi and reload the page if necessary.
10. Expect **New Wi-Fi connected and saved** in Serial/page status. The AP closes
    after two minutes without a page visit/submission while home Wi-Fi is connected.
    Sensor polling does not keep the AP open indefinitely.

No VPS details belong in this sketch yet. Its pairing code is prepared for later
server enrollment; entering it in the current dashboard is not a supported claim flow.
Connecting to home Wi-Fi does not establish cloud connectivity.

## Serial commands

| Command | Behavior |
| --- | --- |
| `status` | Print identity/setup credentials and sensor/network state |
| `setup` | Open/reopen the protected setup AP |
| `forget-wifi` | Clear saved home Wi-Fi only, preserving identity/code/AP password |
| `commission` | Generate and persist identity/secrets only when none exist |
| `restore RAWCODE APPASSWORD` | Restore original credentials from the private record when identity storage is missing/damaged |

Restore uses the ungrouped 10-character code and 16-character AP password. Existing
valid identity cannot be overwritten by `commission` or `restore`. If flash was
erased on a previously enrolled board, use its original record instead of creating
a replacement code. This sketch cannot distinguish a factory-new board from one
whose entire storage was erased; commissioning therefore requires an explicit command.

## Delivered behavior and limits

- Random code/password generation with Wi-Fi active; separate public hardware ID.
- Identity and Wi-Fi each saved as one NVS record, with read-back verification.
- Home credentials committed only after the candidate network obtains an IP.
- Failed new credentials preserve and retry the previous saved network.
- Sensor sampling every 2.5 seconds alongside portal and bounded reconnect attempts.
- Saved-network failure exposes setup after 30 seconds; no saved network opens
  setup immediately once commissioned.
- Setup page bound to the AP IP; host checks, escaped page content, no credential
  JSON, no-cache responses, and a per-AP form token.
- Secret Wi-Fi passwords are not printed by this sketch or sent to a server.

Implementation has been reviewed against the installed ESP32 3.3.11 API headers.
It has not been compiled or flashed here: Arduino CLI is not available on PATH.
Reboot persistence, phone compatibility, sensor sampling during requests, and
connection rollback still require bench evidence. Initial source delivery does
not close the phase acceptance gates.

The 15-minute unconfirmed-upload trigger, actual database receipts, dashboard
claims, physical setup button, OLED/LCD, offline queue, and actuator control are
later phases. NVS is ordinary local storage here, not a claim of encrypted or
tamper-resistant device storage.

## First bench observations to send back

Report whether the AP appears, the phone opens the page, your home Wi-Fi connects,
and DHT22 readings continue. After a power cycle, confirm that the pairing code
is unchanged and home Wi-Fi reconnects. A failed replacement-password attempt
should retain the previously saved network. Do not include real passwords or
the complete pairing code in shared screenshots.

References: [phase plan](../phase-plan.md),
[Espressif Preferences](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/preferences.html),
[Espressif Wi-Fi API](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/wifi.html).
