import type { ScreenshotView } from "./blocks/screenshot-window";
import type { CapturedScreen } from "./capture-contracts";
import type { SceneDraft } from "./scene-draft";
import type { Storyboard } from "./storyboard";

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

/** The real image size and, when `focusText` names one of its elements, that element's box (0–1). */
export function screenViewFor(options: {
  screen: CapturedScreen;
  focusText?: string | undefined;
}): ScreenshotView {
  const { screen } = options;
  const target = screen.targets.find((candidate) => candidate.text === options.focusText);
  return {
    imageWidth: screen.width,
    imageHeight: screen.height,
    ...(target
      ? {
          focusBox: {
            x: clampUnit(target.box.x / screen.width),
            y: clampUnit(target.box.y / screen.height),
            width: clampUnit(target.box.width / screen.width),
            height: clampUnit(target.box.height / screen.height),
          },
        }
      : {}),
  };
}

/**
 * Fills the code-owned `view` of a screenshot scene from the capture, replacing whatever view the
 * input carried. Works on drafts and on full scenes (a user edit); other blocks pass through.
 */
export function attachScreenView<SceneLike extends SceneDraft>(options: {
  scene: SceneLike;
  screens: ReadonlyArray<CapturedScreen>;
}): SceneLike {
  const { scene } = options;
  if (scene.block !== "screenshot-window") return scene;
  const screen = options.screens.find((candidate) => candidate.id === scene.props.screenId);
  if (!screen) return scene;
  // The spread keeps every field of SceneLike and only replaces props.view, which TypeScript
  // cannot follow through the generic.
  return {
    ...scene,
    props: { ...scene.props, view: screenViewFor({ screen, focusText: scene.props.focusText }) },
  } as SceneLike;
}

export function attachScreenViews(options: {
  storyboard: Storyboard;
  screens: ReadonlyArray<CapturedScreen>;
}): Storyboard {
  return {
    ...options.storyboard,
    scenes: options.storyboard.scenes.map((scene) => attachScreenView({ scene, screens: options.screens })),
  };
}
