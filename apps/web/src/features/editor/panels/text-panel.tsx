"use client";

import type React from "react";
import { blockLabels } from "@/features/storyboard/block-labels";
import { RegenerateControl, SceneFields } from "@/features/storyboard/scene-fields";
import { apiClient } from "@/lib/api-client";
import { useEditor } from "../editor-context";
import { EditorPanel } from "../editor-panel";
import { useSelectedScene } from "../use-selected-scene";

/** On-screen text of the selected scene: the block's props form, and regenerate with a direction. */
export function TextPanel(): React.ReactElement {
  const editor = useEditor();
  const { scene, update } = useSelectedScene();
  if (!scene) return <EditorPanel title="Text">{null}</EditorPanel>;
  return (
    <EditorPanel title="Text" bodyClassName="px-4 pb-4">
      <p className="mb-4 text-xs text-ink-faint">
        {blockLabels[scene.block]}
        {scene.beat ? ` · ${scene.beat}` : ""} · wrap a phrase in *stars* to colour it
      </p>
      {editor.editable ? (
        <div className="mb-5">
          <RegenerateControl
            busy={editor.busy || editor.draft.dirty}
            onRegenerate={(instruction) =>
              void editor.runAction(() =>
                apiClient.regenerateScene({
                  runId: editor.run.id,
                  sceneId: scene.id,
                  instruction: instruction || undefined,
                }),
              )
            }
          />
          {editor.draft.dirty ? (
            <p className="mt-1.5 text-[11px] text-weak">Save your edits before regenerating.</p>
          ) : null}
        </div>
      ) : null}
      <fieldset disabled={!editor.editable} className="disabled:opacity-70">
        <SceneFields scene={scene} onChange={update} />
      </fieldset>
    </EditorPanel>
  );
}
