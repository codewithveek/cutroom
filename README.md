# Cutroom

**Turn a codebase into product videos, on open models.**

Cutroom reads a repository and produces finished product videos: launch films, feature drops, tutorials, explainers, teasers and social cutdowns, as 16:9, 9:16, 1:1 or 4:5 MP4s with voiceover, music, captions and a thumbnail.

An agent does the work a motion designer and a copywriter would do:

1. It reads the repository (and redacts secrets before anything else sees it).
2. It writes a product brief, and every feature cites file-and-line evidence that is checked against the code.
3. It picks a video structure and a visual style.
4. It writes the script as a storyboard of typed scenes.
5. It **audits every claim against the code**: quoted UI labels, code excerpts, numbers, commands, then a Gemma judge for the rest.
6. It hands you the storyboard to approve. Unsupported claims block approval until you fix them or override them with a reason.
7. It renders the result with Remotion and normalises loudness to −16 LUFS.

Gemma does the reasoning and Kokoro does the voice, so in **Local mode** the whole pipeline runs on your laptop with no network access, enforced in code: a privacy guard refuses to construct a non-local provider, and an egress guard blocks every non-loopback connection while the run executes.

> Built for the DEV Hacktoberfest 2026 Open-Source AI Challenge (Week 2, "Side Hustle"). See [`prd.md`](prd.md) for the full product spec and [`docs/progress.md`](docs/progress.md) for what is done.

## Who it is for

| Persona | Job to be done |
|---|---|
| Indie hacker / solo founder | A launch video for Product Hunt, X and LinkedIn this week |
| Dev-tool startup | A video for every release, plus 9:16 cutdowns |
| DevRel / docs team | Tutorials that stay true to the current UI |
| Agency | Client launch videos under NDA: Local mode keeps client code on their machine |

Pricing hypothesis: free and open source for self-hosted / Local mode; a ~$19/month hosted plan for GPU rendering, ElevenLabs voices and team presets; per-seat licensing for agencies.

## Install from npm

```bash
npx cutroom demo                   # films a bundled sample repo with a scripted model: needs only Node 22 and ffmpeg
npx cutroom setup                  # once: the Kokoro voice model
npx cutroom make --repo .          # needs Ollama with gemma4:e4b
```

See [`apps/cli/README.md`](apps/cli/README.md) for every flag.

## Quick start from source (Local mode)

