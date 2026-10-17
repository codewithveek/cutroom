import React from "react";
import { useCurrentFrame } from "remotion";
import { useLook } from "../looks/look-context";
import { progressBetween } from "./easing";

export interface RuleLabelProps {
  label: string;
  startFrame: number;
  fontSizePx: number;
}

/** A rule drawing in from the left with a small uppercase label above it. */
export function RuleLabel(props: RuleLabelProps): React.ReactElement {
  const frame = useCurrentFrame();
  const look = useLook();
  const ruleProgress = progressBetween({ frame, startFrame: props.startFrame, durationFrames: 24 });
  const labelProgress = progressBetween({ frame, startFrame: props.startFrame + 6, durationFrames: 18 });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: props.fontSizePx * 0.6 }}>
      <div
        style={{
          fontFamily: look.fonts.body.family,
          fontWeight: 600,
          fontSize: props.fontSizePx,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: look.colors.inkMuted,
          opacity: labelProgress,
        }}
      >
        {props.label}
      </div>
      <div
        style={{
          height: Math.max(2, props.fontSizePx * 0.1),
          width: "100%",
          background: look.colors.ink,
          opacity: 0.85,
          transformOrigin: "left center",
          transform: `scaleX(${ruleProgress})`,
        }}
      />
    </div>
  );
}
