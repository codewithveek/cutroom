import type { Brand, Scene, SceneTiming } from "@cutroom/scene-spec";
import React, { createContext, type ReactNode, useContext } from "react";

export interface SceneContextValue {
  scene: Scene;
  timing: SceneTiming;
  sceneIndex: number;
  sceneCount: number;
  seed: number;
  assetUrls: Readonly<Record<string, string>>;
  brand: Brand;
}

const SceneContext = createContext<SceneContextValue | null>(null);

export function SceneProvider(props: { value: SceneContextValue; children: ReactNode }): React.ReactElement {
  return <SceneContext.Provider value={props.value}>{props.children}</SceneContext.Provider>;
}

export function useSceneContext(): SceneContextValue {
  const value = useContext(SceneContext);
  if (!value) throw new Error("useSceneContext must be used inside a SceneProvider");
  return value;
}

/**
 * Frame by which the block's entrance should be complete and resolved, leaving the
 * tail hold and the outgoing transition untouched.
 */
export function useResolveByFrame(): number {
  const { timing } = useSceneContext();
  return Math.max(20, timing.durationFrames - 30);
}

/** Scene-relative frame at which narration line `lineIndex` starts, if it exists. */
export function useLineStartFrame(lineIndex: number): number | undefined {
  const { timing } = useSceneContext();
  return timing.lines[lineIndex]?.fromFrame;
}
