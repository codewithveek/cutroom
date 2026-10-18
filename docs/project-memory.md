# Cutroom: project memory

A short note on what Cutroom is, how it works and how to use it. Last updated 2026-10-18.

## What it is

Cutroom turns a codebase into a product video: a launch film, a feature drop, a tutorial, an explainer, a teaser or a social cutdown. It writes the script, checks every claim against the code, records the voiceover and renders MP4s in 16:9, 9:16, 1:1 or 4:5, with captions and a thumbnail.

- **Open models.** Gemma (via Ollama) writes the brief, the storyboard and judges claims. Kokoro does the voice. ElevenLabs is optional.
- **Source of truth.** `prd.md` plus the extension docs. Working rules are in `CLAUDE.md`. Decisions are recorded as ADRs in `docs/decisions/`, and progress in `docs/progress.md`.
- **Repo.** `github.com/codewithveek/cutroom`. The CLI is published on npm as `cutroom`.

## Rules that never break

- **Everything shown is real.** No invented features, UI or numbers. Placeholder *data* is fine.
- **The model never writes JSX.** It returns JSON checked against Zod schemas, and tested Remotion blocks render that JSON.
- **Narration drives timing.** Scene lengths come from the voice durations.
- **Privacy modes are enforced in code:**
  - **Local:** no outbound network at all during a run; an egress guard blocks it.
  - **Hybrid:** only the approved render job goes to the cloud, after you confirm.
  - **Cloud:** models may be remote.
- **Secrets are redacted** before anything reaches a model, a log or a frame.
- **Deterministic renders.** Seeded randomness only.

## How a run works (pipeline steps)

1. **ingest-repository.** Reads the repo: README, package files, routes, UI strings, source excerpts. Skips ignored files and binaries, and redacts secrets. It isn't tied to particular file extensions: it reads text files and picks out what matters by role (docs, manifests, source, UI text). With `--changes`, it builds a change snapshot from a git range.
2. **capture-screens** (optional). Takes read-only screenshots of the running app (`--app-url`).
3. **analyze-product.** Gemma writes a product brief, or a change brief for a feature drop.
4. **plan-storyboard.** Gemma picks scenes from the preset's beats and fills block props as JSON. A repair loop fixes validation errors: word budgets, how the narration reads aloud, missing screens, and code cards that only show source code.
5. **audit-claims.** Deterministic checks first (labels, code, numbers and commands must exist in the repo), then a Gemma judge. Claims with no verdict count as unsupported.
6. **review.** Pauses for approval. Any unsupported claim blocks approval until it's fixed or overridden with a written reason. Edits are saved as versions, and only changed scenes are re-audited.
7. **synthesize-voice.** Kokoro or ElevenLabs, or silent. Clips are cached per line.
8. **build-render-job.** The timing solver turns voice durations into frames.
9. **render.** Remotion, once per ratio, with an optional "created with cutroom" watermark.
10. **quality-check.** Stills at scene ends and transition midpoints, plus loudness normalised to −16 LUFS.
11. **finalize-deliverables.** MP4s, VTT captions, thumbnail and a delivery note (claims, overrides, licences).

## Layout (pnpm + Turborepo, TypeScript strict)

