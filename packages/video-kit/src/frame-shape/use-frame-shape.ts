import { useVideoConfig } from "remotion";
import { computeFrameShape, type FrameShape } from "./frame-shape";

/** Blocks read this to pick their layout per aspect ratio (P5). */
export function useFrameShape(): FrameShape {
  const { width, height } = useVideoConfig();
  return computeFrameShape(width, height);
}
