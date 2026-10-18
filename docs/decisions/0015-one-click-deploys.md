# 0015 · One-click deploys: one container for the API and its worker, a runtime API address

- **Status:** accepted · 2026-10-18

## Context
PRD extension E4 asks for "Deploy to Render" and "Deploy to DigitalOcean" buttons, with the web app, the API, a rendering worker and Postgres. Two facts from the platforms' docs shape this:

- A Render disk is attached to one service and cannot be shared; DigitalOcean App Platform has no persistent disks. Pipeline steps share working files (snapshot, voice clips, renders) under `CUTROOM_DATA_DIR`, so an API and a worker in separate services cannot see each other's files.
- DigitalOcean binds service URLs only at runtime for Dockerfile builds, and a Render service learns its public URL after it is created. The web app inlined `NEXT_PUBLIC_API_URL` at build time.

## Decision
- **No separate worker service.** `cutroom-service all` (the image's default command) runs the API and, when `RUNNER=temporal`, the Temporal worker in the same container on the same disk. Without Temporal the API runs steps in-process, as before. The single-host compose stack keeps the separate `api` and `worker` services on a shared volume.
- **Runtime API address.** The web app calls its own `/cutroom-api/*` route, which forwards to `CUTROOM_API_URL` (read per request, streaming both ways). Render sets it from the API's internal `hostport`; DigitalOcean from `${api.PRIVATE_URL}`, so the API can stay internal there. `NEXT_PUBLIC_API_URL` still overrides it at build time.
- **No open render API.** Render generates `RENDER_API_TOKEN`; without a token the remote render API is not registered at all.
- **Cloud by default on hosts without Ollama** (`DEFAULT_PRIVACY_MODE=cloud`).
- Start commands are not overridden on either platform: the image has an `ENTRYPOINT`, and an override appended to it (`cutroom-service cutroom-service all`) would exit at once.

## Consequences
- The extension's `cutroom-worker` service does not exist; durability on one-click hosts comes from Temporal Cloud plus the in-container worker. Scaling the worker separately needs shared storage (object storage) first.
- On DigitalOcean, run files reset on redeploy.
- The API has no authentication: anyone with a deployment's URL can start runs. The README says so; adding a login is a separate decision (it needs UI the extension rules do not allow).
