# Cutroom: turn a codebase into product videos, on open models

*Draft for the DEV Hacktoberfest 2026 Open-Source AI Challenge (Week 2, "Side Hustle"). Items marked
**[author]** need the author's accounts or links before posting.*

## What it is

Cutroom reads a repository and makes the product video: a launch film, a feature drop for one
release, a tutorial, an explainer, a teaser, a social cutdown. It writes the script, checks every
claim against the code, records the voiceover and renders 16:9, 9:16, 1:1 or 4:5 MP4s with captions
and a thumbnail.

Gemma does the reasoning and Kokoro does the voice, so in Local mode the whole pipeline runs on a
laptop with no network access, enforced in code.

## Why someone would pay for it

Every release deserves a video, and almost none get one: a decent launch video costs $300–$3,000 or
days of a developer's time. Cutroom makes one from the code, and a "what's new" video from the
changes since the last tag (`cutroom make --changes v1.2.0..v1.3.0`).

## Everything shown is real

The model never writes JSX. It writes JSON against Zod schemas, and tested blocks render it. Before
anything renders, every claim is checked:

- deterministic checks first: quoted UI labels, code excerpts, numbers and commands must exist in
  the repository;
- then a Gemma judge over retrieved evidence;
- in a changes video, anything called "new" must cite lines the range added.

Unsupported claims block approval until they are fixed or overridden with a written reason, and the
delivery note lists every override.

## Cutroom filmed itself

The launch video below was made by Cutroom from this repository with `gemma4:e4b` on a 4-core CPU.
Running it surfaced eight real bugs, from Gemma ignoring the JSON schema while "thinking" to a
storyboard that could be approved after an audit that never ran. All are fixed with tests
([`README.md`](README.md)).

- 16:9: `cutroom-launch-16x9.mp4`
- 9:16: `cutroom-launch-9x16.mp4`

## Deploy your own

**Deploy to Render** and **Deploy to DigitalOcean** buttons in the README stand up the web app, the
API and Postgres. A deployed instance always has a login (one seeded admin, argon2id, server-side
sessions, CSRF origin checks, rate-limited sign-in, revocable API tokens); a laptop install never
does.

- Live demo: **[author]** `https://<domain>.tech`

## Built with

- **Gemma** (Ollama locally, vLLM on a GPU Droplet in Cloud mode) for the brief, the storyboard and
  the claim judge.
- **Temporal** for durable runs: kill the worker mid-render and the run resumes
  (`durability-run.md`).
- **Sentry** agent tracing: a span per pipeline step and per model call. **[author]** trace
  screenshots.
- **Render** and **DigitalOcean** one-click deploys.
- Remotion, Kokoro, Fastify, Next.js, Drizzle + Postgres (pgvector).

## Evals

**[pending]** `eval-table.md`.

## Agent session

**[author]** link to the exported build session.

## Credits

Cutroom's visual styles and video craft rules are adapted from the product-videos skill
(github.com/codewithveek/skills, MIT). The engine, agent pipeline and app are new for this challenge.
