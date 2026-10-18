import { describe, expect, it } from "vitest";
import { buildRunRequest, makeFlagsSchema } from "./make-options";

describe("buildRunRequest direction", () => {
  it("passes a trimmed --direction through and omits an empty one", () => {
    const steered = makeFlagsSchema.parse({ repo: ".", direction: "  for developers  " });
    expect(buildRunRequest(steered).direction).toBe("for developers");
    expect(buildRunRequest(makeFlagsSchema.parse({ repo: ".", direction: " " }))).not.toHaveProperty(
      "direction",
    );
  });
});

describe("buildRunRequest watermark", () => {
  it("leaves the badge off by default", () => {
    const flags = makeFlagsSchema.parse({ repo: "." });
    expect(buildRunRequest(flags).watermark).toBe(false);
  });

  it("turns the badge on with --watermark", () => {
    const flags = makeFlagsSchema.parse({ repo: ".", watermark: true });
    expect(buildRunRequest(flags).watermark).toBe(true);
  });
});
