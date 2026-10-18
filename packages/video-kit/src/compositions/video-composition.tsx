import {
  buildCaptionCues,
  deriveThumbnailTitle,
  introFramesFor,
  THUMBNAIL_FADE_FRAMES,
  THUMBNAIL_HOLD_FRAMES,
  totalVideoFrames,
  type VideoProps,
} from "@cutroom/scene-spec";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import React from "react";
import { AbsoluteFill, Freeze, interpolate, Sequence, useCurrentFrame } from "remotion";
import { Soundtrack } from "../audio/soundtrack";
import { BurnedCaptions } from "../captions/burned-captions";
import { LookProvider } from "../looks/look-context";
import { resolveLook } from "../looks/resolve-look";
import { easeInOut } from "../motion/easing";
import { cutroomTransition } from "../transitions/presentations";
import { resolveSceneTransition } from "../transitions/resolve-transition";
import { CreatedWithWatermark } from "../watermark/created-with-watermark";
import { SceneLayer } from "./scene-layer";
import { THUMBNAIL_CAPTURE_FRAME, ThumbnailFrame } from "./thumbnail-frame";

function ThumbnailIntro(props: VideoProps): React.ReactElement {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [THUMBNAIL_HOLD_FRAMES, THUMBNAIL_HOLD_FRAMES + THUMBNAIL_FADE_FRAMES],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  return (
    <AbsoluteFill style={{ opacity }}>
      <Freeze frame={THUMBNAIL_CAPTURE_FRAME}>
        <ThumbnailFrame
          storyboard={props.storyboard}
          titleLines={props.thumbnailTitle ?? deriveThumbnailTitle(props.storyboard)}
          assetUrls={props.assetUrls}
        />
      </Freeze>
    </AbsoluteFill>
  );
}

/** The main composition: one storyboard, any ratio (P5). */
export function VideoComposition(props: VideoProps): React.ReactElement {
  const { storyboard, voiceTimeline } = props;
  const look = resolveLook(storyboard.look, storyboard.brand);
  const introFrames = introFramesFor(props.openOnThumbnail);
  const totalFrames = totalVideoFrames(voiceTimeline, props.openOnThumbnail);
  const timingsById = new Map(voiceTimeline.scenes.map((timing) => [timing.sceneId, timing]));
  const transitions = storyboard.scenes.map((scene, sceneIndex) =>
    resolveSceneTransition({ scene, look, isLastScene: sceneIndex === storyboard.scenes.length - 1 }),
  );
  const captionCues = props.burnCaptions ? buildCaptionCues({ timeline: voiceTimeline, introFrames }) : [];
  return (
    <LookProvider look={look}>
      <AbsoluteFill style={{ background: look.colors.ground }}>
        <Sequence from={introFrames} layout="none">
          <TransitionSeries>
            {storyboard.scenes.flatMap((scene, sceneIndex) => {
              const timing = timingsById.get(scene.id);
              if (!timing) return [];
              const sceneElement = (
                <TransitionSeries.Sequence key={scene.id} durationInFrames={timing.durationFrames}>
                  <SceneLayer
                    scene={scene}
                    timing={timing}
                    sceneIndex={sceneIndex}
                    sceneCount={storyboard.scenes.length}
                    seed={storyboard.seed}
                    brand={storyboard.brand}
                    assetUrls={props.assetUrls}
                  />
                </TransitionSeries.Sequence>
              );
              if (sceneIndex === 0 || timing.transitionInFrames === 0) return [sceneElement];
              return [
                <TransitionSeries.Transition
                  key={`${scene.id}-transition`}
                  timing={linearTiming({ durationInFrames: timing.transitionInFrames, easing: easeInOut })}
                  presentation={cutroomTransition({
                    transition: transitions[sceneIndex] ?? look.transitions.default,
                    origin: scene.transitionOrigin ?? [0.5, 0.5],
                    slabColor: look.colors.accent,
                  })}
                />,
                sceneElement,
              ];
            })}
          </TransitionSeries>
        </Sequence>
        {props.burnCaptions ? <BurnedCaptions cues={captionCues} /> : null}
        {props.openOnThumbnail ? (
          <Sequence durationInFrames={THUMBNAIL_HOLD_FRAMES + THUMBNAIL_FADE_FRAMES}>
            <ThumbnailIntro {...props} />
          </Sequence>
        ) : null}
        {props.watermark ? <CreatedWithWatermark /> : null}
        <Soundtrack
          storyboard={storyboard}
          timeline={voiceTimeline}
          look={look}
          transitions={transitions}
          assetUrls={props.assetUrls}
          introFrames={introFrames}
          totalFrames={totalFrames}
        />
      </AbsoluteFill>
    </LookProvider>
  );
}
