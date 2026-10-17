import { parseStarredText } from "@cutroom/scene-spec";
import type { CSSProperties } from "react";
import React from "react";
import { useCurrentFrame } from "remotion";
import { progressBetween } from "./easing";

export const WORD_STAGGER_FRAMES = 3;
const WORD_RISE_FRAMES = 16;

interface Word {
  text: string;
  starred: boolean;
}

function splitWords(source: string): Word[] {
  return parseStarredText(source).flatMap((segment) =>
    segment.text
      .split(/\s+/)
      .filter(Boolean)
      .map((text) => ({ text, starred: segment.starred })),
  );
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
            key={`${word.text}-${wordIndex}`}
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
                color: word.starred ? props.starColor : undefined,
              }}
            >
              {word.text}
            </span>
            {wordIndex < words.length - 1 ? " " : null}
          </span>
        );
      })}
    </span>
  );
}
