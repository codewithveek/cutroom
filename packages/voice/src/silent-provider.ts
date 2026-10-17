import type { PcmAudio } from "@cutroom/audio-io";
import { countWords, NARRATION_WORDS_PER_SECOND } from "@cutroom/scene-spec";
import type { SynthesizeOptions, VoiceProvider } from "./voice-provider";

const SILENT_SAMPLE_RATE = 24_000;

/**
 * Silence at narration pace: for videos without voice, and for CI where the Kokoro model is
 * not downloaded. Timing still follows the words, so captions stay in sync.
 */
export function createSilentProvider(): VoiceProvider {
  return {
    providerId: "silent",
    networkScope: "none",
    isAiVoice: false,
    licence: "No voice",
    async synthesizePcm(options: SynthesizeOptions): Promise<PcmAudio> {
      const seconds = Math.max(0.5, countWords(options.text) / NARRATION_WORDS_PER_SECOND / options.speed);
      return {
        sampleRate: SILENT_SAMPLE_RATE,
        channels: [new Float32Array(Math.round(seconds * SILENT_SAMPLE_RATE))],
      };
    },
  };
}
