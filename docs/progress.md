# Progress

One line per completed item, with the date. Milestones follow PRD §13.

## M0 · Scaffold
- 2026-10-17 · pnpm workspaces + Turborepo, strict tsconfig base, Biome (kebab-case filenames, no `any`, no deep imports), Vitest, CI workflow
- 2026-10-17 · `@cutroom/config`: Zod env schema, `loadEnv` that refuses invalid config, brand constants
- 2026-10-17 · `@cutroom/observability`: pino logger with secret redaction and runId/step child loggers; Sentry span helpers (pipeline step, gen_ai model call)
- 2026-10-17 · ADRs 0001–0004 (Week 2 target, source-only packages, default Gemma tag, Zod 4 JSON Schema)

## M1 · Contracts + video kit
- 2026-10-17 · `@cutroom/scene-spec`: Zod contracts for brief, evidence, eight P0 blocks, storyboard, claims, voice timeline, render job, video props; per-look narrowed draft schema
- 2026-10-17 · Timing solver (narration-driven scene lengths) and caption cue builder, unit-tested
- 2026-10-17 · `@cutroom/video-kit`: four looks as token sets, eight P0 blocks, eight transitions, frame shapes for 16:9 / 9:16 / 1:1 / 4:5, self-hosted fonts, music ducking, whoosh SFX, burned captions, thumbnail composition (240 frames, captured at 239), 16:9 thumbnail intro
- 2026-10-17 · `@cutroom/renderer`: bundle once, renderMedia per ratio, two-pass loudnorm (−16 LUFS / −1.5 dBTP), WebVTT, cover art, versioned outputs, generated music beds and SFX
- 2026-10-17 · **Acceptance:** fixture storyboard rendered to MP4 in 16:9 and 9:16 in all four looks with captions and thumbnails (`pnpm --filter @cutroom/renderer render:fixture`; ~2 min per look on 4 cores). Integrated loudness lands within ~1 LU of target; true peak occasionally overshoots by ≤0.5 dB on music-only beds (follow-up: limiter pass)

## M2 · Agent core (in-process)
- 2026-10-17 · `@cutroom/repo-ingest`: path and shallow git sources, .gitignore + default ignores, binary and size caps, secret-file skipping and regex redaction that preserves line numbers, UI string inventory (JSX, attributes, i18n, CLI help), frameworks, README commands, brand hints, redacted mirror
- 2026-10-17 · `@cutroom/providers`: Ollama (streaming) and OpenAI-compatible transports, scripted transport, validate-and-repair loop (3 attempts), privacy guard at construction, Local-mode egress guard
- 2026-10-17 · `@cutroom/agent`: analyze-product with a token budget and map-reduce directory summaries (cached by content hash), deterministic evidence verification (verified / relocated / rejected → weak); plan-storyboard with beat plan, look-narrowed schema, word budgets at 2.5 words/s, headline length, filler openers, exact-byte code snapping
- 2026-10-17 · `@cutroom/voice`: Kokoro (offline in Local mode), ElevenLabs (PCM), silent voice, per-line cache keyed on text/voice/speed/provider, −1 dBFS clip normalisation, narration → timing solver
- 2026-10-17 · `@cutroom/pipeline`: run store, idempotent steps, `InProcessRunner`, delivery note; `cutroom make` and `cutroom setup`
- 2026-10-17 · **Acceptance:** `pnpm cutroom make --repo evals/fixtures/shipnote --yes --scripted` produced narrated 16:9 and 9:16 MP4s (Kokoro voice, −16.1 LUFS / −2.0 dBTP) in Local mode with the egress guard on; the same flow runs in CI as `pipeline.test.ts`
- 2026-10-17 · Real model: `gemma4:e2b` on a 4-core CPU wrote a schema-valid brief on the first attempt (5 features, 8 excerpts verified, 2 rejected); planning exposed fetch's 300 s header timeout, fixed by streaming (ADR 0008)

## M3 · Claim audit
- 2026-10-17 · Deterministic checks: quoted UI labels against the inventory, code excerpts byte-for-byte against the redacted file, numbers against the repo, commands against README/scripts, URLs, overclaim lexicon (weak, never blocking)
- 2026-10-17 · Model judge: grep retrieval with line-numbered snippets, batched Gemma verdicts, cited evidence re-verified (an unverifiable "supported" becomes weak), rewrites as suggestions
- 2026-10-17 · Approval gate with typed overrides (≥ 8 characters), CLI audit table, re-audit of changed scenes only on edit

