# Local infrastructure

`mosquitto.conf` configures the broker used by the opt-in local simulator overlay in
`compose.simulator.yaml`. The broker listens on container port 1883, allows anonymous
clients, and persists its local simulator data under `/mosquitto/data`. Compose maps
the broker to `127.0.0.1:1883`, so a simulator process on the same host can connect.

The MQTT worker reaches the broker through the private Compose network. The loopback
port is for the companion software simulator at `eggcelerate-simulate@2b85e15`; start
that simulator from its checkout with `--broker 127.0.0.1 --port 1883`. Do not start its
own broker at the same time. `compose.yaml` binds the API and development database to
host loopback when those profiles are enabled.

The worker requires PostgreSQL and defaults command dispatch to disabled. The overlay
sets `MQTT_HOST=broker`; set `SIMULATOR_DISPATCH_ENABLED=true` only for an isolated
simulator run. This broker has no TLS or authentication. Its loopback binding cannot be
reached by a physical device on the LAN; physical hardware and a production broker
configuration are not included.

## Local simulator integration

Use the simulator checkout at revision `2b85e15` with the database-backed API and
worker. Set `STORAGE_BACKEND` and `DATABASE_URL` in the shell so the API, seed command
and worker use the same local database. Then start the database, apply migrations and
seed the development farm:

```sh
export STORAGE_BACKEND=postgres_incubators
export DATABASE_URL=postgresql+asyncpg://eggcelerate:eggcelerate_local@db:5432/eggcelerate
docker compose --profile database -f compose.yaml -f compose.simulator.yaml up -d --wait db
docker compose --profile database -f compose.yaml -f compose.simulator.yaml run --rm --no-deps api alembic upgrade head
docker compose --profile database -f compose.yaml -f compose.simulator.yaml run --rm --no-deps api python -m eggcelerate_api.database.seed
docker compose --profile database -f compose.yaml -f compose.simulator.yaml up -d --build api broker mqtt-worker
```

From the sibling simulator checkout, start `EGG-1003` against the host-loopback broker:

```sh
./.venv/bin/python -m sim live --device EGG-1003 --broker 127.0.0.1 --port 1883 --rate 15
```

The simulator can publish telemetry to the local worker; command dispatch remains
disabled unless explicitly enabled. Stop any other local broker already using port
1883 before starting the overlay. This workflow exercises the software contract only;
it does not connect a device on the LAN or qualify physical electronics.
