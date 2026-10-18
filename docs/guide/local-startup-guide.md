# Starting EGGCELERATE locally

**Updated workflow:** use `pnpm dev:vps` at **https://127.0.0.1:5174** for local
frontend edits against the VPS. See
[VPS-connected development](vps-connected-local-development.md). The Docker steps
below still apply to the separate local database/backend development environment;
they are no longer required to record the incubator once it uses VPS firmware.

Use this guide for the existing checkout and local database. The Docker setup is
the API-backed dashboard with saved accounts/readings. The Vite shortcut at the
end is a separate mock demo. Commands below are instructions, not actions already
performed by the agent.

If a step fails, use the symptom-based
[troubleshooting guide](./troubleshooting.md) for Docker, browser, API, and
device checks.

## 1. Open the project

```sh
cd /home/mawi/Projects/eggcelerate/eggcelerate
```

Docker must be running. On this Linux machine, if its daemon is stopped:

```sh
sudo systemctl start docker
```

The existing `hardware-local-compose.sh` wrapper selects project
`egg-hardware-local`, private `.env.hardware-local` and all four required Compose
files. Use it consistently so you keep the same database and configuration.

## 2. Start the saved dashboard, API and database

```sh
sh ./hardware-local-compose.sh up -d db api web dashboard-https
sh ./hardware-local-compose.sh ps
```

Open **https://127.0.0.1:18443** and sign in with your existing local account.
Use the same origin consistently. The local HTTPS certificate uses the project's
development CA; use its existing local trust setup if the browser reports it as
untrusted. The authenticated app uses secure cookies, so prefer this HTTPS URL
over the HTTP web port.

These services open the saved dashboard; the command does not start the MQTT
broker/worker if those are stopped. Without hardware telemetry, saved readings
may be visible while current device status is stale/offline. Do not interpret
saved values as a live connection.

No dependency installation, image rebuild, database seed or firmware upload is
needed for an ordinary restart of this existing setup.

## 3. Connect real ESP32 readings

The hardware services are `hardware-broker` and `hardware-telemetry`. Their
configured network endpoint must match the ESP32's MQTT address and the broker
certificate before starting them.

**Current blocker observed October 18:** the broker is configured to bind
`10.100.164.237:18883`, but this computer currently has LAN address
`192.168.1.26`. Docker records `cannot assign requested address` for the broker.
Its local TLS certificate and local firmware source also reference the old IP.
The firmware actually flashed on the board was not inspected.

For recording on this network, the following need to agree:

1. A stable computer LAN IP or hostname reachable by the ESP32.
2. `LOCAL_MQTT_BIND_ADDRESS` in private `.env.hardware-local`.
3. The MQTT server certificate's matching IP/DNS name and trusted CA.
4. The ESP32's broker host/port and trusted CA, plus router Wi-Fi connectivity.

Changing only the bind IP does not resolve the firmware endpoint or TLS name.
Choose the intended network/address first; network/firmware changes are separate
work and were not performed for this guide.

After that endpoint is reconciled:

```sh
sh ./hardware-local-compose.sh up -d hardware-broker hardware-telemetry
sh ./hardware-local-compose.sh logs --tail 50 hardware-broker hardware-telemetry
```

The hardware worker handles saved controller intent and can deliver equipment
commands; starting it is an operational hardware connection step. Use the normal
owner flow when ready: select chamber → Prepare → Chicken → Begin Preparation →
wait for readiness → load eggs → confirm incubation. Opening the dashboard alone
is not a request to begin a new cycle. Local ESP32 regulation may continue while
the dashboard/worker is offline.

The ESP32 setup AP at **http://10.10.10.10** is its router-Wi-Fi configuration
page. It is separate from the Docker dashboard and MQTT broker.

## 4. View logs or stop services

```sh
sh ./hardware-local-compose.sh logs --tail 50 api web dashboard-https
sh ./hardware-local-compose.sh stop
```

Stopping Docker services does not command the ESP32 actuators off. For an
equipment Stop, use the existing owner controls and wait for fresh device
acknowledgement while the hardware connection is available.

The database is stored in the existing named Docker volume. Preserve it: do not
use `down -v` or delete the volume. Do not overwrite `.env.hardware-local` with
`.env.example`; the former contains this deployment's existing configuration.

## 5. Optional: frontend development with mock data

For UI development without the API, database or ESP32, use Node.js supported by
the root `package.json` and pnpm 9.12.3:

```sh
pnpm install --frozen-lockfile
VITE_DATA_SOURCE=mock pnpm dev:web
```

Open **http://localhost:5173** (or the URL Vite prints). This uses simulated data,
not the saved hardware dashboard. Press Ctrl+C in that terminal to stop Vite.
Mock credentials in the root README apply only to that demo, not local Docker
accounts.

## Later source updates

Rebuild images only when applying source changes. For a deliberate API/web update:

```sh
sh ./hardware-local-compose.sh build api web
sh ./hardware-local-compose.sh up -d api web dashboard-https
```

If the update includes database migrations, apply the documented migration before
bringing the updated app into service. Routine starts do not require migrations
or reseeding. This guide does not deploy the VPS or change ESP32 firmware.
