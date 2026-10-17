import { z } from "zod";
import { runFfmpeg } from "./ffmpeg";

export const TARGET_INTEGRATED_LUFS = -16;
export const TARGET_TRUE_PEAK_DBTP = -1.5;
const TARGET_LOUDNESS_RANGE = 11;

const loudnormMeasurementSchema = z.object({
  input_i: z.string(),
  input_tp: z.string(),
  input_lra: z.string(),
  input_thresh: z.string(),
  target_offset: z.string(),
});
export type LoudnessMeasurement = z.infer<typeof loudnormMeasurementSchema>;

/** loudnorm prints its JSON report as the last {...} block on stderr. */
export function parseLoudnormReport(stderr: string): LoudnessMeasurement {
  const lastBrace = stderr.lastIndexOf("}");
  const firstBrace = stderr.lastIndexOf("{", lastBrace);
  if (firstBrace < 0 || lastBrace < 0) throw new Error("loudnorm report not found in ffmpeg output");
  const report: unknown = JSON.parse(stderr.slice(firstBrace, lastBrace + 1));
  return loudnormMeasurementSchema.parse(report);
}

const loudnormTarget = `I=${TARGET_INTEGRATED_LUFS}:TP=${TARGET_TRUE_PEAK_DBTP}:LRA=${TARGET_LOUDNESS_RANGE}`;
/** AAC encoding overshoots true peak slightly, so the applying pass aims half a dB lower. */
const applyTarget = `I=${TARGET_INTEGRATED_LUFS}:TP=${TARGET_TRUE_PEAK_DBTP - 0.5}:LRA=${TARGET_LOUDNESS_RANGE}`;

export async function measureLoudness(inputPath: string): Promise<LoudnessMeasurement> {
  const { stderr } = await runFfmpeg([
    "-i",
    inputPath,
    "-vn",
    "-af",
    `loudnorm=${loudnormTarget}:print_format=json`,
    "-f",
    "null",
    "-",
  ]);
  return parseLoudnormReport(stderr);
}

export interface NormalizeLoudnessOptions {
  inputPath: string;
  outputPath: string;
}

/** Two-pass loudnorm to −16 LUFS / −1.5 dBTP; the video stream is copied untouched (FR-RD-2). */
export async function normalizeLoudness(options: NormalizeLoudnessOptions): Promise<LoudnessMeasurement> {
  const measured = await measureLoudness(options.inputPath);
  const secondPassFilter = [
    `loudnorm=${applyTarget}`,
    `measured_I=${measured.input_i}`,
    `measured_TP=${measured.input_tp}`,
    `measured_LRA=${measured.input_lra}`,
    `measured_thresh=${measured.input_thresh}`,
    `offset=${measured.target_offset}`,
    "linear=true",
  ].join(":");
  await runFfmpeg([
    "-y",
    "-i",
    options.inputPath,
    "-c:v",
    "copy",
    "-af",
    secondPassFilter,
    "-ar",
    "48000",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    options.outputPath,
  ]);
  return measured;
}
