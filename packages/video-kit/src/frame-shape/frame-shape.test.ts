import { describe, expect, it } from "vitest";
import { computeFrameShape, ratioFromSize } from "./frame-shape";

describe("computeFrameShape", () => {
  it("maps sizes to ratios", () => {
    expect(ratioFromSize(1920, 1080)).toBe("16:9");
    expect(ratioFromSize(1080, 1920)).toBe("9:16");
    expect(ratioFromSize(1080, 1080)).toBe("1:1");
    expect(ratioFromSize(1080, 1350)).toBe("4:5");
  });

  it("keeps vertical content above the bottom 20%", () => {
    const vertical = computeFrameShape(1080, 1920);
    expect(vertical.paddingBottom).toBe(384);
    expect(vertical.isStacked).toBe(true);
    expect(vertical.minTextPx).toBeGreaterThanOrEqual(28);
  });

  it("scales previews proportionally", () => {
    expect(computeFrameShape(960, 540).typeScale).toBeCloseTo(0.5);
  });
});
