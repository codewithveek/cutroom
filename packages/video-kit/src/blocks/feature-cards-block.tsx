import type { FeatureCardsScene } from "@cutroom/scene-spec";
import React from "react";
import { random, useCurrentFrame } from "remotion";
import { useFrameShape } from "../frame-shape/use-frame-shape";
import { type TypeSizes, useTypeSizes } from "../frame-shape/use-type-sizes";
import { useLook } from "../looks/look-context";
import { progressBetween } from "../motion/easing";
import { FadeRise } from "../motion/fade-rise";
import { Card } from "../primitives/card";
import { Icon } from "../primitives/icons";
import { useSceneContext } from "../scene-context/scene-context";
import { BlockFrame } from "./block-frame";

const CARD_STAGGER_FRAMES = 7;
const FIRST_CARD_FRAME = 8;

type FeatureCard = FeatureCardsScene["props"]["cards"][number];

function FeatureCardView(props: { card: FeatureCard; sizes: TypeSizes; isRow: boolean }): React.ReactElement {
  const look = useLook();
  const iconBox = Math.round(76 * props.sizes.scale);
  return (
    <Card
      scale={props.sizes.scale}
      style={{
        padding: 40 * props.sizes.scale,
        display: "flex",
        flexDirection: props.isRow ? "column" : "row",
        alignItems: props.isRow ? "flex-start" : "center",
        gap: 28 * props.sizes.scale,
        textAlign: "left",
        height: "100%",
      }}
    >
      <div
        style={{
          width: iconBox,
          height: iconBox,
          flexShrink: 0,
          borderRadius: iconBox * 0.28,
          background: `${look.colors.accent}1f`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon icon={props.card.icon} sizePx={iconBox * 0.55} color={look.colors.accent} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 * props.sizes.scale }}>
        <div
          style={{
            fontFamily: look.fonts.headline.family,
            fontWeight: Math.max(600, look.fonts.headline.weight - 100),
            fontSize: props.sizes.body * 1.05,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          {props.card.title}
        </div>
        <div
          style={{
            fontFamily: look.fonts.body.family,
            fontWeight: look.fonts.body.weight,
            fontSize: props.sizes.small,
            color: look.colors.inkMuted,
            lineHeight: 1.35,
          }}
        >
          {props.card.line}
        </div>
      </div>
    </Card>
  );
}

/** Cards are dealt in: each rises and settles from a small seeded tilt. */
function DealtCard(props: { index: number; seed: number; children: React.ReactNode }): React.ReactElement {
  const frame = useCurrentFrame();
  const startFrame = FIRST_CARD_FRAME + props.index * CARD_STAGGER_FRAMES;
  const settle = progressBetween({ frame, startFrame, durationFrames: 26 });
  const tiltDegrees = (random(`card-${props.seed}-${props.index}`) - 0.5) * 6;
  return (
    <FadeRise startFrame={startFrame} distancePx={60} style={{ flex: 1, minWidth: 0 }}>
      <div style={{ transform: `rotate(${tiltDegrees * (1 - settle)}deg)`, height: "100%" }}>
        {props.children}
      </div>
    </FadeRise>
  );
}

export function FeatureCardsBlock(props: { scene: FeatureCardsScene }): React.ReactElement {
  const { heading, cards } = props.scene.props;
  const look = useLook();
  const shape = useFrameShape();
  const sizes = useTypeSizes();
  const { seed } = useSceneContext();
  const isRow = shape.layout === "wide";
  const columns = isRow ? cards.length : shape.layout === "vertical" ? 1 : 2;
  return (
    <BlockFrame>
      {heading ? (
        <FadeRise startFrame={0} distancePx={20} style={{ marginBottom: 48 * sizes.scale }}>
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
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 32 * sizes.scale,
          width: "100%",
        }}
      >
        {cards.map((card, index) => (
          <DealtCard key={card.title} index={index} seed={seed}>
            <FeatureCardView card={card} sizes={sizes} isRow={isRow} />
          </DealtCard>
        ))}
      </div>
    </BlockFrame>
  );
}
