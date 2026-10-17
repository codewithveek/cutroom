import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { durationMsOf, encodeWav, normalizePeak } from "@cutroom/audio-io";
import { z } from "zod";
import type { SynthesizedClip, SynthesizeOptions, VoiceProvider } from "./voice-provider";

const clipMetadataSchema = z.object({
  durationMs: z.number().int().nonnegative(),
  sampleRate: z.number().int().positive(),
});

/** Every clip peaks at −1 dBFS before mixing (FR-VO-4). */
export const CLIP_PEAK_DBFS = -1;

export function voiceCacheKey(options: SynthesizeOptions & { providerId: string }): string {
  return createHash("sha256")
    .update(JSON.stringify([options.text, options.voiceId, options.speed, options.providerId]))
    .digest("hex")
    .slice(0, 32);
}

export interface CachedVoice {
  readonly provider: VoiceProvider;
  synthesize(options: SynthesizeOptions): Promise<SynthesizedClip>;
}

/** Caches clips by hash of (text, voice, speed, provider); the same line is never synthesised twice. */
export function createCachedVoice(options: { provider: VoiceProvider; cacheDirectory: string }): CachedVoice {
  return {
    provider: options.provider,
    async synthesize(synthesizeOptions: SynthesizeOptions): Promise<SynthesizedClip> {
      const cacheKey = voiceCacheKey({ ...synthesizeOptions, providerId: options.provider.providerId });
      const audioPath = path.join(options.cacheDirectory, `${cacheKey}.wav`);
      const metadataPath = path.join(options.cacheDirectory, `${cacheKey}.json`);
      try {
        const metadata = clipMetadataSchema.parse(JSON.parse(await readFile(metadataPath, "utf8")));
        return { audioPath, ...metadata, cacheKey, fromCache: true };
      } catch {
        // Not cached yet (or the metadata is unreadable): synthesise below.
      }
      const pcm = await options.provider.synthesizePcm(synthesizeOptions);
      const normalized = normalizePeak(pcm, CLIP_PEAK_DBFS);
      await mkdir(options.cacheDirectory, { recursive: true });
      await writeFile(audioPath, encodeWav(normalized));
      const metadata = { durationMs: durationMsOf(normalized), sampleRate: normalized.sampleRate };
      await writeFile(metadataPath, JSON.stringify(metadata));
      return { audioPath, ...metadata, cacheKey, fromCache: false };
    },
  };
}
