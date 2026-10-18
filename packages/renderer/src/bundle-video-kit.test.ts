import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bundleVideoKit } from "./bundle-video-kit";

async function makePrebuiltBundle(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "cutroom-prebuilt-"));
  await mkdir(path.join(directory, "public", "fonts"), { recursive: true });
  await writeFile(path.join(directory, "index.html"), "<html></html>");
  await writeFile(path.join(directory, "public", "fonts", "inter.woff2"), "font");
  return directory;
}

describe("bundleVideoKit with a prebuilt bundle", () => {
  it("copies the bundle into the writable output directory and serves it from there", async () => {
    const prebuiltDirectory = await makePrebuiltBundle();
    const outDir = path.join(await mkdtemp(path.join(tmpdir(), "cutroom-bundle-")), "bundle");
    const { serveUrl } = await bundleVideoKit({ outDir, prebuiltDirectory });
    expect(serveUrl).toBe(outDir);
    expect(await readFile(path.join(outDir, "public", "fonts", "inter.woff2"), "utf8")).toBe("font");
  });

  it("refuses a directory that is not a Remotion bundle", async () => {
    const prebuiltDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-empty-"));
    const outDir = path.join(await mkdtemp(path.join(tmpdir(), "cutroom-bundle-")), "bundle");
    await expect(bundleVideoKit({ outDir, prebuiltDirectory })).rejects.toThrow(/index\.html is missing/);
  });
});
