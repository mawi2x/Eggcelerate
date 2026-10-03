# Device provisioning and simulator routing

**Current limit:** the API can associate one operator-verified device ID with one farm and
route simulator telemetry and commands within that boundary. The repository does not
contain device firmware or per-device MQTT authentication. The bundled worker refuses to
run in production. These steps do not qualify a physical board or actuator.

## Provision the farm owner

Approved future physical-device scope: [ESP32 connection, pairing, and offline recovery](../../apps/firmware/provisioning-plan.md).
This plan is not implemented; the operator provisioning steps below remain
the current supported path.

Production self-registration is disabled until email verification is available. An
operator creates an owner account from the running API container:

```sh
docker compose --profile database -f compose.yaml -f compose.production.yaml exec api \
  python -m eggcelerate_api.admin create-owner \
  --email owner@example.com --name 'Farm Owner' --farm 'Sunrise Farm'
```

The command prompts for the password twice without echoing it and prints the new farm
UUID. The operator should give the account credentials to the owner through the team's
approved private channel. Password recovery is manual:

```sh
docker compose --profile database -f compose.yaml -f compose.production.yaml exec api \
  python -m eggcelerate_api.admin reset-password --email owner@example.com
```

Resetting a password revokes all of that user's active sessions.

## Reserve a device ID

Verify the printed identity on the device or commissioning record, then reserve it for
exactly one farm:

```sh
docker compose --profile database -f compose.yaml -f compose.production.yaml exec api \
  python -m eggcelerate_api.admin provision-device \
  --farm-id <farm-uuid> --device-id <printed-id>
```

Device IDs are globally unique in the provisioned registry and case-sensitive when used
by the API and MQTT topic. The owner must use the exact spelling when adding or reassigning
a chamber. Requests for unprovisioned IDs, IDs provisioned to another farm, and legacy IDs
that already appear under multiple farms are rejected. The migration intentionally does
not pick a farm for duplicated historical IDs.

The API endpoints for farm configuration are under `/api/v1/incubators`; device telemetry
and command acknowledgments use the topic and payload schemas in the
[MQTT contract](b4-mqtt-contract.md). The worker resolves a topic's device ID against the
registry, then constrains reads and command claims to the owning farm. With `AUTH_MODE=sessions`,
unregistered devices do not receive commands or write telemetry.

## Protected MQTT client settings

The bundled worker and Python simulator support MQTT username/password authentication over
TLS with broker certificate verification. They accept `MQTT_USERNAME`, `MQTT_PASSWORD`,
`MQTT_TLS_CA_FILE`, and optionally the mutual-TLS pair `MQTT_TLS_CERT_FILE` plus
`MQTT_TLS_KEY_FILE`. Supplying credentials without a CA file fails closed; TLS hostname
verification stays enabled. With a CA file, the clients default to port `8883`; set
`MQTT_PORT` when the broker uses another port. Use one broker username per device and
configure ACLs so it can publish only its own telemetry/state/ack topics and subscribe only
to its own commands topic. Give the worker a separate service identity that can read
telemetry/ack topics and publish commands.

The bundled local broker remains anonymous, unencrypted, and loopback-only. The current
operator command reserves device IDs in the application database; it does not create broker
credentials, broker ACLs, or firmware secrets. Do not expose that local broker or treat the
client options as a completed hardware commissioning flow.

## Simulator boundary

The local simulator overlay sets the API and worker to `APP_ENV=development` and
`AUTH_MODE=sessions`, closes self-registration, requires PostgreSQL, and waits for the
database before starting the API. Set the container-network database URL before starting
it, for example:

```sh
export DATABASE_URL='postgresql+asyncpg://eggcelerate:eggcelerate_local@db:5432/eggcelerate'
```

Build the API image, migrate the database, and start the simulator services:

```sh
docker compose --profile database -f compose.yaml -f compose.simulator.yaml build api
docker compose --profile database -f compose.yaml -f compose.simulator.yaml run --rm api alembic upgrade head
docker compose --profile database -f compose.yaml -f compose.simulator.yaml up -d --wait api broker mqtt-worker
```

Create the local owner and reserve a device ID against this same simulator database:

```sh
docker compose --profile database -f compose.yaml -f compose.simulator.yaml exec api \
  python -m eggcelerate_api.admin create-owner \
  --email owner@example.com --name 'Farm Owner' --farm 'Simulator Farm'
docker compose --profile database -f compose.yaml -f compose.simulator.yaml exec api \
  python -m eggcelerate_api.admin provision-device \
  --farm-id <farm-uuid> --device-id <printed-id>
```

For dashboard sign-in, build the web image with `VITE_DATA_SOURCE=api`. The overlay binds
Mosquitto to loopback and does not publish a public listener. Command delivery remains
opt-in with `SIMULATOR_DISPATCH_ENABLED=true`. The worker refuses `APP_ENV=production`
because the bundled anonymous broker and simulator messages are not authenticated per
device.

Before connecting a real board, provision its broker credential, configure broker
authentication and per-device ACLs, implement the same TLS trust and device identity rules
in firmware, and add credential recovery/revocation tests. Then verify
telemetry replay, cross-farm command isolation, acknowledgments, clock behavior, network
loss, and local safety cutoffs on the selected hardware. Never use a public serial number
alone as proof that a device belongs to a farm.
