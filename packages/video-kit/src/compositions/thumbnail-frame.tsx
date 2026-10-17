import type { Scene, Storyboard } from "@cutroom/scene-spec";
import React from "react";
import { AbsoluteFill } from "remotion";
import { LookBackground } from "../backgrounds/look-background";
import { useFrameShape } from "../frame-shape/use-frame-shape";
import { useLook } from "../looks/look-context";
import { BrandMark } from "../primitives/brand-mark";
import { SceneLayer } from "./scene-layer";

export const THUMBNAIL_FRAMES = 240;
export const THUMBNAIL_CAPTURE_FRAME = 239;

/** The most product-like scene makes the best thumbnail picture. */
export function pickThumbnailScene(storyboard: Storyboard): Scene | undefined {
  const preference: ReadonlyArray<Scene["block"]> = [
    "feature-cards",
    "code-card",
    "terminal",
    "big-number",
    "title-card",
  ];
  for (const block of preference) {
    const match = storyboard.scenes.find((scene) => scene.block === block);
    if (match) return match;
  }
  return storyboard.scenes[0];
}

export interface ThumbnailFrameProps {
  storyboard: Storyboard;
  titleLines: readonly [string, string];
  assetUrls: Readonly<Record<string, string>>;
}

/** Brand and a two-line title beside a resolved scene frame (FR-RD-4). */
export function ThumbnailFrame(props: ThumbnailFrameProps): React.ReactElement {
  const look = useLook();
  const shape = useFrameShape();
  const scene = pickThumbnailScene(props.storyboard);
  const isWide = shape.layout === "wide";
  const titleSize = Math.round(look.headlineSizePx * 1.15 * shape.typeScale);
  const previewScale = isWide ? 0.5 : 0.6;
  return (
    <AbsoluteFill>
      <LookBackground />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: isWide ? "row" : "column",
          alignItems: "center",
          padding: shape.paddingX,
          gap: shape.paddingX * 0.6,
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: titleSize * 0.3 }}>
          <BrandMark
            name={props.storyboard.brand.name}
            sizePx={Math.round(96 * shape.typeScale)}
            logoUrl={
              props.storyboard.brand.logoAssetKey
                ? props.assetUrls[props.storyboard.brand.logoAssetKey]
                : undefined
            }
          />
          <div
            style={{
              fontFamily: look.fonts.headline.family,
              fontWeight: look.fonts.headline.weight,
              fontSize: titleSize,
              letterSpacing: `${look.headlineTracking}em`,
              lineHeight: 1.02,
              color: look.colors.ink,
            }}
          >
            <div>{props.titleLines[0]}</div>
            <div style={{ color: look.colors.accent }}>{props.titleLines[1]}</div>
          </div>
        </div>
        {scene ? (
          <div
            style={{
              position: "relative",
              width: shape.width * previewScale,
              height: shape.height * previewScale,
              borderRadius: look.cardRadiusPx,
              overflow: "hidden",
              boxShadow: look.cardShadow,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: shape.width,
                height: shape.height,
                transform: `scale(${previewScale})`,
                transformOrigin: "top left",
                position: "relative",
              }}
            >
              <SceneLayer
                scene={scene}
                timing={{
                  sceneId: scene.id,
                  fromFrame: 0,
                  durationFrames: THUMBNAIL_FRAMES + 30,
                  transitionInFrames: 0,
                  lines: [],
                }}
                sceneIndex={0}
                sceneCount={1}
                seed={props.storyboard.seed}
                brand={props.storyboard.brand}
                assetUrls={props.assetUrls}
              />
            </div>
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
