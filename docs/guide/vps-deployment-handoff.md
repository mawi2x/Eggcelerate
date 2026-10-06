# EGGCELERATE — VPS Setup & Deployment Handoff

> **For the AI Agent on the VPS:**  
> This document is a complete, self-contained runbook to configure, deploy, initialize, and maintain **Eggcelerate** on a Linux VPS using Docker Compose. Follow the instructions step by step.

---

## 1. System Overview & Architecture

Eggcelerate is an automated egg incubation and hatchery management platform designed with:
* **Frontend (`apps/web`)**: React 19 + TypeScript + Vite + Tailwind CSS 4. In Docker, it is compiled and served via Nginx on port `80`. Nginx serves the static SPA and reverse-proxies `/api/` to the backend.
* **Backend (`apps/api`)**: Python 3.14 + FastAPI + Uvicorn + SQLAlchemy/asyncpg. Runs internally on port `8000`. Features Argon2id session authentication, CSRF validation, rate limiting, and domain logic.
* **Database (`db`)**: PostgreSQL 17 with TimescaleDB extension (`timescale/timescaledb:2.30.0-pg17`). Runs under Docker Compose profile `database`.
* **IoT / Simulator (`broker` & `mqtt-worker`)**: Eclipse Mosquitto MQTT broker + Python MQTT background worker for sensor telemetry and device commands (opt-in under `compose.simulator.yaml`).

---

## 2. Server Prerequisites

Ensure the following are installed on the VPS (Ubuntu 22.04/24.04 or Debian 12 recommended):

```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Install basic utilities and Git
sudo apt install -y curl wget git openssl ca-certificates gnupg

# 3. Install Docker Engine & Compose plugin (if not already installed)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Log out and log back in, or run:
newgrp docker

# Verify Docker installation
docker --version
docker compose version
```

---

## 3. Clone Repository

```bash
# Recommended deployment path
sudo mkdir -p /opt/eggcelerate
sudo chown -R $USER:$USER /opt/eggcelerate
cd /opt/eggcelerate

# Clone repository (replace with your repo URL)
git clone <YOUR_REPOSITORY_GIT_URL> .
git checkout experiment # or main
```

---

## 4. Environment Configuration (`.env`)

In the repository root, create the `.env` file. Choose between **Scenario A (Production with Domain & SSL)** or **Scenario B (Preview/Staging on direct IP)**.

### Scenario A: Production (Recommended — Domain with HTTPS)

```bash
# Generate secrets
AUTH_RATE_LIMIT_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 24)

# Create .env
cat <<EOF > .env
APP_ENV=production
AUTH_MODE=sessions
PUBLIC_REGISTRATION_ENABLED=false
STORAGE_BACKEND=postgres_incubators
DEFAULT_FARM_ID=00000000-0000-0000-0000-000000000001
API_HOST=0.0.0.0
API_PORT=8000

# Set your actual domain name below (must include https://)
CORS_ORIGINS=https://eggcelerate.yourdomain.com

# Database credentials
POSTGRES_USER=eggcelerate
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=eggcelerate
DATABASE_URL=postgresql+asyncpg://eggcelerate:${POSTGRES_PASSWORD}@db:5432/eggcelerate

# Minimum 32 characters
AUTH_RATE_LIMIT_KEY=${AUTH_RATE_LIMIT_KEY}

# Web build settings
VITE_DATA_SOURCE=api
VITE_API_URL=/api
VITE_LIVE_REFRESH_ENABLED=true
EOF
```

### Scenario B: Preview / Staging (Direct IP, No Domain / HTTP)

If you don't have a domain yet and want to preview directly on the VPS IP (`http://<YOUR_VPS_IP>`):

```bash
VPS_IP=$(curl -s ifconfig.me)
POSTGRES_PASSWORD=$(openssl rand -hex 16)

cat <<EOF > .env
APP_ENV=development
AUTH_MODE=sessions
PUBLIC_REGISTRATION_ENABLED=false
STORAGE_BACKEND=postgres_incubators
DEFAULT_FARM_ID=00000000-0000-0000-0000-000000000001
API_HOST=0.0.0.0
API_PORT=8000

CORS_ORIGINS=http://${VPS_IP},http://localhost,http://127.0.0.1

POSTGRES_USER=eggcelerate
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=eggcelerate
DATABASE_URL=postgresql+asyncpg://eggcelerate:${POSTGRES_PASSWORD}@db:5432/eggcelerate

AUTH_RATE_LIMIT_KEY=development-rate-limit-key-at-least-32-characters-long

VITE_DATA_SOURCE=api
VITE_API_URL=/api
VITE_LIVE_REFRESH_ENABLED=true
EOF
```