## M5 · Web app (Week-2 thin cut, plus most of the full editor)
- 2026-10-17 · `apps/api`: Fastify + Zod type provider, POST/GET runs, SSE events with replay, PUT storyboard (versioned, re-audited), approve (409 `approval_blocked`), range-served assets, one error envelope; resumes interrupted runs on boot
- 2026-10-17 · `apps/web`: wizard (source, privacy, preset, live look previews, ratios, brand accent), run timeline with durations and tokens, brief with evidence viewer, storyboard editor (scene list with reorder and audit badges, `@remotion/player` preview with ratio switcher, schema-generated props form, narration text/say, transitions, apply suggestion, override dialog), renders with players and downloads, delivery note, library

## M6 · Hybrid + production polish (partial)
- 2026-10-17 · Hybrid mode: `build-render-job` step, egress manifest with hash, `awaiting_egress` pause and `confirmEgress`, bearer-token upload client (the only external role allowed), remote render API on the API server (`POST /render-jobs`, status, file download) that re-verifies hashes and the manifest, 24 h sweep; CLI prompt and web egress panel; end-to-end test with a live render host (ADR 0010)
- 2026-10-17 · Sentry agent tracing: a span per pipeline step and per model call with gen_ai model, token and validation attributes (enabled when `SENTRY_DSN` is set)
- 2026-10-17 · Eval harness: `pnpm eval` over five fixtures pinned by commit (shipnote, vercel/serve, fastify/demo, vercel/commerce, Cutroom itself), JSON + markdown table per model; `--scripted` self-test

## M7 · P1 features (partial)
- 2026-10-17 · Brand extraction (accent from Tailwind/CSS variables, font, logo copied into the snapshot and used by title and end cards)
- 2026-10-17 · Quality check: stills at every scene end and transition midpoint, audio report (peak, RMS, energy below 250 Hz, loudness per second); surfaced in the CLI, delivery note and web renders panel
- 2026-10-17 · Regenerate one scene with the others as fixed context (agent, runner, `POST /runs/:runId/scenes/:sceneId/regenerate`, inspector button with an optional direction)
- 2026-10-17 · Contract check script: every block in every allowed look × ratio (`pnpm --filter @cutroom/renderer render:block-stills`)

- 2026-10-18 · Zip sources: safe extraction (no zip slip, symlinks or size bombs), `POST /uploads`, drop a .zip in the composer, `--repo app.zip`
- 2026-10-18 · Edit the brief during review and re-plan from it; edited evidence is re-verified against the snapshot
- 2026-10-18 · Uploaded music track (transcoded to WAV) in local and Hybrid renders, from the Audio panel or `POST /runs/:id/music`
- 2026-10-18 · `diagram-flow` block, audited node labels, in the explainer template
- 2026-10-18 · Read-only Playwright screen capture with redaction and real element boxes; `screenshot-window` block; capture step after ingest; App screens in the wizard; `--app-url`/`--routes`
- 2026-10-18 · Semantic code retrieval for the claim judge: Ollama or offline hashing embeddings, pgvector index synced by content hash (`EMBEDDINGS`)

- 2026-10-18 · Watermark: a "created with cutroom" badge (Cutroom mark, bottom right) on every ratio, in local, Hybrid and quality-check renders and the editor preview; `--watermark`; `--direction` on the CLI
- 2026-10-18 · Ollama calls send `think: false`, so gemma4 honours the JSON schema (ADR 0014)
- 2026-10-18 · Watermark toggle in the new-video wizard
- 2026-10-18 · Captured screens reach the storyboard: `screenshot-window` in launch/feature-drop moments and tutorial steps, at least one when screens were captured

## Real-model run on Cutroom itself (gemma4:e4b, 4-core CPU)
Cutroom made its own demo video (16:9 + 9:16, watermarked). The run surfaced and fixed:
- 2026-10-18 · Capture waits for `load`, not network idle, so pages with an open event stream are captured
- 2026-10-18 · Directory summaries get 2,048 output tokens (were cut off at 1,200) and stop once the analysis budget is full
- 2026-10-18 · Word-budget repairs quote the headline and say how many words to cut or add
- 2026-10-18 · The claim judge keeps returned verdicts and re-asks only for claims it left out
- 2026-10-18 · An edit whose audit failed can no longer be approved, and its empty results are never carried over
- 2026-10-18 · API answers model failures with `model_output_invalid` / `model_unavailable`, not `internal`
- 2026-10-18 · `docs/architecture.md` said eight blocks (there are ten); the judge had accepted the stale number

## Deploy
- 2026-10-18 · `cutroom-node` (API/worker) and `cutroom-web` images, both start without network access; single-host compose stack (Postgres + pgvector, Temporal, Caddy TLS), Render blueprint, vLLM script for Gemma; Temporal Cloud via API key (docs/deploy.md)

## Distribution
- 2026-10-18 · Publishable `cutroom` npm package: esbuild bundle with a dependency check, prebuilt Remotion bundle, `cutroom demo` with the bundled fixture, ffmpeg/Ollama preflight; tarball installed in an empty directory renders 16:9 + 9:16 (ADR 0011)

