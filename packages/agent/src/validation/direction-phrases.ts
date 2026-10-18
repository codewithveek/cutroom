import { type Direction, type SceneDraft, stripStars } from "@cutroom/scene-spec";

/** Every string a scene shows or says: narration, headlines, card text, captions. */
function sceneTexts(scene: SceneDraft): string[] {
  const texts: string[] = scene.narration.map((line) => line.text);
  const visit = (value: unknown): void => {
    if (typeof value === "string") texts.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(scene.props);
  return texts.map((text) => stripStars(text).toLowerCase());
}

/**
 * E1-3: must-say phrases appear somewhere the viewer reads or hears them (and, being text in
 * the storyboard, they are audited like any claim); must-not-say phrases appear nowhere.
 */
export function directionPhraseIssues(options: {
  scenes: ReadonlyArray<SceneDraft>;
  direction: Direction;
}): string[] {
  const texts = options.scenes.flatMap(sceneTexts);
  const contains = (phrase: string) => texts.some((text) => text.includes(phrase.toLowerCase()));
  return [
    ...(options.direction.mustSay ?? [])
      .filter((phrase) => !contains(phrase))
      .map(
        (phrase) =>
          `The user asked to say "${phrase}": put it word for word in a headline or a narration line.`,
      ),
    ...(options.direction.mustNotSay ?? [])
      .filter((phrase) => contains(phrase))
      .map((phrase) => `The user asked never to say "${phrase}": remove it from every scene.`),
  ];
}
