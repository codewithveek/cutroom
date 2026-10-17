import { stripStars } from "./starred-text";
import type { Storyboard } from "./storyboard";

const MAX_THUMBNAIL_WORDS = 5;

/**
 * Two lines, ≤ 5 words in total; the second line takes the accent (FR-RD-4).
 * Uses the brand name and the shortest promise we already have, never new copy.
 */
export function deriveThumbnailTitle(storyboard: Storyboard): [string, string] {
  const name = storyboard.brand.name;
  const nameWords = name.split(/\s+/).filter(Boolean);
  const tagline = stripStars(storyboard.brand.tagline ?? storyboard.title);
  const remainingWords = Math.max(1, MAX_THUMBNAIL_WORDS - nameWords.length);
  const taglineWords = tagline
    .replace(/[.!?]+$/, "")
    .split(/\s+/)
    .filter(Boolean);
  const secondLine = taglineWords.slice(0, remainingWords).join(" ");
  return [name, secondLine || storyboard.title];
}
