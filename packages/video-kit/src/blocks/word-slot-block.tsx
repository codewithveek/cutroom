import type { WordSlotScene } from "@cutroom/scene-spec";
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { useFrameShape } from "../frame-shape/use-frame-shape";
import { useTypeSizes } from "../frame-shape/use-type-sizes";
import { useLook } from "../looks/look-context";
import { easeInOut } from "../motion/easing";
import { FadeRise } from "../motion/fade-rise";
import { useResolveByFrame } from "../scene-context/scene-context";
import { BlockFrame } from "./block-frame";

const SLOT_START_FRAME = 10;
const STEP_TRAVEL_FRAMES = 10;

/** Fractional slot position: integer while holding an item, between items while stepping. */
export function slotPosition(frame: number, itemCount: number, resolveBy: number): number {
  const stepFrames = Math.max(
    STEP_TRAVEL_FRAMES + 6,
    (resolveBy - SLOT_START_FRAME) / Math.max(1, itemCount),
  );
  const stepKeyframes: number[] = [];
  const positions: number[] = [];
  for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
    const holdStart = SLOT_START_FRAME + itemIndex * stepFrames;
    stepKeyframes.push(holdStart, holdStart + stepFrames - STEP_TRAVEL_FRAMES);
    positions.push(itemIndex, itemIndex);
  }
  if (stepKeyframes.length < 2) return 0;
  return interpolate(frame, stepKeyframes, positions, {
    easing: easeInOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export function WordSlotBlock(props: { scene: WordSlotScene }): React.ReactElement {
  const { lead, items } = props.scene.props;
  const frame = useCurrentFrame();
  const look = useLook();
  const shape = useFrameShape();
  const sizes = useTypeSizes();
  const resolveBy = useResolveByFrame();
  const position = slotPosition(frame, items.length, resolveBy);
  const lineHeight = sizes.headline * 1.2;
  const longestItemCharacters = Math.max(...items.map((item) => item.length));
  // Roughly 0.6em per character keeps the longest item on one line without measuring text.
  const slotWidth = shape.isStacked ? "100%" : `${longestItemCharacters * 0.6}em`;
  return (
    <BlockFrame>
      <div
        style={{
          display: "flex",
          flexDirection: shape.isStacked ? "column" : "row",
          alignItems: "center",
          gap: sizes.headline * 0.35,
          fontFamily: look.fonts.headline.family,
          fontWeight: look.fonts.headline.weight,
          fontSize: sizes.headline,
          letterSpacing: `${look.headlineTracking}em`,
          color: look.colors.ink,
        }}
      >
        <FadeRise startFrame={0} distancePx={24} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
          <span>{lead}</span>
        </FadeRise>
        <div style={{ position: "relative", height: lineHeight * 3, overflow: "hidden", width: slotWidth }}>
          {items.map((item, itemIndex) => {
            const offset = itemIndex - position;
            return (
              <div
                key={item}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: lineHeight * (1 + offset),
                  height: lineHeight,
                  lineHeight: `${lineHeight}px`,
                  textAlign: shape.isStacked ? "center" : "left",
                  whiteSpace: "nowrap",
                  color: Math.abs(offset) < 0.5 ? look.colors.accent : look.colors.ink,
                  opacity: interpolate(Math.abs(offset), [0, 1, 2], [1, 0.22, 0], {
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                {item}
              </div>
            );
          })}
        </div>
      </div>
    </BlockFrame>
  );
}
