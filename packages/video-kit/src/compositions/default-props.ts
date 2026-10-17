import {
  estimateTimeline,
  fixtureStoryboardInput,
  type Storyboard,
  storyboardSchema,
  type VideoProps,
} from "@cutroom/scene-spec";
import { resolveLook } from "../looks/resolve-look";

export const fixtureStoryboard: Storyboard = storyboardSchema.parse(fixtureStoryboardInput);

/** Props for Remotion Studio and previews: the fixture storyboard with estimated timing. */
export function createPreviewVideoProps(storyboard: Storyboard = fixtureStoryboard): VideoProps {
  const look = resolveLook(storyboard.look, storyboard.brand);
  return {
    storyboard,
    voiceTimeline: estimateTimeline({ scenes: storyboard.scenes, transitionFrames: look.crossfadeFrames }),
    ratio: "16:9",
    music: { kind: "none" },
    assetUrls: {},
    openOnThumbnail: false,
    burnCaptions: false,
  };
}
