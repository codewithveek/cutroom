import { parseEnv } from "@cutroom/config";
import { describe, expect, it } from "vitest";
import { createEmbeddingClient, createHashingEmbeddingClient } from "./embedding-client";
import { PrivacyViolationError } from "./privacy-guard";

describe("createHashingEmbeddingClient", () => {
  it("is deterministic, unit length and closer for texts that share words", async () => {
    const embedder = createHashingEmbeddingClient({ dimensions: 64 });
    const [claim, related, unrelated, again] = await embedder.embed([
      "groups commits by type",
      "export function groupCommits(commits) { by type }",
      "loudness normalisation in ffmpeg",
      "groups commits by type",
    ]);
    if (!claim || !related || !unrelated) throw new Error("missing vectors");
    const dot = (left: number[], right: number[]) =>
      left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
    expect(again).toEqual(claim);
    expect(dot(claim, claim)).toBeCloseTo(1);
    expect(dot(claim, related)).toBeGreaterThan(dot(claim, unrelated));
  });
});

describe("createEmbeddingClient", () => {
  it("returns no embedder when retrieval is off", () => {
    expect(createEmbeddingClient({ mode: "local", env: parseEnv({}), dimensions: 768 })).toBeUndefined();
  });

  it("refuses a remote Ollama in Local mode, like the model", () => {
    const env = parseEnv({
      EMBEDDINGS: "ollama",
      RUN_STORE: "postgres",
      DATABASE_URL: "postgres://localhost/cutroom",
      OLLAMA_HOST: "https://gpu.example.com",
    });
    expect(() => createEmbeddingClient({ mode: "local", env, dimensions: 768 })).toThrow(
      PrivacyViolationError,
    );
    expect(createEmbeddingClient({ mode: "cloud", env, dimensions: 768 })?.networkScope).toBe("external");
  });
});
