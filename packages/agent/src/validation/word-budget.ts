import { type BeatTemplate, videoTypeTemplates } from "@cutroom/presets";
import {
  countWords,
  type SceneDraft,
  type StoryboardDraft,
  stripStars,
  type VideoType,
} from "@cutroom/scene-spec";

const fillerOpeners = /^(so|now|okay|ok|well|alright|basically|let'?s|now let'?s|here'?s the thing)\b[,\s]/i;
const HEADLINE_WORD_RANGE: readonly [number, number] = [4, 9];
const TEASER_HEADLINE_WORD_RANGE: readonly [number, number] = [1, 9];

function beatFor(videoType: VideoType, beat: string | undefined): BeatTemplate | undefined {
  return videoTypeTemplates[videoType].beats.find((template) => template.beat === beat);
}

function narrationWordCount(scene: SceneDraft): number {
  return scene.narration.reduce((sum, line) => sum + countWords(line.text), 0);
}

function sceneLabel(scene: SceneDraft, index: number): string {
  return `scenes.${index} (${scene.block}${scene.beat ? `, beat ${scene.beat}` : ""})`;
}

function narrationIssues(scene: SceneDraft, index: number, beat: BeatTemplate): string[] {
  const issues: string[] = [];
  const words = narrationWordCount(scene);
  if (words > beat.narrationWords[1]) {
    issues.push(
      `${sceneLabel(scene, index)}: narration has ${words} words; the ${beat.beat} beat allows at most ${beat.narrationWords[1]} (2.5 words per second).`,
    );
  }
  scene.narration.forEach((line, lineIndex) => {
    if (fillerOpeners.test(line.text.trim())) {
      issues.push(
        `scenes.${index}.narration.${lineIndex}: drop the filler opener ("${line.text.split(/[\s,]/)[0]}").`,
      );
    }
  });
  return issues;
}

function headlineIssues(scene: SceneDraft, index: number, videoType: VideoType): string[] {
  if (scene.block !== "kinetic-headline") return [];
  const [minimumWords, maximumWords] =
    videoType === "teaser" ? TEASER_HEADLINE_WORD_RANGE : HEADLINE_WORD_RANGE;
  const words = countWords(stripStars(scene.props.lines.join(" ")));
  if (words >= minimumWords && words <= maximumWords) return [];
  return [
    `${sceneLabel(scene, index)}: headline has ${words} words; use ${minimumWords}–${maximumWords} words across its lines.`,
  ];
}

function structureIssues(draft: StoryboardDraft, videoType: VideoType): string[] {
  const template = videoTypeTemplates[videoType];
  const issues: string[] = [];
  const lastScene = draft.scenes.at(-1);
  if (lastScene?.block !== "end-card") issues.push("The last scene must be an end-card.");
  draft.scenes.forEach((scene, index) => {
    const beat = beatFor(videoType, scene.beat);
    if (!beat) {
      issues.push(
        `${sceneLabel(scene, index)}: beat must be one of ${template.beats.map((item) => item.beat).join(", ")}.`,
      );
      return;
    }
    if (!beat.blocks.includes(scene.block)) {
      issues.push(
        `${sceneLabel(scene, index)}: the ${beat.beat} beat uses ${beat.blocks.join(" or ")}, not ${scene.block}.`,
      );
    }
  });
  return issues;
}

/**
 * Checks Zod cannot express: beat structure, word budgets at 2.5 words/s, headline length
 * and filler openers (FR-SB-4, FR-SB-5). Every issue goes back to the model to repair.
 */
export function storyboardDraftIssues(draft: StoryboardDraft, videoType: VideoType): string[] {
  const issues = structureIssues(draft, videoType);
  draft.scenes.forEach((scene, index) => {
    const beat = beatFor(videoType, scene.beat);
    if (beat) issues.push(...narrationIssues(scene, index, beat));
    issues.push(...headlineIssues(scene, index, videoType));
  });
  return issues;
}
