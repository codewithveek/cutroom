# Architecture

This is the as-built companion to PRD §8. Where the build differs from the PRD, an ADR in `docs/decisions/` says why.

## Packages

| Package | Responsibility | Depends on |
|---|---|---|
| `@cutroom/scene-spec` | Zod contracts for everything that crosses a boundary: brief, evidence, the eight block schemas, storyboard, claims, voice timeline, render job, video props, run request/status/events/view. Pure helpers that must behave identically in Node and the browser: timing solver, caption cues, claim collection, starred text. | zod |
| `@cutroom/presets` | Video-type beat templates, the six presets, `recommendLook` (a rules table). | scene-spec |
| `@cutroom/video-kit` | Remotion: looks (token sets), frame shapes, motion primitives, eight blocks, eight transitions, soundtrack mixing, burned captions, video and thumbnail compositions. Runs in the render browser and in `@remotion/player`. | scene-spec, remotion, shiki |
| `@cutroom/repo-ingest` | Source resolution (path, shallow git clone), ignore rules, secret redaction, UI string inventory, frameworks, brand hints, the redacted mirror (`SnapshotReader`), deterministic evidence verification. | scene-spec |
| `@cutroom/providers` | `ModelClient` contract, Ollama (streaming) / OpenAI-compatible / scripted transports, the validate-and-repair loop, the privacy guard and the Local-mode egress guard. | scene-spec, observability |
| `@cutroom/agent` | `analyzeProduct` (map-reduce context within a token budget, verified evidence) and `planStoryboard` (beat plan prompt, narrowed schema, word budgets, code snapping). | providers, repo-ingest, presets |
| `@cutroom/claim-audit` | Deterministic checks (UI labels, code bytes, numbers, commands, URLs, overclaims), grep retrieval, the Gemma judge with verified evidence, the approval gate, the CLI table. | providers, repo-ingest |
| `@cutroom/voice` | Kokoro / ElevenLabs / silent voices, per-line cache, narration synthesis feeding the timing solver. | audio-io, providers |
| `@cutroom/renderer` | Bundle once, `renderMedia` per ratio, two-pass loudnorm, WebVTT, thumbnail stills, MP4 cover art, versioned outputs, generated music beds and SFX. | video-kit, audio-io |
| `@cutroom/pipeline` | Run record and store, `PipelineRunner` interface, the idempotent steps, `InProcessRunner`, delivery note, scripted fixture model. | everything above |
| `apps/cli` | `cutroom make`, `cutroom setup`. | pipeline |
| `apps/api` | Fastify + `fastify-type-provider-zod`: runs, run settings, SSE events, range-served assets and preview media, system status, voices with samples, one error envelope. | pipeline |
| `apps/web` | Next.js App Router: sidebar shell, dashboard composer, the run editor (script tree, live preview, inspector, multi-track timeline), library, styles, settings. Imports only browser-safe packages (scene-spec, presets, video-kit). See ADR 0012. | scene-spec, video-kit, presets |

Each package exposes one `src/index.ts`; deep imports are blocked by Biome.

## A run, step by step

| # | Step | Persisted output | Skips when |
|---|---|---|---|
| 1 | `ingest-repository` | `runs/<id>/snapshot/` (redacted mirror + `snapshot.json`) | the snapshot exists |
| 2 | `analyze-product` | `run.brief` | a brief exists |
| 3 | `plan-storyboard` | storyboard version 1 | any version exists |
| 4 | `audit-claims` | claim results on the latest version | the version is audited |
| – | `review` | `run.approval` | approved (or `autoApprove` with no unsupported claims) |
| 5 | `synthesize-voice` | `run.voiceTimeline`, clips in the voice cache | the timeline and clips exist |
| 5b | `build-render-job` (Hybrid) | bundle + egress manifest; pauses in `awaiting_egress` | not Hybrid, or confirmed |
| 6–7 | `render` | MP4 + VTT per ratio, thumbnail PNG/JPG (local, or remote in Hybrid) | every ratio has a video |
| 8 | `quality-check` | stills at scene ends and transition midpoints, audio report | an audio report exists |
| 7b | `finalize-deliverables` | `delivery-note.md` | a note exists |

Steps emit `started` / `progress` / `completed` / `failed` events, appended to `events.jsonl` and pushed to SSE subscribers. The API resumes any run it finds mid-flight on boot.

## Privacy enforcement

- Every provider declares a network scope derived from where it actually connects (`networkScopeForUrl`), not from configuration labels.
- `createModelClient` and `createVoiceProvider` call `assertProviderAllowed` at construction; an out-of-policy provider throws `PrivacyViolationError` and never exists.
- In Local mode the CLI installs `installLocalEgressGuard`, which patches `fetch` and `http(s).request` to reject any non-loopback host for the duration of the run. The end-to-end test runs with it on.
- Kokoro runs with `allowRemoteModels = false` in Local mode; `cutroom setup` downloads the weights once beforehand.

## Hybrid mode

`build-render-job` (5b) packs the bundle and pauses in `awaiting_egress`; after `confirmEgress` the render step uploads it with the bearer-token client, polls `GET /render-jobs/:jobId` and downloads the outputs. The render host's `RenderJobWorker` re-verifies every hash and the manifest before rendering, and sweeps finished jobs after 24 h. The quality check then runs locally on the downloaded files. See ADR 0010.

## What is not built yet

Temporal workflow and worker, Postgres/Drizzle persistence, screen capture and `screenshot-window`, pgvector retrieval, zip upload, cloud deploy. See `docs/progress.md`.
