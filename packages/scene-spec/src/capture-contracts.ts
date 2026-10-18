import { z } from "zod";

/** Optional on a run: capture the running app (FR-CAP-1, P1). Routes are paths on `appUrl`. */
export const captureRequestSchema = z.object({
  appUrl: z.url(),
  routes: z
    .array(z.string().regex(/^\/[\w\-./?=&%#]*$/, "Routes start with / (e.g. /settings)"))
    .min(1)
    .max(8),
});
export type CaptureRequest = z.infer<typeof captureRequestSchema>;

/** A box in the screenshot's CSS pixels (the image is captured at 2× these). */
export const screenBoxSchema = z.object({
  x: z.number().nonnegative(),
  y: z.number().nonnegative(),
  width: z.number().positive(),
  height: z.number().positive(),
});
export type ScreenBox = z.infer<typeof screenBoxSchema>;

/** A real element on screen whose text is in the repo's UI string inventory (FR-CAP-3). */
export const screenTargetSchema = z.object({ text: z.string().min(1), box: screenBoxSchema });
export type ScreenTarget = z.infer<typeof screenTargetSchema>;

export const capturedScreenSchema = z.object({
  /** Stable within a run: `screen-1`, `screen-2`… in route order. */
  id: z.string().regex(/^screen-\d+$/),
  route: z.string(),
  title: z.string(),
  /** Viewport size in CSS pixels. */
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fileName: z.string().min(1),
  targets: z.array(screenTargetSchema),
  /** Secret-looking strings replaced on the page before the screenshot was taken. */
  redactions: z.number().int().nonnegative(),
});
export type CapturedScreen = z.infer<typeof capturedScreenSchema>;

export const captureManifestSchema = z.object({
  appUrl: z.string(),
  capturedAt: z.string(),
  screens: z.array(capturedScreenSchema),
  /** Non-GET requests the read-only capture refused (FR-CAP-2). */
  blockedRequests: z.number().int().nonnegative(),
});
export type CaptureManifest = z.infer<typeof captureManifestSchema>;

/** The asset key a captured screen is staged under for rendering and previews. */
export function screenshotAssetKey(screenId: string): string {
  return `screenshot-${screenId}`;
}
