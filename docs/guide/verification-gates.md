# Local and CI verification gates

Both `web / web` and `api / api` run on all pull requests and pushes to `main`
and `experiment`. Avoid path-filtered required workflows: they can leave an
otherwise unrelated pull request waiting for a check that was never started.
The API job also runs the shared frontend/live HTTP contract, so changes to
either side of the transport are covered.

## Local reproduction

From the repository root, install the pinned workspace dependencies and the API
test extra into a Python 3.14 virtual environment. Then run:

```sh
pnpm lint
pnpm --filter eggcelerate-ui typecheck
pnpm --filter eggcelerate-ui test
pnpm --filter eggcelerate-ui coverage
pnpm --filter eggcelerate-ui build
docker compose --profile database-test up -d --wait db-test
# Verify the disposable Timescale image without relying on a container name.
docker ps --filter ancestor=timescale/timescaledb:2.30.0-pg17
export TEST_DATABASE_URL=postgresql+asyncpg://eggcelerate:eggcelerate_test@127.0.0.1:55432/eggcelerate_test
apps/api/.venv/bin/ruff check apps/api
apps/api/.venv/bin/ruff format --check apps/api
apps/api/.venv/bin/python apps/api/scripts/verify_migrations.py
apps/api/.venv/bin/python -m pytest -q apps/api/tests --require-database
apps/api/.venv/bin/python apps/api/scripts/verify_live_contract.py
```

`pnpm --filter eggcelerate-ui test:contract` runs the repository contract against
the local API named by `EGG_API_URL`; it refuses to run without a loopback URL because
the contract mutates its farm. CI uses `verify_live_contract.py` to migrate and seed
an isolated farm, start a temporary API, set `EGG_API_URL`, and invoke that same
package script. `pnpm --filter eggcelerate-ui test` runs the memory adapter only and
does not count as HTTP transport coverage.

Run `.venv/bin/mypy` from `apps/api`. CI uses the same commands with its installed
Python tools. The database service uses the same pinned Timescale image as Compose.

`--require-database` rejects a missing or non-disposable database URL before tests
start and fails the session if any selected test is skipped. Normal local unit
runs can still omit the option and skip database tests explicitly.

The migration verifier creates uniquely named databases using the disposable
test role, proves empty-to-head and populated-0001-to-head upgrades, checks
preserved farm/mode values and the Timescale hypertable, then drops only those
databases. It requires CREATEDB. Additional intermediate populated migrations
are exercised by the PostgreSQL test suite. The live contract runner seeds a
unique farm and launches its own API on a free port; it never targets the running
preview API. The test database accumulates isolated farms until its disposable
container is recreated.

## Required checks and evidence

A repository administrator must select `web / web` and `api / api` in the branch
ruleset after the new workflow has run on GitHub. Workflow files alone cannot
make a check mandatory. Local execution proves the commands, not GitHub runner
execution or branch protection. Record those external results separately.

Current dependency deprecation warnings and the Vite bundle warning are tracked
independently; warnings must not obscure failed tests, skipped integration tests
or a failed migration.