## UI v2 · editor-first interface (ADR 0012)
- 2026-10-18 · API: `GET /system/status`, `GET /voices` + local Kokoro samples, `PATCH /runs/:id/settings` (voice, music until approval), run preview media (voice clips, logo), `direction` on the run request (redacted, steers planning)
- 2026-10-18 · Shell: warm dark/light themes, collapsible sidebar with a projects → videos tree, activity badge, fly-out on the rail
- 2026-10-18 · Home: composer (source, direction, preset chips, privacy, look, ratios, model chip, sample repository), recent videos with live storyboard frames, setup checklist
- 2026-10-18 · Editor: mode tabs, script tree (play a line, reorder, add from block templates, duplicate, delete, regenerate), live preview fitted to any ratio, voice picker with samples, looks, aspect ratio, claim audit, multi-track timeline (video thumbnails, real voice waveforms after synthesis, music, captions), undo/redo, keyboard shortcuts, renders on the stage, brief/pipeline sheets
- 2026-10-18 · Library and Activity with filters and search, Styles gallery (hover to play each look), Settings (toolchain, model, voices, privacy, appearance)
- 2026-10-18 · Capability flags for designed-but-off features (script source, screen capture, generated media, voice cloning, music upload, manual timing)

## M4 · Durable pipeline (ADR 0013)
- 2026-10-18 · Shared `StepExecutor` + `RunCommands` for both runners; local event bus
- 2026-10-18 · `@cutroom/db`: Drizzle schema for PRD §8.6 (incl. pgvector `code_chunks`), migrations, `PostgresRunStore` (row locks, LISTEN/NOTIFY events), integration tests against Postgres in CI
- 2026-10-18 · `@cutroom/temporal`: `produceVideoWorkflow` (PRD retries/timeouts, heartbeats, review/egress signals, `getRunStatus` query), activities on the step executor, `TemporalRunner`; `apps/worker`; API picks the runner from `RUNNER`
- 2026-10-18 · Acceptance: `scripts/check-durability.ts` kills the worker mid-render; a new worker finishes the run (CI job `durability`)

## M8 · PRD extension (prd-extend-1)
- 2026-10-18 · E4 one-click deploys: Render Blueprint and DigitalOcean App Platform template with README buttons; web app proxies the API at a runtime address; API and Temporal worker share one container (`cutroom-service all`); `/health` reports runner, database and checks; generated render-API token; `DEFAULT_PRIVACY_MODE` (ADR 0015)

- 2026-10-18 · E7 auth for deployed instances: login required off loopback (refuses to start open or with weak secrets), one seeded argon2id admin, hashed server-side sessions, CSRF origin checks, rate-limited login with backoff, helmet, revocable `ctr_` API tokens, `/login` page and Settings → Account / API tokens, generated secrets in the Render Blueprint (ADR 0016)

- 2026-10-18 · E1 direction hardened: `directionSchema` parsed from the free text (audience, tone, must-say / must-not-say), a delimited `<user_direction>` block for the brief and the storyboard, a system rule that it cannot add claims, repair issues for missing / forbidden phrases
- 2026-10-18 · E2 changes-to-video: `ChangeSnapshot` (commits, redacted hunks, added lines, CHANGELOG section), `analyze-changes` with added-line evidence, "new" claims audited against added lines, `no_user_visible_changes`, `feature-drop-editorial` preset, `--changes` / `--include-fixes`, composer `Whole product ▾` chip (ADR 0017)

## cutroom.tech · landing and public demo (prd-site, ADR 0018)
- 2026-10-19 · Demo mode: `CUTROOM_DEMO_MODE` (the one public `auth none` exception, no secrets), read-only `onRequest` hook (403 `DEMO_READ_ONLY`), 120/min/IP rate limit keyed on the load balancer's address, no upload or git routes, `DemoModeDisabledError` in the executor, ingest, render, model and voice factories
- 2026-10-19 · Demo seed: shipnote run (brief, storyboard, 24-claim audit, Kokoro voice, 16:9 + 9:16 MP4s, captions, thumbnails) in `demo/seed`, loaded into an empty store on boot; exporter script
- 2026-10-19 · Demo UI: banner, `shipnote (sample)` composer, browser-only edits with the API's message in the toast, Approve & render opens the pre-rendered result, noindex + robots.txt
- 2026-10-19 · `apps/landing`: nav, hero, Cutroom's own launch video (captions burned in, reduced motion respected), features, how it works, four looks rendered by video-kit, quick start with copy, waitlist (Zod, honeypot, 5 per 10 min per IP, stored once), footer credit, OG/Twitter tags; no horizontal scroll at 360 px
- 2026-10-19 · `deploy/cutroom-tech.render.yaml` and `deploy/landing.Dockerfile`

## Not done yet
- Deploying to the .tech domain (needs the Droplet or Render account and DNS)
