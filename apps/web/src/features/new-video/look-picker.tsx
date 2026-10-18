"use client";

import type { LookId } from "@cutroom/scene-spec";
import { lookTokensById } from "@cutroom/video-kit";
import type React from "react";
import { useMemo } from "react";
import { lookIds, lookPreviewStoryboard } from "@/features/video-preview/look-preview";
import { StoryboardPlayer } from "@/features/video-preview/storyboard-player";
import { classNames } from "@/lib/class-names";

export interface LookPickerProps {
  value: LookId | "auto";
  onChange: (look: LookId | "auto") => void;
}

export function LookPicker(props: LookPickerProps): React.ReactElement {
  const storyboards = useMemo(
    () => Object.fromEntries(lookIds.map((look) => [look, lookPreviewStoryboard(look)])),
    [],
  );
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => props.onChange("auto")}
        aria-pressed={props.value === "auto"}
        className={classNames(
          "w-full rounded-lg border px-4 py-3 text-left text-sm",
          props.value === "auto"
            ? "border-accent bg-accent/10"
            : "border-line bg-panel hover:border-line-strong",
        )}
      >
        <span className="font-medium">Recommend one for my product</span>
        <span className="ml-2 text-ink-muted">
          Picked after analysis from UI density, brand darkness and channel.
        </span>
      </button>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {lookIds.map((look) => {
          const tokens = lookTokensById[look];
          const storyboard = storyboards[look];
          return (
            <button
              key={look}
              type="button"
              aria-pressed={props.value === look}
              onClick={() => props.onChange(look)}
              className={classNames(
                "overflow-hidden rounded-lg border text-left transition-colors",
                props.value === look
                  ? "border-accent ring-1 ring-accent"
                  : "border-line hover:border-line-strong",
              )}
            >
              <div className="pointer-events-none">
                {storyboard ? (
                  <StoryboardPlayer storyboard={storyboard} ratio="16:9" autoPlay loop controls={false} />
                ) : null}
              </div>
              <div className="p-3">
                <div className="text-sm font-medium">{tokens.label}</div>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{tokens.summary}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
