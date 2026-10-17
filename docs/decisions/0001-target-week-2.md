# 0001 · Target Week 2 ("Side Hustle")

- **Status:** accepted · 2026-10-17

## Context
PRD §13 asks for the target week to be decided before the first commit. The repository was created on 2026-10-17 and Week 2 closes on 2026-10-18 at 11:59 PM PDT. Week 3 requires the repo not to exist before Oct 19, which is no longer possible.

## Decision
Build the **Week 2 path**: M0 → M1 → M2 → M3 → a thin M5 (single page: source → preset → storyboard review → render) backed by the `InProcessRunner` behind the API. Temporal, the full storyboard editor and M6 polish are cut for the submission and stay behind the `PipelineRunner` interface for later.

Where cheap, we still build more than the cut line (all four looks rather than two; all eight P0 blocks rather than six), because looks are token sets and blocks share one motion vocabulary.

## Consequences
- Run state is persisted to the local data directory (JSON files) behind a repository interface rather than Postgres/Drizzle; the `db` package and Temporal worker are follow-ups.
- Any commit after the deadline is listed in the README.
