# Relay and fan integration — revised hardware

> **Latest tray confirmation — October 15:** The installed motor is **220 V AC**,
> and the user confirms **90 degrees total rocking travel**. Earlier DC motor
> assumptions below are historical and superseded. Control remains relay IN2 /
> GPIO25 (LOW on / HIGH off); main firmware holds it off. Cycle duration,
> self-stop/continuous-power behavior and position/home feedback remain unknown.
> Use the [current handoff](../../docs/guide/capstone-next-phases-2026-10-15.md).


October 14: a separate [local two-fan MOSFET bench](mosfet-bench/README.md)
now contains a draft sketch and control page. Main pilot firmware still has no
actuator outputs. Confirm actual GPIO/trigger interfaces before arming the bench;
upload and physical acceptance are pending.

Recorded 2026-10-12 from the user's purchase screenshots and wiring revision.
This guide prepares later implementation; the main firmware still does not
drive relay or MOSFET outputs. Keep the working DHT22, LCD/OLED, setup and cloud
code as the baseline.


## Current decision — October 14 single-board revision

User now selected **one MakerLab 5 V four-channel board** for all four relay
loads; the two-channel board is spare. This supersedes the October 12 two-board
allocation below. User-corrected channel order: heater, tray, empty/reserved LED, mist.
Channel allocation is user-confirmed; GPIO wires remain proposed:

| Input | Load | GPIO | Relation to original schematic |
| --- | --- | --- | --- |
| IN1 | Heater | 27 | Originally IN3; retains heater GPIO |
| IN2 | DC tray motor enable | 25 | Originally IN1/GPIO12; GPIO25 still proposed |
| IN3 | Empty / reserved 12 V LED light | 26 reserved | Leave disconnected/disabled for now |
| IN4 | Mist maker | 14 | Originally IN2; retains mist GPIO |

Seller lists 10 A at 250 V AC / 28 V DC contacts and 5 V control for this variant.
This is per-relay contact information, not an aggregate board-current guarantee.
The explicit 3.3 V compatibility claim in the supplied text is for the eight-
channel variant; four-channel trigger compatibility/polarity remain unconfirmed.
See [the current relay reference](hardware/relay-reference.md) before testing.
The remaining two-board tables/circuit example below are historical October 12
planning; follow the current single-board table above for the next bench work.

## 1. Historical October 12 component allocation

| Module | User's selected variant | Loads assigned by user |
| --- | --- | --- |
| Relay board A | MakerLab **5 V, 2-channel**, with optocouplers | Heater and mist maker |
| Relay board B | MakerLab **5 V, 4-channel**, with optocouplers | Egg tray DC rotation motor and **12 V LED light**; two channels unused unless motor direction requires them |
| MOSFET modules ×2 | Listing: **15 A / 400 W trigger switch / PWM module** | Two fans from the original schematic |

The 5 V relay rating is the board/coil supply rating; it does not establish that
its IN pins accept ESP32 3.3 V logic or that all variants have the same trigger
polarity. Optocouplers do not establish isolation with the installed jumpers and
grounds. Identify VCC/JD-VCC/GND/IN labels and HIGH/LOW selection from photos of
the actual boards before choosing an interface circuit.

The earlier schematic used one relay board for motor, mist and heater and
labelled the motor 220AC. The user now describes a **DC tray motor** on the
four-channel board. Treat that motor label and old relay channel numbers as
superseded; motor voltage, current and motion arrangement are still unknown.

## 2. Proposed GPIO plan — confirm actual wires before coding outputs

This preserves the original heater/mist/fan GPIOs where possible. The tray
GPIO25 and light GPIO26 are proposals, not claims about existing physical wires.

