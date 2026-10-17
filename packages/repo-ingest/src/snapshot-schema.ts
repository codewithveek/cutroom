import { z } from "zod";

export const uiStringKindSchema = z.enum(["jsx-text", "attribute", "i18n", "cli", "html-text"]);

export const uiStringSchema = z.object({
  text: z.string().min(1),
  filePath: z.string(),
  line: z.number().int().positive(),
  kind: uiStringKindSchema,
});
export type UiString = z.infer<typeof uiStringSchema>;

export const snapshotFileSchema = z.object({
  path: z.string(),
  language: z.string(),
  bytes: z.number().int().nonnegative(),
  lines: z.number().int().nonnegative(),
  sha256: z.string(),
});
export type SnapshotFile = z.infer<typeof snapshotFileSchema>;

export const keyFileRoleSchema = z.enum(["readme", "manifest", "route", "i18n", "entry", "config", "docs"]);

export const brandHintsSchema = z.object({
  accentColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  fontFamily: z.string().optional(),
  logoPath: z.string().optional(),
  homepage: z.string().optional(),
});
export type BrandHints = z.infer<typeof brandHintsSchema>;

export const repoSnapshotSchema = z.object({
  /** Directory or repository name, used as the default product name. */
  rootName: z.string(),
  packageName: z.string().optional(),
  description: z.string().optional(),
  files: z.array(snapshotFileSchema),
  keyFiles: z.array(z.object({ path: z.string(), role: keyFileRoleSchema })),
  frameworks: z.array(z.string()),
  uiStrings: z.array(uiStringSchema),
  /** package.json scripts, by name. */
  scripts: z.record(z.string(), z.string()),
  /** Shell commands found in README code fences. */
  readmeCommands: z.array(
    z.object({ command: z.string(), filePath: z.string(), line: z.number().int().positive() }),
  ),
  brandHints: brandHintsSchema,
  stats: z.object({
    keptFiles: z.number().int().nonnegative(),
    skippedFiles: z.number().int().nonnegative(),
    secretFilesSkipped: z.number().int().nonnegative(),
    redactions: z.number().int().nonnegative(),
  }),
});
export type RepoSnapshot = z.infer<typeof repoSnapshotSchema>;
