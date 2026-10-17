# 0005 · Timing solver and caption cues live in `@cutroom/scene-spec`

- **Status:** accepted · 2026-10-17

## Context
PRD §8.2 lists `timing-solver` under `@cutroom/voice`. Three consumers need it: the voice step (real durations), the web storyboard preview (estimated durations, in the browser) and the renderer/video-kit (caption cues, burned-in captions). `@cutroom/voice` depends on `kokoro-js` and `onnxruntime-node`, which must never be pulled into a browser bundle.

## Decision
The solver (`solveTimeline`, `estimateTimeline`) and caption cue builder (`buildCaptionCues`) are pure functions over contracts, so they live in `@cutroom/scene-spec`. `@cutroom/voice` calls `solveTimeline` with synthesised durations and re-exports it.

## Consequences
- The browser preview and the final render use the exact same timing maths.
- `scene-spec` stays dependency-free apart from Zod.
