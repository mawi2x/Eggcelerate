# Last-minute changes

**Status:** Settings password change and shared-incubator pairing are deployed
to the VPS (2026-10-18).

Custom incubation mode support is **planned, not implemented** (2026-10-19).
HTM/LTM/LHM benchmark controls are **deployed to the VPS and flashed as v8**
(2026-10-19); physical capacity runs remain pending.

## Request

Allow a signed-in user with a real API-backed account to change their own
password from **Settings → Change password**. The user clarified that no
Forgot password function is requested. This replaces the earlier email-recovery
proposal; domain setup, email delivery, email verification, recovery links, and
reset-token storage are outside this scope.

## Current behavior

- API passwords must be 12–128 characters and are hashed with Argon2id.
- An operator can reset an account with
  `python -m eggcelerate_api.admin reset-password --email <address>` from the
  API environment. The CLI prompts privately and revokes all active sessions.
- The mock demo has a separate local administrator reset control that does not
  affect real API accounts.

## User flow

1. The signed-in user opens **Settings → Change password**.
2. They enter their current password, new password, and new-password confirmation.
3. The server verifies their current password and validates the new password
   against the existing 12–128 character policy.
4. The server stores the new Argon2id hash and revokes all active sessions in
   one transaction.
5. The UI clears sensitive form values and account caches, then asks the user
   to sign in again with the new password.

Current-password confirmation and signing out all sessions are implemented
defaults. Users who cannot remember their password can still
use operator-assisted recovery through the existing CLI.

## Changes to plan

### Frontend

- Add an accessible Settings form with current password, new password, and
  confirmation fields, visibility controls, and clear error/success feedback.
- Check matching confirmation and password policy before submission; keep
  server-side validation authoritative.
- Prevent duplicate submissions. Clear sensitive form values on success or
  leaving the form; never persist passwords in browser storage.
- After success, clear authentication state and cached account data and return
  to sign-in with a password-changed confirmation.
- Keep mock-demo behavior separate from real API accounts.

### API and database

- Add an authenticated password-change endpoint under `/api/v1/auth`.
- Derive the account from the authenticated session, never a client-supplied
  email, user ID, or farm membership.
- Verify the current password and reuse the existing password policy and
  Argon2id helpers for the new password.
- Serialize concurrent changes for the same account; recheck the current
  password while holding the account lock. Atomically update the password hash
  and revoke all active sessions, including the requesting session.
- Apply existing session/origin protections and rate-limit failed password
  checks by account and source.
- Reuse the users and auth_sessions tables. No email service, reset-token table,
  or email-verification migration is expected for this feature.

### Security and operations

- Use the existing HTTPS connection. Never log passwords, hashes, or secrets.
- Preserve the operator CLI as a separate recovery path.
- Document that Settings password changes require a signed-in session and the
  current password. No Forgot password feature is included.

## Acceptance checks for implementation

- A signed-in user can change only their own password.
- Wrong current passwords, invalid new passwords, and mismatched confirmation
  leave the password and existing sessions unchanged.
- Unauthenticated requests are rejected and existing origin protections apply.
- A successful change stores an Argon2id hash and revokes every active session.
- The new password works at sign-in; the old password and old sessions do not.
- Concurrent submissions cannot both succeed using the same old password.
- Failed current-password attempts are rate-limited.
- Passwords do not appear in logs, persistent browser storage, or cached data.
- Mock-demo and API account behavior remain separate.
- The existing operator CLI reset continues to work.

## Related implementation references

- [Authentication and onboarding](./auth-onboarding-guide.md)
- [Local user administration](./platform-admin-guide.md)
- [API admin CLI](../../apps/api/src/eggcelerate_api/admin.py)
- [Authentication endpoints](../../apps/api/src/eggcelerate_api/api/v1/auth.py)
- [Sign-in and registration screens](../../apps/web/src/app/components/auth/)

## Interim shared incubator access

**Status:** deployed to the VPS as an interim pairing flow (2026-10-18).

- Account 1 enters the incubator's pairing code, such as `EGG01`, and can
  monitor and control it.
