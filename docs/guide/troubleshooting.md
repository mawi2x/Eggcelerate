# Troubleshooting

Use the checks for the environment you actually opened. The mock demo, local
Docker dashboard, VPS-connected Vite server, and VPS deployment use different
origins, data, and services.

## Identify the environment

| Environment | Start command | Open | Data and services |
| --- | --- | --- | --- |
| Mock frontend demo | `pnpm dev:web` | `http://localhost:5173` | Simulated browser data; no API or database |
| Local frontend with VPS API | `pnpm dev:vps` | `https://127.0.0.1:5174` | Uses VPS API and accounts; separate from local Docker data |
| Local saved dashboard | `sh ./hardware-local-compose.sh up -d db api web dashboard-https` | `https://127.0.0.1:18443` | Local API and persistent database; hardware broker/worker start separately |
| Default Compose web | `docker compose up -d --build` | `http://localhost` | Default Compose configuration; see the root README for profiles and settings |
| VPS | Use the deployment operator's configured Compose wrapper | The configured VPS HTTPS origin | Production API, database, and device services |

Use the same hostname, scheme, and port while signing in. For example,
`localhost`, `127.0.0.1`, HTTP, HTTPS, and different ports are separate browser
origins and do not share session cookies.

## Start with safe checks

For the local saved dashboard, use the wrapper so Compose selects the existing
project, private environment file, and overlay files:

```sh
docker info
sh ./hardware-local-compose.sh ps
sh ./hardware-local-compose.sh logs --tail 100 api web dashboard-https
```

For device ingestion, inspect the additional services:

```sh
sh ./hardware-local-compose.sh ps
sh ./hardware-local-compose.sh logs --tail 100 hardware-broker hardware-telemetry
```

If a command reports a port is already in use, check which process owns the port
before stopping anything. The local HTTPS dashboard uses host port `18443`; the
hardware broker uses its configured host bind and is a separate endpoint. Do not
stop an unrelated process or change the broker bind address until the certificate
and ESP32 endpoint have been checked too.

Do not share `.env` files, passwords, session cookies, private keys, or expanded
Compose configuration. Redact credentials and personally identifying data from
logs before sharing them. Preserve the local database volume; do not use
`docker compose down -v` as a troubleshooting step.

## Docker dashboard and frontend

| Symptom | Checks and next step |
| --- | --- |
| Docker commands cannot connect | Run `docker info`. Start the Docker service if it is stopped, then check `sh ./hardware-local-compose.sh ps`. |
| Local dashboard does not load | Check `dashboard-https`, `web`, and `api` with `ps` and recent logs. Confirm you opened `https://127.0.0.1:18443`, not the mock or VPS-connected origin. |
| Browser says the local certificate is untrusted | Use the project's local development CA trust setup. Continue using the exact HTTPS origin. Do not disable TLS checks in the app or firmware. |
| Page still shows old frontend after a source edit | A standalone `docker build` may not update the image Compose runs, and building an image alone does not replace a running container. Rebuild and recreate the local web service, then reload the page. |
| HTTPS proxy gives an error after recreating `web` | Restart `dashboard-https` so Nginx resolves the current `web` container, then reload. |

For a frontend-only update to the local saved dashboard:

```sh
sh ./hardware-local-compose.sh build web
sh ./hardware-local-compose.sh up -d web
sh ./hardware-local-compose.sh restart dashboard-https
```

For an API or combined update, use the build and startup steps in the
[local startup guide](./local-startup-guide.md). If the frontend still looks old,
confirm the browser received a new `index.html` and hashed JavaScript asset; then
hard reload. The app shell is configured to revalidate, while hashed assets are
cached as immutable.

## Sign-in and account problems

- Use the same origin each time. Local Docker sessions use
  `https://127.0.0.1:18443`; switching to HTTP or `localhost` starts a separate
  browser session context.
- If the browser reports a certificate problem, follow the local CA setup rather
  than bypassing certificate validation. For the VPS, check the configured
  public HTTPS certificate and the [HTTPS operations guide](../../infrastructure/https/README.md).
- For a missing local account or administrator access, use the
  [local administration guide](./platform-admin-guide.md). Do not reset the
  database to recover a password.
- If sign-in is rejected, check API logs and the account's deployment before
  repeating attempts. Login throttling may temporarily reject repeated attempts.

## API and database

For the local saved dashboard, compare the web health check with API readiness:

```sh
curl -k -i https://127.0.0.1:18443/healthz
curl -k -i https://127.0.0.1:18443/readyz
```

