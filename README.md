# EGGCELERATE

EGGCELERATE is organized as a pnpm monorepo for independently deployable applications, future shared packages, and infrastructure configuration.

## Repository structure

- `apps/web` — current Vite + React web dashboard. This is the only implemented and deployed application.
- `apps/api` — reserved for a future backend/API; no framework has been selected.
- `apps/mobile` — reserved for a future Android/iOS application; no framework has been selected.
- `packages` — reserved for code that is genuinely shared between applications.
- `infrastructure` — reserved for future service and infrastructure configuration.
- `compose.yaml` — currently builds and deploys only the web application.

## Workspace commands

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

## Production web container

Docker Compose builds the web application with Node and pnpm, then serves only the generated static files from Nginx:

```bash
docker compose up -d --build
docker compose ps
```

The deployment currently exposes the web dashboard on host port 80. API, database, MQTT, and mobile services are not implemented or included in Compose.
