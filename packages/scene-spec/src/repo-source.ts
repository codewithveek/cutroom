import { z } from "zod";

export const repoSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("path"), path: z.string().min(1) }),
  z.object({ kind: z.literal("git"), url: z.string().min(1), ref: z.string().min(1).optional() }),
  /** An uploaded archive, extracted by the API into the data directory (FR-ING-1, P1). */
  z.object({
    kind: z.literal("zip"),
    uploadId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, "Expected an upload id"),
    fileName: z.string().min(1).max(200),
  }),
]);
export type RepoSource = z.infer<typeof repoSourceSchema>;

/** A stable reference for grouping runs into projects: the path, the URL, or the upload. */
export function sourceReference(source: RepoSource): string {
  if (source.kind === "git") return source.url.replace(/\.git$/, "");
  if (source.kind === "zip") return `upload:${source.uploadId}`;
  return source.path.replace(/[\\/]+$/, "");
}

/** A short human name: the last path or URL segment, or the archive name without `.zip`. */
export function sourceLabel(source: RepoSource): string {
  if (source.kind === "zip") return source.fileName.replace(/\.zip$/i, "");
  const raw = sourceReference(source);
  return raw.split(/[\\/:]/).pop() || raw;
}

/** POST /uploads: the archive was stored and extracted; start a run with `{ kind: "zip", uploadId, fileName }`. */
export const uploadResultSchema = z.object({
  uploadId: z.string(),
  fileName: z.string(),
  files: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
});
export type UploadResult = z.infer<typeof uploadResultSchema>;
