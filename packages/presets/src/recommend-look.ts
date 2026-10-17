import type { LookId, VideoType } from "@cutroom/scene-spec";

export type TargetChannel = "product-hunt" | "x" | "linkedin" | "youtube" | "vertical-social" | "docs";

export interface ProductSignals {
  productName: string;
  /** Count of user-facing strings found in the UI string inventory. */
  uiStringCount: number;
  hasWebUi: boolean;
  /** The product's own surfaces are dark (dark theme default, dark brand ground). */
  brandIsDark: boolean;
  targetChannel?: TargetChannel;
}

export interface LookRecommendation {
  look: LookId;
  reason: string;
  alternatives: LookId[];
}

const LOW_UI_DENSITY = 15;
const allLooks: ReadonlyArray<LookId> = ["editorial", "studio", "graphic", "cinematic"];

interface LookRule {
  applies: (videoType: VideoType, signals: ProductSignals) => boolean;
  look: LookId;
  reason: (signals: ProductSignals) => string;
}

/**
 * Ordered rules: first match wins. A pure table, never a model call,
 * so every recommendation is explainable and testable (PRD §7.4).
 */
const lookRules: ReadonlyArray<LookRule> = [
  {
    applies: (videoType) => videoType === "teaser",
    look: "graphic",
    reason: (signals) =>
      `A teaser lives on the beat: kinetic lines and hard cuts, then ${signals.productName}'s name.`,
  },
  {
    applies: (_videoType, signals) => signals.targetChannel === "vertical-social",
    look: "graphic",
    reason: (signals) =>
      `Vertical feeds reward 2–4 s scenes and hard cuts, so ${signals.productName} gets the Graphic pace.`,
  },
  {
    applies: (videoType) => videoType === "dev-integration",
    look: "graphic",
    reason: (signals) =>
      `${signals.productName} is used from code, so tight type and code cards beat app windows.`,
  },
  {
    applies: (videoType) => videoType === "tutorial",
    look: "studio",
    reason: (signals) =>
      `Tutorials are voice-first; Studio keeps ${signals.productName} centred and the music ducked.`,
  },
  {
    applies: (videoType, signals) => videoType === "launch" && signals.uiStringCount < LOW_UI_DENSITY,
    look: "graphic",
    reason: (signals) =>
      `${signals.productName} has ${signals.uiStringCount} UI strings, so bold type carries the launch better than screens.`,
  },
  {
    applies: (_videoType, signals) => signals.brandIsDark,
    look: "studio",
    reason: (signals) =>
      `${signals.productName} lives on a dark surface; Studio matches it instead of fighting it.`,
  },
  {
    applies: () => true,
    look: "editorial",
    reason: (signals) =>
      `${signals.productName} has ${signals.uiStringCount} UI strings to show, and Editorial's white cards and big numbers frame them.`,
  },
];

export function recommendLook(videoType: VideoType, signals: ProductSignals): LookRecommendation {
  const matchedRule = lookRules.find((rule) => rule.applies(videoType, signals)) ?? lookRules.at(-1);
  if (!matchedRule) throw new Error("Look rules table is empty");
  return {
    look: matchedRule.look,
    reason: matchedRule.reason(signals),
    alternatives: allLooks.filter((look) => look !== matchedRule.look),
  };
}
