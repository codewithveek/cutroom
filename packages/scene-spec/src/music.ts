import { z } from "zod";

export const musicBedSchema = z.enum(["calm", "upbeat"]);
export type MusicBed = z.infer<typeof musicBedSchema>;

export const musicSelectionSchema = z.discriminatedUnion("kind", [
  /** Synthesised in code: no third-party licence, flagged as placeholder (FR-MU-1). */
  z.object({ kind: z.literal("generated"), bed: musicBedSchema }),
  z.object({ kind: z.literal("uploaded"), assetKey: z.string().min(1) }),
  z.object({ kind: z.literal("none") }),
]);
export type MusicSelection = z.infer<typeof musicSelectionSchema>;
