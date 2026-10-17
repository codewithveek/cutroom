import { describe, expect, it } from "vitest";
import { synthesizeMusicBed } from "./music-bed";
import { synthesizeWhoosh } from "./sound-effects";
import { encodeWav } from "./wav";

describe("generated audio", () => {
  it("is deterministic for a seed", () => {
    const first = encodeWav(synthesizeMusicBed({ bed: "upbeat", durationSeconds: 2, seed: 3 }));
    const second = encodeWav(synthesizeMusicBed({ bed: "upbeat", durationSeconds: 2, seed: 3 }));
    expect(first.equals(second)).toBe(true);
  });

  it("peaks at the requested level", () => {
    const bed = synthesizeMusicBed({ bed: "calm", durationSeconds: 3, seed: 1 });
    const peak = bed.channels.reduce(
      (channelPeak, channel) =>
        channel.reduce((samplePeak, sample) => Math.max(samplePeak, Math.abs(sample)), channelPeak),
      0,
    );
    expect(peak).toBeCloseTo(10 ** (-3 / 20), 3);
  });

  it("writes a valid WAV header", () => {
    const wav = encodeWav(synthesizeWhoosh(1));
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.readUInt16LE(22)).toBe(2);
    expect(wav.readUInt32LE(24)).toBe(44_100);
  });
});
