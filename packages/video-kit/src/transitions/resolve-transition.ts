import type { Scene, TransitionId } from "@cutroom/scene-spec";
import type { LookTokens } from "../looks/look-tokens";

/** The look picks a transition by role unless the scene names one. */
export function resolveSceneTransition({
  scene,
  look,
  isLastScene,
}: {
  scene: Scene;
  look: LookTokens;
  isLastScene: boolean;
}): TransitionId {
  if (scene.transitionIn) return scene.transitionIn;
  if (scene.block === "title-card") return look.transitions.brandMoment;
  if (scene.block === "end-card" || isLastScene) return look.transitions.close;
  if (scene.block === "code-card" || scene.block === "terminal") return look.transitions.detail;
  return look.transitions.default;
}
