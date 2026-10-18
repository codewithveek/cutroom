# 0013 · Temporal runner and Postgres store

## Context

PRD M4 asks for a durable pipeline: a Temporal workflow and worker, a Drizzle/Postgres data model, SSE events, and "killing the worker mid-run resumes correctly". The in-process runner (ADR 0006) already had idempotent steps behind `PipelineRunner` and `RunStore`.

## Decision

- **One step executor for both runners.** `StepExecutor` (pipeline) owns a step's bookkeeping: status, started/completed/failed events, metrics and pause states. `RunCommands` owns validated human actions (approve, confirm egress, edit, regenerate, settings). `InProcessRunner` loops over steps in the API process; `TemporalRunner` (`@cutroom/temporal`) records the action and signals the workflow.
- **Workflow.** `produceVideoWorkflow` runs each step as the `runPipelineStep` activity, with PRD §8.4 retries and timeouts (`stepPolicies`), a 30 s heartbeat timeout (heartbeats every 5 s) so a dead worker is noticed quickly, and the `getRunStatus` query. A step that pauses (review, Hybrid egress) waits for the `approveStoryboard` / `confirmEgress` signal and runs again. The store stays the source of truth, so signals carry no payload. The workflow imports only plain data (`workflow-contracts.ts`), and a test pins its step list to the pipeline registry.
- **Retries vs failure records.** Activities rethrow errors so Temporal retries; only the final attempt records the run as failed.
- **Postgres store.** `@cutroom/db` maps a `RunRecord` onto the PRD §8.6 tables (projects, runs, run_events, product_briefs, storyboard_versions, claim_results, voice_clips + run_voice_clips, assets, code_chunks with pgvector). `update` row-locks the run (`SELECT … FOR UPDATE`) so the API and worker never lose a write. Working files stay on disk under the data directory, which the API and the worker share.
- **Events across processes.** Appending an event runs `pg_notify`; the API's `TemporalRunner.subscribe` LISTENs and reads events after its cursor, so SSE stays live while the worker runs steps.
- **Configuration.** `RUN_STORE=file|postgres`, `RUNNER=in-process|temporal` (temporal requires postgres), `DATABASE_URL`, `TEMPORAL_*`. Defaults keep the zero-dependency file store and in-process runner; the CLI always runs in process.

## Consequences

- `scripts/check-durability.ts` (and the CI `durability` job) proves the M4 acceptance: it SIGKILLs the worker mid-render, starts another, and the run completes with the render step started twice.
- The Postgres store rewrites a run's child rows on every update. Runs are small (one storyboard, tens of claims), so this stays cheap and simple. Revisit it if runs grow.
- Temporal bundles the workflow with webpack at worker start (about 1 s).
