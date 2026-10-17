# 0002 · Workspace packages ship TypeScript source

- **Status:** accepted · 2026-10-17

## Context
Every package exposes one `src/index.ts`. Consumers are tsx (CLI, API), Vitest, Next.js (`transpilePackages`) and the Remotion bundler (webpack + esbuild loader). All of them compile TypeScript themselves.

## Decision
Internal packages are "just-in-time" packages: `exports` points at `./src/index.ts`, there is no per-package build step, and imports are extensionless (`moduleResolution: Bundler`). `pnpm typecheck` runs `tsc --noEmit` per package through Turborepo; `pnpm build` builds only the apps.

## Consequences
- No stale `dist/` between packages; edits are visible everywhere immediately.
- Packages are not publishable to npm as-is. If one ever needs publishing, add a `tsup` build for that package only.
- Deep imports (`@cutroom/x/src/...`) are blocked by Biome's `noRestrictedImports`.
