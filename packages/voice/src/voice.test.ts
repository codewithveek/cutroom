import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { decodeWav } from "@cutroom/audio-io";
import { PrivacyViolationError } from "@cutroom/providers";
import { fixtureStoryboardInput, storyboardSchema } from "@cutroom/scene-spec";
import { describe, expect, it } from "vitest";
import { createVoiceProvider } from "./create-voice-provider";
import { createSilentProvider } from "./silent-provider";
import { synthesizeNarration } from "./synthesize-narration";
import { createCachedVoice, voiceCacheKey } from "./voice-cache";
import type { VoiceProvider } from "./voice-provider";

const kokoroOptions = {
  modelId: "onnx-community/Kokoro-82M-v1.0-ONNX",
  dtype: "q8" as const,
  modelCacheDirectory: "/tmp",
};

function toneProvider(): VoiceProvider & { calls: number } {
  const provider = {
    providerId: "kokoro" as const,
    networkScope: "none" as const,
    isAiVoice: true,
    licence: "test",
    calls: 0,
    async synthesizePcm(options: { text: string }) {
      provider.calls += 1;
      const samples = new Float32Array(24_000 * (options.text.length > 20 ? 2 : 1)).map(
        (_, index) => 0.3 * Math.sin(index / 10),
      );
      return { sampleRate: 24_000, channels: [samples] };
    },
  };
  return provider;
}

describe("voice cache", () => {
  it("keys on text, voice, speed and provider", () => {
    const base = { text: "Hello", voiceId: "af_heart", speed: 1, providerId: "kokoro" };
    expect(voiceCacheKey(base)).toBe(voiceCacheKey({ ...base }));
    expect(voiceCacheKey(base)).not.toBe(voiceCacheKey({ ...base, speed: 1.1 }));
    expect(voiceCacheKey(base)).not.toBe(voiceCacheKey({ ...base, providerId: "elevenlabs" }));
  });

  it("synthesises once, normalises to −1 dBFS and serves repeats from disk", async () => {
    const provider = toneProvider();
    const voice = createCachedVoice({
      provider,
      cacheDirectory: await mkdtemp(path.join(tmpdir(), "cutroom-voice-")),
    });
    const first = await voice.synthesize({ text: "Hi", voiceId: "af_heart", speed: 1 });
    const second = await voice.synthesize({ text: "Hi", voiceId: "af_heart", speed: 1 });
    expect(provider.calls).toBe(1);
    expect(second.fromCache).toBe(true);
    expect(first.durationMs).toBe(1000);
    const decoded = decodeWav(await readFile(first.audioPath));
    const samples = decoded.channels[0] ?? new Float32Array();
    const peak = samples.reduce((max: number, sample: number) => Math.max(max, Math.abs(sample)), 0);
    expect(peak).toBeCloseTo(10 ** (-1 / 20), 3);
  });
});

describe("synthesizeNarration", () => {
  it("builds a voice timeline from clip durations", async () => {
    const storyboard = storyboardSchema.parse(fixtureStoryboardInput);
    const voice = createCachedVoice({
      provider: toneProvider(),
      cacheDirectory: await mkdtemp(path.join(tmpdir(), "cutroom-voice-")),
    });
    const result = await synthesizeNarration({
      storyboard,
      voice,
      selection: { provider: "kokoro", voiceId: "af_heart", speed: 1 },
      transitionFrames: 14,
    });
    expect(result.timeline.source).toBe("voice");
    const firstLine = result.timeline.scenes[0]?.lines[0];
    expect(firstLine?.frames).toBe(60);
    expect(firstLine?.audioAssetKey).toMatch(/^voice-[0-9a-f]{32}$/);
    expect(result.clips.length).toBeGreaterThan(0);
  });

  it("uses `say` for speech", async () => {
    const spoken: string[] = [];
    const provider = {
      ...createSilentProvider(),
      synthesizePcm: async (options: { text: string }) => {
        spoken.push(options.text);
        return { sampleRate: 24_000, channels: [new Float32Array(2400)] };
      },
    };
    const storyboard = storyboardSchema.parse(fixtureStoryboardInput);
    const voice = createCachedVoice({
      provider,
      cacheDirectory: await mkdtemp(path.join(tmpdir(), "cutroom-voice-")),
    });
    await synthesizeNarration({
      storyboard,
      voice,
      selection: { provider: "none", voiceId: "x", speed: 1 },
      transitionFrames: 14,
    });
    expect(spoken).toContain("Meet Ship note.");
    expect(spoken).not.toContain("Meet Shipnote.");
  });
});

describe("createVoiceProvider", () => {
  it("keeps Kokoro offline in Local mode and blocks ElevenLabs unless allowed", () => {
    const local = createVoiceProvider({
      mode: "local",
      selection: { provider: "kokoro", voiceId: "af_heart", speed: 1 },
      kokoro: kokoroOptions,
      elevenLabsApiKey: undefined,
    });
    expect(local.networkScope).toBe("none");
    const elevenLabs = { provider: "elevenlabs" as const, voiceId: "abc", speed: 1 };
    expect(() =>
      createVoiceProvider({
        mode: "local",
        selection: elevenLabs,
        kokoro: kokoroOptions,
        elevenLabsApiKey: "k",
      }),
    ).toThrow(PrivacyViolationError);
    expect(() =>
      createVoiceProvider({
        mode: "hybrid",
        selection: elevenLabs,
        kokoro: kokoroOptions,
        elevenLabsApiKey: "k",
      }),
    ).toThrow(PrivacyViolationError);
    expect(
      createVoiceProvider({
        mode: "hybrid",
        selection: elevenLabs,
        kokoro: kokoroOptions,
        elevenLabsApiKey: "k",
        optIns: { externalVoice: true },
      }).providerId,
    ).toBe("elevenlabs");
  });
});
