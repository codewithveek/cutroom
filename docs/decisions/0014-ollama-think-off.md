# 0014 · Turn thinking off for structured Ollama calls

- **Status:** accepted · 2026-10-18

## Context
Every model call in Cutroom asks for JSON matching a Zod-derived schema through Ollama's `format`. With Ollama 0.40.6 and `gemma4:e4b` (a thinking-capable model), a request that leaves `think` unset or sets it to `true` ignores `format`: "Name a colour." with an object schema returns `Blue`, not `{"name":"Blue"}`. With `"think": false` the same request returns schema-valid JSON, streamed or not.

## Decision
The Ollama transport always sends `think: false`. The pipeline gets its reasoning from the schema-shaped steps (brief, storyboard, per-claim verdicts), not from hidden thinking tokens.

## Consequences
- Structured output works with the default model; the repair loop is not spent on prose answers.
- No thinking tokens: faster on CPU, and token counts match what the step produced.
- If a future model needs thinking to do well, it is a per-model setting to add here, not a default.
