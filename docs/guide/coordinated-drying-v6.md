# Revised humidity-control plan: v6 trial candidate

19 October 2026. Firmware `climate-coordinated-drying-v6`. This implements the
software needed to carry out the revised solution plan; the physical outcome is
not established by compilation or simulation. See the release installation and
trial evidence before assuming a step was completed.

## Baseline saved before changes

`output/audits/humidity-v5-baseline-extended-20261019/` contains a frozen extended
VPS baseline. Chicken preparation is observed from 20:22:49 to 20:47:20 Manila
(~24.5 minutes), after which the user changed mode/lifecycle to Duck incubation.
Chicken has 235 unique reported valid samples; none meet 55–60% RH. After first
37.5°C, temperature spans 37.4–38.0°C and RH 63.2–66.8%; 188/212 reported samples
meet temperature, none meet both. These are report counts, not time percentages.
The mixed-mode records must not be treated as a single Chicken experiment.

The chamber was re-confirmed empty and authorized for Chicken testing. The v5
local journal was exported before installation: 727 records decoded with zero
invalid records. USB opening restarted the controller (known board behavior);
explicit Stop was sent and confirmed before export. Opening Serial again can do
the same, so open the trial monitor before starting Chicken preparation.

## Diagnostics

`AdaptiveDiagnostics` is part of the control snapshot, cloud report and version 3
binary journal. Fields include normalized RH, filtered moisture rate, humidity
forecast; heating/cooling/power forecasts; thermal target, requested heat power,
integral/feed-forward terms; drying effort/baseline, stability and review/exposure
times, duty-seconds, review count/result; dry hold/permission/limited flags; thermal
ceiling, boost state, relay-window second, comparison duty. Completed-review
baseline, exposure and delta are retained separately so the decision remains
inspectable after a new window starts.

- `review_result`: 0=no qualified observation, 1=observation started,
  2=effective/within target, 3=insufficient improvement while high.
- `duty_seconds`: integral of applied humidity-exhaust duty fraction over time;
  not measured air volume. `exhaust_ms` counts humidity-driven ON time only.
- State is last evaluated by the Chicken adaptive branch. Running/fault/sensor
  validity must be checked before interpreting a retained forecast. Requested
  heat and test permission are zeroed when not actively evaluating Chicken.
- Cloud reports at most every 5 s during Chicken regulation, or 1 s on coalesced
  output changes. This remains sparse compared with the 50 ms control loop.
- Journal v3 is 256 bytes, v1/v2 exports/decoder retained. Two 64 KiB files now
  retain roughly 512 records total. Export/stream promptly; this is not an archive.
- New optional API model accepts legacy reports and journal versions 1/2/3.
  Deploy to API AND telemetry worker before flashing. No migration is required.
- MQTT/payload/diagnostic buffers are 7168/6656/3328 bytes. Static owner-task buffers
  avoid stack pressure; control records still use a bounded nonblocking queue.

## Drying review correction

The old warm-up moisture baseline is replaced with a qualified observation:

1. Fresh valid T within the selected band, with absolute filtered T rate <=0.35°C/min.
2. Keep those conditions for 30 s before establishing a baseline.
3. Compare within 0.2°C of baseline temperature; a thermal excursion or lost sensor
   invalidates the observation rather than counting it as failed dehumidification.
4. Require five eligible minutes AND at least two minutes of humidity-driven
   exhaust. Temperature-driven cooling cannot satisfy this exposure gate.
5. Less than 0.5 normalized-RH point improvement while above the upper target
   triggers the existing bounded backoff/retry, with evidence retained in the log.

These windows test effectiveness under comparable conditions; they do not prove
intake moisture, evaporation or airflow causes. Highly oscillating temperature may
prevent a review from qualifying; the counters expose that instead of guessing.

## Heat and exhaust coordination

- Shared bounded 25 s temperature forecast is used for heater power and drying
  hold. Lower raw T/forecast protection remains; release needs midpoint raw T and
  forecast above the lower guard rather than waiting for midpoint forecast.
- Heater predictive cutoff can act before raw T reaches midpoint; raw upper target
  and all existing fault/overheat protections remain authoritative.
- During permitted humidity exhaust, add at most 0.20 requested heater-power
  fraction at 100% duty, proportionally at lower duties. This is provisional
  feed-forward, not a measured heater/airflow model. PI anti-windup includes
  compensating output. Requested relay power is not electrical power measurement.
- Ordinary drying ceiling now varies from 50% to 100% with forecast thermal
  headroom; it does not simply command maximum fan continuously. Startup boost,
  PWM frequency/resolution, upper full circulation and explicit Stop unchanged.
- Heater relay schedule remains 20 s windows with minimum normal ON/OFF 5 s;
  safety can interrupt a pulse. Relay endurance/rating remains a qualification item.
- Mist still cannot oppose drying/cooling, and raw upper RH blocks misting.

## Empty-chamber exhaust comparison

Local Serial commands (no new remote command surface):

```
climate vent 60
climate vent 100
climate vent off
```

Requires healthy **Chicken preparation**, fresh readings and raw T within range.
Other modes, incubation phase, invalid duties and faults refuse the request.
Each request expires after ten minutes and does not persist across restart.
Stop/fault/sensor interruption, leaving preparation or T below the lower target
ends comparison automatically. Confirmed high temperature retains the cooling
policy (100% can override the requested comparison duty). Mist remains interlocked.
Normal regulation continues after timeout/cancellation; it does not automatically
start or resume a stopped controller.

A valid comparison needs stable T, confirmed requested/applied duty, no fault or
sensor interruption, and comparable room/reservoir/door conditions. An aborted or
cooling-overridden step is evidence of a constraint, not a fixed-duty plateau.
Report actual data rather than promising ten minutes will reach equilibrium.
Paired intake T/RH is useful if available; no independent intake sensor currently
exists, so physical intake-floor diagnosis remains uncertain.

## Checks and limitations

Control fault tests cover qualified baseline, disturbance reset, exposure gate,
backoff/retry, simultaneous heater/exhaust, comparison expiry/invalid request,
sensor loss, Stop, overheat, mode and phase refusal. Existing 21 adaptive control,
sensor recovery, fault ventilation, sensor diagnostics and journal migration
checks pass. Eight decoder tests and 17 API schema checks pass. Actual C++ JSON is
accepted by the API; a production C++ binary record is decoded by the Python tool.

Ten paired synthetic scenarios are saved beside the audit. V6 has mixed joint
coverage relative to v5 (some improve, some regress); humid intake remains
unreachable. These hypothetical models are not calibrated to this chamber and
are not proof of improvement. Candidate changes require controlled hardware data.

Success requires sustained joint 37.5–37.8°C/55–60% indicated RH, bounded overshoot,
acceptable relay cycling and sensor reliability. If a comparable ventilation
trial cannot reduce moisture, investigate intake/evaporation/airflow before further
software tuning. No physical root cause is yet established and no physical change
is authorized by the software work alone.
