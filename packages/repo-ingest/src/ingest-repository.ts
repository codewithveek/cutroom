import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Ignore } from "ignore";
import { extractBrandHints } from "./brand-hints";
import {
  detectNodeFrameworks,
  detectPythonFrameworks,
  type PackageManifest,
  parsePackageManifest,
} from "./frameworks";
import { createIgnoreMatcher, hasBinaryExtension, looksBinary } from "./ignore-rules";
import { classifyKeyFile } from "./key-files";
import { detectLanguage } from "./languages";
import { extractReadmeCommands, type ReadmeCommand } from "./readme-commands";
import { isSecretFile, redactSecrets } from "./redaction";
import { SnapshotReader } from "./snapshot-reader";
import type { RepoSnapshot, SnapshotFile, UiString } from "./snapshot-schema";
import { type RepoSource, resolveSource } from "./source";
import { extractUiStrings } from "./ui-strings";

export const DEFAULT_MAX_FILE_BYTES = 200 * 1024;
const MAX_KEPT_FILES = 5000;
const MAX_LOGO_BYTES = 1024 * 1024;

export interface IngestRepositoryOptions {
  source: RepoSource;
  /** Where the redacted mirror and snapshot.json are written. */
  outputDirectory: string;
  maxFileBytes?: number;
}

export interface IngestResult {
  snapshot: RepoSnapshot;
  reader: SnapshotReader;
  snapshotPath: string;
  /** Absolute path to the logo copied into the mirror, if one was found. */
  logoFilePath?: string;
}

interface WalkState {
  rootDirectory: string;
  matcher: Ignore;
  keptPaths: string[];
  allPaths: string[];
  skipped: number;
  secretFilesSkipped: number;
}

