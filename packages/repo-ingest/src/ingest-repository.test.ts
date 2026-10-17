import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ingestRepository } from "./ingest-repository";
import { PathOutsideSnapshotError } from "./snapshot-reader";

const shipnoteFixture = path.resolve(import.meta.dirname, "../../../evals/fixtures/shipnote");

async function writeTree(root: string, files: Record<string, string | Buffer>): Promise<void> {
  for (const [relativePath, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, relativePath)), { recursive: true });
    await writeFile(path.join(root, relativePath), content);
  }
}

describe("ingestRepository", () => {
  it("snapshots the shipnote fixture", async () => {
    const outputDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-ingest-"));
    const { snapshot, reader } = await ingestRepository({
      source: { kind: "path", path: shipnoteFixture },
      outputDirectory,
    });
    expect(snapshot.packageName).toBe("shipnote");
    expect(snapshot.frameworks).toContain("cli");
    expect(snapshot.files.map((file) => file.path)).toContain("src/group-commits.ts");
    expect(snapshot.readmeCommands.map((command) => command.command)).toContain("npx shipnote draft");
    expect(snapshot.uiStrings.map((uiString) => uiString.text)).toContain(
      "Draft release notes from your commits",
    );
    expect(snapshot.keyFiles).toContainEqual({ path: "README.md", role: "readme" });
    expect(await reader.readLines({ filePath: "src/group-commits.ts", lineStart: 5, lineEnd: 5 })).toBe(
      'export const commitTypes = ["feat", "fix", "perf"];',
    );
  });

  it("skips ignored, binary and secret files and redacts secrets in the rest", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "cutroom-repo-"));
    const fakeToken = `ghp_${"Q".repeat(36)}`;
    await writeTree(root, {
      ".gitignore": "generated/\n",
      ".env": "API_KEY=real\n",
      "node_modules/lib/index.js": "module.exports = 1;",
      "generated/out.ts": "export const x = 1;",
      "logo.png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0]),
      "pnpm-lock.yaml": "lockfileVersion: 9",
      "src/client.ts": `const github = "${fakeToken}";\nexport { github };\n`,
      "public/logo.svg": "<svg></svg>",
      "src/app.css": ":root { --primary: #12AB34; }",
    });
    const outputDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-ingest-"));
    const { snapshot, reader, logoFilePath } = await ingestRepository({
      source: { kind: "path", path: root },
      outputDirectory,
    });
    const paths = snapshot.files.map((file) => file.path).sort();
    expect(paths).toEqual(["public/logo.svg", "src/app.css", "src/client.ts"].concat([".gitignore"]).sort());
    expect(snapshot.stats.secretFilesSkipped).toBe(1);
    expect(snapshot.stats.redactions).toBe(1);
    const client = await reader.readFile("src/client.ts");
    expect(client).not.toContain(fakeToken);
    expect(client).toContain("‹redacted:github-token›");
    const mirrored = await readFile(path.join(outputDirectory, "files", "src/client.ts"), "utf8");
    expect(mirrored).not.toContain(fakeToken);
    expect(snapshot.brandHints.accentColor).toBe("#12ab34");
    expect(snapshot.brandHints.logoPath).toBe("public/logo.svg");
    expect(logoFilePath).toBeDefined();
    await expect(reader.readFile("../../etc/passwd")).resolves.toBeUndefined();
  });

  it("refuses traversal outside the mirror", async () => {
    const { resolveInside } = await import("./snapshot-reader");
    expect(() => resolveInside("/tmp/mirror", "../secrets")).toThrow(PathOutsideSnapshotError);
  });
});