- Account 2 can enter the same code and is added to the farm immediately. There
  is no owner approval or email-verification step.
- If the incubator is already in the farm, the second account opens that same
  incubator instead of creating a duplicate record.
- Pairing switches the current session to that farm. The most recently joined
  farm is selected again at the next sign-in.
- Farm access is currently the authorization boundary, so the second account
  can access the farm's other incubators and records too. Anyone with a valid
  pairing code can join that farm under this interim rule.

## Implementation details (2026-10-18)

- Settings location: **Farm & Account → Change password**, for API accounts only.
- Endpoint: `POST /api/v1/auth/change-password`, with `current_password` and
  `new_password`. Confirmation is checked in the form.
- Password changes require a valid session, allowed origin, and CSRF token.
- New passwords use the existing 12–128 character rule and must differ from the
  current password. All sessions are revoked on success; sign in again.
- Rate limits use separate HMAC buckets: 5 attempts per account and 30 per
  socket source in each 15-minute window. Attempts include successful changes;
  a proxy may make the source limit shared among users.
- Account locking serializes password changes and login session creation.
- Authentication validation responses omit submitted input and validator context
  so malformed password requests do not echo credentials.
- Existing user/session/membership tables are reused; schema remains `0025`.
- This rollout updates API and web images. ESP32 firmware and the MQTT worker
  are unchanged.
- Shared pairing continues to grant farm-wide owner access without approval,
  as described above. No per-incubator permission model is introduced.

### Build and deployment record

- Local TypeScript check, targeted Python lint/type checks, and production API
  and web image builds passed. Functional/automated acceptance tests have not
  been run for this change.
- VPS backup: `/opt/eggcelerate/rollback-settings-password-20261018-v36lt7oa/`.
- Private local backup mirror:
  `output/backups/vps-pre-settings-password-20261018/`.
- Backup files were checked against SHA-256 hashes; the database dump listing
  parsed successfully. A database restore was not rehearsed. The dump emitted
  the existing Timescale continuous-aggregate circular-constraint warning.
- Release files: `output/releases/vps-settings-password-sharing-20261018/`.
- Rollback: restore the backed-up `hardware-compose.sh`, then recreate API and
  web with the prior image selections. No database downgrade is needed for
  this release. Password changes already made remain in the database.

### VPS activation

- API and web are running `settings-password-sharing-20261018` images and both
  containers report healthy. Public HTTPS `/readyz` returned `ready: true`.
- Running API source hashes and both running image IDs match the local release.
- All 10 deployed source files match the release manifest. Deployment source was
  taken from the prior VPS snapshot with only the selected account/pairing
  changes added; unrelated local notification changes were excluded.
- The MQTT worker retained its existing container and image. No firmware was
  installed and no actuator commands were sent.
- Deployment evidence is saved beside the local and remote release artifacts.
- No existing user's password was changed during deployment. Functional account
  acceptance checks remain unrun.

## Custom incubation modes sent to the ESP32 (2026-10-19)

**Status:** requested for planning only. No implementation, deployment, or firmware
installation is authorized by this documentation update.

### Current limitation

- The ESP32 stores fixed Chicken, Duck, and Quail profiles in firmware.
- The server rejects preparation or incubation for an unknown mode or changed
  preset temperature/humidity limits. Creating a mode on the website does not
  install a matching controller profile.
- Live filtering, heater/mist decisions, fan control, and safety checks run on
  the ESP32. The server stores telemetry and sends lifecycle requests.

### Proposed scope

1. Send a versioned profile from the server containing the selected mode's
   temperature and humidity limits, profile identity, and revision.
2. Validate limits and profile compatibility on both the server and ESP32.
   Preserve firmware safety limits independently of user-selected targets.
3. Require device acknowledgement of the exact profile revision before
   preparation/start; display pending or rejected settings clearly.
4. Save the accepted profile atomically on the ESP32 for offline regulation.
   Validate stored settings after restart and retain existing fault and resume
   protections. Do not silently substitute another mode when settings are invalid.
5. Report the applied profile revision and targets in telemetry, and preserve
   them with the incubation cycle so historical charts show the targets used.
