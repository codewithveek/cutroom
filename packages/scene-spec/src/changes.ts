import { z } from "zod";
import { evidenceSchema } from "./evidence";
import { productBriefSchema } from "./product-brief";

const gitRefSchema = z.string().regex(/^[\w./^~-]{1,100}$/, "a tag, branch or commit");

/** "Make a video of what changed" (PRD extension E2): a range of the repository's history. */
export const changeRequestSchema = z.object({
  fromRef: gitRefSchema,
  toRef: gitRefSchema.default("HEAD"),
  /** Fixes and refactors are left out unless asked for (E2-3). */
  includeFixes: z.boolean().default(false),
});
export type ChangeRequest = z.infer<typeof changeRequestSchema>;

/** Inclusive line ranges in the toRef version of a file. */
export const lineRangeSchema = z.tuple([z.number().int().positive(), z.number().int().positive()]);

export const changedFileSchema = z.object({
  path: z.string().min(1),
  status: z.enum(["added", "modified", "deleted", "renamed"]),
  addedLines: z.array(lineRangeSchema),
  /** The unified diff, secrets redacted, cut to a budget. */
  patch: z.string(),
});
export type ChangedFile = z.infer<typeof changedFileSchema>;

export const changeCommitSchema = z.object({
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  /** Conventional-commit type when the subject has one ("feat", "fix", …). */
  type: z.string().max(20).optional(),
  scope: z.string().max(40).optional(),
  subject: z.string(),
  breaking: z.boolean(),
});
export type ChangeCommit = z.infer<typeof changeCommitSchema>;

/** What repo-ingest reads from the range (E2-1). */
export const changeSnapshotSchema = z.object({
  fromRef: z.string(),
  toRef: z.string(),
  fromSha: z.string().regex(/^[0-9a-f]{40}$/),
  toSha: z.string().regex(/^[0-9a-f]{40}$/),
  commits: z.array(changeCommitSchema),
  files: z.array(changedFileSchema),
  /** The CHANGELOG or release-notes section for toRef, when the repository keeps one. */
  changelogSection: z.string().optional(),
  /** UI strings that appear on added lines. */
  addedUiStrings: z.array(z.string()),
});
export type ChangeSnapshot = z.infer<typeof changeSnapshotSchema>;

export const changeKindSchema = z.enum(["feature", "improvement", "fix"]);

export const changeSchema = z.object({
  kind: changeKindSchema,
  title: z.string().min(1).max(48),
  description: z.string().min(1).max(240),
  evidence: z.array(evidenceSchema).min(1).max(4),
});
export type Change = z.infer<typeof changeSchema>;

/** The model's answer: the product framing plus 0–4 changes (0 → nothing user-visible). */
export const changeBriefDraftSchema = productBriefSchema.omit({ features: true }).extend({
  changes: z.array(changeSchema).max(4),
});
export type ChangeBriefDraft = z.infer<typeof changeBriefDraftSchema>;

/** After verification (E2-2): every change cites added lines in the range. */
export const changeBriefSchema = changeBriefDraftSchema.extend({
  changes: z.array(changeSchema).min(1).max(4),
});
export type ChangeBrief = z.infer<typeof changeBriefSchema>;
