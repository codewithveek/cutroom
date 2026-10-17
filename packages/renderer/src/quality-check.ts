import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { introFramesFor, type VideoProps } from "@cutroom/scene-spec";
import { z } from "zod";
import { runFfmpeg } from "./ffmpeg";
import { renderStills } from "./render-ratio";

export interface StillPlan {
  frame: number;
  label: string;
}

/**
 * Stills at every scene's resolved last frame (just before its outgoing transition) and at
 * every transition midpoint of the full composition (FR-RD-5, CLAUDE.md Remotion rules).
 */
export function planQualityStills(
  videoProps: Pick<VideoProps, "voiceTimeline" | "openOnThumbnail">,
): StillPlan[] {
  const introFrames = introFramesFor(videoProps.openOnThumbnail);
  const scenes = videoProps.voiceTimeline.scenes;
  return scenes.flatMap((sceneTiming, index) => {
    const nextScene = scenes[index + 1];
    const outgoingFrames = nextScene?.transitionInFrames ?? 0;
    const resolvedFrame =
      introFrames + sceneTiming.fromFrame + sceneTiming.durationFrames - outgoingFrames - 1;
    const plans: StillPlan[] = [{ frame: resolvedFrame, label: `scene-${index + 1}-end` }];
    if (nextScene && nextScene.transitionInFrames > 0) {
      plans.push({
        frame: introFrames + nextScene.fromFrame + Math.floor(nextScene.transitionInFrames / 2),
        label: `transition-${index + 1}-${index + 2}`,
      });
    }
    return plans;
  });
}

export const audioReportSchema = z.object({
  peakDbfs: z.number(),
  rmsDbfs: z.number(),
  /** Share of signal energy below 250 Hz: high values mean a muddy mix. */
  lowEnergyPercent: z.number(),
  /** Momentary loudness (LUFS) once per second. */
  loudnessTimeline: z.array(z.object({ second: z.number(), lufs: z.number() })),
  integratedLufs: z.number().optional(),
});
export type AudioReport = z.infer<typeof audioReportSchema>;

function parseOverallStat(stderr: string, label: string): number {
  const overall = stderr.slice(stderr.lastIndexOf("Overall"));
  const match = overall.match(new RegExp(`${label}:\\s*(-?[\\d.]+|-inf)`));
  if (!match?.[1] || match[1] === "-inf") return -120;
  return Number(match[1]);
}

export function parseEbur128Timeline(stderr: string): { second: number; lufs: number }[] {
  const timeline: { second: number; lufs: number }[] = [];
  let nextSecond = 0;
  for (const match of stderr.matchAll(/t:\s*([\d.]+)\s+TARGET:.*?M:\s*(-?[\d.]+|-inf)/g)) {
    const time = Number(match[1]);
    if (time + 1e-6 < nextSecond) continue;
    timeline.push({ second: Math.round(time), lufs: match[2] === "-inf" ? -70 : Number(match[2]) });
    nextSecond = Math.floor(time) + 1;
  }
  return timeline;
}

/** Peak, RMS, low-frequency share and a loudness timeline for one file (FR-RD-5). */
export async function analyseAudio(videoPath: string): Promise<AudioReport> {
  const full = await runFfmpeg([
    "-i",
    videoPath,
    "-vn",
    "-af",
    "astats=measure_perchannel=none",
    "-f",
    "null",
    "-",
  ]);
  const lows = await runFfmpeg([
    "-i",
    videoPath,
    "-vn",
    "-af",
    "lowpass=f=250,astats=measure_perchannel=none",
    "-f",
    "null",
    "-",
  ]);
  const loudness = await runFfmpeg(["-i", videoPath, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"]);
  const rmsDbfs = parseOverallStat(full.stderr, "RMS level dB");
  const lowRmsDbfs = parseOverallStat(lows.stderr, "RMS level dB");
  const lowEnergyPercent = rmsDbfs <= -120 ? 0 : Math.min(100, 100 * 10 ** ((lowRmsDbfs - rmsDbfs) / 10));
  const integrated = loudness.stderr.match(/Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+)/);
  return audioReportSchema.parse({
    peakDbfs: parseOverallStat(full.stderr, "Peak level dB"),
    rmsDbfs,
    lowEnergyPercent: Math.round(lowEnergyPercent * 10) / 10,
    loudnessTimeline: parseEbur128Timeline(loudness.stderr),
    ...(integrated?.[1] ? { integratedLufs: Number(integrated[1]) } : {}),
  });
}

export interface QualityCheckOptions {
  serveUrl: string;
  videoProps: VideoProps;
  videoPath: string;
  outputDirectory: string;
  browserExecutable: string | null;
}

export interface QualityCheckResult {
  stills: Array<{ label: string; frame: number; filePath: string }>;
  audioReport: AudioReport;
  audioReportPath: string;
}

/** Stills and an audio report for one rendered ratio: what to judge by eye and ear. */
export async function qualityCheck(options: QualityCheckOptions): Promise<QualityCheckResult> {
  await mkdir(options.outputDirectory, { recursive: true });
  const plans = planQualityStills(options.videoProps);
  const pathForFrame = new Map(
    plans.map((plan) => [plan.frame, path.join(options.outputDirectory, `${plan.label}.jpg`)]),
  );
  await renderStills({
    serveUrl: options.serveUrl,
    videoProps: options.videoProps,
    frames: plans.map((plan) => plan.frame),
    outputPathForFrame: (frame) =>
      pathForFrame.get(frame) ?? path.join(options.outputDirectory, `frame-${frame}.jpg`),
    browserExecutable: options.browserExecutable,
    scale: 0.5,
  });
  const audioReport = await analyseAudio(options.videoPath);
  const audioReportPath = path.join(options.outputDirectory, "audio-report.json");
  await writeFile(audioReportPath, JSON.stringify(audioReport, null, 2));
  return {
    stills: plans.map((plan) => ({ ...plan, filePath: pathForFrame.get(plan.frame) ?? "" })),
    audioReport,
    audioReportPath,
  };
}