6. Keep existing preset behavior compatible during a staged API, worker, web,
   and firmware rollout. Define how profile edits affect an active cycle;
   do not silently apply edits to a running batch.

Stage-dependent targets, custom turning schedules, and migration of existing
cycles require separate scope and estimates. This feature does not itself fix
the current humidity regulation limitation or improve sensor calibration.

### Estimated effort and priority

| Work | Preliminary estimate |
| --- | --- |
| Profile transport and temperature/humidity validation | 2–4 hours |
| ESP32 acknowledgement, persistence, offline/restart handling | 2–3 hours |
| Integration checks and empty-chamber trial | 2–4 hours |
| Basic custom-mode support total | 6–11 hours |

These are preliminary engineering estimates, not a delivery commitment. Additional
stage/schedule requirements and findings during integration can increase them.
For the October 20 presentation, prioritize the existing Chicken control trial
and humidity investigation before attempting this feature.

### Acceptance checks for future implementation

- A newly created supported profile reaches the ESP32 with matching identity,
  revision, and targets; preparation/start waits for its acknowledgement.
- Invalid, unsupported, stale, or partially written profiles cannot enable
  regulation; the dashboard explains the rejection.
- Accepted settings remain available offline and survive restart without
  bypassing sensor validity, latched faults, or lifecycle protections.
- Mode edits during a running cycle follow an explicit application policy,
  with applied targets retained in that cycle's history.
- Existing Chicken, Duck, and Quail operation and older-device rejection remain
  predictable throughout rollout.
- An empty-chamber trial verifies actual local control against the received
  targets. Transport success alone does not prove temperature/humidity compliance.

### Implementation references

- [Server profile restrictions](../../apps/api/src/eggcelerate_api/database/climate_control.py)
- [Firmware profiles and control decisions](../../apps/firmware/Eggcelerate/ClimateControl.h)
- [Local sensor and actuator runtime](../../apps/firmware/Eggcelerate/ClimateRuntime.h)

## Incubator benchmarking mode (2026-10-19)

**Status:** implemented, deployed to the VPS, and flashed as
`climate-benchmark-v8` (2026-10-19). The controller remains stopped. Full physical
capacity runs have not been performed. The website offers exactly three benchmarks:

Detailed implementation plan: [HTM, LTM, and LHM](./benchmark-modes-plan.md).
The user subsequently authorized implementation. See the deployment record below.

Use these names for the three website selections and matching firmware modes:

| Full name | Acronym |
| --- | --- |
| Highest Temperature Mode | HTM |
| Lowest Temperature Mode | LTM |
| Lowest Humidity Mode | LHM |

The requested initial interface is these three selectable modes through the
existing website mode selection, rather than a separate benchmarking dashboard.
Each selection must map to a supported ESP32 benchmark behavior; adding names
alone does not make the current preset-only firmware able to run them.

1. **Highest temperature:** the highest sustained indicated air temperature
   reached within approved hardware and firmware safety limits.
2. **Lowest temperature:** the lowest sustained indicated air temperature
   reached using the existing heater-off, circulation, and exhaust capabilities.
3. **Lowest humidity:** the lowest sustained indicated relative humidity reached
   at a specified, stable chamber temperature, initially the Chicken target.

Maximum humidity testing is excluded by user request. The user's reason is that
high humidity is readily achieved in their Philippine installation; this is a
scope decision, not a measured claim about every location or season.

### Test conditions and interpretation

- Run only with an empty chamber and no active incubation cycle. Keep the door
  closed and record supply conditions, reservoir state, chamber configuration,
  sensor location, and any openings or other disturbances.
- Record intake/room temperature and humidity when a suitable measurement is
  available. Otherwise mark them **unmeasured**; a stopped chamber reading is
  not an independent measurement of intake air.
- Use a defined starting condition, stabilization criterion, maximum duration,
  and observation window for each benchmark. Record both transient extrema and
  sustained plateau statistics so a single sample is not reported as capacity.
