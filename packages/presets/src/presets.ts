import {
  type AspectRatio,
  aspectRatioSchema,
  lookIdSchema,
  musicSelectionSchema,
  type PresetId,
  presetIdSchema,
  videoTypeSchema,
  voiceSelectionSchema,
} from "@cutroom/scene-spec";
import { z } from "zod";

export { type PresetId, presetIdSchema } from "@cutroom/scene-spec";

export const presetSchema = z.object({
  id: presetIdSchema,
  label: z.string(),
  description: z.string(),
  videoType: videoTypeSchema,
  look: lookIdSchema,
  ratios: z.array(aspectRatioSchema).min(1),
  targetSeconds: z.number().int().positive(),
  voice: voiceSelectionSchema,
  music: musicSelectionSchema,
});
export type Preset = z.infer<typeof presetSchema>;

const defaultVoice = { provider: "kokoro", voiceId: "af_heart", speed: 1 } as const;
const bothShapes: AspectRatio[] = ["16:9", "9:16"];

/** Presets are data (PRD §7.4). */
export const presets: Readonly<Record<PresetId, Preset>> = {
  "launch-editorial": {
    id: "launch-editorial",
    label: "Launch · Editorial",
    description: "A 45-second launch film for Product Hunt, X and LinkedIn, with a vertical cutdown.",
    videoType: "launch",
    look: "editorial",
    ratios: bothShapes,
    targetSeconds: 45,
    voice: defaultVoice,
    music: { kind: "generated", bed: "upbeat" },
  },
  "api-launch-graphic": {
    id: "api-launch-graphic",
    label: "API launch · Graphic",
    description: "Setup, request, response, result: for SDKs, APIs and CLIs.",
    videoType: "dev-integration",
    look: "graphic",
    ratios: ["16:9"],
    targetSeconds: 45,
    voice: { provider: "kokoro", voiceId: "am_michael", speed: 1 },
    music: { kind: "generated", bed: "upbeat" },
  },
  "tutorial-studio": {
    id: "tutorial-studio",
    label: "Tutorial · Studio",
    description: "One action per step, voice first, music ducked.",
    videoType: "tutorial",
    look: "studio",
    ratios: ["16:9"],
    targetSeconds: 60,
    voice: defaultVoice,
    music: { kind: "generated", bed: "calm" },
  },
  "teaser-cinematic": {
    id: "teaser-cinematic",
    label: "Teaser · Cinematic",
    description: "Fifteen seconds of mood, the name and a date.",
    videoType: "teaser",
    look: "cinematic",
    ratios: bothShapes,
    targetSeconds: 15,
    voice: { provider: "kokoro", voiceId: "af_heart", speed: 0.92 },
    music: { kind: "generated", bed: "calm" },
  },
  "explainer-editorial": {
    id: "explainer-editorial",
    label: "Explainer · Editorial",
    description: "How it works, one idea per scene.",
    videoType: "explainer",
    look: "editorial",
    ratios: ["16:9"],
    targetSeconds: 50,
    voice: defaultVoice,
    music: { kind: "generated", bed: "calm" },
  },
  "social-cutdown-vertical": {
    id: "social-cutdown-vertical",
    label: "Social cutdown · 9:16",
    description: "15–30 seconds, captions burned in, opens on the hook.",
    videoType: "launch",
    look: "graphic",
    ratios: ["9:16"],
    targetSeconds: 25,
    voice: { ...defaultVoice, speed: 1.05 },
    music: { kind: "generated", bed: "upbeat" },
  },
};

export function getPreset(presetId: PresetId): Preset {
  return presets[presetId];
}
