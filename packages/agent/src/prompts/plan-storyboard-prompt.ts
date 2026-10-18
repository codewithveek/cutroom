import { type VideoTypeTemplate, videoTypeTemplates } from "@cutroom/presets";
import type { RepoSnapshot } from "@cutroom/repo-ingest";
import {
  blockCatalog,
  blocksAllowedInLook,
  type CapturedScreen,
  type LookId,
  type ProductBrief,
  type VideoType,
} from "@cutroom/scene-spec";
import { describeScreens } from "../screens/screen-views";
import { accuracyRules } from "./shared-rules";

export const planStoryboardSystemPrompt = `You are the scriptwriter and motion designer inside Cutroom. You turn a verified product brief into a storyboard: a list of scenes, each one block from a fixed library with its props and narration.

Rules:
- ${accuracyRules}
- Follow the beat plan exactly: every scene has a "beat" from the plan, in order, using a block the beat allows.
- Narration is spoken at 2.5 words per second. Respect each beat's word budget; shorter is fine.
- Headlines are 4–9 words. One coloured phrase per line, wrapped in *stars*: the problem in a problem headline, the promise in a promise headline, never both.
- No filler openers ("So,", "Now let's", "Okay").
- Narration "text" is what captions show. Add "say" only when the spoken form differs: spell out product names, acronyms and numbers the way they should sound. Show identifiers and code on screen; never read them aloud.
- code-card scenes copy an excerpt from the code excerpts list exactly, with its filePath, lineStart and lineEnd.
- terminal scenes use only commands from the README commands or package scripts, and only output the docs or code show.
- big-number scenes use a number that appears in the evidence. Never invent metrics.
- Placeholder data (names, amounts) is fine; placeholder features are not.
- Return JSON only, matching the schema.`;

function describeBeatPlan(options: {
  template: VideoTypeTemplate;
  look: LookId;
  hasScreens: boolean;
}): string {
  const allowedBlocks = new Set(blocksAllowedInLook(options.look));
  return options.template.beats
    .map((beat, index) => {
      const blocks = beat.blocks.filter(
        (block) => allowedBlocks.has(block) && (options.hasScreens || block !== "screenshot-window"),
      );
      const count =
        beat.sceneCount[0] === beat.sceneCount[1]
          ? `${beat.sceneCount[0]}`
          : `${beat.sceneCount[0]}–${beat.sceneCount[1]}`;
      return `${index + 1}. beat "${beat.beat}" × ${count} scene(s) · blocks: ${blocks.join(", ")} · narration ≤ ${beat.narrationWords[1]} words per scene\n   ${beat.guidance}`;
    })
    .join("\n");
}

function describeBlocks(look: LookId, hasScreens: boolean): string {
  return blocksAllowedInLook(look)
    .filter((block) => hasScreens || block !== "screenshot-window")
    .map((block) => `- ${block}: ${blockCatalog[block].purpose}`)
    .join("\n");
}

function describeBrief(brief: ProductBrief): string {
  const features = brief.features
    .map((feature, index) => {
      const evidence = feature.evidence
        .map((item) => `${item.filePath}:${item.lineStart}-${item.lineEnd}`)
        .join(", ");
      return `${index + 1}. ${feature.title}${feature.strength === "weak" ? " (weak evidence: avoid as a headline)" : ""}: ${feature.description}${evidence ? ` [${evidence}]` : ""}`;
    })
    .join("\n");
  return [
    `Name: ${brief.name}`,
    `Tagline: ${brief.tagline}`,
    `Audience: ${brief.audience}`,
    `Problem: ${brief.problem}`,
    `Promise: ${brief.promise}`,
    `Features:\n${features}`,
  ].join("\n");
}

function describeCodeExcerpts(brief: ProductBrief): string {
  const excerpts = brief.features.flatMap((feature) => feature.evidence);
  if (excerpts.length === 0) return "(none: do not use code-card)";
  return excerpts
    .map(
      (item) =>
        `--- filePath: ${item.filePath} · lineStart: ${item.lineStart} · lineEnd: ${item.lineEnd}\n${item.excerpt}`,
    )
    .join("\n");
}

function describeCommands(snapshot: RepoSnapshot): string {
  const readme = snapshot.readmeCommands.map((command) => `- ${command.command}`);
  const scripts = Object.keys(snapshot.scripts).map((name) => `- npm run ${name}`);
  const all = [...new Set([...readme, ...scripts])].slice(0, 20);
  return all.length > 0 ? all.join("\n") : "(none: do not use terminal)";
}

export interface PlanStoryboardPromptOptions {
  brief: ProductBrief;
  snapshot: RepoSnapshot;
  videoType: VideoType;
  look: LookId;
  targetSeconds: number;
  /** The user's steer, already redacted. */
  direction?: string | undefined;
  screens?: ReadonlyArray<CapturedScreen> | undefined;
}

export function buildPlanStoryboardPrompt(options: PlanStoryboardPromptOptions): string {
  const template = videoTypeTemplates[options.videoType];
  const hasScreens = (options.screens?.length ?? 0) > 0;
  return [
    `Write a ${template.label.toLowerCase()} storyboard of about ${options.targetSeconds} seconds in the ${options.look} look.`,
    "",
    "## Beat plan",
    describeBeatPlan({ template, look: options.look, hasScreens }),
    "",
    "## Blocks available in this look",
    describeBlocks(options.look, hasScreens),
    "",
    "## Product brief (verified)",
    describeBrief(options.brief),
    "",
    "## Code excerpts you may show in code-card (copy exactly)",
    describeCodeExcerpts(options.brief),
    "",
    "## Commands you may show in terminal",
    describeCommands(options.snapshot),
    ...(options.screens && hasScreens
      ? [
          "",
          "## Captured screens of the running app (show at least one in a screenshot-window scene)",
          describeScreens(options.screens),
        ]
      : []),
    ...(options.direction
      ? [
          "",
          "## Direction from the user",
          "Follow it where it does not conflict with the rules, the beat plan or the evidence:",
          options.direction,
        ]
      : []),
  ].join("\n");
}
