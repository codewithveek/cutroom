export { estimateTimeline, solveTimeline } from "@cutroom/scene-spec";
export {
  type CreateVoiceProviderOptions,
  createVoiceProvider,
  VoiceConfigurationError,
} from "./create-voice-provider";
export { createElevenLabsProvider, VoiceProviderError } from "./elevenlabs-provider";
export { createKokoroProvider, type KokoroProviderOptions, VoiceModelMissingError } from "./kokoro-provider";
export { createSilentProvider } from "./silent-provider";
export {
  type NarrationResult,
  type SynthesizeNarrationOptions,
  synthesizeNarration,
  type VoiceClipAsset,
} from "./synthesize-narration";
export { type CachedVoice, CLIP_PEAK_DBFS, createCachedVoice, voiceCacheKey } from "./voice-cache";
export type { SynthesizedClip, SynthesizeOptions, VoiceProvider } from "./voice-provider";
