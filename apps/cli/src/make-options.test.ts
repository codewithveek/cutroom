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

describe("buildRunRequest changes", () => {
  it("reads a range, a single ref up to HEAD, and --include-fixes", () => {
    const range = buildRunRequest(makeFlagsSchema.parse({ repo: ".", changes: "v1.2.0..v1.3.0" }));
    expect(range.changes).toEqual({ fromRef: "v1.2.0", toRef: "v1.3.0", includeFixes: false });
    const since = buildRunRequest(
      makeFlagsSchema.parse({ repo: ".", changes: "v1.2.0", includeFixes: true }),
    );
    expect(since.changes).toEqual({ fromRef: "v1.2.0", toRef: "HEAD", includeFixes: true });
    expect(() => makeFlagsSchema.parse({ repo: ".", changes: "v1 v2" })).toThrow();
  });
});
