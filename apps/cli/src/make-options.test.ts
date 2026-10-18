import { describe, expect, it } from "vitest";
import { buildRunRequest, makeFlagsSchema } from "./make-options";

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
