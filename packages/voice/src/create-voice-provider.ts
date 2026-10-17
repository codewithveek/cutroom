import { assertProviderAllowed, type PrivacyOptIns } from "@cutroom/providers";
import type { PrivacyMode, VoiceSelection } from "@cutroom/scene-spec";
import { createElevenLabsProvider } from "./elevenlabs-provider";
import { createKokoroProvider } from "./kokoro-provider";
import { createSilentProvider } from "./silent-provider";
import type { VoiceProvider } from "./voice-provider";

export interface CreateVoiceProviderOptions {
  mode: PrivacyMode;
  selection: VoiceSelection;
  kokoro: { modelId: string; dtype: "fp32" | "fp16" | "q8" | "q4" | "q4f16"; modelCacheDirectory: string };
  elevenLabsApiKey: string | undefined;
  optIns?: PrivacyOptIns;
}

export class VoiceConfigurationError extends Error {
  override readonly name = "VoiceConfigurationError";
}

/** Builds the run's voice and applies the privacy guard at construction (FR-PRV-2). */
export function createVoiceProvider(options: CreateVoiceProviderOptions): VoiceProvider {
  const provider = buildProvider(options);
  assertProviderAllowed({
    mode: options.mode,
    provider: { providerId: provider.providerId, role: "voice", networkScope: provider.networkScope },
    ...(options.optIns ? { optIns: options.optIns } : {}),
  });
  return provider;
}

function buildProvider(options: CreateVoiceProviderOptions): VoiceProvider {
  switch (options.selection.provider) {
    case "none":
      return createSilentProvider();
    case "elevenlabs":
      if (!options.elevenLabsApiKey) throw new VoiceConfigurationError("ELEVENLABS_API_KEY is not set");
      return createElevenLabsProvider({ apiKey: options.elevenLabsApiKey });
    case "kokoro":
      return createKokoroProvider({ ...options.kokoro, allowDownload: options.mode !== "local" });
  }
}