| Module / channel | Load | Proposed ESP32 GPIO | Relation to old drawing |
| --- | --- | --- | --- |
| A: 2-channel IN1 | Heater | **27** | Heater keeps GPIO27; previously drawn at IN3 |
| A: 2-channel IN2 | Mist maker | **14** | Mist keeps GPIO14 |
| B: 4-channel IN1 | Tray motor enable | **25** | Proposed replacement for old GPIO12 |
| B: 4-channel IN2 | 12 V LED light | **26** | New light assignment; supersedes earlier spare-IN4 proposal |
| B: IN3 / IN4 | Reserved | Unassigned | Do not wire until motor direction/other use is established |
| Upper fan MOSFET | Upper fan | **19** | Original schematic |
| Lower fan MOSFET | Lower fan | **18** | Original schematic |

Existing signals remain DHT22 DATA **GPIO4**, I²C SDA **GPIO21**, SCL **GPIO23**.
GPIO12 is avoided in the proposed revision because its reset level affects
classic ESP32 flash supply selection. See [Espressif's GPIO12 explanation](https://docs.espressif.com/projects/esp-idf/en/v5.5-rc1/esp32/api-reference/peripherals/sd_pullup_requirements.html).
If the tray is already wired to GPIO12, record that fact and resolve the input
pull-up/boot behavior before choosing to retain it or physically move it.

## 3. Wiring information to collect

### Relay boards

- Photograph front/back and power/input headers on each actual board. Record
  active HIGH/LOW, jumper positions and ESP32 logic compatibility separately
  for the two boards.
- Supply relay coils from the appropriate 5 V supply, not a GPIO pin. Use the
  manufacturer's verified logic interface and ground/isolation arrangement;
  do not allow a 5 V IN pull-up to drive an ESP32 GPIO.
- Confirm each channel's COM/NO/NC terminal labels. Use a verified default-off
  arrangement for heater, mist, motor and light; do not assume terminal order.
- Record actual load ratings and contact suitability, including the DC motor's
  starting/stall current and inductive suppression. The advertised 10 A label
  alone does not qualify every load and supply combination.
- Keep relay switching as on/off control. Do not use rapid PWM on mechanical
  relay channels to dim the light or vary heater/motor speed.

For the confirmed **12 V LED light**, the intended default-off contact path is:

```text
12 V load supply + → suitable fuse → B channel 2 COM
B channel 2 NO     → LED light +
LED light −       → 12 V load supply −
```

This uses relay contacts to switch the light's 12 V supply; the relay board's
own supply remains its specified 5 V. Confirm the actual terminal labels, light
current and switching ratings before wiring. Do not use a solderless breadboard
for heater, motor or other high-current load paths; use suitable terminals and
conductors. The unspecified DC motor requires its own confirmed circuit.

### Tray motor

Record voltage, running/stall current, gear reduction and the mechanical motion:

1. Is it a one-direction motor driving a crank, or must it reverse between angles?
2. Are there limit switches or another position signal?
3. What defines a completed turn and the maximum allowed run duration?

A single relay channel only enables/disables power; it does not reverse a DC
motor or report position. If reversal is required, choose and document a suitable
motor driver/relay arrangement before assigning B's remaining channels. Do not
invent a turn duration or enable unattended motion without a confirmed stop rule.

### Fan MOSFETs

October 14 identification: user supplied the Wangzm purchase image of the blue
dual-MOSFET **HW-517** module and its seller description: DC 5 to 36 V supply,
DC 3.3 to 20 V trigger, PWM input up to 20 kHz, advertised 15 A / 400 W at room
temperature. Treat these as listing specifications; actual terminal labels,
HIGH-on polarity, reset behavior and fan compatibility still need bench evidence.
The [bench guide](mosfet-bench/README.md) records this identification. Supply PWM
remains disabled pending the fan's model/wire count and supported frequency.

- Confirm the actual module's power input, switched load terminals, trigger
  input and ground labels, and that 3.3 V control is supported.
- The schematic feeds fan power through MOSFET modules; Tach and fan PWM pins
  are unused. Thus there is no confirmed RPM feedback and no direct fan-PWM
  input connection yet.
- Start later integration with a verified full-on/full-off fan path. Supply
  chopping for speed control must be supported by the actual fan; do not assume
  it is equivalent to controlling a four-wire fan's dedicated PWM terminal.
- Determine suitable PWM frequency, startup duty and minimum running duty from
  the fan/module specifications and measured operation before enabling speed.
- Arduino ESP32 core 3.x uses `ledcAttach(pin, frequency, resolution)` and
  `ledcWrite(pin, duty)`; use the installed core's API rather than old channel-based
  examples. [Espressif Arduino LEDC API](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/ledc.html).

## 4. Later firmware structure

Extend `Eggcelerate/Eggcelerate.ino`; keep earlier phase sketches for fallback.

- **Hardware configuration:** one confirmed pin map, relay active levels,
  MOSFET polarity, load limits and safe startup states. Document proposals until
  verified; don't initialize a proposed output simply because a pin is listed.
- **Actuator service:** logical `heaterOn`, `mistOn`, `lightOn`, fan duty and
  bounded tray motion. Centralize polarity conversion and stop logic.
- **Local controller:** reuse the existing DHT22 sample and timestamps, with
  stateful hysteresis and relay minimum switching intervals. Do not read the
  sensor again per component or use dashboard gauge colors as control logic.
- **Lifecycle state:** idle → preparing → ready to load → incubating. Preparing
  controls conditions without advancing incubation time or turning empty trays.
  Starting after eggs are loaded enables the confirmed turn schedule.
- **Cloud configuration:** validated/persisted mode targets and lifecycle updates
  must reach the ESP32 and be acknowledged. The dashboard's preparation feature
  currently monitors manual control; it does not deliver actuator setpoints yet.
- **Actual output reporting:** publish applied relay/fan state and last command
  result. Don't infer 'heater on' just because measured temperature is low.

The current hardware MQTT worker is sensors-only and does not dispatch actuator
commands. Enabling server control is a separate stage with authorization,
validation, idempotency, acknowledgements and timeout behavior. Existing MQTT
transport can carry both directions; relay/MOSFET components do not need new
public network ports.

## 5. Control and fault behavior to qualify

- Establish safe output levels in hardware during boot/reset, before firmware
  can run; then initialize firmware outputs off before arming control.
- Heater and mist remain off until valid recent sensor readings and confirmed
  targets are available. On sensor failure, turn them off rather than keeping
  the last output energized. Bound tray runs and fail them off on a fault.
- Confirm independent heater over-temperature protection and a local cutoff.
  Existing [safety contract](../../docs/guide/firmware-safety-contract.md) values
  are provisional, not evidence of hardware qualification.
- Define fan behavior under overheating and sensor faults for the actual
  hardware; do not apply a blanket 'all outputs off' rule to required cooling.
- Water checking is manual in this project. Before arming the mist maker,
  confirm water availability and its built-in dry-run protection; a manual
  reminder is not a water-level sensor interlock.
- Keep validated local environmental control working through Wi-Fi/VPS loss.
  OLED Online/Offline is delivery status and must not directly enable/disable
  the heater. No cloud-dependent safety loop.
- Use timed state machines, not blocking motor delays, so sensor sampling,
  displays, setup portal and telemetry remain responsive.

## 6. Planned phase order

1. Confirm module labels, voltages, active levels, pin wires and tray mechanics.
2. Prepare an isolated manual output bring-up phase with loads disconnected:
   verify each channel and boot/reset state; then qualify one actual load at a time.
3. Add bounded manual LED control and verified fan switching.
4. Add local heater/mist control and fault behavior with confirmed targets.
5. Add tray motion, position/timeout handling and lifecycle turning rules.
6. Add server commands, device ACKs and real applied-state telemetry, then link
   automatic control to the existing preparation/start workflow.

Record results before enabling each output in the main firmware. This document
does not run tests, flash the board, revise the physical wiring, or enable outputs.
