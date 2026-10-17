# CLAUDE.md: Cutroom

Cutroom turns a codebase into product videos with an agent that runs on open-weight models. **`prd.md` is the source of truth.** Read it before starting any milestone, and re-read the relevant section before touching a feature.

## How to work in this repo

1. **Build in milestone order** (PRD §13: M0 → M7). Finish a milestone's acceptance criteria before starting the next. Track progress in `docs/progress.md`: one line per completed item, with the date.
2. **Plan before you code** for anything that touches more than one package. Write the plan, list the files you will create or change, then build.
3. **Contracts first.** A new block, step or endpoint starts with its Zod schema in `@cutroom/scene-spec` (or the owning package), then tests, then the implementation.
4. **Verify library APIs before using them.** Remotion, Temporal, Ollama, kokoro-js, ElevenLabs and Sentry change often. Check the current docs. When a choice is non-obvious, record it as an ADR in `docs/decisions/NNNN-kebab-title.md` (context, decision, consequences).
5. **Ask before deviating** from an architectural decision in PRD §8 or a product principle in §5. Don't ask about routine implementation choices; make them and note them in the commit.
6. **Keep commits small and real.** Use conventional commits (`feat(video-kit): add odometer block`), one logical change per commit. Never make a single bulk "initial code" commit. Commit history is evidence for the hackathon.

## Product invariants (never break these)

- **Everything shown is real.** No invented UI, features, statuses or numbers in a video. Placeholder *data* is fine; placeholder *features* are not.
- **The model never writes JSX.** LLM output is JSON validated against Zod schemas; tested blocks render it.
- **Narration drives timing.** Scene lengths come from voice durations via the timing solver. Never hand-time audio.
- **Privacy modes are enforced in code** at the provider factory (`PrivacyViolationError`). In Hybrid mode, only the approved `RenderJob` crosses to the cloud, after the egress manifest is confirmed.
- **Redact secrets** before any content reaches a model, a log, a trace or a video frame.
- **Deterministic renders.** Seeded randomness only.

## Code standards (mandatory)

- **TypeScript strict** with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. **Never use `any`**; use `unknown` and narrow. No `@ts-ignore`; if `@ts-expect-error` is unavoidable, add a reason.
- **Organise by domain/feature**, not by technical layer. Each package exposes one public `src/index.ts`; no deep imports across packages.
- **kebab-case** for every file and folder (`timing-solver.ts`, `plan-storyboard/`). React components are PascalCase *identifiers* in kebab-case *files*.
- **Descriptive names.** `sceneDurationFrames`, `claimVerdict`, never `d`, `f`, `tmp` or `data2`.
- **No god functions or components.** A function does one thing; if it needs a comment saying "and then", split it. Components stay small and composed.
- **Three or more parameters → one options object** with a named type (`renderRatio(options: RenderRatioOptions)`).
- **Zod at every boundary:** env, HTTP request and response, model output, DB jsonb columns, files read from disk.
- **Errors:** typed error classes per domain (`StoryboardValidationError`, `PrivacyViolationError`), with one API error envelope `{ error: { code, message, details? } }`. Never swallow errors; never log secrets.
- **IDs:** ULIDs.
- **Logging:** pino via `@cutroom/observability`, with `runId` and `step` on every line. Wrap model calls and pipeline steps in Sentry spans.

## Stack

pnpm workspaces + Turborepo · TypeScript · Fastify (`fastify-type-provider-zod`) · Next.js App Router + Tailwind + shadcn/ui · Drizzle + Postgres (+pgvector P1) · Temporal (TS SDK) · Remotion (`@remotion/player`, `@remotion/renderer`, `@remotion/bundler`, `@remotion/transitions`) · Ollama (Gemma) · kokoro-js · ElevenLabs (optional) · Playwright (P1) · Shiki · Vitest · Biome · Sentry.

## Remotion rules (learned the hard way)

- **Pin every `remotion` and `@remotion/*` package to the same exact version** (`pnpm add -E`). After installing, check that the CLI's render queue file is non-empty; a past patch release shipped it empty.
- `import React from "react"` at the top of every `.tsx` the Remotion bundler touches.
- **Self-host fonts** in `public/fonts` and load them with `@remotion/fonts`. Never fetch from Google Fonts at render time; it breaks offline and behind proxies.
- Never pass `Infinity` to `interpolate`; use `1e6`.
- Transitions only exist where scenes overlap. Check stills at transition midpoints of the *full* composition, not just per-scene stills.
- Don't spread `rise()` (which sets `transform`) and add another `transform` on the same element. Wrap instead.
- Thumbnails are 240-frame compositions rendered at frame 239, not `<Still>` + `<Freeze>`.
- Loudness: two-pass `loudnorm` to −16 LUFS / −1.5 dBTP with `-vn` on the measuring pass. Read Kokoro's 32-bit float WAVs as float.

## Testing and definition of done

A change is done when:
- `pnpm typecheck && pnpm lint && pnpm test` pass.
- New logic has unit tests (pure functions especially: timing solver, word budget, recommend-look, redaction, deterministic claim checks).
- New or changed blocks render stills in every allowed look × every ratio without errors.
- Anything touching the pipeline passes the in-process end-to-end test on the smallest fixture repo, using the fake model client.
- The milestone checklist in `docs/progress.md` is updated.

Real-model evals (`pnpm eval`) are run manually, not in CI.

## Commands (keep this list current as scripts are added)

```bash
pnpm install
docker compose up -d                 # postgres(+pgvector), temporal dev server
ollama pull <gemma-tag>              # tag recorded in docs/decisions/
pnpm dev                             # web + api + worker
pnpm typecheck && pnpm lint && pnpm test
pnpm cutroom make --repo <path> --preset launch-editorial --ratios 16:9,9:16 --privacy local
pnpm eval
```

## Credits

The visual styles and video craft rules are adapted from the author's MIT-licensed `product-videos` skill (github.com/codewithveek/skills). Keep the credit line from PRD §16 in the README. When porting an idea from it, rewrite it for this architecture (typed blocks driven by storyboard JSON); don't paste files.
