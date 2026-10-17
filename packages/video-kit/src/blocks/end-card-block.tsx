import type { EndCardScene } from "@cutroom/scene-spec";
import React from "react";
import { Sequence, useCurrentFrame } from "remotion";
import { useTypeSizes } from "../frame-shape/use-type-sizes";
import { useLook } from "../looks/look-context";
import { progressBetween } from "../motion/easing";
import { FadeRise } from "../motion/fade-rise";
import { RisingText } from "../motion/rising-text";
import { BrandMark } from "../primitives/brand-mark";
import { useSceneContext } from "../scene-context/scene-context";
import { BlockFrame } from "./block-frame";

const VERB_BEAT_FRAMES = 14;

function VerbBeats(props: { verbs: ReadonlyArray<string> }): React.ReactElement {
  const look = useLook();
  const sizes = useTypeSizes();
  return (
    <>
      {props.verbs.map((verb, verbIndex) => (
        <Sequence
          key={verb}
          from={verbIndex * VERB_BEAT_FRAMES}
          durationInFrames={VERB_BEAT_FRAMES}
          layout="none"
        >
          <BlockFrame>
            <div
              style={{
                fontFamily: look.fonts.headline.family,
                fontWeight: look.fonts.headline.weight,
                fontSize: sizes.title,
                letterSpacing: `${look.headlineTracking}em`,
                color: verbIndex === props.verbs.length - 1 ? look.colors.accent : look.colors.ink,
              }}
            >
              <RisingText text={verb} startFrame={0} />
            </div>
          </BlockFrame>
        </Sequence>
      ))}
    </>
  );
}

function CtaPill(props: { label: string; startFrame: number }): React.ReactElement {
  const frame = useCurrentFrame();
  const look = useLook();
  const sizes = useTypeSizes();
  const pop = progressBetween({ frame, startFrame: props.startFrame, durationFrames: 18 });
  return (
    <div style={{ transform: `scale(${0.8 + 0.2 * pop})`, opacity: pop }}>
      <div
        style={{
          background: look.colors.accent,
          color: look.isDark ? look.colors.ground : "#ffffff",
          fontFamily: look.fonts.mono.family,
          fontWeight: 500,
          fontSize: sizes.body * 0.9,
          padding: `${16 * sizes.scale}px ${38 * sizes.scale}px`,
          borderRadius: 999,
          fontVariantLigatures: "none",
        }}
      >
        {props.label}
      </div>
    </div>
  );
}

export function EndCardBlock(props: { scene: EndCardScene }): React.ReactElement {
  const { verbs, name, tagline, cta, url } = props.scene.props;
  const look = useLook();
  const sizes = useTypeSizes();
  const { brand, assetUrls } = useSceneContext();
  const lockupStart = verbs.length * VERB_BEAT_FRAMES;
  return (
    <>
      <VerbBeats verbs={verbs} />
      <Sequence from={lockupStart} layout="none">
        <BlockFrame>
          <FadeRise startFrame={0} distancePx={20}>
            <BrandMark
              name={name}
              sizePx={Math.round(120 * sizes.scale)}
              logoUrl={brand.logoAssetKey ? assetUrls[brand.logoAssetKey] : undefined}
            />
          </FadeRise>
          <div
            style={{
              marginTop: 28 * sizes.scale,
              fontFamily: look.fonts.headline.family,
              fontWeight: look.fonts.headline.weight,
              fontSize: sizes.title * 0.9,
              letterSpacing: `${look.headlineTracking}em`,
              lineHeight: 1,
              color: look.colors.ink,
            }}
          >
            <RisingText text={name} startFrame={4} />
          </div>
          {tagline ? (
            <FadeRise startFrame={14} style={{ marginTop: 20 * sizes.scale }}>
              <div
                style={{
                  fontFamily: look.fonts.body.family,
                  fontSize: sizes.body,
                  color: look.colors.inkMuted,
                }}
              >
                {tagline}
              </div>
            </FadeRise>
          ) : null}
          <div style={{ marginTop: 44 * sizes.scale }}>
            <CtaPill label={cta} startFrame={22} />
          </div>
          {url ? (
            <FadeRise startFrame={30} style={{ marginTop: 24 * sizes.scale }} distancePx={10}>
              <div
                style={{
                  fontFamily: look.fonts.mono.family,
                  fontSize: sizes.small,
                  color: look.colors.inkMuted,
                }}
              >
                {url}
              </div>
            </FadeRise>
          ) : null}
        </BlockFrame>
      </Sequence>
    </>
  );
}
