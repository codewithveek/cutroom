import type { CaptionCue } from "@cutroom/scene-spec";

export function formatVttTimestamp(totalMilliseconds: number): string {
  const clamped = Math.max(0, Math.round(totalMilliseconds));
  const hours = Math.floor(clamped / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  const milliseconds = clamped % 1000;
  const pad = (value: number, width: number) => String(value).padStart(width, "0");
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(milliseconds, 3)}`;
}

/** WebVTT with one sentence per cue (FR-RD-3). */
export function buildWebVtt(cues: ReadonlyArray<CaptionCue>, fps: number): string {
  const blocks = cues.map((cue, index) => {
    const start = formatVttTimestamp((cue.startFrame / fps) * 1000);
    const end = formatVttTimestamp((cue.endFrame / fps) * 1000);
    return `${index + 1}\n${start} --> ${end}\n${cue.text}`;
  });
  return `WEBVTT\n\n${blocks.join("\n\n")}\n`;
}
