"use client";

import type { MusicSelection } from "@cutroom/scene-spec";
import type React from "react";
import { Label } from "@/components/ui/field";
import { NarrationEditor } from "@/features/storyboard/scene-fields";
import { apiClient } from "@/lib/api-client";
import { classNames } from "@/lib/class-names";
import { useEditor } from "../editor-context";
import { EditorPanel } from "../editor-panel";
import { useSelectedScene } from "../use-selected-scene";

const musicChoices: ReadonlyArray<{ id: string; label: string; music: MusicSelection }> = [
  { id: "upbeat", label: "Upbeat", music: { kind: "generated", bed: "upbeat" } },
  { id: "calm", label: "Calm", music: { kind: "generated", bed: "calm" } },
  { id: "none", label: "None", music: { kind: "none" } },
];

function musicId(music: MusicSelection): string {
  return music.kind === "generated" ? music.bed : music.kind;
}

/** Music bed and voice speed for the run, and the selected scene's narration (captions + spoken form). */
export function AudioPanel(): React.ReactElement {
  const editor = useEditor();
  const { scene, update } = useSelectedScene();
  const { request } = editor.run;
  const settingsLocked = Boolean(editor.run.approval) || editor.busy;
  return (
    <EditorPanel title="Audio" bodyClassName="space-y-6 px-4 pb-4">
      <section className="space-y-2">
        <h3 className="text-xs font-medium text-ink-muted">Music bed</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {musicChoices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              aria-pressed={musicId(request.music) === choice.id}
              disabled={settingsLocked}
              onClick={() =>
                void editor.runAction(() => apiClient.updateSettings(editor.run.id, { music: choice.music }))
              }
              className={classNames(
                "rounded-xl border px-2 py-2 text-sm transition-colors disabled:opacity-50",
                musicId(request.music) === choice.id
                  ? "border-accent/60 bg-accent-soft text-ink"
                  : "border-line bg-panel-raised text-ink-muted hover:text-ink",
              )}
            >
              {choice.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-ink-faint">
          Generated in code (no licence needed), ducked under the voice.
        </p>
      </section>
      <section className="space-y-2">
        <Label htmlFor="voice-speed" hint={`${request.voice.speed.toFixed(2)}×`}>
          Voice speed
        </Label>
        <input
          id="voice-speed"
          type="range"
          min={0.8}
          max={1.25}
          step={0.05}
          disabled={settingsLocked}
          defaultValue={request.voice.speed}
          onPointerUp={(event) =>
            void editor.runAction(() =>
              apiClient.updateSettings(editor.run.id, {
                voice: { ...request.voice, speed: Number((event.target as HTMLInputElement).value) },
              }),
            )
          }
          className="w-full accent-[var(--color-accent)]"
        />
        <p className="text-[11px] text-ink-faint">
          Scene lengths follow the voice, so a faster read is a shorter video.
        </p>
      </section>
      {scene ? (
        <fieldset disabled={!editor.editable} className="disabled:opacity-70">
          <NarrationEditor scene={scene} onChange={update} />
        </fieldset>
      ) : null}
    </EditorPanel>
  );
}
