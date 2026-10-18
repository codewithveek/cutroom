import type { BlockId, LookId, VideoType } from "@cutroom/scene-spec";

export interface BeatTemplate {
  beat: string;
  /** How many scenes fill this beat. */
  sceneCount: readonly [number, number];
  blocks: ReadonlyArray<BlockId>;
  /** Narration words per scene at 2.5 words/s (FR-SB-4). */
  narrationWords: readonly [number, number];
  guidance: string;
}

export interface VideoTypeTemplate {
  videoType: VideoType;
  label: string;
  targetSeconds: readonly [number, number];
  defaultLook: LookId;
  beats: ReadonlyArray<BeatTemplate>;
}

const closeBeat: BeatTemplate = {
  beat: "close",
  sceneCount: [1, 1],
  blocks: ["end-card"],
  narrationWords: [5, 10],
  guidance: "Name, tagline and one call to action that exists (an install command, a URL from the README).",
};

/** Deterministic structure: the model fills beats, it never invents structure (PRD §7.4). */
export const videoTypeTemplates: Readonly<Record<VideoType, VideoTypeTemplate>> = {
  launch: {
    videoType: "launch",
    label: "Launch",
    targetSeconds: [40, 60],
    defaultLook: "editorial",
    beats: [
      {
        beat: "problem",
        sceneCount: [1, 1],
        blocks: ["kinetic-headline"],
        narrationWords: [6, 8],
        guidance:
          "2–3 short lines naming the pain the audience has today. Star the painful phrase. Tone: problem.",
      },
      {
        beat: "introducing",
        sceneCount: [1, 1],
        blocks: ["title-card"],
        narrationWords: [3, 6],
        guidance: "variant 'introducing'. The product name exactly as the repo spells it, and its tagline.",
      },
      {
        beat: "pitch",
        sceneCount: [1, 1],
        blocks: ["feature-cards"],
        narrationWords: [10, 16],
        guidance: "Exactly 3 cards, one per verified feature, verb-led titles.",
      },
      {
        beat: "moment",
        sceneCount: [3, 4],
        blocks: ["code-card", "terminal", "big-number", "word-slot", "kinetic-headline", "screenshot-window"],
        narrationWords: [10, 16],
        guidance:
          "One product moment per scene, each backed by evidence: a real code excerpt, a real command, a real number.",
      },
      closeBeat,
    ],
  },
  "feature-drop": {
    videoType: "feature-drop",
    label: "Feature drop",
    targetSeconds: [20, 40],
    defaultLook: "editorial",
    beats: [
      {
        beat: "new",
        sceneCount: [1, 1],
        blocks: ["kinetic-headline", "title-card"],
        narrationWords: [3, 6],
        guidance: "'New: <feature>' with the feature named as the code names it. Tone: promise.",
      },
      {
        beat: "old-way",
        sceneCount: [1, 1],
        blocks: ["kinetic-headline"],
        narrationWords: [6, 8],
        guidance: "One line on how it worked before. Tone: problem.",
      },
      {
        beat: "moment",
        sceneCount: [2, 3],
        blocks: ["code-card", "terminal", "big-number", "feature-cards", "screenshot-window"],
        narrationWords: [10, 16],
        guidance: "Show the feature working, from real code or commands.",
      },
      {
        ...closeBeat,
        guidance: "Where to find it: the command, setting or URL that exists in the repo.",
      },
    ],
  },
  tutorial: {
    videoType: "tutorial",
    label: "Tutorial",
    targetSeconds: [45, 75],
    defaultLook: "studio",
    beats: [
      {
        beat: "title",
        sceneCount: [1, 1],
        blocks: ["title-card", "kinetic-headline"],
        narrationWords: [3, 6],
        guidance: "What the viewer will be able to do by the end.",
      },
      {
        beat: "step",
        sceneCount: [3, 6],
        blocks: ["terminal", "code-card", "screenshot-window"],
        narrationWords: [10, 16],
        guidance: "One action per scene, in order, using real commands and real code.",
      },
      {
        ...closeBeat,
        guidance: "End card whose CTA starts with 'Next:' and names a real next step from the docs.",
      },
    ],
  },
  explainer: {
    videoType: "explainer",
    label: "Explainer",
    targetSeconds: [45, 60],
    defaultLook: "editorial",
    beats: [
      {
        beat: "stage",
        sceneCount: [1, 1],
        blocks: ["diagram-flow", "word-slot", "kinetic-headline"],
        narrationWords: [6, 10],
        guidance:
          "Name the stages the explainer will walk through, in order; diagram-flow shows them as a flow.",
      },
      {
        beat: "idea",
        sceneCount: [3, 5],
        blocks: ["code-card", "diagram-flow", "big-number", "kinetic-headline", "feature-cards"],
        narrationWords: [10, 16],
        guidance: "One idea per scene, each grounded in the code.",
      },
      {
        beat: "recap",
        sceneCount: [1, 1],
        blocks: ["feature-cards"],
        narrationWords: [10, 16],
        guidance: "Recap the ideas as 2–4 cards.",
      },
      closeBeat,
    ],
  },
  teaser: {
    videoType: "teaser",
    label: "Teaser",
    targetSeconds: [10, 20],
    defaultLook: "graphic",
    beats: [
      {
        beat: "kinetic",
        sceneCount: [2, 3],
        blocks: ["kinetic-headline"],
        narrationWords: [0, 6],
        guidance: "Short kinetic lines on the beat. One line each.",
      },
      {
        beat: "name",
        sceneCount: [1, 1],
        blocks: ["title-card"],
        narrationWords: [0, 4],
        guidance: "The product name and tagline.",
      },
      { ...closeBeat, narrationWords: [0, 8], guidance: "A date or call to action that exists." },
    ],
  },
  "dev-integration": {
    videoType: "dev-integration",
    label: "Developer integration",
    targetSeconds: [40, 50],
    defaultLook: "graphic",
    beats: [
      {
        beat: "setup",
        sceneCount: [1, 1],
        blocks: ["terminal"],
        narrationWords: [6, 12],
        guidance: "Install or key setup exactly as the README shows it.",
      },
      {
        beat: "request",
        sceneCount: [1, 1],
        blocks: ["code-card"],
        narrationWords: [10, 16],
        guidance: "A real request or API call from the code or docs.",
      },
      {
        beat: "response",
        sceneCount: [1, 1],
        blocks: ["code-card", "terminal"],
        narrationWords: [10, 16],
        guidance: "What comes back: a real response shape or real output.",
      },
      {
        beat: "result",
        sceneCount: [1, 1],
        blocks: ["big-number", "feature-cards"],
        narrationWords: [10, 16],
        guidance: "What the developer gets, from the evidence.",
      },
      closeBeat,
    ],
  },
};
