import { z } from "zod";
import { narrationLineSchema } from "../narration";
import { transitionSchema } from "../primitives";

/** Fields every scene shares, whatever its block. */
export const sceneBaseShape = {
  id: z.string().min(1),
  /** Which beat of the video-type template this scene fills, e.g. "problem". */
  beat: z.string().min(1).optional(),
  /** Defaults to the look's transition. */
  transitionIn: transitionSchema.optional(),
  /** Normalised [x, y] origin for circle/zoom transitions. */
  transitionOrigin: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).optional(),
  baseFrames: z.number().int().positive(),
  narration: z.array(narrationLineSchema).default([]),
};
