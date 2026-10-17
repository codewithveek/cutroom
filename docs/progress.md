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
