# 0009 · Remotion pinned to 4.0.536

- **Status:** accepted · 2026-10-17

## Context
CLAUDE.md requires every `remotion` / `@remotion/*` package pinned to one exact version and a check that the CLI's render queue ships non-empty, because a past patch release shipped it empty.

## Decision
All Remotion packages are pinned to `4.0.536` with `pnpm add -E`. Verified after install: `@remotion/cli/dist/render-queue/queue.js` is 7.7 KB (non-empty), and `renderMedia`/`renderStill` render the fixture storyboard in every look in this environment, using the pre-installed Chromium headless shell when present.

## Consequences
Upgrades bump every Remotion package together and repeat the check and the fixture render.
