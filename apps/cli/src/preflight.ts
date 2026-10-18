import { execFile } from "node:child_process";
import type { CutroomEnv } from "@cutroom/config";
import { z } from "zod";
import type { MakeFlags } from "./make-options";

export interface PreflightFacts {
  ffmpegAvailable: boolean;
  /** Model tags Ollama reports, or null when it did not answer. */
  ollamaModels: ReadonlyArray<string> | null;
  needsOllama: boolean;
  modelId: string;
  ollamaHost: string;
}

/** Pure: turns what the probes found into messages a first-time user can act on. */
export function preflightProblems(facts: PreflightFacts): string[] {
  const problems: string[] = [];
  if (!facts.ffmpegAvailable) {
    problems.push(
      "ffmpeg was not found. Install it (brew install ffmpeg / apt install ffmpeg) or set FFMPEG_PATH.",
    );
  }
  if (facts.needsOllama && facts.ollamaModels === null) {
    problems.push(
      `Ollama is not answering at ${facts.ollamaHost}. Install it from https://ollama.com and run \`ollama serve\`, or try \`--scripted\` on the demo fixture.`,
    );
  } else if (facts.needsOllama && !facts.ollamaModels?.some((tag) => tag === facts.modelId)) {
    problems.push(`Ollama does not have ${facts.modelId} yet. Run \`ollama pull ${facts.modelId}\`.`);
  }
  return problems;
}

function probeFfmpeg(): Promise<boolean> {
  const binary = process.env.FFMPEG_PATH ?? "ffmpeg";
  return new Promise((resolve) => execFile(binary, ["-version"], (error) => resolve(!error)));
}

const ollamaTagsSchema = z.object({ models: z.array(z.object({ name: z.string() })) });

async function probeOllama(host: string): Promise<string[] | null> {
  try {
    const response = await fetch(new URL("/api/tags", host), { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    return ollamaTagsSchema.parse(await response.json()).models.map((model) => model.name);
  } catch {
    return null;
  }
}

/** Checks the tools a run needs before it starts, so a missing ffmpeg is not a failure ten minutes in. */
export async function runPreflight(options: { flags: MakeFlags; env: CutroomEnv }): Promise<string[]> {
  const usesCloudEndpoint = options.flags.privacy === "cloud" && Boolean(options.env.OPENAI_COMPAT_BASE_URL);
  const needsOllama = !options.flags.scripted && options.env.MODEL_PROVIDER === "auto" && !usesCloudEndpoint;
  const [ffmpegAvailable, ollamaModels] = await Promise.all([
    probeFfmpeg(),
    needsOllama ? probeOllama(options.env.OLLAMA_HOST) : Promise.resolve([]),
  ]);
  return preflightProblems({
    ffmpegAvailable,
    ollamaModels,
    needsOllama,
    modelId: options.env.MODEL_ID,
    ollamaHost: options.env.OLLAMA_HOST,
  });
}
