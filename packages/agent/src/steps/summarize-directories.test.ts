import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createModelClientFromTransport, createScriptedTransport } from "@cutroom/providers";
import { ingestRepository, type SnapshotReader } from "@cutroom/repo-ingest";
import { beforeAll, describe, expect, it } from "vitest";
import { estimateTokens } from "../context/repo-context";
import { renderDirectorySummaries, summarizeDirectories } from "./summarize-directories";

const directoryNames = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot"];
let reader: SnapshotReader;

beforeAll(async () => {
  const repo = await mkdtemp(path.join(tmpdir(), "cutroom-dirs-"));
  for (const name of directoryNames) {
    await mkdir(path.join(repo, "packages", name), { recursive: true });
    await writeFile(path.join(repo, "packages", name, "index.ts"), `export const ${name} = "${name}";\n`);
  }
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-dirs-out-"));
  ({ reader } = await ingestRepository({ source: { kind: "path", path: repo }, outputDirectory }));
});

function longSummaryTransport() {
  return createScriptedTransport(() => ({ summary: "word ".repeat(100).trim(), candidateFeatures: [] }));
}

describe("summarizeDirectories", () => {
  it("summarises every directory without a rendered budget", async () => {
    const transport = longSummaryTransport();
    const result = await summarizeDirectories({
      reader,
      model: createModelClientFromTransport(transport),
      files: reader.snapshot.files,
      budgetTokensPerCall: 4000,
    });
    expect(result.directories).toHaveLength(directoryNames.length);
    expect(transport.requests).toHaveLength(directoryNames.length);
  });

  it("stops once the summaries overflow the rendered budget, keeping the same prefix", async () => {
    const renderedBudgetTokens = 300;
    const everything = await summarizeDirectories({
      reader,
      model: createModelClientFromTransport(longSummaryTransport()),
      files: reader.snapshot.files,
      budgetTokensPerCall: 4000,
    });
    const transport = longSummaryTransport();
    const bounded = await summarizeDirectories({
      reader,
      model: createModelClientFromTransport(transport),
      files: reader.snapshot.files,
      budgetTokensPerCall: 4000,
      renderedBudgetTokens,
    });
    expect(transport.requests.length).toBeLessThan(directoryNames.length);
    const fits = (list: typeof everything.directories) =>
      list.filter(
        (_, index, all) =>
          estimateTokens(renderDirectorySummaries(all.slice(0, index + 1))) <= renderedBudgetTokens,
      );
    expect(fits(bounded.directories)).toEqual(fits(everything.directories));
    expect(fits(bounded.directories).length).toBeGreaterThan(0);
  });
});
