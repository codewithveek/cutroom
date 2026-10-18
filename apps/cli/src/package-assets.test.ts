import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findDemoRepository, findPrebuiltBundle } from "./package-assets";

describe("package assets", () => {
  it("finds a bundle next to the entry file and ignores a source checkout", async () => {
    const entryDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-dist-"));
    expect(findPrebuiltBundle(entryDirectory)).toBeUndefined();
    await mkdir(path.join(entryDirectory, "remotion-bundle"));
    await writeFile(path.join(entryDirectory, "remotion-bundle", "index.html"), "<html></html>");
    expect(findPrebuiltBundle(entryDirectory)).toBe(path.join(entryDirectory, "remotion-bundle"));
  });

  it("finds the demo repository in a source checkout", () => {
    const sourceDirectory = path.resolve(import.meta.dirname);
    expect(findDemoRepository(sourceDirectory)).toBe(
      path.resolve(sourceDirectory, "../../../evals/fixtures/shipnote"),
    );
  });
});