async function walkDirectory(state: WalkState, relativeDirectory: string): Promise<void> {
  const absoluteDirectory = path.join(state.rootDirectory, relativeDirectory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  for (const entry of entries.toSorted((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (!state.matcher.ignores(`${relativePath}/`)) await walkDirectory(state, relativePath);
      continue;
    }
    if (!entry.isFile() || state.matcher.ignores(relativePath)) {
      state.skipped += 1;
      continue;
    }
    state.allPaths.push(relativePath);
    if (isSecretFile(relativePath)) state.secretFilesSkipped += 1;
    else if (hasBinaryExtension(relativePath)) state.skipped += 1;
    else state.keptPaths.push(relativePath);
  }
}

async function readGitignore(rootDirectory: string): Promise<string[]> {
  try {
    return [await readFile(path.join(rootDirectory, ".gitignore"), "utf8")];
  } catch {
    return [];
  }
}

interface FileFacts {
  file: SnapshotFile;
  content: string;
  redactionCount: number;
}

async function readAndRedact(options: {
  rootDirectory: string;
  mirrorDirectory: string;
  relativePath: string;
  maxFileBytes: number;
}): Promise<FileFacts | undefined> {
  const absolutePath = path.join(options.rootDirectory, options.relativePath);
  if ((await stat(absolutePath)).size > options.maxFileBytes) return undefined;
  const raw = await readFile(absolutePath);
  if (looksBinary(raw)) return undefined;
  const { content, redactions } = redactSecrets(raw.toString("utf8"));
  const mirrorPath = path.join(options.mirrorDirectory, options.relativePath);
  await mkdir(path.dirname(mirrorPath), { recursive: true });
  await writeFile(mirrorPath, content);
  return {
    content,
    redactionCount: redactions.length,
    file: {
      path: options.relativePath,
      language: detectLanguage(options.relativePath),
      bytes: Buffer.byteLength(content),
      lines: content.split("\n").length,
      sha256: createHash("sha256").update(content).digest("hex"),
    },
  };
}

interface Accumulator {
  files: SnapshotFile[];
  uiStrings: UiString[];
  readmeCommands: ReadmeCommand[];
  styleContents: string[];
  frameworks: Set<string>;
  manifest?: PackageManifest;
  redactions: number;
  skippedLarge: number;
}

function absorbFile(accumulator: Accumulator, facts: FileFacts): void {
  const { file, content } = facts;
  accumulator.files.push(file);
  accumulator.redactions += facts.redactionCount;
  const role = classifyKeyFile(file.path);
  accumulator.uiStrings.push(
    ...extractUiStrings({
      filePath: file.path,
      language: file.language,
      content,
      isI18nFile: role === "i18n",
    }),
  );
  if (role === "readme" || (role === "docs" && file.path.toLowerCase().includes("readme"))) {
    accumulator.readmeCommands.push(...extractReadmeCommands(content, file.path));
  }
  if (role === "config" || file.language === "css") accumulator.styleContents.push(content);
  if (file.path === "package.json") {
    const manifest = parsePackageManifest(content);
    if (manifest) {
      accumulator.manifest = manifest;
      for (const framework of detectNodeFrameworks(manifest)) accumulator.frameworks.add(framework);
    }
  } else if (/(^|\/)package\.json$/.test(file.path)) {
    const manifest = parsePackageManifest(content);
    if (manifest)
      for (const framework of detectNodeFrameworks(manifest)) accumulator.frameworks.add(framework);
  }
  if (/(^|\/)(pyproject\.toml|requirements\.txt)$/.test(file.path)) {
    for (const framework of detectPythonFrameworks(content)) accumulator.frameworks.add(framework);
  }
}

async function copyLogo(options: { rootDirectory: string; mirrorDirectory: string; logoPath: string }) {
  const sourcePath = path.join(options.rootDirectory, options.logoPath);
  if ((await stat(sourcePath)).size > MAX_LOGO_BYTES) return undefined;
  const targetPath = path.join(
    options.mirrorDirectory,
    "..",
    "brand",
    `logo${path.extname(options.logoPath)}`,
  );
  await mkdir(path.dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
  return targetPath;
}

/** Repo in, redacted snapshot out (pipeline step 1). */
export async function ingestRepository(options: IngestRepositoryOptions): Promise<IngestResult> {
  const resolved = await resolveSource(options.source);
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const mirrorDirectory = path.join(path.resolve(options.outputDirectory), "files");
  await mkdir(mirrorDirectory, { recursive: true });
  const walkState: WalkState = {
    rootDirectory: resolved.rootDirectory,
    matcher: createIgnoreMatcher(await readGitignore(resolved.rootDirectory)),
    keptPaths: [],
    allPaths: [],
    skipped: 0,
    secretFilesSkipped: 0,
  };
  await walkDirectory(walkState, "");
  const accumulator: Accumulator = {
    files: [],
    uiStrings: [],
    readmeCommands: [],
    styleContents: [],
    frameworks: new Set(),
    redactions: 0,
    skippedLarge: 0,
  };
  for (const relativePath of walkState.keptPaths.slice(0, MAX_KEPT_FILES)) {
    const facts = await readAndRedact({
      rootDirectory: resolved.rootDirectory,
      mirrorDirectory,
      relativePath,
      maxFileBytes,
    });
    if (facts) absorbFile(accumulator, facts);
    else accumulator.skippedLarge += 1;
  }
  const brandHints = extractBrandHints({
    styleContents: accumulator.styleContents,
    allPaths: walkState.allPaths,
    homepage: accumulator.manifest?.homepage,
  });
  const keyFiles = accumulator.files.flatMap((file) => {
    const role = classifyKeyFile(file.path);
    return role ? [{ path: file.path, role }] : [];
  });
  const snapshot: RepoSnapshot = {
    rootName: resolved.rootName,
    ...(accumulator.manifest?.name ? { packageName: accumulator.manifest.name } : {}),
    ...(accumulator.manifest?.description ? { description: accumulator.manifest.description } : {}),
    files: accumulator.files,
    keyFiles,
    frameworks: [...accumulator.frameworks].sort(),
    uiStrings: accumulator.uiStrings,
    scripts: accumulator.manifest?.scripts ?? {},
    readmeCommands: accumulator.readmeCommands,
    brandHints,
    stats: {
      keptFiles: accumulator.files.length,
      skippedFiles:
        walkState.skipped +
        accumulator.skippedLarge +
        Math.max(0, walkState.keptPaths.length - MAX_KEPT_FILES),
      secretFilesSkipped: walkState.secretFilesSkipped,
      redactions: accumulator.redactions,
    },
  };
  const snapshotPath = path.join(path.resolve(options.outputDirectory), "snapshot.json");
  await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
  const logoFilePath = brandHints.logoPath
    ? await copyLogo({
        rootDirectory: resolved.rootDirectory,
        mirrorDirectory,
        logoPath: brandHints.logoPath,
      })
    : undefined;
  return {
    snapshot,
    reader: new SnapshotReader({ snapshot, mirrorDirectory }),
    snapshotPath,
    ...(logoFilePath ? { logoFilePath } : {}),
  };
}
