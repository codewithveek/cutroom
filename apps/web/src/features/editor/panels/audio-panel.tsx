"use client";

import type { MusicSelection } from "@cutroom/scene-spec";
import { Upload } from "lucide-react";
import type React from "react";
import { useRef } from "react";
import { Label } from "@/components/ui/field";
import { NarrationEditor } from "@/features/storyboard/scene-fields";
import { apiClient } from "@/lib/api-client";
import { isEnabled } from "@/lib/capabilities";
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

/** The user's own track: transcoded on the server and mixed under the voice like the generated beds. */
function MusicUpload(props: { locked: boolean }): React.ReactElement {
  const editor = useEditor();
  const inputRef = useRef<HTMLInputElement>(null);
  const { music } = editor.run.request;
  const uploaded = music.kind === "uploaded";
  return (
    <div
      className={classNames(
        "flex items-center gap-2.5 rounded-xl border p-2.5",
        uploaded ? "border-accent/60 bg-accent-soft" : "border-dashed border-line-strong",
      )}
    >
      <Upload className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm">
        {uploaded ? (music.fileName ?? "Your track") : "Use your own track"}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void editor.runAction(() => apiClient.uploadMusic(editor.run.id, file));
        }}
      />
      <button
        type="button"
        disabled={props.locked}
        onClick={() => inputRef.current?.click()}
        className="shrink-0 rounded-lg bg-panel-raised px-2.5 py-1 text-xs font-medium text-ink hover:bg-panel-hover disabled:opacity-50"
      >
        {uploaded ? "Replace" : "Upload"}
      </button>
    </div>
  );
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
        {isEnabled("musicUpload") ? <MusicUpload locked={settingsLocked} /> : null}
        <p className="text-[11px] text-ink-faint">
          Generated beds need no licence; for your own track, you hold the rights. Either way it is ducked
          under the voice.
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
