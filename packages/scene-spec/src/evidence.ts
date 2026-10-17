import { z } from "zod";

export const evidenceSchema = z.object({
  filePath: z.string().min(1),
  lineStart: z.number().int().positive(),
  lineEnd: z.number().int().positive(),
  excerpt: z.string().max(400),
});
export type Evidence = z.infer<typeof evidenceSchema>;
