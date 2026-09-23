# Authentication and onboarding

**Status:** app-managed email/password sign-in and farm authorization are implemented for
the PostgreSQL API mode. Production self-registration is disabled pending email
verification. The mock provider remains the local UI/demo mode. Server-side authorization
is authoritative; `RequireAuth` only controls what the dashboard displays.

## API account flow

- API auth routes live under `/api/v1/auth`: `POST /register`, `POST /login`, `GET /session`,
  and `POST /logout`.
- Development registration creates a normalized-email user, one new farm, an `owner`
  membership, built-in incubation modes, preferences, and a session in one transaction. It
  creates no incubator or simulated connected hardware. Production account creation is
  operator-managed.
- The first registered user owns that farm. Only the `owner` role exists today;
  invitations, additional members, and farm switching are not implemented.
- Passwords are 12–128 characters and use Argon2id hashing (19 MiB, 2 iterations,
  parallelism 1). Email is lowercased and validated syntactically but is not verified.
  Production registration is disabled. An operator creates accounts and can perform a
  manual password reset, which revokes all active sessions. Sign-in is limited to five
  requests per normalized email in a 15-minute window; blocked requests receive `429` and
  `Retry-After`. Production requires a private, random `AUTH_RATE_LIMIT_KEY` of at least
  32 characters.
- Sessions use random opaque credentials. The database stores a SHA-256 digest of the
  session credential, binds it to the user's farm membership, and enforces expiry and
  revocation on each farm request. Default lifetime is 12 hours; “Keep me signed in” uses
  30 days. Logout revokes the session. Cookies are `HttpOnly`, `SameSite=Lax`, and
  production `Secure`; writes require `X-CSRF-Token`. The web client keeps that CSRF value
  in memory, never local storage, and clears private query data on logout/expiry.

## Production configuration and operator access

Deploy the web app and API on the same site behind the `/api` reverse proxy. Set
`AUTH_MODE=sessions`, `APP_ENV=production`, `STORAGE_BACKEND=postgres_incubators`, an
asyncpg `DATABASE_URL`, HTTPS `CORS_ORIGINS`, and a random `AUTH_RATE_LIMIT_KEY` in the
ignored deployment environment. Production refuses disabled auth, public self-registration,
a missing rate-limit key, and empty or non-HTTPS CORS origins. Run Alembic migrations
explicitly; auth-mode readiness requires schema head `0014` and TimescaleDB, but no
pre-seeded demo farm. The production overlay uses the Compose `database` profile:

```sh
docker compose --profile database -f compose.yaml -f compose.production.yaml up -d --wait db
docker compose --profile database -f compose.yaml -f compose.production.yaml run --rm api alembic upgrade head
docker compose --profile database -f compose.yaml -f compose.production.yaml up -d --build
```

Create an owner from the operator shell with
`docker compose --profile database -f compose.yaml -f compose.production.yaml exec api python -m eggcelerate_api.admin create-owner --email owner@example.com --name 'Farm Owner' --farm 'Sunrise Farm'`.
The CLI prompts twice for a password without echoing it. `reset-password --email ...`
provides manual recovery and revokes all sessions. This overlay has not been deployed or
restore-tested.

## Device IDs and electronics boundary

An authenticated farm cannot assign a live device ID until an operator reserves that
globally unique ID for the farm:

```sh
docker compose --profile database -f compose.yaml -f compose.production.yaml exec api \
  python -m eggcelerate_api.admin provision-device --farm-id <farm-uuid> --device-id <printed-id>
```

The registry prevents one wire ID from being assigned to two farms. Historical farm-local
IDs already used by multiple farms cannot be provisioned; use a new commissioned ID rather
than guessing which legacy assignment is real. API chamber creation and device reassignment
require an exact provisioned ID.

The MQTT worker resolves registered IDs to one farm and restricts command claims to that
farm's provisioned IDs when running the local simulator overlay. It refuses to start with
`APP_ENV=production`: the current anonymous Mosquitto configuration and separate simulator
do not implement per-device authentication. Do not expose that broker or worker to a LAN or
public network, and do not use this flow to operate physical relays, motors, or heaters. See
the [device provisioning guide](device-provisioning-guide.md).

## Mock onboarding

When `VITE_DATA_SOURCE=mock`, `/login` and `/onboarding/1` through `/onboarding/3` retain
the deterministic frontend demo behavior backed by `MockAuthProvider`. This local-only
flow can still make a demonstration chamber; it does not create an API account or prove
hardware connectivity. API mode routes account creation to `/register` only when the API
allows registration; an empty farm routes to the first-device setup.

The React auth screens are in `apps/web/src/app/components/auth/`; request parsing is in
`apps/web/src/app/data/auth/api-auth-client.ts`, and session state is in
`apps/web/src/app/providers/auth-context.tsx`. The [Phase 8 handoff](../refine/project-review-handoff-2026-09-23-phase8.md)
records the identity implementation. Phase 9 release and device-authentication evidence
remains open.
