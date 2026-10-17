import type { TitleCardScene } from "@cutroom/scene-spec";
import React from "react";
import { useCurrentFrame } from "remotion";
import { useTypeSizes } from "../frame-shape/use-type-sizes";
import { useLook } from "../looks/look-context";
import { progressBetween } from "../motion/easing";
import { FadeRise } from "../motion/fade-rise";
import { RisingText } from "../motion/rising-text";
import { BrandMark } from "../primitives/brand-mark";
import { useSceneContext } from "../scene-context/scene-context";
import { BlockFrame } from "./block-frame";

export function TitleCardBlock(props: { scene: TitleCardScene }): React.ReactElement {
  const { name, tagline, variant } = props.scene.props;
  const frame = useCurrentFrame();
  const look = useLook();
  const sizes = useTypeSizes();
  const { brand, assetUrls } = useSceneContext();
  const markProgress = progressBetween({ frame, startFrame: 2, durationFrames: 22 });
  const nameStart = variant === "introducing" ? 10 : 6;
  return (
    <BlockFrame>
      <div
        style={{
          transform: `scale(${0.6 + 0.4 * markProgress})`,
          opacity: markProgress,
          marginBottom: 36 * sizes.scale,
        }}
      >
        <BrandMark
          name={name}
          sizePx={Math.round(140 * sizes.scale)}
          logoUrl={brand.logoAssetKey ? assetUrls[brand.logoAssetKey] : undefined}
        />
      </div>
      {variant === "introducing" ? (
        <FadeRise startFrame={0} distancePx={16}>
          <div
            style={{
              fontFamily: look.fonts.body.family,
              fontWeight: 600,
              fontSize: sizes.eyebrow,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: look.eyebrow === "uppercase-accent" ? look.colors.accent : look.colors.inkMuted,
              marginBottom: 18 * sizes.scale,
            }}
          >
            Introducing
          </div>
        </FadeRise>
      ) : null}
      <div
        style={{
          fontFamily: look.fonts.headline.family,
          fontWeight: look.fonts.headline.weight,
          fontSize: sizes.title,
          letterSpacing: `${look.headlineTracking}em`,
          lineHeight: 1,
          color: look.colors.ink,
        }}
      >
        <RisingText text={name} startFrame={nameStart} />
      </div>
      {tagline ? (
        <FadeRise startFrame={nameStart + 14} style={{ marginTop: 28 * sizes.scale, maxWidth: "80%" }}>
          <div
            style={{
              fontFamily: look.fonts.body.family,
              fontWeight: look.fonts.body.weight,
              fontSize: sizes.body,
              color: look.colors.inkMuted,
              lineHeight: 1.3,
            }}
          >
            {tagline}
          </div>
        </FadeRise>
      ) : null}
    </BlockFrame>
  );
}
