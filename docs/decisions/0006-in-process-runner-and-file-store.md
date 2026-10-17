# 0006 · In-process runner with a file-backed run store for Week 2

- **Status:** accepted · 2026-10-17

## Context
PRD §8.1 puts every step behind a `PipelineRunner` so the Week-2 cut can ship with an `InProcessRunner` and the Temporal runner can follow. Postgres + Drizzle (§8.6) and Temporal (§8.4) are both cut from the Week-2 path (ADR 0001).

## Decision
- `InProcessRunner` executes the step registry in the API (or CLI) process.
- Runs persist to `<CUTROOM_DATA_DIR>/runs/<runId>/run.json` (written by atomic rename, updates serialised per run) and `events.jsonl` (append-only), behind a `RunStore` interface.
- Every step is idempotent: it checks for its persisted output before working. On boot the API resumes runs whose status is mid-pipeline, which covers "a crashed render resumes from the last completed step" (G5) for a single process.

## Consequences
- No database is needed to try Cutroom; `docker compose up` is optional.
- A Drizzle `RunStore` and a `TemporalRunner` can be added without touching steps, CLI, API or web.
- Concurrent writers across processes are not supported; one API process owns a data directory.
