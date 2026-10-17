import type { CSSProperties, ReactNode } from "react";
import React from "react";
import { useCurrentFrame } from "remotion";
import { progressBetween } from "./easing";

export interface FadeRiseProps {
  startFrame: number;
  durationFrames?: number;
  distancePx?: number;
  children: ReactNode;
  style?: CSSProperties;
}

/** A wrapper that owns its transform, so children can keep their own. */
export function FadeRise(props: FadeRiseProps): React.ReactElement {
  const frame = useCurrentFrame();
  const progress = progressBetween({
    frame,
    startFrame: props.startFrame,
    durationFrames: props.durationFrames ?? 20,
  });
  return (
    <div
      style={{
        ...props.style,
        opacity: progress,
        transform: `translateY(${(1 - progress) * (props.distancePx ?? 40)}px)`,
      }}
    >
      {props.children}
    </div>
  );
}
