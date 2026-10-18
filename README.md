# EGGCELERATE

EGGCELERATE is organized as a pnpm monorepo for independently deployable applications, future shared packages, and infrastructure configuration.

See the [project roadmap and timeline](ROADMAP.md) for completed work, current
verification results, remaining milestones, and the next implementation batch.
For symptom-based checks, start with the
[troubleshooting guide](docs/guide/troubleshooting.md); for local Docker setup,
see the [local startup guide](docs/guide/local-startup-guide.md).

## Repository structure

- `apps/web` — current Vite + React web dashboard.
- `apps/api` — FastAPI dashboard API with memory and opt-in PostgreSQL/TimescaleDB storage.
- `apps/mobile` — reserved for a future Android/iOS application; no framework has been selected.
- `apps/firmware` — reserved for ESP32 controller firmware; hardware planning and integration contracts are recorded in its README.
- `packages` — reserved for code that is genuinely shared between applications.
- `infrastructure` — includes the local Mosquitto configuration used by the opt-in simulator overlay.
- `compose.yaml` — builds the web and API services; database services use opt-in profiles.
- `compose.simulator.yaml` — adds the isolated Mosquitto broker and MQTT worker; dispatch stays disabled by default.

## Workspace commands

The dashboard uses React 19.3, Vite 8.3, TypeScript, and Tailwind CSS 4.3.
Use Node.js 22.12 or later within the supported Node 22, 24, or 26+ lines,
and pnpm 9.12.3. CI and the web container use Node 22.

Install the workspace dependencies from the repository root:

```bash
pnpm install --frozen-lockfile
```

Run the current web application checks:

```bash
pnpm --filter eggcelerate-ui typecheck
pnpm --filter eggcelerate-ui build
```

Start the web development server:

```bash
pnpm --filter eggcelerate-ui dev
```

`pnpm dev:web` is the root shortcut for the same server. Its default mock demo
starts with three connected chambers, one each for Chicken, Duck and Quail.
The in-memory demo refreshes simulated telemetry on polling and resets on page
reload. API mode continues to use the configured server and real device receipts.

For local frontend edits using the existing VPS API and accounts, run
`pnpm dev:vps` and open **https://127.0.0.1:5174**. See the
[VPS-connected local development guide](docs/guide/vps-connected-local-development.md)
for HTTPS, login/session separation and ESP32 destination settings. This mode
uses live VPS data; the existing local Docker database stays separate.

## Web container

Create the local Docker Compose configuration from the checked-in template:

```bash
cp .env.example .env
```

Skip the copy if `.env` already exists. The root `.env` is ignored by Git and
starts with development/mock defaults. Configure a separate `.env` on the VPS
for its production database, HTTPS origin and authentication settings. Root
`.env` is read by Docker Compose; direct Vite development uses `apps/web/.env`
or exported `VITE_*` environment variables instead.

Docker Compose builds the web application with Node and pnpm, then serves the generated static files from Nginx. In API mode Nginx forwards same-origin `/api/*` requests to the internal `api` service:

```bash
docker compose up -d --build
docker compose ps
```

The web is exposed on host port 80. The API is bound to host loopback port 8000 for local diagnostics; the browser should use `VITE_API_URL=/api` so it does not call a team member's localhost. The database is not started unless the `database` profile is enabled.

Set `VITE_LIVE_REFRESH_ENABLED=false` in the build environment to disable periodic
incubator-summary polling while keeping the dashboard's local freshness clock active.

## Team preview with durable notifications

The checked-in defaults are intentionally mock and in-memory for local work. A VPS preview that must retain cleared notifications across refreshes and restarts needs the API repository and PostgreSQL enabled at **build time** and **run time**:

```sh
export POSTGRES_PASSWORD='replace-with-a-long-secret'
export DATABASE_URL="postgresql+asyncpg://eggcelerate:${POSTGRES_PASSWORD}@db:5432/eggcelerate"
export COMPOSE_FILES='-f compose.yaml -f compose.production.yaml'

docker compose ${COMPOSE_FILES} --profile database down
docker compose ${COMPOSE_FILES} --profile database build --no-cache api web
docker compose ${COMPOSE_FILES} --profile database up -d --wait db
docker compose ${COMPOSE_FILES} --profile database run --rm --no-deps api alembic upgrade head
docker compose ${COMPOSE_FILES} --profile database run --rm --no-deps api python -m eggcelerate_api.database.seed
docker compose ${COMPOSE_FILES} --profile database up -d api web
docker compose ${COMPOSE_FILES} --profile database ps
curl -fsS http://127.0.0.1/healthz
curl -fsS http://127.0.0.1/api/v1/alerts | grep -q '"ok":true'
```

The overlay forces `VITE_DATA_SOURCE=api`, `VITE_API_URL=/api`, and `STORAGE_BACKEND=postgres_incubators`; it also removes the API and database host ports. The web image's build-time check catches literal `http(s)://localhost` or `http(s)://127.0.0.1` strings followed by `:` or `/` when API mode is selected; it does not validate other loopback spellings or prove API reachability. Its healthcheck probes the Nginx `/api` proxy. Run those commands from the repository checkout on the VPS. Do not run `docker compose down -v`; the named database volume contains the alert dismissal tombstones. The API currently has authentication disabled pending B6, so keep this preview behind a VPN, firewall, or an authenticated outer proxy rather than publishing it as a public service.
The overlay uses the Compose `!override` tag; use Docker Compose v2.24 or newer.


### Local demo administration

With `pnpm dev:web` running, open `http://localhost:5173/admin`.
No Docker or API is needed in mock mode.

- Demo administrator: `admin@eggcelerate.demo` / `eggcelerate_admin`
- Original three-incubator sample: `farmer@example.test` / `DemoFarmer123!`

The admin's Create user button opens a modal for a demo owner account with a farm name.
User rows also offer Edit and Delete. Editing supports names, email and an
optional password reset; deleting requires confirmation. Administrator accounts
are protected from these actions.
Sign in at `/login` with the created email/password to open that owner's empty
farm. Use the same browser and origin (do not switch between localhost and
127.0.0.1). Created accounts persist in local browser storage with salted
password hashes; the session persists in the current tab. Farm changes remain
in memory and reset on page reload. Clearing site storage removes demo accounts.
These credentials and accounts are only for the mock demo; API mode continues
to use the server's administrator account and database.
