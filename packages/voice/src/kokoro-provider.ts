import type { PcmAudio } from "@cutroom/audio-io";
import type { KokoroTTS } from "kokoro-js";
import type { SynthesizeOptions, VoiceProvider } from "./voice-provider";

export interface KokoroProviderOptions {
  modelId: string;
  dtype: "fp32" | "fp16" | "q8" | "q4" | "q4f16";
  /** Model weights live here; downloaded once by `pnpm --filter @cutroom/voice download-model`. */
  modelCacheDirectory: string;
  /** False in Local mode: the model must already be on disk. */
  allowDownload: boolean;
  onProgress?: (progress: { status: string; file?: string; progress?: number }) => void;
}

export class VoiceModelMissingError extends Error {
  override readonly name = "VoiceModelMissingError";
}

type KokoroVoiceId = keyof KokoroTTS["voices"];

export class UnknownVoiceError extends Error {
  override readonly name = "UnknownVoiceError";
}

function assertKokoroVoice(model: KokoroTTS, voiceId: string): KokoroVoiceId {
  if (!Object.hasOwn(model.voices, voiceId)) {
    throw new UnknownVoiceError(
      `Unknown Kokoro voice "${voiceId}". Try one of: ${Object.keys(model.voices).join(", ")}`,
    );
  }
  return voiceId as KokoroVoiceId;
}

/** Kokoro-82M (Apache-2.0) running on the CPU through ONNX Runtime (FR-VO-2). */
export function createKokoroProvider(options: KokoroProviderOptions): VoiceProvider {
  let modelPromise: Promise<KokoroTTS> | undefined;
  const loadModel = async (): Promise<KokoroTTS> => {
    const [{ env }, { KokoroTTS }] = await Promise.all([
      import("@huggingface/transformers"),
      import("kokoro-js"),
    ]);
    env.cacheDir = options.modelCacheDirectory;
    env.allowRemoteModels = options.allowDownload;
    env.allowLocalModels = true;
    try {
      return await KokoroTTS.from_pretrained(options.modelId, {
        dtype: options.dtype,
        device: "cpu",
        ...(options.onProgress
          ? { progress_callback: (progress: unknown) => options.onProgress?.(progress as { status: string }) }
          : {}),
      });
    } catch (error) {
      if (!options.allowDownload) {
        throw new VoiceModelMissingError(
          `Kokoro model ${options.modelId} is not in ${options.modelCacheDirectory}. Run \`pnpm cutroom setup\` once while online (with the same CUTROOM_DATA_DIR).`,
        );
      }
      throw error;
    }
  };
  return {
    providerId: "kokoro",
    networkScope: options.allowDownload ? "external" : "none",
    isAiVoice: true,
    licence: "Kokoro-82M, Apache-2.0",
    async synthesizePcm(synthesizeOptions: SynthesizeOptions): Promise<PcmAudio> {
      modelPromise ??= loadModel();
      modelPromise.catch(() => {
        modelPromise = undefined;
      });
      const model = await modelPromise;
      const result = await model.generate(synthesizeOptions.text, {
        voice: assertKokoroVoice(model, synthesizeOptions.voiceId),
        speed: synthesizeOptions.speed,
      });
      return { sampleRate: result.sampling_rate, channels: [result.audio] };
    },
  };
}
