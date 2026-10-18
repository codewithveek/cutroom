import { describe, expect, it } from "vitest";
import { buildRunRequest, sourceFor } from "./run-request";

describe("buildRunRequest", () => {
  it("fills the preset and keeps only meaningful overrides", () => {
    const request = buildRunRequest({
      repo: "  ~/code/app ",
      presetId: "teaser-cinematic",
      privacyMode: "local",
      ratios: ["9:16"],
      direction: "   ",
      accentColor: "orange",
    });
    expect(request.source).toEqual({ kind: "path", path: "~/code/app" });
    expect(request.videoType).toBe("teaser");
    expect(request.look).toBe("cinematic");
    expect(request.targetSeconds).toBe(15);
    expect(request).not.toHaveProperty("direction");
    expect(request).not.toHaveProperty("brandOverride");
  });

  it("lets recommendLook decide on auto and passes a direction through", () => {
    const request = buildRunRequest({
      repo: "https://github.com/x/y",
      presetId: "launch-editorial",
      privacyMode: "cloud",
      ratios: ["16:9"],
      look: "auto",
      direction: "Focus on the CLI",
    });
    expect(request).not.toHaveProperty("look");
    expect(request.direction).toBe("Focus on the CLI");
    expect(sourceFor("git@github.com:x/y.git").kind).toBe("git");
  });

  it("uses an uploaded archive as the source when there is one", () => {
    const request = buildRunRequest({
      repo: "ignored",
      upload: { uploadId: "01M5ABCDEFGHJKMNPQRSTVWXYZ", fileName: "app.zip", files: 3, bytes: 10 },
      presetId: "launch-editorial",
      privacyMode: "local",
      ratios: ["16:9"],
    });
    expect(request.source).toEqual({
      kind: "zip",
      uploadId: "01M5ABCDEFGHJKMNPQRSTVWXYZ",
      fileName: "app.zip",
    });
  });
});
