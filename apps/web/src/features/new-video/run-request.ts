import { type PresetId, presets } from "@cutroom/presets";
import type { AspectRatio, LookId, PrivacyMode, RunRequestInput, UploadResult } from "@cutroom/scene-spec";

export function sourceFor(repo: string): RunRequestInput["source"] {
  const trimmed = repo.trim();
  return /^(https:\/\/|git@)/.test(trimmed) ? { kind: "git", url: trimmed } : { kind: "path", path: trimmed };
}

/** "/, /settings /billing" → a capture of those routes; no app URL → no capture. */
export function captureFor(options: {
  appUrl: string | undefined;
  routes: string | undefined;
}): RunRequestInput["capture"] {
  const appUrl = options.appUrl?.trim();
  if (!appUrl) return undefined;
  const routes = (options.routes ?? "")
    .split(/[\s,]+/)
    .map((route) => route.trim())
    .filter(Boolean)
    .map((route) => (route.startsWith("/") ? route : `/${route}`));
  return { appUrl, routes: routes.length > 0 ? [...new Set(routes)].slice(0, 8) : ["/"] };
}

export interface NewRunChoices {
  repo: string;
  /** An uploaded archive; when set it is the source and `repo` is ignored. */
  upload?: UploadResult | undefined;
  presetId: PresetId;
  privacyMode: PrivacyMode;
  ratios: ReadonlyArray<AspectRatio>;
  /** Omitted or "auto" → recommendLook decides from the repository. */
  look?: LookId | "auto";
  direction?: string;
  accentColor?: string;
  /** The running app to capture screens from, and its routes (space- or comma-separated). */
  appUrl?: string;
  routes?: string;
  /** The "created with cutroom" badge in the bottom-right corner of every ratio. */
  watermark?: boolean;
  /** A tag: make a video of what changed since it, up to HEAD (E2). */
  changesSince?: string | undefined;
}

/** Preset values, overridden by what the user picked: one request shape for the composer and the wizard. */
export function buildRunRequest(choices: NewRunChoices): RunRequestInput {
  const preset = presets[choices.presetId];
  const direction = choices.direction?.trim();
  const look = choices.look ?? preset.look;
  const capture = captureFor({ appUrl: choices.appUrl, routes: choices.routes });
  return {
    source: choices.upload
      ? { kind: "zip", uploadId: choices.upload.uploadId, fileName: choices.upload.fileName }
      : sourceFor(choices.repo),
    presetId: preset.id,
    videoType: preset.videoType,
    ...(look === "auto" ? {} : { look }),
    ratios: [...choices.ratios],
    targetSeconds: preset.targetSeconds,
    voice: preset.voice,
    music: preset.music,
    privacyMode: choices.privacyMode,
    watermark: choices.watermark ?? false,
    ...(choices.changesSince
      ? { changes: { fromRef: choices.changesSince, toRef: "HEAD", includeFixes: false } }
      : {}),
    ...(direction ? { direction } : {}),
    ...(capture ? { capture } : {}),
    ...(choices.accentColor && /^#[0-9a-fA-F]{6}$/.test(choices.accentColor)
      ? { brandOverride: { accentColor: choices.accentColor } }
      : {}),
  };
}
