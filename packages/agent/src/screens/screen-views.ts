import type { CapturedScreen, SceneDraft } from "@cutroom/scene-spec";

/** The planner's view of the captured screens: ids, routes and the element texts it may focus. */
export function describeScreens(screens: ReadonlyArray<CapturedScreen>): string {
  if (screens.length === 0) return "(none captured: do not use screenshot-window)";
  return screens
    .map((screen) => {
      const targets =
        screen.targets.map((target) => `"${target.text}"`).join(", ") || "(no labelled elements)";
      return `- ${screen.id} · route ${screen.route} · "${screen.title}" · focusText options: ${targets}`;
    })
    .join("\n");
}

/** Repair feedback: a screenshot scene must name a captured screen and one of its real elements. */
export function screenIssues(options: {
  scenes: ReadonlyArray<SceneDraft>;
  screens: ReadonlyArray<CapturedScreen>;
}): string[] {
  const issues: string[] = [];
  options.scenes.forEach((scene, index) => {
    if (scene.block !== "screenshot-window") return;
    const screen = options.screens.find((candidate) => candidate.id === scene.props.screenId);
    if (!screen) {
      issues.push(
        `scenes.${index}.props.screenId: "${scene.props.screenId}" was not captured; use one of ${options.screens.map((candidate) => candidate.id).join(", ") || "none (pick another block)"}`,
      );
      return;
    }
    if (scene.props.focusText && !screen.targets.some((target) => target.text === scene.props.focusText)) {
      issues.push(
        `scenes.${index}.props.focusText: "${scene.props.focusText}" is not on ${screen.id}; copy one of its focusText options exactly or leave it out`,
      );
    }
  });
  return issues;
}
