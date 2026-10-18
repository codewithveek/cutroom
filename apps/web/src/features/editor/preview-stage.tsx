"use client";

import { frameSizeByRatio } from "@cutroom/scene-spec";
import type { PlayerRef } from "@remotion/player";
import type React from "react";
import { useMemo, useRef } from "react";
import { StoryboardPlayer } from "@/features/video-preview/storyboard-player";
import { apiClient } from "@/lib/api-client";
import { useEditor } from "./editor-context";
import { useFitSize } from "./use-fit-size";

/**
 * The live preview, as large as the stage allows for the chosen ratio. It plays the synthesised
 * voice once the voice step has run on the storyboard being shown.
 */
export function PreviewStage(props: { playerRef: (player: PlayerRef | null) => void }): React.ReactElement {
  const editor = useEditor();
  const size = frameSizeByRatio[editor.ratio];
  const assetUrls = useMemo(
    () => Object.fromEntries(editor.run.media.map((item) => [item.assetKey, apiClient.assetUrl(item.url)])),
    [editor.run.media],
  );
  const usesVoice = editor.timeline.source === "voice";
  const stageRef = useRef<HTMLDivElement>(null);
  const fit = useFitSize({ containerRef: stageRef, aspect: size.width / size.height });
  return (
    <div ref={stageRef} className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center">
      <div
        className="overflow-hidden rounded-2xl shadow-2xl"
        style={{ width: fit.width, height: fit.height }}
      >
        <StoryboardPlayer
          ref={props.playerRef}
          storyboard={editor.draft.storyboard}
          ratio={editor.ratio}
          voiceTimeline={editor.timeline}
          assetUrls={assetUrls}
          burnCaptions={editor.burnCaptions}
          controls={false}
          className="size-full"
        />
      </div>
      <span className="absolute top-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white/85 backdrop-blur">
        {usesVoice ? "Voice timing" : "Estimated timing · voice is added after approval"}
      </span>
    </div>
  );
}
