"use client";

import type { LookId } from "@cutroom/scene-spec";
import { lookTokensById } from "@cutroom/video-kit";
import type React from "react";
import { useMemo, useState } from "react";
import { lookPreviewStoryboard } from "@/features/video-preview/look-preview";
import { StoryboardPlayer } from "@/features/video-preview/storyboard-player";
import { StoryboardThumbnail } from "@/features/video-preview/storyboard-thumbnail";

/** A look's still at rest; it plays its sample on hover or focus. */
export function LookCard(props: { look: LookId }): React.ReactElement {
  const [playing, setPlaying] = useState(false);
  const storyboard = useMemo(() => lookPreviewStoryboard(props.look), [props.look]);
  const tokens = lookTokensById[props.look];
  return (
    <article
      onMouseEnter={() => setPlaying(true)}
      onMouseLeave={() => setPlaying(false)}
      onFocus={() => setPlaying(true)}
      onBlur={() => setPlaying(false)}
      className="overflow-hidden rounded-2xl border border-line bg-panel"
    >
      <div className="pointer-events-none border-b border-line">
        {playing ? (
          <StoryboardPlayer storyboard={storyboard} ratio="16:9" autoPlay loop controls={false} />
        ) : (
          <StoryboardThumbnail storyboard={storyboard} frame={60} />
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{tokens.label}</h3>
          <span className="ml-auto flex gap-1" aria-hidden="true">
            {[tokens.colors.ground, tokens.colors.accent].map((colour) => (
              <span
                key={colour}
                className="size-4 rounded-full border border-line"
                style={{ background: colour }}
              />
            ))}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-ink-muted">{tokens.summary}</p>
        <p className="font-mono text-[11px] text-ink-faint">
          {tokens.isDark ? "dark" : "light"} · {tokens.paceSeconds[0]}–{tokens.paceSeconds[1]} s per scene
        </p>
        <button type="button" className="sr-only">
          Preview {tokens.label}
        </button>
      </div>
    </article>
  );
}
