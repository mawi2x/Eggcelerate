# HTTPS for the sensor pilot

`nginx.conf` fronts the API-backed dashboard. Production session cookies require
HTTPS. The dashboard's public certificate is separate from the private MQTT CA
embedded in the ESP32, so frequent website renewal does not require reflashing.

The October 11, 2026 VPS pilot uses a trusted Let's Encrypt IP certificate for
`https://4.193.224.4`. Certbot 5.8.0 successfully issued it; the first certificate
expires October 18. `renew.sh` renews with the existing webroot, copies the
certificate/key atomically to `private/`, validates Nginx configuration, and reloads
HTTPS. The deployment operator's cron runs it every eight hours. A future renewal
has not occurred yet; issuance, initial installation, and public TLS worked.

Source: https://letsencrypt.org/2026/03/11/shorter-certs-certbot.html

## Active VPS paths

- Checked source snapshot: `/opt/eggcelerate/hardware-pilot-20261011`.
- Compose project: `eggcelerate-hardware`.
- Operator wrapper: `./hardware-compose.sh` in that directory.
- Private environment: `.env.hardware`; certificates and passwords remain ignored.
- API/web images: `eggcelerate-api:preparation-20261011` and
  `eggcelerate-web:preparation-20261011`, built locally and loaded onto the VPS.
- Original Git checkout: `/opt/eggcelerate/Eggcelerate`, unchanged at `068ff9b`.
  Its old containers remain available for rollback; HTTP now redirects to HTTPS.

The current deployment is a working-source snapshot, not a GitHub-published
revision. `git pull` in the original checkout does not update this active snapshot.
Future releases should publish the source revision, build it, preserve the private
environment/keys and PostgreSQL volume, then deploy that checked build.

## HTTP challenge routing during staging

The original HTTP web container forwards only `/.well-known/acme-challenge/` to
`acme-edge` on the external `eggcelerate-acme` Docker network. The staged HTTPS
proxy serves challenge files from `acme/`. The original HTTP container now uses
`http-redirect.conf` to redirect other requests to the real HTTPS dashboard.
`legacy-nginx.conf`
in the active snapshot is the original web configuration backup.

Do not remove this challenge route or recreate the old HTTP container without
restoring `http-redirect.conf` and its `eggcelerate-acme` network connection while it owns port 80. When promoting the new dashboard to
port 80, let the HTTPS proxy own both ports using `compose.hardware.yaml`; its
HTTP server already serves ACME and redirects other requests to HTTPS.

## Operations

```sh
cd /opt/eggcelerate/hardware-pilot-20261011
./hardware-compose.sh ps
./hardware-compose.sh logs --tail 50 hardware-telemetry
./infrastructure/https/renew.sh
```

Avoid printing Compose's expanded configuration or private environment files;
those contain passwords. To check configuration, use `config --quiet`.

PostgreSQL uses the persistent `eggcelerate-hardware_eggcelerate-db` volume. Do
not use `down -v`. Database backup scheduling is a later operations step, not
implemented by certificate renewal.

## Current remaining activation gates

- Azure inbound TCP 8883 is open; public TLS and EGG-001 MQTT login succeeded.
- Platform admin is provisioned on the VPS at `/admin`; create the real farm owner there.
- Migration 0019 is applied, including persisted preparation before Day 1. The local test owner was not copied to the VPS.
- Pre-admin database/source backups are in `rollback-admin-20261011/` on the VPS;
  database restore has not been qualified.
- EGG-001 is enrolled and paired to Charles Farm. The user uploaded the configured main firmware.
- Physical DHT22 readings are visible on the dashboard. Preparation stability/start acceptance with equipment remains pending.

The local configured main firmware compiled for NodeMCU-32S (81% flash,
15% static RAM). The user uploaded it before this preparation deployment; no reflash is required for the new workflow.
