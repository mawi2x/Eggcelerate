# Relay reference and initial bench sequence

Recorded October 14, 2026. User selected relay testing after reporting successful
MOSFET/fan operation. Latest October 14: user reports both relays and MOSFETs
are working after the enabled LOW-trigger relay bench revision.

## Current decision — one four-channel board

October 14: user selected the **MakerLab 5 V four-channel SPDT relay board**
for heater, mist, DC tray motor and 12 V light. The purchased 5 V two-channel
board is spare; this supersedes the earlier two-board allocation.

User confirmed the channel sequence below, interpreted as IN1 through IN4.
The enabled bench uses GPIO27/25/14 for IN1/IN2/IN4. User reports all relay
controls working with this setup; IN3 remains empty/reserved.

| Four-channel board input | User's channel allocation | Proposed GPIO | Original schematic |
| --- | --- | --- | --- |
| IN1 | Heater | **27** | Heater was IN3 / GPIO27 |
| IN2 | DC tray motor enable | **25** | Motor was IN1 / GPIO12; GPIO25 move still proposed |
| IN3 | Empty, reserved for 12 V LED light | **26 reserved** | New light; leave channel unconnected/disabled for now |
| IN4 | Mist maker | **14** | Mist was IN2 / GPIO14 |

This supersedes the assistant's earlier proposed motor/mist/heater/light order.
IN3 is physically described as empty by the user and is not an active light
output. The future light pin is reserved, not confirmed as wired.

User confirmed GPIO18/19 for the MOSFETs, not these relay wires. Keep GPIO4 for
DHT22 and GPIO21/23 for the shared display bus reserved. Do not reuse GPIO18/19
for relays while the fan triggers remain connected. With IN3 reserved for the light, motor reversal requiring extra contacts would
need a revised driver plan; one channel provides enable/disable only.

## Purchased hardware and seller specifications

Purchase screenshot identifies MakerLab variants **5 V – 2 Channel** and
**5 V – 4 Channel**, one of each. The seller states the four-channel module has:

| Property | Seller-stated specification |
| --- | --- |
| Relay type | Four individually controlled SPDT relays |
| Supply/control listing | 5 V |
| Contact rating | 10 A at 250 V AC; 10 A at 28 V DC |
| Features | Optocouplers and indicator LEDs |
| Variation note | PCB color/layout may vary |

The 10 A contact specification applies to each relay at the listed voltage/load
conditions. It does not qualify the board as a 40 A assembly or establish the
ratings of common wiring, PCB traces, terminals or the PSU. Verify actual relay
markings/model and load-specific contact ratings before load tests. Motor
startup/stall current and inductive switching requirements need separate review.
General reference: [OMRON relay contact/load guidance](https://components.omron.com/eu-en/products/basic-knowledge/relays/applications).

The seller's explicit **3.3 V/5 V logic compatibility** claim belongs to the
**eight-channel variant** in the supplied description. The four-channel section
only says **5 V control voltage**. Therefore this text does not establish safe
direct ESP32 3.3 V input compatibility or HIGH/LOW polarity for the purchased
four-channel board. Identify its actual input circuit/jumpers before wiring it.
Optocouplers alone do not establish isolation with installed power jumpers.

## Required before preparing enabled relay outputs

- Select the board being tested and record actual IN-to-GPIO wires.
- Identify board power headers, jumpers, HIGH/LOW trigger selection and polarity.
- Establish whether the input interface accepts ESP32 3.3 V signals without
  exposing its GPIO to a 5 V pull-up. Coil voltage alone does not establish this.
- Confirm relay-board supply and ground/isolation arrangement from the actual
  board; do not assume the MOSFET ground arrangement applies to every relay board.
- Confirm reset/default-off behavior and contact COM/NO/NC labels.

## First test — relay coils and contacts only

1. Disconnect load power and remove heater/mist/motor/light connections from
   relay contacts. Keep unrelated fan load power off while swapping sketches.
2. Confirm the input interface above, then supply the relay board at its rated
   5 V from the appropriate supply. Do not power relay coils from GPIO pins.
3. Use a relay-specific sketch with confirmed pins/polarity and outputs initially
   inactive. The MOSFET sketch drives only GPIO18/19 and cannot test these relays.
4. Arm manually; energize one channel briefly, listen for its click, then turn
   it off. Verify the corresponding channel changes, with no chatter or reset.
5. With the contacts isolated from all load supplies, use a continuity meter
   if available to check COM–NO closes and COM–NC opens when energized, then
   reverses when de-energized. An indicator LED alone is not a contact test.
6. Repeat per channel and record restart/default-off behavior before connecting
   any real load. No automatic heater/mist or tray movement in this first stage.

## Acceptance record

| Item | Status |
| --- | --- |
| Board selection | User selected the 5 V four-channel board |
| Actual GPIO wiring | Enabled bench GPIO27/25/14; user reports working |
| Trigger polarity and 3.3 V interface | LOW-trigger configured; user reports functional operation; electrical margin not measured |
| Relay-specific sketch | [relay-bench](../relay-bench/README.md) enabled; user reports working |
| Manual relay controls | User reports all working October 14 |
| Separate measured contact-continuity results | Not recorded |
| Boot/reset/off behavior | Pending |
| Real load testing | Separate later step |

References: [pin map](../hardware-pin-map.md),
[actuator integration](../actuator-integration-guide.md),
[fan bench](../mosfet-bench/README.md).

## Actual-board photos — October 14

User supplied two photos. Visible relay markings identify **SONGLE
SRD-05VDC-SL-C** (5 V coils). A yellow jumper bridges labelled **VCC / JD-VCC**
pins. The main input header is partly obscured by plugs/wires, so exact supply,
ground and IN connections cannot be verified from these photos. Indicators
labelled IN1 through IN4 are visible; a separate always-on power LED is not
established. No lit channel LED alone is not evidence of missing supply.
Contact-terminal wires are present; isolate all load supplies before click tests.
Trigger polarity and safe direct ESP32 input compatibility remain unconfirmed.


## Latest acceptance update — October 14

User reports **all relays and MOSFETs working** after the enabled relay-bench
configuration. This supersedes earlier gated/draft-only status for manual bench
control. Working allocation: IN1 heater/GPIO27, IN2 tray/GPIO25, IN3 empty and
reserved for LED/GPIO26, IN4 mist/GPIO14. Relay sketch uses LOW to energize and
HIGH to deactivate. MOSFET fan bench uses GPIO19 upper and GPIO18 lower.

Recorded as user-reported functional control, not agent-measured verification.
PWM, independent load/contact measurements, boot/reset behavior, prolonged runs,
timeout checks and main-program integration remain unrecorded/pending. The
separate sketches do not establish concurrent relay/fan operation in one program.
