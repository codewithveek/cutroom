import type { BigNumberScene } from "@cutroom/scene-spec";
import React from "react";
import { interpolateColors, useCurrentFrame } from "remotion";
import { useFrameShape } from "../frame-shape/use-frame-shape";
import { useTypeSizes } from "../frame-shape/use-type-sizes";
import { useLook } from "../looks/look-context";
import { FadeRise } from "../motion/fade-rise";
import { Odometer } from "../motion/odometer";
import { RisingText } from "../motion/rising-text";
import { RuleLabel } from "../motion/rule-label";
import { BlockFrame } from "./block-frame";

const ROLL_START_FRAME = 8;
const ROLL_FRAMES = 36;

export function BigNumberBlock(props: { scene: BigNumberScene }): React.ReactElement {
  const { label, value, format, line, limitState } = props.scene.props;
  const frame = useCurrentFrame();
  const look = useLook();
  const shape = useFrameShape();
  const sizes = useTypeSizes();
  const rollEnd = ROLL_START_FRAME + ROLL_FRAMES + 10;
  const numberColor = limitState
    ? interpolateColors(frame, [rollEnd, rollEnd + 12], [look.colors.ink, look.colors.alarm])
    : look.colors.ink;
  return (
    <BlockFrame align="start" style={{ alignItems: "center" }}>
      <div style={{ width: shape.isStacked ? "100%" : "62%", display: "flex", flexDirection: "column" }}>
        <RuleLabel label={label} startFrame={0} fontSizePx={sizes.eyebrow} />
        <div
          style={{
            fontFamily: look.fonts.number.family,
            fontWeight: look.fonts.number.weight,
            fontSize: sizes.number,
            letterSpacing: "-0.04em",
            color: numberColor,
            marginTop: sizes.number * 0.12,
            marginBottom: sizes.number * 0.1,
          }}
        >
          <Odometer
            value={value}
            format={format}
            startFrame={ROLL_START_FRAME}
            durationFrames={ROLL_FRAMES}
          />
        </div>
        {line ? (
          <FadeRise startFrame={ROLL_START_FRAME + 10} distancePx={0}>
            <div
              style={{
                fontFamily: look.fonts.body.family,
                fontWeight: 600,
                fontSize: sizes.body * 1.1,
                color: look.colors.ink,
                lineHeight: 1.25,
              }}
            >
              <RisingText text={line} startFrame={ROLL_START_FRAME + 12} starColor={look.colors.accent} />
            </div>
          </FadeRise>
        ) : null}
      </div>
    </BlockFrame>
  );
}
