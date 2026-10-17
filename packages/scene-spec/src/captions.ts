import { FRAMES_PER_SECOND } from "./primitives";
import type { VoiceTimeline } from "./voice-timeline";

export const CAPTION_MAX_CHARS_PER_LINE = 42;
export const CAPTION_MAX_LINES = 2;
/** A cue may stretch to meet the next one, but not across a long silence. */
const MAX_CUE_EXTENSION_FRAMES = 2 * FRAMES_PER_SECOND;

export interface CaptionCue {
  startFrame: number;
  endFrame: number;
  /** Already wrapped: at most two lines joined with "\n". */
  text: string;
}

export function splitSentences(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [];
  return sentences.map((sentence) => sentence.trim()).filter(Boolean);
}

/** Greedy word wrap. Returns lines no longer than `maxChars` unless a single word is longer. */
export function wrapWords(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let currentLine = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length > maxChars && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/** Splits a sentence into chunks that each fit in two caption lines. */
function chunkSentence(sentence: string): string[] {
  const wrappedLines = wrapWords(sentence, CAPTION_MAX_CHARS_PER_LINE);
  const chunks: string[] = [];
  for (let index = 0; index < wrappedLines.length; index += CAPTION_MAX_LINES) {
    chunks.push(wrappedLines.slice(index, index + CAPTION_MAX_LINES).join("\n"));
  }
  return chunks;
}

interface TimedText {
  startFrame: number;
  frames: number;
  text: string;
}

/** Shares a line's frames between its chunks in proportion to their length. */
function splitTimedText(timedText: TimedText): CaptionCue[] {
  const chunks = splitSentences(timedText.text).flatMap(chunkSentence);
  const totalChars = chunks.reduce((sum, chunk) => sum + chunk.length, 0) || 1;
  const cues: CaptionCue[] = [];
  let cursor = timedText.startFrame;
  chunks.forEach((chunk, index) => {
    const isLast = index === chunks.length - 1;
    const chunkFrames = Math.round((chunk.length / totalChars) * timedText.frames);
    const endFrame = isLast ? timedText.startFrame + timedText.frames : cursor + Math.max(1, chunkFrames);
    cues.push({ startFrame: cursor, endFrame, text: chunk });
    cursor = endFrame;
  });
  return cues;
}

export interface BuildCaptionCuesOptions {
  timeline: VoiceTimeline;
  /** Frames before the first scene (thumbnail intro). */
  introFrames: number;
}

/** One sentence per cue, ≤ 2 lines × ~42 chars, each cue ending where the next starts (FR-RD-3). */
export function buildCaptionCues(options: BuildCaptionCuesOptions): CaptionCue[] {
  const timedTexts: TimedText[] = options.timeline.scenes.flatMap((sceneTiming) =>
    sceneTiming.lines.map((line) => ({
      startFrame: options.introFrames + sceneTiming.fromFrame + line.fromFrame,
      frames: line.frames,
      text: line.text,
    })),
  );
  const cues = timedTexts.flatMap(splitTimedText);
  return cues.map((cue, index) => {
    const nextCue = cues[index + 1];
    if (!nextCue) return cue;
    const extendedEnd = Math.min(nextCue.startFrame, cue.endFrame + MAX_CUE_EXTENSION_FRAMES);
    return { ...cue, endFrame: Math.max(cue.endFrame, extendedEnd) };
  });
}
