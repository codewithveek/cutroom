import { parseStarredText } from "@cutroom/scene-spec";
import type { CSSProperties } from "react";
import React from "react";
import { useCurrentFrame } from "remotion";
import { progressBetween } from "./easing";

export const WORD_STAGGER_FRAMES = 3;
const WORD_RISE_FRAMES = 16;

/** One rising word; "*days*." is one word with a starred and a plain part. */
interface Word {
  parts: Array<{ text: string; starred: boolean }>;
}

/**
 * Words split on whitespace only, so punctuation right after a starred phrase stays on the same
 * word: "*days*." rises as "days." instead of "days" and a lone ".", which wrapped to its own line.
 */
export function splitWords(source: string): Word[] {
  const words: Word[] = [];
  let joinsPrevious = false;
  for (const segment of parseStarredText(source)) {
    const tokens = segment.text.split(/(\s+)/);
    tokens.forEach((token) => {
      if (token === "") return;
      if (/^\s+$/.test(token)) {
        joinsPrevious = false;
        return;
      }
      const previous = words.at(-1);
      if (joinsPrevious && previous) previous.parts.push({ text: token, starred: segment.starred });
      else words.push({ parts: [{ text: token, starred: segment.starred }] });
      joinsPrevious = true;
    });
  }
  return words;
}

export function countRisingWords(source: string): number {
  return splitWords(source).length;
}

export interface RisingTextProps {
  text: string;
  startFrame: number;
  /** Colour for *starred* words; unstarred words inherit. */
  starColor?: string;
  style?: CSSProperties;
}

/** Text rises out of a mask word by word, about 3 frames apart (PRD §7.5). */
export function RisingText(props: RisingTextProps): React.ReactElement {
  const frame = useCurrentFrame();
  const words = splitWords(props.text);
  return (
    <span style={{ display: "inline", ...props.style }}>
      {words.map((word, wordIndex) => {
        const progress = progressBetween({
          frame,
          startFrame: props.startFrame + wordIndex * WORD_STAGGER_FRAMES,
          durationFrames: WORD_RISE_FRAMES,
        });
        return (
          <span
            key={`${word.parts.map((part) => part.text).join("")}-${wordIndex}`}
            style={{
              display: "inline-block",
              overflow: "hidden",
              verticalAlign: "top",
              paddingBottom: "0.08em",
              marginBottom: "-0.08em",
            }}
          >
            <span
              style={{
                display: "inline-block",
                transform: `translateY(${(1 - progress) * 105}%)`,
              }}
            >
              {word.parts.map((part, partIndex) => (
                <span key={partIndex} style={part.starred ? { color: props.starColor } : undefined}>
                  {part.text}
                </span>
              ))}
            </span>
            {wordIndex < words.length - 1 ? " " : null}
          </span>
        );
      })}
    </span>
  );
}
