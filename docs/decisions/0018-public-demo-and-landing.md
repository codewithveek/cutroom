# 0018 · Public demo mode and the cutroom.tech landing page

- **Status:** accepted · 2026-10-19

## Context
prd-site: judges need a page that explains Cutroom and a demo they can click through, with no
security or cost risk. ADR 0016 refuses an open API on a public address. The demo must be the real
app, not a mock-up, and must not be able to ingest code, call a model or render.

## Decision
- **One flag, `CUTROOM_DEMO_MODE`**, Zod-validated in `@cutroom/config`. It is the only case where
  `CUTROOM_AUTH_MODE=none` is allowed off loopback; it refuses provider secrets and a password login,
  so a misconfigured demo fails at boot instead of running half-open.
- **The API is the boundary.** In demo mode an `onRequest` hook answers every request that is not
  GET, HEAD or OPTIONS with `403 DEMO_READ_ONLY`, with no allow-list. HEAD and OPTIONS change nothing
  and CORS preflights need them. Uploads and `/sources/tags` (which runs git) are not registered.
- **Defence in depth.** `assertNotDemoMode` throws `DemoModeDisabledError` in the step executor,
  ingest, render, the model and voice factories, and voice samples. The demo's system status is
  static and probes nothing.
- **Rate limit keyed on the last X-Forwarded-For entry.** `trustProxy: true` makes `request.ip` the
  leftmost entry, which the client controls. Render's load balancer appends the real address, and
  the web app's proxy forwards the header unchanged, so the rightmost entry is the one to trust. The
  landing site's waitlist uses the same rule.
- **Seed from files, every boot.** `demo/seed/runs/<runId>/` holds `run.json` (paths relative to that
  folder), the step events and the deliverables, made by `cutroom demo` and exported with
  `scripts/export-demo-seed.ts`. An empty store is seeded on boot, so the demo needs no disk or
  database and restarts clean. Paths that leave the run's folder are refused.
- **Editor without saves.** In demo mode a completed seeded run is editable in the browser. Saves and
  every other write hit the API and show its 403 message in the editor's existing toast. "Approve &
  render" opens the pre-rendered result.
- **Landing page as its own app** (`apps/landing`): static Next.js with the web app's tokens, font and
  mark, plus one route handler for the waitlist. It creates its single table (`waitlist_signups`)
  idempotently rather than depending on `@cutroom/db`, which would pull the pipeline into its bundle.
  The rate limiter is in memory because the site runs as one instance.
- **The video on the landing page** is the 9:16 cut of Cutroom's own launch video (docs/submission,
  E6-6). It is the cut with burned-in captions; the 16:9 cut's captions file was not kept.

## Consequences
- A second deploy of the same images serves the demo: `deploy/cutroom-tech.render.yaml`.
- Refreshing the demo means re-running `cutroom demo` and the exporter, then committing `demo/seed`
  (about 6.5 MB).
- The waitlist's rate limit resets when the landing service restarts and does not span instances.
