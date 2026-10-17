export interface TextSegment {
  text: string;
  starred: boolean;
}

/** Splits "Ship *every* week" into plain and starred segments. Unbalanced stars stay literal. */
export function parseStarredText(source: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const pattern = /\*([^*]+)\*/g;
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const matchStart = match.index;
    if (matchStart > cursor) segments.push({ text: source.slice(cursor, matchStart), starred: false });
    segments.push({ text: match[1] ?? "", starred: true });
    cursor = matchStart + match[0].length;
  }
  if (cursor < source.length) segments.push({ text: source.slice(cursor), starred: false });
  return segments;
}

export function stripStars(source: string): string {
  return parseStarredText(source)
    .map((segment) => segment.text)
    .join("");
}
