import type { LookId } from "./primitives";
import type { BlockId } from "./scene";

export interface BlockCatalogEntry {
  /** One line the planner prompt uses to choose blocks. */
  purpose: string;
  allowedLooks: ReadonlyArray<LookId>;
  /** Seconds the scene may last on screen. */
  durationRangeSeconds: readonly [number, number];
}

const allLooks: ReadonlyArray<LookId> = ["studio", "editorial", "graphic", "cinematic"];

export const blockCatalog: Readonly<Record<BlockId, BlockCatalogEntry>> = {
  "title-card": {
    purpose:
      "Product mark, name and tagline. Use variant 'introducing' to reveal the product after the problem.",
    allowedLooks: allLooks,
    durationRangeSeconds: [2, 6],
  },
  "kinetic-headline": {
    purpose:
      "1–3 short lines rising word by word. Star one phrase per line. Good for problem and promise beats.",
    allowedLooks: allLooks,
    durationRangeSeconds: [2, 6],
  },
  "big-number": {
    purpose: "One real number rolling up, with a label and one line. Only numbers that appear in the code.",
    allowedLooks: allLooks,
    durationRangeSeconds: [3, 6],
  },
  "feature-cards": {
    purpose: "2–4 cards with an icon, a verb-led title and one line. Good for the pitch beat.",
    allowedLooks: allLooks,
    durationRangeSeconds: [4, 8],
  },
  "code-card": {
    purpose: "A real excerpt from the repository, with its path. Copy the lines exactly.",
    allowedLooks: allLooks,
    durationRangeSeconds: [4, 10],
  },
  terminal: {
    purpose: "Commands typed with their real output, taken from the README or package scripts.",
    allowedLooks: ["studio", "editorial", "graphic"],
    durationRangeSeconds: [4, 10],
  },
  "word-slot": {
    purpose: "A lead phrase with a slot stepping through 2–6 items (audiences, integrations, formats).",
    allowedLooks: allLooks,
    durationRangeSeconds: [3, 6],
  },
  "end-card": {
    purpose:
      "Verbs as beats, then mark, name, tagline, a call-to-action pill and URL. Always the last scene.",
    allowedLooks: allLooks,
    durationRangeSeconds: [3, 7],
  },
};

export function blocksAllowedInLook(look: LookId): ReadonlyArray<BlockId> {
  return (Object.keys(blockCatalog) as BlockId[]).filter((blockId) =>
    blockCatalog[blockId].allowedLooks.includes(look),
  );
}
