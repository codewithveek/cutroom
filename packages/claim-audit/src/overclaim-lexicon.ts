/** Unqualified absolutes the audit flags (FR-CA-2d), with the precise wording to reach for instead. */
export const overclaimLexicon: Readonly<Record<string, string>> = {
  globally: "name the regions or 'across borders'",
  anywhere: "name where it works",
  instantly: "say how fast, or 'in one step'",
  "real-time": "say how often it updates",
  realtime: "say how often it updates",
  any: "name what is supported",
  all: "name what is covered",
  never: "say what it avoids, and when",
  always: "say when it happens",
  automatic: "say what triggers it",
  automatically: "say what triggers it",
  effortless: "say what step it removes",
  effortlessly: "say what step it removes",
  secure: "name the protection (e.g. 'encrypted at rest')",
  seamless: "say what it connects",
  seamlessly: "say what it connects",
};

/** Words that make an absolute precise enough to keep ("all three", "any of these", "secure by default"…). */
const qualifierAfter = /^(of|three|two|four|five|\d+|the\s+(?:same|following)|by\s+default|from)\b/i;

export interface OverclaimHit {
  word: string;
  advice: string;
}

export function findOverclaims(text: string): OverclaimHit[] {
  const hits: OverclaimHit[] = [];
  const pattern = /\b([A-Za-z-]+)\b/g;
  for (const match of text.matchAll(pattern)) {
    const word = (match[1] ?? "").toLowerCase();
    const advice = overclaimLexicon[word];
    if (!advice) continue;
    const following = text.slice(match.index + word.length).trimStart();
    if (qualifierAfter.test(following)) continue;
    if (hits.some((hit) => hit.word === word)) continue;
    hits.push({ word, advice });
  }
  return hits;
}
