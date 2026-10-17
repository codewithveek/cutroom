import type { PcmAudio } from "@cutroom/audio-io";
import type { NetworkScope } from "@cutroom/providers";

export interface SynthesizeOptions {
  text: string;
  voiceId: string;
  speed: number;
}

/** A text-to-speech engine. The cache layer turns its PCM into files (FR-VO-1). */
export interface VoiceProvider {
  readonly providerId: "kokoro" | "elevenlabs" | "silent";
  readonly networkScope: NetworkScope;
  /** True when the voice is synthetic: the delivery note says so. */
  readonly isAiVoice: boolean;
  readonly licence: string;
  synthesizePcm(options: SynthesizeOptions): Promise<PcmAudio>;
}

export interface SynthesizedClip {
  audioPath: string;
  durationMs: number;
  sampleRate: number;
  cacheKey: string;
  fromCache: boolean;
}
