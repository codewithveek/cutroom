import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { encodeWav } from "@cutroom/audio-io";
import { assertNotDemoMode } from "@cutroom/config";
import { runFfmpeg } from "@cutroom/renderer";
import type { SystemCheck, SystemStatus, VoiceOption } from "@cutroom/scene-spec";
import { createVoiceProvider, kokoroVoices, type VoiceProvider } from "@cutroom/voice";
import { z } from "zod";
import { dataPaths, type PipelineServices } from "../services";

export class UnknownVoiceOptionError extends Error {
  override readonly name = "UnknownVoiceOptionError";
}

export interface SystemService {
  status(): Promise<SystemStatus>;
  voices(): ReadonlyArray<VoiceOption>;
  /** A short WAV in the voice, synthesised locally once and cached. Resolves to its path. */
  voiceSample(voiceId: string): Promise<string>;
}

const ollamaTagsSchema = z.object({ models: z.array(z.object({ name: z.string() })) });

async function ollamaModels(host: string): Promise<string[] | null> {
  try {
    const response = await fetch(new URL("/api/tags", host), { signal: AbortSignal.timeout(2500) });
    if (!response.ok) return null;
    return ollamaTagsSchema.parse(await response.json()).models.map((model) => model.name);
  } catch {
    return null;
  }
}

function modelCheck(options: { modelId: string; host: string; installed: string[] | null }): SystemCheck {
  if (options.installed === null) {
    return {
      id: "model",
      label: "Gemma via Ollama",
      state: "missing",
      detail: `Ollama is not answering at ${options.host}.`,
      fix: "ollama serve",
    };
  }
  const ready = options.installed.includes(options.modelId);
  return {
    id: "model",
    label: "Gemma via Ollama",
    state: ready ? "ready" : "missing",
    detail: ready ? `${options.modelId} is installed.` : `${options.modelId} is not pulled yet.`,
    ...(ready ? {} : { fix: `ollama pull ${options.modelId}` }),
  };
}

function voiceCheck(services: PipelineServices): SystemCheck {
  const modelDirectory = path.join(dataPaths(services.dataDirectory).models, services.env.KOKORO_MODEL_ID);
  const ready = existsSync(path.join(modelDirectory, "config.json"));
  return {
    id: "voice",
    label: "Kokoro voice model",
    state: ready ? "ready" : "missing",
    detail: ready ? "Downloaded; voices run offline." : "Not downloaded yet (about 90 MB, once).",
    ...(ready ? {} : { fix: "pnpm cutroom setup" }),
  };
}

async function ffmpegCheck(): Promise<SystemCheck> {
  const available = await runFfmpeg(["-version"]).then(
    () => true,
    () => false,
  );
  return {
    id: "ffmpeg",
    label: "ffmpeg",
    state: available ? "ready" : "missing",
    detail: available ? "Loudness, captions and thumbnails." : "Needed for every render.",
    ...(available ? {} : { fix: "brew install ffmpeg  ·  apt install ffmpeg" }),
  };
}

function renderHostCheck(services: PipelineServices): SystemCheck {
  const host = services.env.RENDER_API_BASE_URL;
  const configured = Boolean(host && services.env.RENDER_API_TOKEN);
  return {
    id: "render-host",
    label: "Hybrid render host",
    state: configured ? "ready" : "optional",
    detail:
      configured && host ? `Hybrid renders go to ${new URL(host).host}.` : "Only needed for Hybrid mode.",
    ...(configured ? {} : { fix: "RENDER_API_BASE_URL and RENDER_API_TOKEN" }),
  };
}

function findDemoRepository(): string | undefined {
  const candidate = path.resolve(import.meta.dirname, "../../../../evals/fixtures/shipnote");
  return existsSync(path.join(candidate, "package.json")) ? candidate : undefined;
}

/** Health of the local toolchain and voice previews, for the dashboard and settings screens. */
export function createSystemService(services: PipelineServices): SystemService {
  const scripted = Boolean(services.modelTransportOverride) || services.env.MODEL_PROVIDER !== "auto";
  let sampleVoice: VoiceProvider | undefined;
  const samplesDirectory = path.join(services.dataDirectory, "voice-samples");

  return {
    async status() {
      // The demo probes nothing (no Ollama, no ffmpeg): it only serves what was rendered beforehand.
      if (services.env.CUTROOM_DEMO_MODE)
        return {
          model: { provider: "scripted", modelId: "scripted-shipnote", installedModels: [] },
          checks: [
            {
              id: "model",
              label: "Scripted model",
              state: "ready",
              detail: "The demo plays back runs made beforehand; nothing is generated here.",
            },
          ],
          defaultPrivacyMode: "local",
          demoMode: true,
        };
      const installed = scripted ? [] : await ollamaModels(services.env.OLLAMA_HOST);
      const model: SystemCheck = scripted
        ? {
            id: "model",
            label: "Scripted model",
            state: "ready",
            detail: "Answers for the demo repository only (MODEL_PROVIDER=scripted-shipnote).",
          }
        : modelCheck({ modelId: services.env.MODEL_ID, host: services.env.OLLAMA_HOST, installed });
      const demoRepositoryPath = findDemoRepository();
      return {
        model: {
          provider: scripted ? "scripted" : "ollama",
          modelId: scripted ? "scripted-shipnote" : services.env.MODEL_ID,
          installedModels: installed ?? [],
        },
        checks: [model, voiceCheck(services), await ffmpegCheck(), renderHostCheck(services)],
        defaultPrivacyMode: services.env.DEFAULT_PRIVACY_MODE,
        demoMode: false,
        ...(demoRepositoryPath ? { demoRepositoryPath } : {}),
      };
    },

    voices: () => kokoroVoices,

    async voiceSample(voiceId) {
      const voice = kokoroVoices.find((candidate) => candidate.id === voiceId);
      if (!voice) throw new UnknownVoiceOptionError(`Unknown voice "${voiceId}"`);
      const samplePath = path.join(samplesDirectory, `${voice.id}.wav`);
      if (existsSync(samplePath)) return samplePath;
      assertNotDemoMode(services.env, "Voice synthesis");
      // Local mode: the privacy guard refuses anything but the on-disk Kokoro model.
      sampleVoice ??= createVoiceProvider({
        mode: "local",
        selection: { provider: "kokoro", voiceId: voice.id, speed: 1 },
        kokoro: {
          modelId: services.env.KOKORO_MODEL_ID,
          dtype: services.env.KOKORO_DTYPE,
          modelCacheDirectory: dataPaths(services.dataDirectory).models,
        },
        elevenLabsApiKey: undefined,
      });
      const audio = await sampleVoice.synthesizePcm({
        text: `Hi, I'm ${voice.name}. This is how your product video will sound.`,
        voiceId: voice.id,
        speed: 1,
      });
      await mkdir(samplesDirectory, { recursive: true });
      await writeFile(samplePath, encodeWav(audio));
      return samplePath;
    },
  };
}