---

## 5. Build and Initialize Services

### Step 5.1: Build Docker Images
```bash
docker compose --profile database build
```

### Step 5.2: Start Database and Wait for Health Check
```bash
docker compose --profile database up -d db

# Wait until database is healthy
until [ "$(docker inspect -f '{{.State.Health.Status}}' eggcelerate-db-1 2>/dev/null)" = "healthy" ]; do
    echo "Waiting for PostgreSQL + TimescaleDB to become healthy..."
    sleep 3
done
echo "Database is ready!"
```

### Step 5.3: Run Database Migrations
Run the Alembic migrations to set up the 15 schema revisions:
```bash
docker compose --profile database run --rm api alembic upgrade head
```

### Step 5.4: Start All Services
```bash
# If using Scenario A (Production overlay):
docker compose -f compose.yaml -f compose.production.yaml --profile database up -d

# If using Scenario B (Standard Compose):
docker compose --profile database up -d
```

---

## 6. Create Initial Admin / Farm Owner Account

Because public self-registration is safely disabled by default, create the initial owner account using the admin CLI:

```bash
# Run interactively (will prompt for a secure password of 12-128 chars):
docker compose exec api python -m eggcelerate_api.admin create-owner \
  --email "admin@yourdomain.com" \
  --name "Farm Owner" \
  --farm "Main Farm"
```

*(Note: To run non-interactively in an automated script, pipe the password twice:)*
```bash
printf "YourSecretPassword123!\nYourSecretPassword123!\n" | \
  docker compose exec -T api python -m eggcelerate_api.admin create-owner \
    --email "admin@yourdomain.com" \
    --name "Farm Owner" \
    --farm "Main Farm"
```

Save the generated `user_id` and `farm_id` printed by the command.

---

## 7. Reverse Proxy & HTTPS (for Scenario A)

The `web` container serves traffic on port `80`. In production, terminate SSL using **Caddy** (simplest) or **Nginx + Certbot** on the host.

### Option 1: Automatic HTTPS with Caddy (Recommended)

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy

# First, move compose web port from 80:80 to 127.0.0.1:8080:80 in compose.override.yaml:
cat <<EOF > compose.override.yaml
services:
  web:
    ports:
      - "127.0.0.1:8080:80"
EOF
docker compose -f compose.yaml -f compose.production.yaml --profile database up -d

# Configure /etc/caddy/Caddyfile:
sudo bash -c 'cat <<EOF > /etc/caddy/Caddyfile
eggcelerate.yourdomain.com {
    reverse_proxy 127.0.0.1:8080
}
EOF'

# Reload Caddy
sudo systemctl reload caddy
```
Caddy will automatically obtain and renew Let's Encrypt certificates.

---

## 8. Verification & Health Checks

Run these commands to confirm that all layers are functional:

```bash
# 1. Check container status
docker compose ps

# 2. Check web container health
curl -f http://127.0.0.1/healthz
# Expected output: healthy

# 3. Check full system readiness (API + Database + TimescaleDB)
curl -i http://127.0.0.1/readyz
# Expected output: HTTP/1.1 200 OK
# Body: {"status":"ready","database":"connected","auth":"sessions",...}

# 4. Check API logs
docker compose logs --tail 50 api

# 5. Check Web logs
docker compose logs --tail 50 web
```

---

## 9. Common Operations & Maintenance Runbook

### Password Reset
```bash
docker compose exec api python -m eggcelerate_api.admin reset-password \
  --email "admin@yourdomain.com"
```

### Provisioning a New Hardware/Simulated Device
```bash
docker compose exec api python -m eggcelerate_api.admin provision-device \
  --farm-id "<FARM_UUID>" \
  --device-id "<DEVICE_MAC_OR_ID>"
```

### Database Backup
```bash
BACKUP_FILE="eggcelerate_backup_\$(date +%Y%m%d_%H%M%S).sql.gz"
docker compose exec -T db pg_dump -U eggcelerate -d eggcelerate | gzip > \$BACKUP_FILE
echo "Backup saved to \$BACKUP_FILE"
```

### Database Restore
```bash
gunzip -c backup.sql.gz | docker compose exec -T db psql -U eggcelerate -d eggcelerate
```

### Pull Updates & Redeploy
```bash
git pull origin experiment
docker compose --profile database build
docker compose --profile database run --rm api alembic upgrade head
docker compose -f compose.yaml -f compose.production.yaml --profile database up -d
```
