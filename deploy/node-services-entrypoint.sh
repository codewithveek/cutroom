#!/bin/sh
# Runs migrations when Postgres is the store, then starts the requested service.
#   api     the API; with RUNNER=in-process it also runs the pipeline steps
#   worker  the Temporal worker (RUNNER=temporal), sharing CUTROOM_DATA_DIR with the API
#   all     the API, plus the Temporal worker in the same container when RUNNER=temporal:
#           one-click hosts give each service its own disk, so the two share this one (ADR 0015)
set -eu
service="${1:-api}"
if [ "${RUN_STORE:-file}" = "postgres" ]; then
  pnpm --filter @cutroom/db migrate
fi
case "$service" in
  api) exec pnpm --filter @cutroom/api start ;;
  worker) exec pnpm --filter @cutroom/worker start ;;
  all)
    if [ "${RUNNER:-in-process}" = "temporal" ]; then
      pnpm --filter @cutroom/worker start &
    else
      echo "RUNNER=${RUNNER:-in-process}: the API runs pipeline steps itself (no durability across restarts)"
    fi
    exec pnpm --filter @cutroom/api start
    ;;
  *) echo "Unknown service: $service (use api, worker or all)" >&2; exit 64 ;;
esac
