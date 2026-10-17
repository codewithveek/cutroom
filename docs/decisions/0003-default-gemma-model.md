# 0003 · Default local model: `gemma4:e4b`

- **Status:** accepted · 2026-10-17

## Context
PRD §8.5 asks for the newest Gemma instruct tag available in Ollama at build time. Checked `ollama.com/library/gemma4/tags` on 2026-10-17: tags exist for `e2b`, `e4b`, `12b`, `26b-a4b` and `31b` (plus quantisation variants). The PRD's performance target is a 16 GB laptop.

## Decision
Default `MODEL_ID=gemma4:e4b` (instruct, q4 by default in Ollama, ~4–5 GB on disk). Users with more memory set `MODEL_ID=gemma4:12b`; Cloud mode serves a larger Gemma through an OpenAI-compatible endpoint. Structured output uses Ollama's `format` parameter with a JSON Schema.

## Consequences
- The eval harness compares `gemma4:e4b` with at least one other size (FR-EV-4).
- If a smaller machine struggles, `gemma4:e2b` is the documented fallback.
