"use client";

import type React from "react";
import { useMemo } from "react";
import { classNames } from "@/lib/class-names";
import { useEditor } from "../editor-context";
import { EditorPanel } from "../editor-panel";
import { setNarrationLine } from "../model/storyboard-edits";
import { captionClips, formatSeconds, lineClips } from "../model/timeline-layout";

const burnChoices: ReadonlyArray<{ id: string; label: string; value: boolean | undefined }> = [
  { id: "auto", label: "As rendered", value: undefined },
  { id: "on", label: "On", value: true },
  { id: "off", label: "Off", value: false },
];

/**
 * Captions are the narration text, split into cues by the same code that writes the WebVTT.
 * Editing a line here edits the narration it comes from.
 */
export function CaptionsPanel(): React.ReactElement {
  const editor = useEditor();
  const fps = editor.timeline.fps;
  const lines = useMemo(() => lineClips(editor.timeline), [editor.timeline]);
  const cues = useMemo(() => captionClips(editor.timeline), [editor.timeline]);
  const sceneById = new Map(editor.draft.storyboard.scenes.map((scene) => [scene.id, scene]));
  const frame = editor.playerState.frame;
  return (
    <EditorPanel title="Captions" bodyClassName="space-y-5 px-4 pb-4">
      <section className="space-y-2">
        <h3 className="text-xs font-medium text-ink-muted">Burned-in captions in the preview</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {burnChoices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              aria-pressed={editor.burnCaptions === choice.value}
              onClick={() => editor.setBurnCaptions(choice.value)}
              className={classNames(
                "rounded-xl border px-2 py-1.5 text-xs transition-colors",
                editor.burnCaptions === choice.value
                  ? "border-accent/60 bg-accent-soft text-ink"
                  : "border-line bg-panel-raised text-ink-muted hover:text-ink",
              )}
            >
              {choice.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-ink-faint">
          Renders burn captions into 9:16 and 1:1 and ship a WebVTT file with every ratio.
        </p>
      </section>
      <section className="space-y-2">
        <h3 className="text-xs font-medium text-ink-muted">
          {cues.length} cues from {lines.length} lines
        </h3>
        <ul className="space-y-1.5">
          {lines.map((line) => {
            const scene = sceneById.get(line.sceneId);
            const text = scene?.narration[line.lineIndex]?.text ?? line.text;
            const lineCues = cues.filter(
              (cue) => cue.startFrame >= line.startFrame && cue.startFrame < line.endFrame,
            );
            const live = frame >= line.startFrame && frame < line.endFrame;
            return (
              <li
                key={`${line.sceneId}-${line.lineIndex}`}
                className={classNames(
                  "rounded-xl border p-2.5",
                  live ? "border-caption/70 bg-caption/10" : "border-line",
                )}
              >
                <button
                  type="button"
                  onClick={() => editor.seekToFrame(line.startFrame)}
                  className="font-mono text-[11px] text-ink-faint hover:text-ink"
                >
                  {formatSeconds(line.startFrame, fps)} → {formatSeconds(line.endFrame, fps)} ·{" "}
                  {lineCues.length} cue
                  {lineCues.length === 1 ? "" : "s"}
                </button>
                <textarea
                  aria-label={`Caption text for line starting ${formatSeconds(line.startFrame, fps)}`}
                  rows={2}
                  disabled={!editor.editable}
                  value={text}
                  onChange={(event) =>
                    editor.applyEdit((storyboard) =>
                      setNarrationLine({
                        storyboard,
                        sceneId: line.sceneId,
                        lineIndex: line.lineIndex,
                        patch: { text: event.target.value || " " },
                      }),
                    )
                  }
                  className="mt-1 w-full resize-none bg-transparent text-sm text-ink focus:outline-none disabled:opacity-70"
                />
              </li>
            );
          })}
        </ul>
      </section>
    </EditorPanel>
  );
}
