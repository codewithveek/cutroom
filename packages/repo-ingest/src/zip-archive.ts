import { createWriteStream } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import yauzl, { type Entry, type ZipFile } from "yauzl";

export class ZipArchiveError extends Error {
  override readonly name = "ZipArchiveError";
}

export interface ZipLimits {
  maxEntries: number;
  maxTotalBytes: number;
}

export const defaultZipLimits: ZipLimits = { maxEntries: 20_000, maxTotalBytes: 300 * 1024 * 1024 };

const symlinkMode = 0o120000;
const fileTypeMask = 0o170000;

function openZip(archivePath: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(
      archivePath,
      { lazyEntries: true, autoClose: true, strictFileNames: true },
      (error, zipFile) => {
        if (error || !zipFile)
          reject(new ZipArchiveError(`Not a readable zip archive: ${error?.message ?? "unknown"}`));
        else resolve(zipFile);
      },
    );
  });
}

function openEntry(zipFile: ZipFile, entry: Entry): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error || !stream) reject(new ZipArchiveError(`Could not read ${entry.fileName}`));
      else resolve(stream);
    });
  });
}

/** Where an entry may be written, or undefined to skip it. Throws on anything that escapes. */
export function safeEntryPath(options: { destination: string; fileName: string }): string {
  const normalised = options.fileName.replaceAll("\\", "/");
  if (normalised.startsWith("/") || /^[a-zA-Z]:/.test(normalised) || normalised.split("/").includes(".."))
    throw new ZipArchiveError(`Refusing an entry outside the archive: ${options.fileName}`);
  const target = path.resolve(options.destination, normalised);
  if (target !== options.destination && !target.startsWith(`${options.destination}${path.sep}`))
    throw new ZipArchiveError(`Refusing an entry outside the archive: ${options.fileName}`);
  return target;
}

/**
 * Extracts a zip into `destination`, refusing entries that escape it (zip slip), symlinks, and
 * archives over the entry or size limits. Sizes are checked on the bytes written, not trusted
 * from the headers.
 */
export async function extractZipArchive(options: {
  archivePath: string;
  destination: string;
  limits?: ZipLimits;
}): Promise<{ files: number; bytes: number }> {
  const limits = options.limits ?? defaultZipLimits;
  const destination = path.resolve(options.destination);
  await mkdir(destination, { recursive: true });
  const zipFile = await openZip(options.archivePath);
  if (zipFile.entryCount > limits.maxEntries)
    throw new ZipArchiveError(
      `The archive has ${zipFile.entryCount} entries; the limit is ${limits.maxEntries}.`,
    );
  let files = 0;
  let bytes = 0;
  try {
    await new Promise<void>((resolve, reject) => {
      zipFile.on("error", reject);
      zipFile.on("end", resolve);
      zipFile.on("entry", (entry: Entry) => {
        void (async () => {
          const target = safeEntryPath({ destination, fileName: entry.fileName });
          const mode = (entry.externalFileAttributes >>> 16) & fileTypeMask;
          if (mode === symlinkMode) throw new ZipArchiveError(`Refusing a symlink: ${entry.fileName}`);
          if (entry.fileName.endsWith("/")) {
            await mkdir(target, { recursive: true });
          } else {
            await mkdir(path.dirname(target), { recursive: true });
            const stream = await openEntry(zipFile, entry);
            stream.on("data", (chunk: Buffer) => {
              bytes += chunk.length;
              if (bytes > limits.maxTotalBytes)
                stream.emit("error", new ZipArchiveError("The archive expands past the size limit."));
            });
            await pipeline(stream, createWriteStream(target));
            files += 1;
          }
          zipFile.readEntry();
        })().catch(reject);
      });
      zipFile.readEntry();
    });
  } catch (error) {
    zipFile.close();
    await rm(destination, { recursive: true, force: true });
    throw error instanceof ZipArchiveError ? error : new ZipArchiveError(String(error));
  }
  return { files, bytes };
}

/** GitHub-style archives wrap everything in one folder (`repo-main/`); the project root is inside it. */
export async function archiveRoot(directory: string): Promise<string> {
  const entries = (await readdir(directory)).filter((entry) => entry !== "__MACOSX");
  const [only] = entries;
  if (entries.length === 1 && only && (await stat(path.join(directory, only))).isDirectory())
    return path.join(directory, only);
  return directory;
}

/** The upload's directory under the data directory's `uploads/`. */
export function uploadDirectory(options: { uploadsDirectory: string; uploadId: string }): string {
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(options.uploadId)) throw new ZipArchiveError("Invalid upload id");
  return path.join(path.resolve(options.uploadsDirectory), options.uploadId);
}
