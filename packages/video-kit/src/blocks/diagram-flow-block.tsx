import type { DiagramFlowScene } from "@cutroom/scene-spec";
import React from "react";
import { useCurrentFrame } from "remotion";
import { useFrameShape } from "../frame-shape/use-frame-shape";
import { type TypeSizes, useTypeSizes } from "../frame-shape/use-type-sizes";
import { useLook } from "../looks/look-context";
import { progressBetween } from "../motion/easing";
import { FadeRise } from "../motion/fade-rise";
import { Card } from "../primitives/card";
import { Icon } from "../primitives/icons";
import { BlockFrame } from "./block-frame";

const FIRST_NODE_FRAME = 6;
/** Each stage waits for the connector into it to finish drawing. */
const STAGE_FRAMES = 16;
const CONNECTOR_DRAW_FRAMES = 12;

type DiagramNode = DiagramFlowScene["props"]["nodes"][number];

function nodeStartFrame(index: number): number {
  return FIRST_NODE_FRAME + index * STAGE_FRAMES;
}

function StageNode(props: { node: DiagramNode; index: number; sizes: TypeSizes }): React.ReactElement {
  const look = useLook();
  const { sizes } = props;
  const iconBox = Math.round(64 * sizes.scale);
  return (
    <Card
      scale={sizes.scale}
      style={{ padding: 30 * sizes.scale, display: "flex", flexDirection: "column", gap: 16 * sizes.scale }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 * sizes.scale }}>
        <span
          style={{
            fontFamily: look.fonts.mono.family,
            fontSize: sizes.small * 0.8,
            color: look.colors.accent,
            letterSpacing: "0.04em",
          }}
        >
          {String(props.index + 1).padStart(2, "0")}
        </span>
        {props.node.icon ? (
          <span
            style={{
              width: iconBox,
              height: iconBox,
              borderRadius: iconBox * 0.28,
              background: `${look.colors.accent}1f`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon icon={props.node.icon} sizePx={iconBox * 0.55} color={look.colors.accent} />
          </span>
        ) : null}
      </div>
      <div
        style={{
          fontFamily: look.fonts.headline.family,
          fontWeight: Math.max(600, look.fonts.headline.weight - 100),
          fontSize: sizes.body,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}
      >
        {props.node.label}
      </div>
      {props.node.detail ? (
        <div
          style={{
            fontFamily: look.fonts.mono.family,
            fontSize: sizes.small * 0.85,
            color: look.colors.inkMuted,
          }}
        >
          {props.node.detail}
        </div>
      ) : null}
    </Card>
  );
}

/** The line between two stages draws itself in; the wrapper owns layout, the bar owns its scale. */
function Connector(props: {
  index: number;
  label: string | undefined;
  vertical: boolean;
  sizes: TypeSizes;
}): React.ReactElement {
  const look = useLook();
  const frame = useCurrentFrame();
  const drawn = progressBetween({
    frame,
    startFrame: nodeStartFrame(props.index) + 8,
    durationFrames: CONNECTOR_DRAW_FRAMES,
  });
  const thickness = Math.max(3, Math.round(4 * props.sizes.scale));
  return (
    <div
      style={{
        flex: props.vertical ? "0 0 auto" : 1,
        minWidth: props.vertical ? undefined : 48 * props.sizes.scale,
        minHeight: props.vertical ? 56 * props.sizes.scale : undefined,
        display: "flex",
        flexDirection: props.vertical ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10 * props.sizes.scale,
        alignSelf: "stretch",
      }}
    >
      <div
        style={{
          width: props.vertical ? thickness : "100%",
          height: props.vertical ? "100%" : thickness,
          minHeight: props.vertical ? 56 * props.sizes.scale : undefined,
          background: look.colors.accent,
          borderRadius: thickness,
          transformOrigin: props.vertical ? "top" : "left",
          transform: props.vertical ? `scaleY(${drawn})` : `scaleX(${drawn})`,
        }}
      />
      {props.label ? (
        <span
          style={{
            fontFamily: look.fonts.mono.family,
            fontSize: props.sizes.small * 0.75,
            color: look.colors.inkMuted,
            opacity: drawn,
            whiteSpace: "nowrap",
          }}
        >
          {props.label}
        </span>
      ) : null}
    </div>
  );
}

/** Stages of how the product works, left to right (top to bottom in tall frames), drawn in order. */
export function DiagramFlowBlock(props: { scene: DiagramFlowScene }): React.ReactElement {
  const { heading, nodes, connectors } = props.scene.props;
  const look = useLook();
  const shape = useFrameShape();
  const sizes = useTypeSizes();
  const vertical = shape.layout !== "wide" || nodes.length > 4;
  return (
    <BlockFrame>
      {heading ? (
        <FadeRise startFrame={0} distancePx={20} style={{ marginBottom: 56 * sizes.scale }}>
          <div
            style={{
              fontFamily: look.fonts.headline.family,
              fontWeight: look.fonts.headline.weight,
              fontSize: sizes.headline * 0.6,
              letterSpacing: `${look.headlineTracking}em`,
              color: look.colors.ink,
            }}
          >
            {heading}
          </div>
        </FadeRise>
      ) : null}
      <div
        style={{
          display: "flex",
          flexDirection: vertical ? "column" : "row",
          alignItems: vertical ? "stretch" : "center",
          width: vertical ? Math.min(shape.width * 0.72, 900 * sizes.scale) : "100%",
        }}
      >
        {nodes.map((node, index) => (
          <React.Fragment key={`${node.label}-${index.toString()}`}>
            {index > 0 ? (
              <Connector
                index={index - 1}
                label={connectors?.[index - 1]}
                vertical={vertical}
                sizes={sizes}
              />
            ) : null}
            <FadeRise
              startFrame={nodeStartFrame(index)}
              distancePx={36}
              style={{ flex: vertical ? undefined : "0 1 auto", minWidth: 0 }}
            >
              <StageNode node={node} index={index} sizes={sizes} />
            </FadeRise>
          </React.Fragment>
        ))}
      </div>
    </BlockFrame>
  );
}
