import { describe, expect, it } from "vitest";
import { type PreflightFacts, preflightProblems } from "./preflight";

const ready: PreflightFacts = {
  ffmpegAvailable: true,
  ollamaModels: ["gemma4:e4b"],
  needsOllama: true,
  modelId: "gemma4:e4b",
  ollamaHost: "http://127.0.0.1:11434",
};

describe("preflightProblems", () => {
  it("passes when ffmpeg and the model are there", () => {
    expect(preflightProblems(ready)).toEqual([]);
  });

  it("names each missing tool with the command that fixes it", () => {
    expect(preflightProblems({ ...ready, ffmpegAvailable: false })[0]).toMatch(/ffmpeg was not found/);
    expect(preflightProblems({ ...ready, ollamaModels: null })[0]).toMatch(/Ollama is not answering/);
    expect(preflightProblems({ ...ready, ollamaModels: [] })[0]).toMatch(/ollama pull gemma4:e4b/);
  });

  it("ignores Ollama when the run does not use it", () => {
    expect(preflightProblems({ ...ready, needsOllama: false, ollamaModels: null })).toEqual([]);
  });
});
