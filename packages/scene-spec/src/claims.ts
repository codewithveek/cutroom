import { z } from "zod";
import { evidenceSchema } from "./evidence";

export const claimKindSchema = z.enum(["text", "narration", "number", "code-excerpt", "command", "url"]);
export type ClaimKind = z.infer<typeof claimKindSchema>;

export const claimSchema = z.object({
  /** `${sceneId}:${fieldPath}` */
  id: z.string().min(1),
  sceneId: z.string().min(1),
  fieldPath: z.string().min(1),
  text: z.string(),
  kind: claimKindSchema,
  /** For code excerpts: where the excerpt claims to come from. */
  source: z
    .object({
      filePath: z.string(),
      lineStart: z.number().int().positive(),
      lineEnd: z.number().int().positive(),
    })
    .optional(),
});
export type Claim = z.infer<typeof claimSchema>;

export const claimVerdictSchema = z.enum(["supported", "weak", "unsupported"]);
export type ClaimVerdict = z.infer<typeof claimVerdictSchema>;

export const claimCheckSchema = z.object({
  check: z.enum(["ui-label", "code-excerpt", "number", "overclaim", "model-judge", "evidence-search"]),
  passed: z.boolean(),
  detail: z.string(),
});
export type ClaimCheck = z.infer<typeof claimCheckSchema>;

export const claimResultSchema = z.object({
  claimId: z.string().min(1),
  sceneId: z.string().min(1),
  fieldPath: z.string().min(1),
  claimText: z.string(),
  verdict: claimVerdictSchema,
  checks: z.array(claimCheckSchema),
  evidence: z.array(evidenceSchema),
  suggestion: z.string().optional(),
  overrideReason: z.string().min(1).optional(),
});
export type ClaimResult = z.infer<typeof claimResultSchema>;

export const claimOverrideSchema = z.object({
  claimId: z.string().min(1),
  reason: z.string().min(8, "Explain the override in a sentence"),
});
export type ClaimOverride = z.infer<typeof claimOverrideSchema>;
