#!/bin/sh
# Local hardware recorder; uses its existing persistent database and private env.
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec docker compose -p egg-hardware-local --env-file .env.hardware-local \
  -f compose.yaml -f compose.production.yaml -f compose.hardware.yaml \
  -f compose.hardware-local.yaml --profile database "$@"
