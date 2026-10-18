import type { RunRecord } from "@cutroom/pipeline";
import { describe, expect, it } from "vitest";
import { fromRows, projectForSource, toRows } from "./run-record-mapping";

const record: RunRecord = {
  id: "01M5ABCDEFGHJKMNPQRSTVWXYZ",
  request: {
    source: { kind: "git", url: "https://github.com/vercel/serve.git" },
    videoType: "launch",
    ratios: ["16:9"],
    targetSeconds: 30,
    voice: { provider: "kokoro", voiceId: "af_heart", speed: 1 },
    music: { kind: "none" },
    watermark: false,
    privacyMode: "local",
    autoApprove: false,
    seed: 1,
  },
  status: "rendering",
  createdAt: "2026-10-18T10:00:00.000Z",
  updatedAt: "2026-10-18T10:05:00.000Z",
  look: "graphic",
  storyboardVersions: [],
  voiceClips: [
    { assetKey: "voice-b", filePath: "/v/b.wav", durationMs: 1250.5 },
    { assetKey: "voice-a", filePath: "/v/a.wav", durationMs: 900 },
  ],
  assets: [
    {
      id: "01M5ASSET00000000000000000",
      kind: "video",
      ratio: "16:9",
      version: 1,
      filePath: "/r/v.mp4",
      bytes: 10,
    },
  ],
  providers: { modelId: "gemma4:e4b", voiceProvider: "kokoro" },
  metrics: [],
};

describe("run record mapping", () => {
  it("round-trips a record through rows, keeping order", () => {
    const rows = toRows({ record, projectId: "01M5PROJECT000000000000000" });
    expect(rows.run.ratios).toEqual(["16:9"]);
    expect(rows.voiceClips.map((clip) => clip.voiceId)).toEqual(["af_heart", "af_heart"]);
    expect(fromRows({ ...rows, runVoiceClips: rows.runVoiceClips.toReversed() })).toEqual(record);
  });

  it("names projects after the last segment of their source", () => {
    expect(projectForSource({ source: record.request.source }).name).toBe("serve");
    expect(projectForSource({ source: { kind: "path", path: "/code/shipnote/" } }).name).toBe("shipnote");
  });
});
