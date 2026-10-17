import { z } from "zod";

/** Every composition renders at this frame rate. */
export const FRAMES_PER_SECOND = 30;

export const aspectRatioSchema = z.enum(["16:9", "9:16", "1:1", "4:5"]);
export type AspectRatio = z.infer<typeof aspectRatioSchema>;

export const lookIdSchema = z.enum(["studio", "editorial", "graphic", "cinematic"]);
export type LookId = z.infer<typeof lookIdSchema>;

export const transitionSchema = z.enum(["fade", "focus", "circle", "panel", "slab", "zoom", "push", "cut"]);
export type TransitionId = z.infer<typeof transitionSchema>;

export const videoTypeSchema = z.enum([
  "launch",
  "feature-drop",
  "tutorial",
  "explainer",
  "teaser",
  "dev-integration",
]);
export type VideoType = z.infer<typeof videoTypeSchema>;

export const privacyModeSchema = z.enum(["local", "hybrid", "cloud"]);
export type PrivacyMode = z.infer<typeof privacyModeSchema>;

export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a #rrggbb colour");

export const frameSizeByRatio: Readonly<Record<AspectRatio, { width: number; height: number }>> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

export function secondsToFrames(seconds: number): number {
  return Math.round(seconds * FRAMES_PER_SECOND);
}

export function framesToSeconds(frames: number): number {
  return frames / FRAMES_PER_SECOND;
}
