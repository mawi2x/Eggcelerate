# Local user administration

Open **https://127.0.0.1:18443/admin** in the API-backed local Docker deployment.
The current local HTTPS certificate is issued by the development CA. Sign in with
the administrator credentials supplied for this phase. The initial account is
`eggcelerate@eggcelerate.com`; its password is stored only as an Argon2 hash in
the local database. No administrator credentials are embedded in the browser,
source, Docker image, or environment defaults.

## Scope

The page uses the dashboard's shared `Button`, `Typography`, `FormInput`,
`Table`, and `PaginationBar` components and semantic tokens: 40px list-toolbar
actions, 36px row/form actions (34px on mobile), 40px navigation rows, standard
card radius, app canvas, and dashboard content width. Narrow tables scroll inside
their own container; desktop scrolling stays in the main content area while the
administrator sidebar remains in place.

- Create a farm owner with name, farm name, email, and password.
- Each new account gets an empty farm and standard species presets.
- View registered accounts, their farms, and access type, with pagination.
- Account creation preserves the administrator's signed-in session.
- Device enrollment, role editing, password reset UI, and deleting users are
  outside this page's current scope.

## Permissions

Migration `0018` adds `users.is_platform_admin`, defaulting to false for existing
and newly registered accounts. Admin APIs check this flag against the current
database user on every request. They require cookie sessions, allowed origins,
and CSRF protection for writes. Mock mode cannot create users. Public registration
remains closed in the production overlay.

The initial administrator has an empty operator farm for compatibility with the
existing farm-scoped cookie sessions. Platform permissions are separate from the
farm owner role and cannot be requested through the user creation form.

## Start or update the local deployment

```sh
docker compose --env-file .env.hardware-local -p egg-hardware-local \
  -f compose.yaml -f compose.production.yaml -f compose.hardware.yaml \
  -f compose.hardware-local.yaml --profile database build api web

docker compose --env-file .env.hardware-local -p egg-hardware-local \
  -f compose.yaml -f compose.production.yaml -f compose.hardware.yaml \
  -f compose.hardware-local.yaml --profile database run --rm api alembic upgrade head

docker compose --env-file .env.hardware-local -p egg-hardware-local \
  -f compose.yaml -f compose.production.yaml -f compose.hardware.yaml \
  -f compose.hardware-local.yaml --profile database up -d api web
```

For a fresh database, create the administrator once with an interactive password
prompt (do not put the password in the command):

```sh
docker compose --env-file .env.hardware-local -p egg-hardware-local \
  -f compose.yaml -f compose.production.yaml -f compose.hardware.yaml \
  -f compose.hardware-local.yaml --profile database exec api \
  python -m eggcelerate_api.admin create-admin \
  --email eggcelerate@eggcelerate.com --name 'Eggcelerate Admin' --farm 'Eggcelerate Operations'
```

Existing emails are rejected; this command does not silently replace passwords
or grant administrator access to an existing account.

## VPS rollout — October 11

The admin page is now deployed at **https://4.193.224.4/admin** with migration
`0018` and the supplied initial administrator credentials. The local test owner
was not copied to the VPS. Create the real farm owner through the VPS admin page.
HTTP redirects to HTTPS while preserving certificate challenge routing. See
[deployment operations](../../infrastructure/https/README.md) for the active
source snapshot and backup location.
