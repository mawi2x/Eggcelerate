# Local frontend development with the VPS

## Connection arrangement

- ESP32 → current router Wi-Fi → VPS MQTT at `4.193.224.4:8883`, using TLS.
- Deployed dashboard/API/database remain on the VPS.
- Local frontend edits run at **https://127.0.0.1:5174** and proxy `/api` to
  **https://4.193.224.4**. Vite refreshes the preview when frontend source changes.
- The existing local Docker database/dashboard at port 18443 remains independent.

The AP changes the ESP32's router Wi-Fi credentials when moving. The home
computer does not need to travel with the incubator or provide its MQTT server.
The VPS address remains the same across router changes. The destination Wi-Fi
must provide internet access to that broker; captive-portal login is not part
of the current ESP32 setup flow.

## Start editing

From the repository root:

```sh
pnpm dev:vps
```

Open **https://127.0.0.1:5174** and sign in with your **VPS account**. Local Docker
accounts and mock-demo credentials are separate. This preview uses real VPS
farm data and sends normal dashboard actions to that VPS; it is not a cloned
test database. Editing frontend source alone does not send equipment commands.

Use the existing local HTTPS certificate trust setup. The preview uses the
project's ignored `infrastructure/https/private/server.crt` and `server.key`;
these files are read only by the development server. They are not browser assets.
The certificate includes `127.0.0.1`; use the exact URL above.

Only the development proxy runs locally; a local API/database/MQTT broker is not
required for this mode. The server listens only on loopback. Stop it with Ctrl+C
in the terminal where it was started.

## Login and proxy behavior

`apps/web/vite.vps-proxy.ts` configures this mode only:

- Upstream HTTPS certificates are verified; TLS checks are not disabled.
- Browser requests use same-origin `/api`. The server checks the local Origin
  before rewriting it to the VPS origin accepted by the API.
- Mutations still need the VPS-issued session and CSRF token. No authentication
  bypass or relaxed VPS CORS configuration is added.
- The local proxy renames the browser session cookie to `egg_vps_dev_session`
  and translates it to/from the real VPS `egg_session`. Local Docker's cookie
  is not forwarded, so the two localhost sessions do not overwrite each other.
- No saved VPS passwords or API tokens are embedded in frontend code.

To deliberately use another HTTPS VPS origin, set the server-only
`EGG_VPS_API_TARGET` environment variable before starting. TLS paths may be
overridden with `EGG_DEV_TLS_CERT` and `EGG_DEV_TLS_KEY`. The default mode
`pnpm dev:web` remains the existing mock/development workflow.

## ESP32 configuration and upload order

The main sketch now uses private **CloudConfig.h** by default. Its existing
settings point to the VPS on port 8883 with per-device credentials and a trusted
CA. Keeping an old `LocalCloudConfig.h` beside the sketch no longer silently
overrides that destination.

A deliberate local recorder build must define **EGG_USE_LOCAL_RECORDER** and
provide `LocalCloudConfig.h`; otherwise it fails at compile time. The original
private files, Wi-Fi credentials, pairing identity and NVS records are preserved.

Compile output for the new default destination is private:
`output/firmware/climate-pwm-vps/`. No upload has been performed.
NodeMCU-32S/core 3.3.11 compilation passed: 1,141,172 bytes flash (87%) and
52,236 bytes static RAM (15%). Frontend TypeScript compilation also passed.

The new PWM firmware adds report fields and fault 7. The **VPS** API and worker
were updated to accept them on October 18, including migration 0019 → 0024.
The separate local schema-0024 installation did not perform that remote update.
Local frontend proxy support does not duplicate farm accounts or migrate readings.

## Current activation state

- VPS HTTPS readiness and MQTT TLS handshake succeeded on October 18.
- Local preview started successfully; proxied readiness/session reads succeeded.
- VPS access uses SSH user `eggcelerate` and the saved project key. Remote
  database/source backups were taken before installing the matching API, worker
  and dashboard images tagged `climate-pwm-20261018`.
- VPS schema is 0024; API/web are healthy and the MQTT worker reports connected
  in `hardware-climate-control` mode. Climate control is enabled; tray control
  remains disabled. Existing VPS accounts/enrollment, 561 readings and the stopped
  cycle were preserved. Control history and pending climate requests were empty
  after deployment; no new run or actuator request was created.
- Full login was not exercised with user credentials. No farm mutation, remote
  equipment command or firmware upload was performed to demonstrate the proxy.

Active deployment remains `/opt/eggcelerate/hardware-pilot-20261011`, managed by
`./hardware-compose.sh`. Its new `compose.climate-pwm-20261018.yaml` overlay follows
the existing stage overlay, preserving HTTPS/ACME routing and private environment.
Release files are in `/opt/eggcelerate/releases/climate-pwm-20261018/`; the private
pre-update backup is `/opt/eggcelerate/rollback-climate-pwm-20261018-FgXdgv/`.
Old image tags remain available. The old app expects schema 0019, so an image-only
rollback is insufficient; preserve post-update data and plan a compatible schema
rollback/restore before reverting. Backup restore was not rehearsed.

Next activation step is uploading the compiled VPS-targeted firmware. That was
not performed remotely: the ESP32 must receive the new sketch locally. Preserve
NVS (flash erasure disabled) and existing Wi-Fi/device identity. Use the normal
owner controls for preparation/incubation; no automatic run is created by this
deployment.
