# Submission evidence pack (PRD extension E6)

What exists, where it is, and what still needs the author's accounts. Every item here is
referenced from the draft post ([`post-draft.md`](post-draft.md)).

| ID | Item | Status | File |
| --- | --- | --- | --- |
| E6-1 | Durability demo: kill the worker mid-render, the run resumes | Log and run timeline from `scripts/check-durability.ts` (Temporal + Postgres) | `durability-run.md` (pending) |
| E6-2 | Sentry agent traces (per-step spans, per-call tokens, repair attempts) | **Needs the author's Sentry project**: set `SENTRY_DSN`, make one real run, screenshot the trace | — |
| E6-3 | Agent session export (DevRelay or Entire) | **Needs the author's account** | — |
| E6-4 | Live demo on the `.tech` domain, deployed with the Render button | **Needs the author's Render account and DNS** | — |
| E6-5 | Eval table from `pnpm eval` | One Gemma configuration on CPU, run here | `eval-table.md` (pending) |
| E6-6 | Cutroom's own launch video, made by Cutroom from this repo, plus a 9:16 cutdown of the last day's changes | Made with `gemma4:e4b` on a 4-core CPU, watermarked | `cutroom-launch-16x9.mp4`, `cutroom-launch-9x16.mp4` (pending) |

## What the self-filmed runs found and fixed

The first real-model runs of Cutroom on its own repository surfaced bugs the scripted tests could not:
Ollama ignoring the JSON schema while thinking (ADR 0014), a cold model load timing out the first
call, capture waiting forever on pages with an event stream, directory summaries cut off mid-string,
the voice reading a placeholder `say` ("spoken") aloud, docs lines shown as code, a judge dropping
claims from long batches, and a storyboard approvable after an audit that never ran. Each fix has a
test; see `docs/progress.md` ("Real-model run on Cutroom itself").
