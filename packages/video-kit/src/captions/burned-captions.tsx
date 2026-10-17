import type { CaptionCue } from "@cutroom/scene-spec";
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useFrameShape } from "../frame-shape/use-frame-shape";
import { useTypeSizes } from "../frame-shape/use-type-sizes";
import { useLook } from "../looks/look-context";

/** Burned in for 9:16 and 1:1, 14% from the bottom (PRD §7.6). */
export function BurnedCaptions(props: { cues: ReadonlyArray<CaptionCue> }): React.ReactElement | null {
  const frame = useCurrentFrame();
  const look = useLook();
  const shape = useFrameShape();
  const sizes = useTypeSizes();
  const activeCue = props.cues.find((cue) => frame >= cue.startFrame && frame < cue.endFrame);
  if (!activeCue) return null;
  return (
    <AbsoluteFill
      style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: shape.height * 0.14 }}
    >
      <div
        style={{
          maxWidth: "86%",
          textAlign: "center",
          whiteSpace: "pre-line",
          fontFamily: look.fonts.body.family,
          fontWeight: 700,
          fontSize: Math.max(sizes.small * 1.15, shape.minTextPx + 6),
          lineHeight: 1.3,
          color: "#ffffff",
          background: "rgba(10,10,12,0.72)",
          padding: `${10 * sizes.scale}px ${22 * sizes.scale}px`,
          borderRadius: 14 * sizes.scale,
        }}
      >
        {activeCue.text}
      </div>
    </AbsoluteFill>
  );
}
