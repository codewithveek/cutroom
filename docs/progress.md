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
