# 0004 · Zod 4 with native JSON Schema conversion

- **Status:** accepted · 2026-10-17

## Context
FR-SB-2 names `zod-to-json-schema`. That library targets Zod 3; Zod 4 (current: 4.6.x) ships `z.toJSONSchema()` natively, which supports discriminated unions and `.meta()` descriptions.

## Decision
Use Zod 4 everywhere and `z.toJSONSchema(schema, { target: "draft-7", io: "input" })` for the model `format` / `response_format`. No `zod-to-json-schema` dependency.

## Consequences
- One fewer dependency, and the schema the model sees is generated from the exact Zod object that validates its output.
- Remotion's optional `schema` prop on `<Composition>` is not used (it pins a Zod 3 version); input props are validated with our own schemas in `calculateMetadata`.