- **apps/**
  - `cli`: the published `cutroom` command.
  - `api`: Fastify.
  - `web`: Next.js editor.
  - `worker`: Temporal worker.
- **packages/**
  - `scene-spec`: every Zod contract, the timing solver and the word counter.
  - `agent`: prompts and steps.
  - `pipeline`: runner, steps, store.
  - `video-kit`: Remotion blocks and looks.
  - `renderer`: bundle, render, quality checks.
  - `providers`: Ollama, OpenAI-compatible, egress guard.
  - `voice`, `audio-io`: voice and audio.
  - `repo-ingest`: reading repos and git ranges.
  - `capture`: Playwright screenshots.
  - `claim-audit`: the claim checks.
  - `presets`: video presets.
  - `db`: Drizzle + Postgres + pgvector.
  - `temporal`: Temporal workflow.
  - `auth`: login for deployed instances.
  - `config`: env schema.
  - `observability`: pino + Sentry.
- **Blocks:** kinetic-headline, title-card, feature-cards, terminal, code-card, screenshot-window, big-number, diagram-flow, word-slot, end-card.
- **Looks:** editorial, studio, cinematic, graphic.
- **Presets:** launch-editorial, feature-drop-editorial, api-launch-graphic, explainer-editorial, tutorial-studio, teaser-cinematic, social-cutdown-vertical.

## Using the CLI

You need Node 22+ and ffmpeg. Ollama with `gemma4:e4b` is needed only for real runs.

```bash
npx cutroom demo                       # bundled demo repo, scripted model, no Ollama needed
npx cutroom setup                      # one-time, online: Kokoro voice + render browser
ollama pull gemma4:e4b
npx cutroom make --repo . --preset launch-editorial --ratios 16:9,9:16 --privacy local
npx cutroom make --repo . --preset feature-drop-editorial --changes v1.2.0..v1.3.0
npx cutroom make --repo . --watermark --direction "for developers, focus on the CLI"
npx cutroom make --repo . --app-url http://localhost:3000 --routes /,/settings
```

Other flags:
- `--yes`: approve automatically when no claim is unsupported.
- `--silent`: no voiceover.
- `--voice af_heart`: pick a voice.
- `--music upbeat|calm|none`: background music.
- `--seconds 45`: target length.

Output goes to `.cutroom/runs/<runId>/deliverables/`.

## Running from source

```bash
pnpm install
docker compose up -d        # Postgres (+pgvector) and Temporal; optional
pnpm dev                    # web + api + worker
pnpm typecheck && pnpm lint && pnpm test
pnpm eval                   # real-model evals, run by hand
```

- **Defaults:**
  - in-process runner with a file store under `.cutroom/`;
  - `RUN_STORE=postgres` plus `DATABASE_URL` switches to Postgres;
  - `RUNNER=temporal` switches to durable runs.
- **Key env:**
  - `MODEL_ID` (default `gemma4:e4b`), `OLLAMA_HOST`;
  - `OPENAI_COMPAT_*` for a cloud or vLLM endpoint;
  - `DEFAULT_PRIVACY_MODE`;
  - `BROWSER_EXECUTABLE`;
  - `ELEVENLABS_API_KEY`;
  - `SENTRY_DSN`;
  - `CUTROOM_AUTH_MODE` and `CUTROOM_ADMIN_*`.

## Self-hosting

- **One-click:** "Deploy to Render" (`render.yaml`) and "Deploy to DigitalOcean" (`.do/deploy.template.yaml`) buttons in the README. They stand up the web app, the API and Postgres.
- **Docker:**

  ```bash
  docker compose -f deploy/docker-compose.cloud.yml --env-file deploy/cloud.env up -d --build
  ```

  Details are in `docs/deploy.md`.
- **Login on deployed instances:**
  - one seeded admin (`CUTROOM_ADMIN_EMAIL`/`PASSWORD`), argon2id passwords;
  - server-side sessions in a signed cookie;
  - CSRF origin checks and rate-limited sign-in;
  - revocable API tokens.

  A laptop install has no login.
- **Proxy:** the web app talks to the API through `/cutroom-api/*`, so there is one public URL.

## Publishing the CLI

```bash
cd apps/cli
# bump "version" in package.json first
pnpm publish --access public
```

`prepack` builds `dist/cli.js` and the Remotion bundle. It fails if a bundled import is missing from `dependencies`. The CI `package` job packs the CLI, installs it in an empty folder and runs `cutroom demo`.

## Lessons learned (gotchas)

- **Pin Remotion.** Every `remotion`/`@remotion/*` package uses the same exact version (4.0.536).
- **Gemma needs `think: false`,** or it ignores the JSON format.
- **The browser is fetched before the egress guard.** Remotion downloads its browser on first use from remotion.media. That must happen before Local mode's egress guard is on, so the runner and the CLI call `ensureBrowser` first.
- **Package names must stay unique.** The root package is `cutroom-monorepo`. If it were also named `cutroom`, `npx cutroom` inside the repo would fail with "could not determine executable".
- **Restart long-running servers after video-kit changes.** The Remotion bundle is cached once per process.
- **Narration must be speakable.** Text like "Spoken" or file paths in `say` is rejected by `isPlausibleSpokenForm`.
- **Code cards only show real source files** (`isSourceCodePath`), never docs.

## Status (2026-10-18)

- **Done:**
  - M0 to M8;
  - E1 (direction), E2 (changes to video), E4 (one-click deploys), E7 (auth);
  - the demo video, made by Cutroom, in `docs/submission/`.
- **Pending:**
  - E6 evidence: the durability run, the eval table, a 9:16 cutdown of the last day's changes, Sentry trace screenshots and the live demo link;
  - E3 (GitHub Action);
  - E5 (your own voice).
- **Credits:** visual styles adapted from the MIT `product-videos` skill (github.com/codewithveek/skills).
