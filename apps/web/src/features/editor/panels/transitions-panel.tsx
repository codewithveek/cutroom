"use client";

import { type TransitionId, transitionSchema } from "@cutroom/scene-spec";
import { lookTokensById } from "@cutroom/video-kit";
import type React from "react";
import { Select } from "@/components/ui/field";
import { sceneHeadline } from "@/features/storyboard/scene-summary";
import { useEditor } from "../editor-context";
import { EditorPanel } from "../editor-panel";
import { setTransition } from "../model/storyboard-edits";
import { sceneClips } from "../model/timeline-layout";

const transitionNotes: Readonly<Record<TransitionId, string>> = {
  fade: "Cross-fade",
  focus: "Blur out, blur in",
  circle: "Circle wipe from a point",
  panel: "Panel slides over",
  slab: "Colour slab sweeps across",
  zoom: "Push into the next scene",
  push: "Next scene pushes this one out",
  cut: "Hard cut on the beat",
};

/** The transition into each scene; empty uses the look's default. They exist only where scenes overlap. */
export function TransitionsPanel(): React.ReactElement {
  const editor = useEditor();
  const { storyboard } = editor.draft;
  const clips = sceneClips(editor.timeline);
  const lookDefault = lookTokensById[storyboard.look];
  return (
    <EditorPanel title="Transitions" bodyClassName="space-y-2 px-4 pb-4">
      <p className="pb-2 text-xs text-ink-faint">
        The {lookDefault.label} look sets the default for every cut.
      </p>
      <ol className="space-y-2">
        {storyboard.scenes.slice(1).map((scene, index) => {
          const clip = clips[index + 1];
          const previous = storyboard.scenes[index];
          return (
            <li key={scene.id} className="rounded-xl border border-line p-3">
              <button
                type="button"
                onClick={() => {
                  editor.selectScene(scene.id);
                  if (clip) editor.seekToFrame(clip.startFrame + Math.round(clip.transitionInFrames / 2));
                }}
                className="block w-full text-left text-xs text-ink-muted hover:text-ink"
              >
                <span className="font-mono text-ink-faint">
                  {String(index + 1).padStart(2, "0")} → {String(index + 2).padStart(2, "0")}
                </span>{" "}
                {previous ? sceneHeadline(previous) : ""} → {sceneHeadline(scene)}
              </button>
              <div className="mt-2 flex items-center gap-2">
                <Select
                  aria-label={`Transition into scene ${index + 2}`}
                  disabled={!editor.editable}
                  value={scene.transitionIn ?? ""}
                  onChange={(event) =>
                    editor.applyEdit((current) =>
                      setTransition({
                        storyboard: current,
                        sceneId: scene.id,
                        transition: transitionSchema.safeParse(event.target.value).data,
                      }),
                    )
                  }
                >
                  <option value="">Look default</option>
                  {transitionSchema.options.map((transition) => (
                    <option key={transition} value={transition}>
                      {transition} · {transitionNotes[transition]}
                    </option>
                  ))}
                </Select>
                {clip ? (
                  <span className="shrink-0 font-mono text-[11px] text-ink-faint">
                    {(clip.transitionInFrames / editor.timeline.fps).toFixed(1)}s
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </EditorPanel>
  );
}
