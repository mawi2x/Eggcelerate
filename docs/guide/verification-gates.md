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
pnpm --filter eggcelerate-ui coverage
pnpm --filter eggcelerate-ui test:assets
pnpm --filter eggcelerate-ui build
pnpm --filter eggcelerate-ui check:assets
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

The coverage command runs the complete Vitest suite and the seven-screen scope
gate; do not also run the same full suite without coverage in CI. Vitest discovers
only `src/tests` TS/TSX suites, with two workers. Asset-report tests run separately
with Node and validate dependency cycles, shared costs, missing assets, budget
failures, and external-resource rejection. Live HTTP contracts remain in the API job.

## Asset budgets

After a production build, `check:assets` uses Vite's manifest to walk static imports,
CSS, assets, and HTML-linked icons. It measures each unique file once, including
shared dependencies, and adds separate costs for each important lazy route above
the initial closure. Missing route entries/files and external initial resources
fail the gate. JS/CSS/HTML use computed gzip sizes; binary assets use raw sizes.
This is an estimate, not proof of deployment compression. All declared Unicode
font subsets and icons count conservatively, even when a browser uses fewer.

Engineering regression limits are in `apps/web/asset-budgets.json`: 145,000 bytes
entry gzip, 195,000 initial JS gzip, 22,000 initial CSS gzip, 620,000 total initial
asset bytes, 500,000 minified bytes per JS chunk, and per-route incremental limits.
Changes to limits require recorded measurement and rationale; these are build
guardrails rather than user-facing latency guarantees.

CI publishes coverage and `dist/.vite` manifest, module-size, and asset reports
as `web-verification`, including on failure when reports exist, for 14 days.
Reproduction and current measurements: [M5 handoff](../refine/m5-loading-ci-2026-10-03.md).
The subsequent [React/Vite upgrade](../refine/frontend-upgrade-2026-10-03.md)
records current measurements, additional lazy routes, and the measured rationale
for rebasing the Incubators/Candling incremental limits. Coverage floors remain
unchanged; the suite now includes the additional upgrade regression checks.

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

Current dependency deprecation warnings are tracked independently. M5 resolved
the measured Vite chunk warning and now enforces asset budgets. Warnings must not
obscure failed tests, skipped integration tests
or a failed migration.