Requirements: Node 22, pnpm 10, ffmpeg, and [Ollama](https://ollama.com).

```bash
pnpm install
pnpm cutroom setup                 # downloads the Kokoro voice model once (~90 MB)
ollama pull gemma4:e4b             # default model; see docs/decisions/0003
pnpm cutroom make --repo ./path/to/app --preset launch-editorial --ratios 16:9,9:16 --privacy local
```

The CLI prints the storyboard and the claim audit table, then asks for approval. `--yes` approves automatically when no claim is unsupported.

No GPU handy? Try the whole pipeline on the bundled fixture with a scripted model:

```bash
pnpm cutroom make --repo evals/fixtures/shipnote --yes --scripted
```

### Hybrid mode

Analysis, audit, review and voice stay on your machine; only the approved render bundle is uploaded to a render host, after you confirm its manifest (every file, every code excerpt shown on screen, and a SHA-256 the host re-verifies).

```bash
# on the render host (any machine with ffmpeg and Chromium)
RENDER_API_TOKEN=<secret> pnpm --filter @cutroom/api start
# on your laptop
RENDER_API_BASE_URL=https://render.example.com RENDER_API_TOKEN=<secret> \
  pnpm cutroom make --repo . --privacy hybrid
```

### Web app

```bash
pnpm --filter @cutroom/api dev     # http://127.0.0.1:4100
pnpm --filter @cutroom/web dev     # http://localhost:3000
```

The wizard takes a source, a privacy mode and a preset; the run page shows the live pipeline timeline, the product brief with evidence chips, and the storyboard editor: scene list, a live `@remotion/player` preview with a ratio switcher, a props form generated from each block's Zod schema, audit badges with "Apply suggestion", and approval with typed overrides. Set `MODEL_PROVIDER=scripted-shipnote` on the API to click through without a model.

## How it works

```
apps/web (Next.js) ──REST + SSE──▶ apps/api (Fastify, Zod) ──▶ PipelineRunner ◀── apps/cli
                                                                 │ InProcessRunner (Temporal later)
   ┌──────────────┬───────────────┬───────────────┬──────────────┼──────────────┬──────────────┐
   ▼              ▼               ▼               ▼              ▼              ▼              ▼
repo-ingest     agent        claim-audit        voice         renderer      video-kit      providers
(snapshot,   (analyze,      (deterministic   (Kokoro /      (bundle,      (looks, blocks,  (Ollama /
 redaction)   plan)          + Gemma judge)   ElevenLabs)    loudness)     transitions)     OpenAI-compat,
                                                                                             privacy guard)
                     all speaking @cutroom/scene-spec: Zod contracts for every boundary
```

- **Models fill contracts; code renders.** Gemma returns JSON validated against Zod schemas (sent to Ollama as the structured-output `format`); a validate-and-repair loop sends Zod issues and word-budget problems back, up to three attempts. The model never writes JSX: a fixed, tested library of eight scene blocks renders the storyboard.
- **Narration drives timing.** Scene lengths come from synthesised voice durations through a timing solver; the browser preview uses the same solver with estimated durations.
- **One storyboard, every shape.** Aspect ratio is a render-time parameter; blocks lay themselves out per frame shape, and 9:16 keeps content out of the bottom 20%.
- **Four looks** (Studio, Editorial, Graphic, Cinematic) are typed token sets; the product's brand accent replaces the look's accent when the repo has one. `recommendLook` is a rules table, not a model call.
- **Durable steps.** Every pipeline step is idempotent and checks for its persisted output, so a restarted API resumes interrupted runs from the last completed step.

More in [`docs/architecture.md`](docs/architecture.md) and the decision records in [`docs/decisions/`](docs/decisions).

## Repository layout

```
apps/       web · api · cli
packages/   scene-spec · video-kit · repo-ingest · agent · claim-audit · providers
            voice · renderer · pipeline · presets · audio-io · observability · config
evals/      fixtures (shipnote) and the eval harness
docs/       architecture, decisions (ADRs), progress
```

## Evals

```bash
pnpm eval --models gemma4:e2b,gemma4:e4b                 # every pinned fixture, per model
pnpm eval --fixtures shipnote,vercel-serve
```

Results land in `evals/results/<date>-<model>.json` and `.md`: evidence validity, storyboard first-try validity, repair attempts, claim verdicts and time per step.

## Development

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm --filter @cutroom/renderer render:fixture       # every look × 16:9 and 9:16 from a hand-written storyboard
pnpm --filter @cutroom/renderer render:block-stills  # every block × allowed look × ratio, as contact sheets
```

The test suite includes the CI-safe "repo in, MP4 out" run: the in-process pipeline on the fixture repo with a scripted model and the egress guard on.

## Credits

Cutroom's visual styles and video craft rules are adapted from my open-source [product-videos skill](https://github.com/codewithveek/skills) (MIT). The engine, agent pipeline and app are new for this challenge.

Open models and libraries doing the heavy lifting: [Gemma](https://ai.google.dev/gemma) via [Ollama](https://ollama.com), [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) via [kokoro-js](https://github.com/hexgrad/kokoro) (Apache-2.0), [Remotion](https://www.remotion.dev) (free for individuals and companies of up to three people; a company licence above that), [Shiki](https://shiki.style), Inter, Plus Jakarta Sans, Inter Tight and Geist (SIL OFL).

## Commits after the deadline

None yet. Any commit after 2026-10-18 23:59 PDT will be listed here.
