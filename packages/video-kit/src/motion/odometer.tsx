import type { CSSProperties } from "react";
import React from "react";
import { useCurrentFrame } from "remotion";
import { progressBetween } from "./easing";

export type NumberFormat = "integer" | "percent" | "currency";

export function formatNumber(value: number, format: NumberFormat): string {
  const rounded = Math.round(value);
  const grouped = new Intl.NumberFormat("en-US").format(Math.abs(rounded));
  const sign = rounded < 0 ? "-" : "";
  if (format === "percent") return `${sign}${grouped}%`;
  if (format === "currency") return `${sign}$${grouped}`;
  return `${sign}${grouped}`;
}

const DIGIT_STAGGER_FRAMES = 3;

function DigitColumn(props: { digit: number; progress: number }): React.ReactElement {
  // Rolls through one full turn plus the target digit, landing exactly on it.
  const travelledDigits = (10 + props.digit) * props.progress;
  return (
    <span style={{ display: "inline-block", height: "1em", overflow: "hidden", verticalAlign: "top" }}>
      <span style={{ display: "block", transform: `translateY(${-travelledDigits}em)` }}>
        {Array.from({ length: 20 }, (_, index) => (
          <span key={index} style={{ display: "block", height: "1em", lineHeight: 1 }}>
            {index % 10}
          </span>
        ))}
      </span>
    </span>
  );
}

export interface OdometerProps {
  value: number;
  format: NumberFormat;
  startFrame: number;
  durationFrames: number;
  style?: CSSProperties;
}

/** Digits roll into the final value, each column a few frames after the last. */
export function Odometer(props: OdometerProps): React.ReactElement {
  const frame = useCurrentFrame();
  const characters = [...formatNumber(props.value, props.format)];
  let digitIndex = 0;
  return (
    <span
      style={{ display: "inline-flex", lineHeight: 1, fontVariantNumeric: "tabular-nums", ...props.style }}
    >
      {characters.map((character, characterIndex) => {
        const digit = Number.parseInt(character, 10);
        if (Number.isNaN(digit)) {
          return <span key={characterIndex}>{character}</span>;
        }
        const progress = progressBetween({
          frame,
          startFrame: props.startFrame + digitIndex * DIGIT_STAGGER_FRAMES,
          durationFrames: props.durationFrames,
        });
        digitIndex += 1;
        return <DigitColumn key={characterIndex} digit={digit} progress={progress} />;
      })}
    </span>
  );
}
