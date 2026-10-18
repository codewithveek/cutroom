import type { RunRequestInput } from "@cutroom/pipeline";
import { type Preset, type PresetId, presetIdSchema, presets } from "@cutroom/presets";
import {
  type AspectRatio,
  aspectRatioSchema,
  lookIdSchema,
  musicBedSchema,
  privacyModeSchema,
  videoTypeSchema,
} from "@cutroom/scene-spec";
import { z } from "zod";

export const makeFlagsSchema = z.object({
  repo: z.string().min(1, "--repo is required"),
  preset: presetIdSchema.default("launch-editorial"),
  ratios: z.string().optional(),
  privacy: privacyModeSchema.default("local"),
  look: lookIdSchema.optional(),
  type: videoTypeSchema.optional(),
  seconds: z.coerce.number().int().min(10).max(120).optional(),
  voice: z.string().optional(),
  music: z.union([musicBedSchema, z.literal("none")]).optional(),
  yes: z.boolean().default(false),
  scripted: z.boolean().default(false),
  silent: z.boolean().default(false),
  seed: z.coerce.number().int().nonnegative().default(1),
  appUrl: z.url().optional(),
  routes: z.string().optional(),
});
export type MakeFlags = z.infer<typeof makeFlagsSchema>;

function parseRatios(value: string | undefined, preset: Preset): AspectRatio[] {
  if (!value) return preset.ratios;
  return value.split(",").map((ratio) => aspectRatioSchema.parse(ratio.trim()));
}

function captureFor(flags: MakeFlags): RunRequestInput["capture"] {
  if (!flags.appUrl) return undefined;
  const routes = (flags.routes ?? "/")
    .split(",")
    .map((route) => route.trim())
    .filter(Boolean);
  return { appUrl: flags.appUrl, routes: routes.length > 0 ? routes : ["/"] };
}

function sourceFor(repo: string): RunRequestInput["source"] {
  return /^(https:\/\/|git@)/.test(repo) ? { kind: "git", url: repo } : { kind: "path", path: repo };
}

/** Preset values, overridden flag by flag; `source` replaces `--repo` (a staged zip). */
export function buildRunRequest(flags: MakeFlags, source?: RunRequestInput["source"]): RunRequestInput {
  const preset = presets[flags.preset as PresetId];
  const voice = flags.silent
    ? { provider: "none" as const, voiceId: "silent", speed: 1 }
    : flags.voice
      ? { ...preset.voice, voiceId: flags.voice }
      : preset.voice;
  const music =
    flags.music === "none"
      ? { kind: "none" as const }
      : flags.music
        ? { kind: "generated" as const, bed: flags.music }
        : preset.music;
  return {
    source: source ?? sourceFor(flags.repo),
    presetId: preset.id,
    videoType: flags.type ?? preset.videoType,
    look: flags.look ?? preset.look,
    ratios: parseRatios(flags.ratios, preset),
    targetSeconds: flags.seconds ?? preset.targetSeconds,
    voice,
    music,
    privacyMode: flags.privacy,
    autoApprove: flags.yes,
    seed: flags.seed,
    ...(flags.appUrl ? { capture: captureFor(flags) } : {}),
  };
}
