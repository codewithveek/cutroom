import React from "react";
import { Composition } from "remotion";
import { calculateThumbnailMetadata, calculateVideoMetadata, compositionIds } from "./calculate-metadata";
import { createPreviewVideoProps, fixtureStoryboard } from "./default-props";
import { ThumbnailComposition } from "./thumbnail-composition";
import { THUMBNAIL_FRAMES } from "./thumbnail-frame";
import { VideoComposition } from "./video-composition";

export function RemotionRoot(): React.ReactElement {
  return (
    <>
      <Composition
        id={compositionIds.video}
        component={VideoComposition}
        defaultProps={createPreviewVideoProps()}
        calculateMetadata={({ props }) => calculateVideoMetadata(props)}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={300}
      />
      <Composition
        id={compositionIds.thumbnail}
        component={ThumbnailComposition}
        defaultProps={{ storyboard: fixtureStoryboard, ratio: "16:9", assetUrls: {} }}
        calculateMetadata={({ props }) => calculateThumbnailMetadata(props)}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={THUMBNAIL_FRAMES}
      />
    </>
  );
}
