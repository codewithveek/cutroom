"use client";

import type { Scene } from "@cutroom/scene-spec";
import { setAtPath } from "@/features/storyboard/edit-paths";
import { useEditor } from "./editor-context";

/** The scene the user is working on, and a path setter for its fields (props.*, narration.*). */
export function useSelectedScene(): {
  scene: Scene | undefined;
  update: (path: string, value: unknown) => void;
} {
  const editor = useEditor();
  const { scenes } = editor.draft.storyboard;
  const scene = scenes.find((candidate) => candidate.id === editor.selectedSceneId) ?? scenes[0];
  const update = (path: string, value: unknown) => {
    if (!scene) return;
    editor.applyEdit((storyboard) => ({
      ...storyboard,
      scenes: storyboard.scenes.map((candidate) =>
        candidate.id === scene.id
          ? setAtPath<Scene>({ value: candidate, path, nextValue: value })
          : candidate,
      ),
    }));
  };
  return { scene, update };
}
