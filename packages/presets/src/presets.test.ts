import { blockCatalog, videoTypeSchema } from "@cutroom/scene-spec";
import { describe, expect, it } from "vitest";
import { videoTypeTemplates } from "./beat-templates";
import { presetSchema, presets } from "./presets";
import { type ProductSignals, recommendLook } from "./recommend-look";

const webApp: ProductSignals = {
  productName: "Ledgerly",
  uiStringCount: 120,
  hasWebUi: true,
  brandIsDark: false,
};

describe("recommendLook", () => {
  it("recommends Editorial for a UI-rich launch, with a reason naming the product", () => {
    const recommendation = recommendLook("launch", webApp);
    expect(recommendation.look).toBe("editorial");
    expect(recommendation.reason).toContain("Ledgerly");
    expect(recommendation.alternatives).not.toContain("editorial");
    expect(recommendation.alternatives).toHaveLength(3);
  });

  it("switches a launch with little UI to Graphic", () => {
    expect(recommendLook("launch", { ...webApp, uiStringCount: 3, hasWebUi: false }).look).toBe("graphic");
  });

  it("follows the video type for teasers, tutorials and integrations", () => {
    expect(recommendLook("teaser", webApp).look).toBe("graphic");
    expect(recommendLook("tutorial", webApp).look).toBe("studio");
    expect(recommendLook("dev-integration", webApp).look).toBe("graphic");
  });

  it("matches dark products and vertical channels", () => {
    expect(recommendLook("feature-drop", { ...webApp, brandIsDark: true }).look).toBe("studio");
    expect(recommendLook("launch", { ...webApp, targetChannel: "vertical-social" }).look).toBe("graphic");
  });
});

describe("presets", () => {
  it("defines six valid presets", () => {
    expect(Object.keys(presets)).toHaveLength(6);
    for (const preset of Object.values(presets)) expect(presetSchema.parse(preset)).toEqual(preset);
    expect(presets["social-cutdown-vertical"].ratios).toEqual(["9:16"]);
  });
});

describe("video type templates", () => {
  it("covers every video type and only uses blocks allowed by its default look", () => {
    for (const videoType of videoTypeSchema.options) {
      const template = videoTypeTemplates[videoType];
      expect(template.beats.at(-1)?.blocks).toContain("end-card");
      for (const beat of template.beats) {
        for (const block of beat.blocks)
          expect(blockCatalog[block].allowedLooks).toContain(template.defaultLook);
      }
    }
  });
});
