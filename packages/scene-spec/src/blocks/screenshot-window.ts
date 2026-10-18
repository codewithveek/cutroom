import { z } from "zod";
import { sceneBaseShape } from "./scene-base";

/** Normalised (0–1) box within the screenshot: where the camera and cursor go. */
export const normalizedBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

/** Set by code from the capture manifest, never by the model: the real image and element box. */
export const screenshotViewSchema = z.object({
  imageWidth: z.number().int().positive(),
  imageHeight: z.number().int().positive(),
  focusBox: normalizedBoxSchema.optional(),
});

export type ScreenshotView = z.infer<typeof screenshotViewSchema>;

export const screenshotWindowPropsSchema = z.object({
  /** A captured screen, e.g. "screen-2". */
  screenId: z.string().regex(/^screen-\d+$/),
  /** Exact text of an element on that screen to zoom to and click, from the capture's targets. */
  focusText: z.string().min(1).max(60).optional(),
  caption: z.string().min(1).max(70).optional(),
  view: screenshotViewSchema.optional(),
});

export const screenshotWindowSceneSchema = z.object({
  ...sceneBaseShape,
  block: z.literal("screenshot-window"),
  props: screenshotWindowPropsSchema,
});
export type ScreenshotWindowScene = z.infer<typeof screenshotWindowSceneSchema>;
