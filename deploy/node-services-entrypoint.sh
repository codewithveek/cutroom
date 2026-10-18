#!/bin/sh
# Runs migrations when Postgres is the store, then starts the requested service.
set -eu
service="${1:-api}"
if [ "${RUN_STORE:-file}" = "postgres" ]; then
  pnpm --filter @cutroom/db migrate
fi
case "$service" in
  api) exec pnpm --filter @cutroom/api start ;;
  worker) exec pnpm --filter @cutroom/worker start ;;
  *) echo "Unknown service: $service (use api or worker)" >&2; exit 64 ;;
esac