- Temperature and humidity results depend on ambient conditions and actuator
  configuration. Without refrigeration or another cooling mechanism, exhaust
  alone cannot guarantee a temperature below intake temperature.
- For minimum humidity, log chamber temperature and calculate a moisture metric
  such as dew point alongside RH. Heating alone can lower RH without removing
  moisture; do not present that effect as measured dehumidification capacity.
- Results are DHT22-indicated values until checked against an independent
  reference. Save the firmware version, applied settings, timestamps, raw
  readings, validity/fault state, and commanded actuator outputs with each run.

### Proposed controls and safety behavior

- Provide a choice of the three benchmarks, clear progress, elapsed time,
  current readings, and **Stop benchmark**. Show the proposed actuator settings
  and limits before starting.
- Execute timed benchmark stages and safety checks locally on the ESP32;
  loss of the website or network must not leave an unbounded test running.
- Preserve sensor validity, stale-reading protection, latched faults, and
  approved thermal limits. Highest-temperature testing must not bypass the
  existing overtemperature cutoff or search for a destructive physical limit.
  If a limit is reached, report **safety-limited; physical maximum not established**.
- Stop or timeout returns to a defined stopped state, with any existing
  emergency cooling protection taking precedence. Do not automatically resume
  incubation or move the tray as part of these benchmarks.
- Keep benchmark runs separate from incubation cycles, while saving them per
  chamber for later viewing and comparison in Trends. Retain cancelled,
  interrupted, faulted, and time-limited runs with their outcome clearly shown.

### Acceptance checks for future implementation

- Only the three requested benchmarks are offered; no maximum-humidity test.
- Starting a benchmark cannot overlap an active incubation cycle.
- Device acknowledgement identifies the actual test, limits, and settings;
  unsupported firmware cannot silently fall back to an incubation preset.
- Stop, timeout, sensor failure, restart, and disconnection have defined,
  verified outcomes. Restart does not silently resume a benchmark.
- Saved results include conditions, extrema, sustained observations, duration,
  and termination reason. Missing ambient readings and safety/time limits remain
  visible when comparing results.
- A repeat run under comparable conditions is used to assess repeatability.

This is additional scope beyond the custom-mode estimate above; its effort
must be estimated separately before implementation.


### Benchmark implementation and deployment record

- Firmware: `climate-benchmark-v8`; API/worker: `benchmark-v8-20261019`;
  website: `benchmark-v8-r2-20261019`; database revision `0027`.
- Select through **Prepare → Mode → Equipment benchmarks**, or the Device
  Settings mode selector. Confirm the chamber is empty, then use **Start
  benchmark**. An explicit start is required; installation does not begin a test.
- Results, including interrupted runs, are under **Trends → Benchmarks**.
- HTM uses a 38.5°C test ceiling and retains the independent 39.0°C fault.
  LTM uses circulation and full exhaust with heater/mist off. LHM keeps mist
  off and compares 60%/100% exhaust while qualifying readings at 37.5–37.8°C.
- Runs have a local one-hour timeout, no tray turning, explicit Stop/retry,
  persistent results, restart interruption, and capability/acknowledgement gates.
- Checks: 43 targeted backend tests passed; firmware benchmark and existing
  climate/sensor/fault checks passed; TypeScript and production builds passed;
  disposable PostgreSQL migration/start/acknowledgement/overlap/Stop/history
  checks passed. Browser start/stop/history previews used isolated fixtures.
- Installation was hash-verified. Live VPS telemetry confirmed capability 1,
  valid sensor readings, PWM ready, no fault, and every output off. These checks
  do not establish the incubator's physical temperature or humidity limits.
- Local evidence: `output/releases/benchmark-v8-20261019/`; private firmware:
  `output/firmware/benchmark-v8-20261019/`.
- VPS backup: `/opt/eggcelerate/rollback-benchmark-v8-k96e4d_3/`; the custom
  database dump header and archive listing were checked, but restore was not
  rehearsed. Schema-compatible rollback images preserve the additive history
  table without requiring data deletion. Final web backup:
  `/opt/eggcelerate/rollback-benchmark-v8-web-4fagufex/`.
