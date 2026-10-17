import { z } from "zod";
import { sceneBaseShape } from "./scene-base";

export const codeCardPropsSchema = z.object({
  /** Repo-relative path, shown on the card. */
  filePath: z.string().min(1),
  language: z.string().min(1).max(20),
  lineStart: z.number().int().positive(),
  lineEnd: z.number().int().positive(),
  /** Must match the file byte-for-byte after redaction (claim audit). */
  code: z.string().min(1).max(1200),
  caption: z.string().max(60).optional(),
  reveal: z.enum(["type", "lines"]).default("lines"),
});

export const codeCardSceneSchema = z.object({
  ...sceneBaseShape,
  block: z.literal("code-card"),
  props: codeCardPropsSchema,
});
export type CodeCardScene = z.infer<typeof codeCardSceneSchema>;
