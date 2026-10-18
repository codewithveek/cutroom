import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findPrebuiltBundle, type PreflightFacts, preflightProblems } from "./preflight";

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

describe("findPrebuiltBundle", () => {
  it("finds a bundle next to the entry file and ignores a source checkout", async () => {
    const entryDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-dist-"));
    expect(findPrebuiltBundle(entryDirectory)).toBeUndefined();
    await mkdir(path.join(entryDirectory, "remotion-bundle"));
    await writeFile(path.join(entryDirectory, "remotion-bundle", "index.html"), "<html></html>");
    expect(findPrebuiltBundle(entryDirectory)).toBe(path.join(entryDirectory, "remotion-bundle"));
  });
});
