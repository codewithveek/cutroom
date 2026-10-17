import { describe, expect, it } from "vitest";
import { decodeWav, durationMsOf, encodeWav, normalizePeak } from "./wav";

function floatWav(samples: Float32Array, sampleRate: number): Buffer {
  const buffer = Buffer.alloc(44 + samples.length * 4);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + samples.length * 4, 4);
  buffer.write("WAVEfmt ", 8, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(3, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(32, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(samples.length * 4, 40);
  samples.forEach((sample, index) => buffer.writeFloatLE(sample, 44 + index * 4));
  return buffer;
}

describe("wav", () => {
  it("round-trips 16-bit PCM", () => {
    const samples = new Float32Array([0, 0.5, -0.5, 0.25]);
    const decoded = decodeWav(encodeWav({ sampleRate: 24_000, channels: [samples] }));
    expect(decoded.sampleRate).toBe(24_000);
    expect([...(decoded.channels[0] ?? [])].map((sample) => Math.round(sample * 100) / 100)).toEqual([
      0, 0.5, -0.5, 0.25,
    ]);
  });

  it("reads 32-bit float WAVs as float", () => {
    const decoded = decodeWav(floatWav(new Float32Array([0.123456, -0.9]), 24_000));
    expect(decoded.channels[0]?.[0]).toBeCloseTo(0.123456, 5);
    expect(durationMsOf(decoded)).toBe(0);
  });

  it("normalises to a peak in dBFS", () => {
    const normalized = normalizePeak({ sampleRate: 1000, channels: [new Float32Array([0.1, -0.2])] }, -1);
    expect(Math.abs(normalized.channels[0]?.[1] ?? 0)).toBeCloseTo(10 ** (-1 / 20), 5);
  });
});
