import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { archiveRoot, extractZipArchive, safeEntryPath, ZipArchiveError } from "./zip-archive";

async function writeZip(entries: Record<string, string>): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "cutroom-zip-"));
  const archivePath = path.join(directory, "archive.zip");
  await writeFile(
    archivePath,
    zipSync(Object.fromEntries(Object.entries(entries).map(([name, text]) => [name, strToU8(text)]))),
  );
  return archivePath;
}

describe("extractZipArchive", () => {
  it("extracts a GitHub-style archive and finds the project root inside its folder", async () => {
    const archivePath = await writeZip({
      "app-main/package.json": "{}",
      "app-main/src/index.ts": "export {};",
    });
    const destination = path.join(path.dirname(archivePath), "out");
    const result = await extractZipArchive({ archivePath, destination });
    expect(result.files).toBe(2);
    const root = await archiveRoot(destination);
    expect(path.basename(root)).toBe("app-main");
    expect(await readFile(path.join(root, "src/index.ts"), "utf8")).toBe("export {};");
  });

  it("refuses zip slip and removes what it extracted", async () => {
    const archivePath = await writeZip({ "ok.txt": "fine", "../../evil.txt": "nope" });
    const destination = path.join(path.dirname(archivePath), "out");
    await expect(extractZipArchive({ archivePath, destination })).rejects.toThrow(ZipArchiveError);
    await expect(stat(destination)).rejects.toThrow();
  });

  it("enforces the size limit on the bytes actually written", async () => {
    const archivePath = await writeZip({ "big.txt": "x".repeat(10_000) });
    const destination = path.join(path.dirname(archivePath), "out");
    await expect(
      extractZipArchive({ archivePath, destination, limits: { maxEntries: 10, maxTotalBytes: 1000 } }),
    ).rejects.toThrow(/size limit/);
  });

  it("rejects absolute and parent paths outright", () => {
    expect(() => safeEntryPath({ destination: "/tmp/x", fileName: "/etc/passwd" })).toThrow(ZipArchiveError);
    expect(() => safeEntryPath({ destination: "/tmp/x", fileName: "a/../../b" })).toThrow(ZipArchiveError);
    expect(safeEntryPath({ destination: "/tmp/x", fileName: "a/b.ts" })).toBe("/tmp/x/a/b.ts");
  });
});
