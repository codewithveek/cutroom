import { z } from "zod";

export const repoSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("path"), path: z.string().min(1) }),
  z.object({ kind: z.literal("git"), url: z.string().min(1), ref: z.string().min(1).optional() }),
]);
export type RepoSource = z.infer<typeof repoSourceSchema>;