The local HTTPS certificate may not be trusted by `curl`; `-k` here is only a
diagnostic workaround for these local checks. Keep TLS verification enabled in
the application and on devices. `/healthz` checks whether Nginx is serving;
`/readyz` checks whether the API's configured storage is ready.

If `/healthz` works but `/readyz` fails, inspect the API and database logs and
confirm the expected database service is running. An unavailable or unmigrated
database can make readiness fail while the web process still serves a page.
Apply a migration only when the specific source update requires it and against
the intended database; see the [database setup guide](./database-setup-guide.md).
Never reseed or recreate the database volume as a first diagnostic step.

## MQTT and device readings

When the ESP32 reports sensor values but the dashboard is stale or offline, trace
the path in order:

1. **Sensor:** confirm plausible fresh readings in Serial Monitor.
2. **Wi-Fi and time:** confirm the device joined the intended router and has a
   valid clock for TLS.
3. **Broker:** confirm the configured host and port are reachable from the ESP32
   and the broker is listening on the intended interface.
4. **TLS and access:** check that the broker certificate matches the configured
   host, the device trusts the correct CA, and credentials and topic ACLs match.
5. **Worker and database:** inspect `hardware-telemetry` logs and look for the
   firmware receipt confirming that the database accepted the reading.
6. **Assignment and freshness:** confirm the device is provisioned for the
   correct farm/chamber and compare the dashboard timestamp with the expected
   freshness window.

Useful local checks:

```sh
sh ./hardware-local-compose.sh ps
sh ./hardware-local-compose.sh logs --tail 100 hardware-broker hardware-telemetry
```

| Symptom | Likely checks |
| --- | --- |
| Broker exits with `cannot assign requested address` | The configured bind IP is not assigned to the current computer. Check the computer's current LAN address, then reconcile the bind address, certificate name, and ESP32 broker host together. |
| ESP32 cannot establish MQTT/TLS | Check Wi-Fi, host/port, clock, certificate name, trusted CA, credentials, broker listener, firewall, and ACL. A TCP connection or publish attempt alone does not prove database receipt. |
| MQTT connects but readings do not appear | Check worker logs, device/farm assignment, topic, and database readiness. Look for the explicit database-accepted receipt on the device. |
| Dashboard shows old values | Check the reading timestamp and worker receipt before treating the value as live. Saved values can remain visible while telemetry is offline. |

The local broker's address and certificate may be tied to a particular LAN. The
dated endpoint observations in the [local startup guide](./local-startup-guide.md)
are diagnostic context, not guaranteed current settings. Re-check the current
network before changing configuration. Do not change only the bind IP while
leaving the certificate and firmware endpoint unchanged.

## ESP32 and sensor

- Open the main firmware Serial Monitor at **115200 baud** with **Newline**.
  `status` and `climate status` report current state. `setup` opens the Wi-Fi
  setup AP; use it only when you intend to configure Wi-Fi. `climate stop` stops
  equipment outputs, so send it only when you intend an equipment stop.
- If the DHT22 reports repeated failures, verify the module labels, 3.3 V power,
  ground, DATA on GPIO4, and the required pull-up. For a bare sensor, verify its
  package orientation and pinout before reconnecting power. See the
  [firmware bring-up guide](../../apps/firmware/bringup-guide.md).
- If the setup page is unavailable, connect to the ESP32 setup network first and
  open `http://10.10.10.10`. This is separate from the Docker dashboard and the
  broker address.
- If cloud readings stop, follow the ordered checks in
  [cloud activation](../../apps/firmware/cloud-activation.md). Confirm the device
  reports database acceptance; a successful socket send is not a durable receipt.
- The ESP32 can continue local regulation while Docker, the VPS, or MQTT is
  offline. A stale dashboard does not establish that local control has stopped.
  Confirm fresh device status and acknowledgement before relying on remote
  commands. Follow the [firmware safety contract](./firmware-safety-contract.md)
  for safety boundaries.

## VPS deployment

Use the deployment-specific wrapper and environment file. Do not run local
hardware commands against the VPS project or use local credentials there.
Confirm container status, API `/healthz` and `/readyz`, and the relevant API/web
or hardware-worker logs as described in the
[VPS deployment handoff](./vps-deployment-handoff.md) and
[HTTPS operations guide](../../infrastructure/https/README.md). Keep database
volumes and private deployment files intact while diagnosing the issue.

## When asking for help

Include the environment and exact URL, the command you ran, relevant service
status, the failing health/readiness result, and a short redacted log excerpt.
For device issues, include the Serial Monitor status and whether the device
reported database acceptance. Do not include passwords, tokens, `.env` contents,
private certificates/keys, or unredacted account data.
