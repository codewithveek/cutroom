# 0007 · A scripted model for CI and GPU-less demos

- **Status:** accepted · 2026-10-17

## Context
PRD §11 asks for a CI-safe "repo in, MP4 out" integration test with a scripted fake model client. Reviewers and contributors without a GPU also need to see the pipeline work.

## Decision
`createScriptedTransport` answers from a function and has network scope `none`. `createShipnoteScriptedTransport` returns what a well-behaved Gemma answers for `evals/fixtures/shipnote`: the brief and storyboard drafts, and claim verdicts that cite the first non-empty snippet the judge prompt shows. It is exposed as `cutroom make --scripted` and `MODEL_PROVIDER=scripted-shipnote` on the API.

## Consequences
- Every deterministic part (ingest, verification, repair loop, audit checks, timing, render, loudness, delivery note) is exercised in CI.
- The scripted judge is deliberately naive; real verdict quality is measured by the eval harness against real models, never by the script.
