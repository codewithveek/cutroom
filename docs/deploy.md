# Deploying Cutroom

Two images cover every service:

| Image | Dockerfile | Runs |
| --- | --- | --- |
| `cutroom-node` | `deploy/node-services.Dockerfile` | `all` (default: the API, plus the Temporal worker in the same container when `RUNNER=temporal`), `api` or `worker`. Node 22, ffmpeg, Chrome Headless Shell downloaded at build time. Runs migrations first when `RUN_STORE=postgres`. |
| `cutroom-web` | `deploy/web.Dockerfile` | The Next.js app. The browser calls the web app's `/cutroom-api/*`, which it forwards to `CUTROOM_API_URL`, read at runtime. One image fits every deploy. |

Neither image downloads anything when it starts.

The API and the worker share files on disk (snapshots, voice WAVs, renders), so they need the same
volume at `CUTROOM_DATA_DIR` (`/data` in the image). On one host that is a shared Docker volume;
on Render and DigitalOcean, where a disk belongs to one service, both run in one container (ADR 0015).

`GET /health` reports the runner, the database and each toolchain check (model, voice, ffmpeg). It
answers 503 only when the database is unreachable, so a fresh deploy boots before the model is set.

## Signing in

A deployed instance always has a login; a laptop install never does. The API decides from where
it listens: on a loopback address there is no login (`CUTROOM_AUTH_MODE` defaults to `none`);
anywhere else it is `password`, and the API refuses to start without these, naming what is missing:

| Variable | |
| --- | --- |
| `CUTROOM_ADMIN_EMAIL` | The admin's login, used to seed the account on first boot |
| `CUTROOM_ADMIN_PASSWORD` | At least 12 characters; seeds the account on first boot only |
| `CUTROOM_SESSION_SECRET` | At least 32 random bytes (`openssl rand -base64 48`); signs the session cookie |
| `CUTROOM_ADMIN_RESET` | `true` re-applies the env email and password on the next boot (recovery); unset it after |
| `CUTROOM_PUBLIC_URL` | Optional: the web app's exact origin for CSRF checks; otherwise the proxied host is used |

Every API route except `/health` and the login needs the session cookie or an API token
(`Authorization: Bearer ctr_…`, created in **Settings → API tokens**). `RENDER_API_TOKEN` still works
as a bootstrap token for the remote render API.

## Option A · One host (DigitalOcean Droplet)

Everything in `deploy/docker-compose.cloud.yml`: web, API, worker, Postgres with pgvector, a Temporal
dev server and Caddy with automatic HTTPS for `CUTROOM_DOMAIN` and `api.CUTROOM_DOMAIN`.

1. Point `A` records for `cutroom.tech` and `api.cutroom.tech` (or your domain) at the Droplet.
2. On the Droplet, from a clone of the repo:

   ```bash
   cp deploy/cloud.env.example deploy/cloud.env   # set CUTROOM_DOMAIN, POSTGRES_PASSWORD, the model
   docker compose -f deploy/docker-compose.cloud.yml --env-file deploy/cloud.env up -d --build
   ```

3. Check `https://api.<domain>/health` reports `"status":"ok"`, then open `https://<domain>`.

Runs go through Temporal (`RUNNER=temporal`), so a worker restart mid-render resumes the run.

### Temporal Cloud instead of the bundled server

Set `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE` and `TEMPORAL_API_KEY` in `cloud.env`. An API key
switches the connection to TLS. Then start without the dev server:

```bash
docker compose -f deploy/docker-compose.cloud.yml --env-file deploy/cloud.env up -d --build --scale temporal=0
```

## Option B · Render (one click)

The README's **Deploy to Render** button reads `render.yaml`: the web app, the API with a 20 GB disk,
and Render Postgres (with pgvector). Render asks for these at creation:

- `OPENAI_COMPAT_BASE_URL`, `OPENAI_COMPAT_MODEL_ID`, `OPENAI_COMPAT_API_KEY`: the Gemma endpoint.
- `ELEVENLABS_API_KEY`, `SENTRY_DSN`: optional.

`RENDER_API_TOKEN` (the remote render API's bearer token) is generated, so that API is never open.
The web app finds the API through Render's internal address; there is no URL to copy.

Runs start in Cloud mode (`DEFAULT_PRIVACY_MODE=cloud`) and the API runs the pipeline itself
(`RUNNER=in-process`, no durability across restarts). For durable runs, add Temporal Cloud:
set `RUNNER=temporal`, `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE` and `TEMPORAL_API_KEY` on
`cutroom-api`; the worker then starts in the same container.

## Option C · DigitalOcean App Platform (one click)

The **Deploy to DigitalOcean** button reads `.do/deploy.template.yaml`: the public web app, the API
as an internal service, and a dev Postgres. It asks for the same model settings as Render.
App Platform has no persistent disks, so snapshots, voice clips and renders reset on redeploy
(run records stay in Postgres). Use Option A for a long-lived install.

## The model in Cloud mode

Cloud mode reaches Gemma through an OpenAI-compatible endpoint. `deploy/gemma-vllm.sh` serves it
with vLLM on a GPU Droplet:

```bash
GEMMA_MODEL=google/<gemma instruct checkpoint> HF_TOKEN=... VLLM_API_KEY=... sh deploy/gemma-vllm.sh
```

Then set `OPENAI_COMPAT_BASE_URL=http://<gpu droplet private IP>:8000/v1`,
`OPENAI_COMPAT_API_KEY=<VLLM_API_KEY>` and `OPENAI_COMPAT_MODEL_ID=<GEMMA_MODEL>`.

For a GPU-free demo, `MODEL_PROVIDER=scripted-shipnote` answers from a script written for the
shipnote fixture, so only that fixture produces a video.

## Uploads

Hybrid render bundles (200 MB), zip archives (100 MB) and music tracks (30 MB) go to the API. The
bundled Caddyfile allows request bodies up to 210 MB and turns off buffering for the server-sent run
events. Configure the same limits on any other proxy you put in front of the API.
