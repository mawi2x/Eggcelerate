# Local infrastructure

`mosquitto.conf` configures the broker used by the opt-in local simulator overlay in
`compose.simulator.yaml`. The broker listens on container port 1883, allows anonymous
clients, and persists its local simulator data under `/mosquitto/data`.

The overlay does not publish a broker host port: the MQTT worker reaches it through the
private Compose network. `compose.yaml` binds the API and development database to host
loopback when those profiles are enabled. Do not expose this anonymous broker to a LAN,
the internet, or a production device network; it has no TLS or broker authentication.

The worker requires PostgreSQL and defaults command dispatch to disabled. The overlay
sets `MQTT_HOST=broker`; set `SIMULATOR_DISPATCH_ENABLED=true` only for an isolated
simulator run. Physical hardware and a production broker configuration are not included.
