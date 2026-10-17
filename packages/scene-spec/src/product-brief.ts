import { z } from "zod";
import { evidenceSchema } from "./evidence";

export const featureSchema = z.object({
  /** Verb-led, e.g. "Schedule payouts". */
  title: z.string().min(1).max(48),
  description: z.string().min(1).max(240),
  evidence: z.array(evidenceSchema).max(6),
  /** `weak` when none of the model's evidence could be verified in the repo (FR-ANA-3). */
  strength: z.enum(["verified", "weak"]).default("verified"),
});
export type Feature = z.infer<typeof featureSchema>;

export const productBriefSchema = z.object({
  name: z.string().min(1).max(40),
  tagline: z.string().min(1).max(90),
  audience: z.string().min(1).max(160),
  problem: z.string().min(1).max(240),
  promise: z.string().min(1).max(240),
  features: z.array(featureSchema).min(1).max(6),
});
export type ProductBrief = z.infer<typeof productBriefSchema>;

/** What the model is asked to produce: every feature must cite at least one excerpt. */
export const productBriefDraftSchema = productBriefSchema.extend({
  features: z
    .array(
      featureSchema.omit({ strength: true }).extend({
        evidence: z.array(evidenceSchema).min(1).max(4),
      }),
    )
    .min(3)
    .max(6),
});
export type ProductBriefDraft = z.infer<typeof productBriefDraftSchema>;
