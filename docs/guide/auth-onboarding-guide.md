# Authentication and onboarding

**Status:** app-managed email/password sign-in and farm authorization are implemented for
the PostgreSQL API mode. The mock provider remains the local UI/demo mode. Server-side
authorization is authoritative; `RequireAuth` only controls what the dashboard displays.

## API account flow

- API auth routes live under `/api/v1/auth`: `POST /register`, `POST /login`, `GET /session`,
  and `POST /logout`.
- Registration creates a normalized-email user, one new farm, an `owner` membership,
  built-in incubation modes, preferences, and a session in one transaction. It creates no
  incubator or simulated connected hardware. Owners add their actual chamber and printed
  device ID in the Incubators screen.
- The first registrant is the farm owner. Only the `owner` role exists today; invitations,
  additional members, and farm switching are not implemented.
- Passwords are 12–128 characters and use Argon2id hashing (19 MiB, 2 iterations,
  parallelism 1). Email is lowercased and validated syntactically. The address is not
  verified, password reset/recovery is not available, and login attempts are not rate-limited.
  Do not expose open registration publicly until those Phase 9 release controls are closed.
- Sessions use random opaque credentials. The database stores a SHA-256 digest of the
  session credential, binds it to the user's farm membership, and enforces expiry and
  revocation on each farm request. Default lifetime is 12 hours; “Keep me signed in” uses
  30 days. Logout revokes the session. Cookies are `HttpOnly`, `SameSite=Lax`, and
  `Secure` in production; writes require `X-CSRF-Token`. The web client keeps that CSRF
  value in memory, never local storage, and clears private query data on logout/expiry.

Deploy the web app and API on the same site behind the `/api` reverse proxy. Set
`AUTH_MODE=sessions`, `APP_ENV=production`, `STORAGE_BACKEND=postgres_incubators`, an
asyncpg `DATABASE_URL`, and `CORS_ORIGINS` to the HTTPS web origin. Production startup
rejects disabled auth and non-HTTPS/empty CORS origins. Run Alembic migrations explicitly;
auth-mode readiness requires schema head `0012` and TimescaleDB, but does not require a
pre-seeded demo farm. The production overlay uses the Compose `database` profile:

```sh
docker compose --profile database -f compose.yaml -f compose.production.yaml up -d --wait db
docker compose --profile database -f compose.yaml -f compose.production.yaml run --rm api alembic upgrade head
docker compose --profile database -f compose.yaml -f compose.production.yaml up -d --build
```

Set a strong `POSTGRES_PASSWORD`, its matching `DATABASE_URL`, and
`CORS_ORIGINS=https://your-site.example` in the ignored deployment environment before
running those commands. This overlay has not been deployed or restore-tested.

## Mock onboarding

When `VITE_DATA_SOURCE=mock`, `/login` and `/onboarding/1` through `/onboarding/3` retain
the deterministic frontend demo behavior backed by `MockAuthProvider`. This local-only
flow can still make a demonstration chamber; it does not create an API account or prove
hardware connectivity. API mode routes account creation to `/register` and sends owners
with an empty farm directly to the first-device setup.

The React auth screens are in `apps/web/src/app/components/auth/`; request parsing is in
`apps/web/src/app/data/auth/api-auth-client.ts`, and session state is in
`apps/web/src/app/providers/auth-context.tsx`. The [Phase 8 handoff](../refine/project-review-handoff-2026-09-23-phase8.md)
records the implementation and remaining public-release gates.
