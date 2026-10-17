import type { AspectRatio } from "@cutroom/scene-spec";

export type FrameLayout = "wide" | "vertical" | "square" | "portrait";

export interface FrameShape {
  ratio: AspectRatio;
  layout: FrameLayout;
  width: number;
  height: number;
  /** True for 9:16, 1:1 and 4:5: blocks stack instead of laying out in a row. */
  isStacked: boolean;
  /** Multiplier for look sizes, which are authored at 1920×1080. */
  typeScale: number;
  paddingX: number;
  paddingTop: number;
  /** 9:16 keeps key content out of the bottom 20% (platform UI). */
  paddingBottom: number;
  /** Minimum legible text size for this shape (≥ 28 px at 1080 width in vertical formats). */
  minTextPx: number;
}

const layoutByRatio: Readonly<Record<AspectRatio, FrameLayout>> = {
  "16:9": "wide",
  "9:16": "vertical",
  "1:1": "square",
  "4:5": "portrait",
};

const typeScaleByLayout: Readonly<Record<FrameLayout, number>> = {
  wide: 1,
  vertical: 0.92,
  square: 0.8,
  portrait: 0.86,
};

export function ratioFromSize(width: number, height: number): AspectRatio {
  const aspect = width / height;
  const candidates: Array<[AspectRatio, number]> = [
    ["16:9", 16 / 9],
    ["9:16", 9 / 16],
    ["1:1", 1],
    ["4:5", 4 / 5],
  ];
  const [closest] = candidates.toSorted(
    (left, right) => Math.abs(left[1] - aspect) - Math.abs(right[1] - aspect),
  );
  return closest?.[0] ?? "16:9";
}

export function computeFrameShape(width: number, height: number): FrameShape {
  const ratio = ratioFromSize(width, height);
  const layout = layoutByRatio[ratio];
  const sizeScale = layout === "wide" ? width / 1920 : width / 1080;
  return {
    ratio,
    layout,
    width,
    height,
    isStacked: layout !== "wide",
    typeScale: typeScaleByLayout[layout] * sizeScale,
    paddingX: Math.round(width * (layout === "vertical" ? 0.08 : 0.07)),
    paddingTop: Math.round(height * (layout === "vertical" ? 0.1 : 0.08)),
    paddingBottom: Math.round(height * (layout === "vertical" ? 0.2 : 0.08)),
    minTextPx: Math.round(28 * sizeScale),
  };
}
