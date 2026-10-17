import { describe, expect, it } from "vitest";
import { z } from "zod";
import { blocksAllowedInLook } from "./block-catalog";
import { collectClaims } from "./collect-claims";
import { fixtureStoryboardInput } from "./fixtures/fixture-storyboard";
import { createStoryboardDraftSchema } from "./scene-draft";
import { parseStarredText, stripStars } from "./starred-text";
import { storyboardSchema } from "./storyboard";

describe("storyboardSchema", () => {
  it("parses the fixture storyboard and applies defaults", () => {
    const storyboard = storyboardSchema.parse(fixtureStoryboardInput);
    expect(storyboard.scenes).toHaveLength(8);
    const bigNumber = storyboard.scenes.find((scene) => scene.block === "big-number");
    expect(bigNumber?.block === "big-number" && bigNumber.props.limitState).toBe(false);
  });

  it("rejects an unknown block", () => {
    const broken = structuredClone(fixtureStoryboardInput);
    const firstScene: Record<string, unknown> = { ...broken.scenes[0], block: "hologram" };
    const result = storyboardSchema.safeParse({ ...broken, scenes: [firstScene, ...broken.scenes.slice(1)] });
    expect(result.success).toBe(false);
  });
});

describe("createStoryboardDraftSchema", () => {
  it("narrows the scene union to the look's blocks", () => {
    expect(blocksAllowedInLook("cinematic")).not.toContain("terminal");
    const jsonSchema = JSON.stringify(z.toJSONSchema(createStoryboardDraftSchema("cinematic")));
    expect(jsonSchema).not.toContain('"const":"terminal"');
    expect(jsonSchema).toContain('"const":"kinetic-headline"');
  });

  it("does not ask the model for ids or frame counts", () => {
    const jsonSchema = JSON.stringify(z.toJSONSchema(createStoryboardDraftSchema("editorial")));
    expect(jsonSchema).not.toContain("baseFrames");
    expect(jsonSchema).toContain('"const":"terminal"');
  });

  it("validates a draft scene without an id", () => {
    const schema = createStoryboardDraftSchema("graphic");
    const result = schema.safeParse({
      title: "Demo",
      scenes: [
        { block: "kinetic-headline", props: { lines: ["Hello"], tone: "neutral" }, narration: [] },
        { block: "title-card", props: { variant: "title", name: "Demo", tagline: "x" } },
        { block: "end-card", props: { name: "Demo", tagline: "x", cta: "Try it" } },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("collectClaims", () => {
  it("collects block claim fields and narration from every scene", () => {
    const claims = collectClaims(storyboardSchema.parse(fixtureStoryboardInput));
    const codeClaim = claims.find((claim) => claim.kind === "code-excerpt");
    expect(codeClaim?.source).toEqual({ filePath: "src/group-commits.ts", lineStart: 1, lineEnd: 5 });
    expect(claims.find((claim) => claim.id === "scene-number:props.value")?.kind).toBe("number");
    expect(claims.filter((claim) => claim.kind === "narration")).toHaveLength(8);
    expect(new Set(claims.map((claim) => claim.id)).size).toBe(claims.length);
  });
});

describe("parseStarredText", () => {
  it("splits starred phrases", () => {
    expect(parseStarredText("Ship *every* week")).toEqual([
      { text: "Ship ", starred: false },
      { text: "every", starred: true },
      { text: " week", starred: false },
    ]);
  });

  it("keeps unbalanced stars literal and strips balanced ones", () => {
    expect(stripStars("a *b* c *d")).toBe("a b c *d");
  });
});
