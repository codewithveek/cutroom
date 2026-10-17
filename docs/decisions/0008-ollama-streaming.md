# 0008 · Stream Ollama responses

- **Status:** accepted · 2026-10-17

## Context
A first real run with `gemma4:e2b` on a 4-core CPU took 300 s for the brief and then failed planning with `fetch failed`. Node's fetch (undici) aborts when response headers take longer than 300 s, and a non-streamed Ollama answer sends no headers until generation finishes.

## Decision
The Ollama transport sends `stream: true` and reads the NDJSON stream (`readOllamaStream`), accumulating content and taking token counts from the final `done` chunk. Structured output (`format`) is unchanged.

## Consequences
- Slow hardware can take as long as it needs; headers arrive immediately.
- Token-level progress is available for a future progress bar.
