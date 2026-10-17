import type { PcmAudio } from "@cutroom/audio-io";
import type { SynthesizeOptions, VoiceProvider } from "./voice-provider";

const ELEVENLABS_SAMPLE_RATE = 24_000;

export interface ElevenLabsProviderOptions {
  apiKey: string;
  modelId?: string;
  fetchImplementation?: typeof fetch;
}

export class VoiceProviderError extends Error {
  override readonly name = "VoiceProviderError";
}

/**
 * ElevenLabs (Cloud mode, or Hybrid with an explicit opt-in). It receives narration text only,
 * never code. Requests raw 24 kHz PCM so durations are exact without decoding MP3 (FR-VO-3).
 */
export function createElevenLabsProvider(options: ElevenLabsProviderOptions): VoiceProvider {
  const fetchImplementation = options.fetchImplementation ?? ((input, init) => fetch(input, init));
  return {
    providerId: "elevenlabs",
    networkScope: "external",
    isAiVoice: true,
    licence: "ElevenLabs (commercial use on paid plans)",
    async synthesizePcm(synthesizeOptions: SynthesizeOptions): Promise<PcmAudio> {
      const url = new URL(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(synthesizeOptions.voiceId)}`,
      );
      url.searchParams.set("output_format", `pcm_${ELEVENLABS_SAMPLE_RATE}`);
      const response = await fetchImplementation(url, {
        method: "POST",
        headers: { "content-type": "application/json", "xi-api-key": options.apiKey },
        body: JSON.stringify({
          text: synthesizeOptions.text,
          model_id: options.modelId ?? "eleven_multilingual_v2",
          voice_settings: { speed: synthesizeOptions.speed },
        }),
      });
      if (!response.ok) throw new VoiceProviderError(`ElevenLabs returned ${response.status}`);
      const pcm = Buffer.from(await response.arrayBuffer());
      const samples = new Float32Array(Math.floor(pcm.length / 2));
      for (let index = 0; index < samples.length; index += 1)
        samples[index] = pcm.readInt16LE(index * 2) / 32768;
      return { sampleRate: ELEVENLABS_SAMPLE_RATE, channels: [samples] };
    },
  };
}
