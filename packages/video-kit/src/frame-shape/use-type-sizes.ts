import { useLook } from "../looks/look-context";
import { useFrameShape } from "./use-frame-shape";

export interface TypeSizes {
  scale: number;
  headline: number;
  title: number;
  number: number;
  body: number;
  small: number;
  eyebrow: number;
  code: number;
}

/** Look sizes scaled to the frame, never below the shape's minimum legible size. */
export function useTypeSizes(): TypeSizes {
  const look = useLook();
  const shape = useFrameShape();
  const scale = shape.typeScale;
  const legible = (sizePx: number): number => Math.max(shape.minTextPx, Math.round(sizePx));
  return {
    scale,
    headline: legible(look.headlineSizePx * scale),
    title: legible(look.headlineSizePx * 1.25 * scale),
    number: legible(look.numberSizePx * scale),
    body: legible(42 * scale),
    small: legible(30 * scale),
    eyebrow: legible(28 * scale),
    code: legible(30 * scale),
  };
}
