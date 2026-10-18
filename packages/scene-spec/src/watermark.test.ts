import { describe, expect, it } from "vitest";
import { runRequestSchema } from "./run-contracts";

const minimalRunRequest = {
  source: { kind: "path", path: "/repo" },
  videoType: "launch",
  ratios: ["16:9"],
  targetSeconds: 45,
  voice: { provider: "kokoro", voiceId: "af_heart" },
  music: { kind: "none" },
  privacyMode: "local",
} as const;

describe("watermark", () => {
  it("is off unless the run asks for it", () => {
    expect(runRequestSchema.parse(minimalRunRequest).watermark).toBe(false);
  });

  it("is kept when the run asks for it", () => {
    expect(runRequestSchema.parse({ ...minimalRunRequest, watermark: true }).watermark).toBe(true);
  });

  it("rejects anything but a boolean", () => {
    expect(runRequestSchema.safeParse({ ...minimalRunRequest, watermark: "yes" }).success).toBe(false);
  });
});
