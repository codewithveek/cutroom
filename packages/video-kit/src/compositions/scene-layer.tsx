import type { Brand, Scene, SceneTiming } from "@cutroom/scene-spec";
import React from "react";
import { AbsoluteFill } from "remotion";
import { LookBackground } from "../backgrounds/look-background";
import { SceneBlock } from "../blocks/scene-block";
import { SceneProvider } from "../scene-context/scene-context";

export interface SceneLayerProps {
  scene: Scene;
  timing: SceneTiming;
  sceneIndex: number;
  sceneCount: number;
  seed: number;
  brand: Brand;
  assetUrls: Readonly<Record<string, string>>;
}

/** One scene on its look's ground, with the context its block reads. */
export function SceneLayer(props: SceneLayerProps): React.ReactElement {
  return (
    <SceneProvider
      value={{
        scene: props.scene,
        timing: props.timing,
        sceneIndex: props.sceneIndex,
        sceneCount: props.sceneCount,
        seed: props.seed,
        brand: props.brand,
        assetUrls: props.assetUrls,
      }}
    >
      <AbsoluteFill>
        <LookBackground />
        <SceneBlock scene={props.scene} />
      </AbsoluteFill>
    </SceneProvider>
  );
}
