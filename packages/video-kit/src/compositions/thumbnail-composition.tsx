import { deriveThumbnailTitle, type ThumbnailProps } from "@cutroom/scene-spec";
import React from "react";
import { LookProvider } from "../looks/look-context";
import { resolveLook } from "../looks/resolve-look";
import { ThumbnailFrame } from "./thumbnail-frame";

/** A 240-frame composition rendered at frame 239, so every block has resolved. */
export function ThumbnailComposition(props: ThumbnailProps): React.ReactElement {
  const look = resolveLook(props.storyboard.look, props.storyboard.brand);
  return (
    <LookProvider look={look}>
      <ThumbnailFrame
        storyboard={props.storyboard}
        titleLines={props.titleLines ?? deriveThumbnailTitle(props.storyboard)}
        assetUrls={props.assetUrls}
      />
    </LookProvider>
  );
}
