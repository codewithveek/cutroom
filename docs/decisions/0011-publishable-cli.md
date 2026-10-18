# 0011 · Publishing the CLI as one npm package

## Context

Workspace packages are source-only (ADR 0002): they export `src/index.ts` and run through `tsx`. That works in the monorepo but not for `npx cutroom`. The renderer also bundled `@cutroom/video-kit` from its sources with webpack on the first render, which a published package would have to ship (sources, webpack and all).

## Decision

- Publish a single package, `cutroom`, from `apps/cli`. `scripts/build.ts` uses esbuild to inline every `@cutroom/*` package into `dist/cli.js`; third-party packages stay external and are the package's `dependencies`. Workspace packages move to `devDependencies`, so nothing internal is published.
- The build fails when an external import is missing from `dependencies`, a dependency is never imported, or a version differs from the one the workspace pins. Remotion packages therefore stay on one exact version.
- The Remotion bundle is built at pack time into `dist/remotion-bundle`. `bundleVideoKit({ prebuiltDirectory })` copies it into the data directory (runs stage assets inside the bundle, and `node_modules` may be read-only); `@remotion/bundler` is imported lazily and is not a dependency.
- Source maps stay in the bundle because Remotion reads them to symbolicate render errors (a run failed with `ENOENT bundle.js.map` without them); `sourcesContent` and the build machine's paths are stripped.
- `cutroom demo` ships the shipnote fixture so the scripted model works from npm with no Ollama. `cutroom make` checks for ffmpeg and the Ollama model before starting.

## Consequences

- 3.8 MB tarball, ~19 MB unpacked, plus Remotion, Kokoro/transformers and Shiki from npm.
- `pnpm build` now also builds the Remotion bundle (~20 s). CI packs the tarball, installs it in an empty directory and runs `cutroom demo`.
- Remotion's licence applies to users: free for individuals and companies of up to three people. The package README says so.
- Publishing: `pnpm --filter cutroom publish --access public` (pnpm, so `workspace:*` in devDependencies is rewritten).
