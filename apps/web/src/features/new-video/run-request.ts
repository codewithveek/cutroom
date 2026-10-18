import { type PresetId, presets } from "@cutroom/presets";
import type { AspectRatio, LookId, PrivacyMode, RunRequestInput } from "@cutroom/scene-spec";

export function sourceFor(repo: string): RunRequestInput["source"] {
  const trimmed = repo.trim();
  return /^(https:\/\/|git@)/.test(trimmed) ? { kind: "git", url: trimmed } : { kind: "path", path: trimmed };
}

export interface NewRunChoices {
  repo: string;
  presetId: PresetId;
  privacyMode: PrivacyMode;
  ratios: ReadonlyArray<AspectRatio>;
  /** Omitted or "auto" → recommendLook decides from the repository. */
  look?: LookId | "auto";
  direction?: string;
  accentColor?: string;
}

/** Preset values, overridden by what the user picked: one request shape for the composer and the wizard. */
export function buildRunRequest(choices: NewRunChoices): RunRequestInput {
  const preset = presets[choices.presetId];
  const direction = choices.direction?.trim();
  const look = choices.look ?? preset.look;
  return {
    source: sourceFor(choices.repo),
    presetId: preset.id,
    videoType: preset.videoType,
    ...(look === "auto" ? {} : { look }),
    ratios: [...choices.ratios],
    targetSeconds: preset.targetSeconds,
    voice: preset.voice,
    music: preset.music,
    privacyMode: choices.privacyMode,
    ...(direction ? { direction } : {}),
    ...(choices.accentColor && /^#[0-9a-fA-F]{6}$/.test(choices.accentColor)
      ? { brandOverride: { accentColor: choices.accentColor } }
      : {}),
  };
}
