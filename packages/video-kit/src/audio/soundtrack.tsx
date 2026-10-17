import type { Storyboard, TransitionId, VoiceTimeline } from "@cutroom/scene-spec";
import React from "react";
import { Html5Audio, Sequence } from "remotion";
import type { LookTokens } from "../looks/look-tokens";
import { audioAssetKeys } from "./audio-asset-keys";
import {
  musicLevelsFor,
  musicVolumeAt,
  type VoiceInterval,
  WHOOSH_LEAD_FRAMES,
  WHOOSH_VOLUME,
} from "./music-levels";

export interface SoundtrackProps {
  storyboard: Storyboard;
  timeline: VoiceTimeline;
  look: LookTokens;
  transitions: ReadonlyArray<TransitionId>;
  assetUrls: Readonly<Record<string, string>>;
  introFrames: number;
  totalFrames: number;
}

function voiceIntervalsOf(timeline: VoiceTimeline, introFrames: number): VoiceInterval[] {
  return timeline.scenes.flatMap((sceneTiming) =>
    sceneTiming.lines.map((line) => {
      const fromFrame = introFrames + sceneTiming.fromFrame + line.fromFrame;
      return { fromFrame, toFrame: fromFrame + line.frames };
    }),
  );
}

function VoiceClips(props: SoundtrackProps): React.ReactElement {
  return (
    <>
      {props.timeline.scenes.flatMap((sceneTiming) =>
        sceneTiming.lines.map((line) => {
          const audioUrl = line.audioAssetKey ? props.assetUrls[line.audioAssetKey] : undefined;
          if (!audioUrl) return null;
          return (
            <Sequence
              key={`${sceneTiming.sceneId}-${line.lineIndex}`}
              from={props.introFrames + sceneTiming.fromFrame + line.fromFrame}
              durationInFrames={line.frames + 2}
              layout="none"
            >
              <Html5Audio src={audioUrl} />
            </Sequence>
          );
        }),
      )}
    </>
  );
}

/** A soft whoosh 3 frames before each crossfade; none on hard cuts (FR-MU-4). */
function TransitionWhooshes(props: SoundtrackProps): React.ReactElement | null {
  const whooshUrl = props.assetUrls[audioAssetKeys.whoosh];
  if (!whooshUrl) return null;
  return (
    <>
      {props.timeline.scenes.map((sceneTiming, sceneIndex) => {
        if (sceneIndex === 0 || props.transitions[sceneIndex] === "cut") return null;
        return (
          <Sequence
            key={sceneTiming.sceneId}
            from={Math.max(0, props.introFrames + sceneTiming.fromFrame - WHOOSH_LEAD_FRAMES)}
            durationInFrames={30}
            layout="none"
          >
            <Html5Audio src={whooshUrl} volume={WHOOSH_VOLUME} />
          </Sequence>
        );
      })}
    </>
  );
}

function MusicBed(props: SoundtrackProps): React.ReactElement | null {
  const musicUrl = props.assetUrls[audioAssetKeys.music];
  if (!musicUrl) return null;
  const levels = musicLevelsFor(props.storyboard.videoType, props.look.sound.musicLed);
  const voiceIntervals = voiceIntervalsOf(props.timeline, props.introFrames);
  return (
    <Html5Audio
      src={musicUrl}
      loop
      volume={(frame) => musicVolumeAt({ frame, totalFrames: props.totalFrames, levels, voiceIntervals })}
    />
  );
}

export function Soundtrack(props: SoundtrackProps): React.ReactElement {
  return (
    <>
      <MusicBed {...props} />
      <VoiceClips {...props} />
      <TransitionWhooshes {...props} />
    </>
  );
}
