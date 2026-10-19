import { z } from "zod";

export const directionToneSchema = z.enum(["plain", "confident", "playful", "technical", "calm"]);
export type DirectionTone = z.infer<typeof directionToneSchema>;

/**
 * The user's steer (PRD extension E1). Intent only: it can focus, address and colour the video,
 * never add a claim, change a block's schema or skip the claim audit.
 */
export const directionSchema = z.object({
  prompt: z.string().trim().max(500).optional(),
  audience: z.string().trim().max(80).optional(),
  tone: directionToneSchema.optional(),
  focusFeatureIds: z.array(z.string()).max(4).optional(),
  mustSay: z.array(z.string().max(80)).max(5).optional(),
  mustNotSay: z.array(z.string().max(80)).max(5).optional(),
});
export type Direction = z.infer<typeof directionSchema>;

const quoted = `["“']([^"”']{1,80})["”']`;
const mustNotSayPattern = new RegExp(
  String.raw`(?:don'?t|do not|never)\s+(?:say|mention|use)\s+${quoted}|(?:avoid|without)\s+${quoted}`,
  "gi",
);
const mustSayPattern = new RegExp(
  String.raw`(?:^|[^a-z'])(?:say|mention|include|use the (?:phrase|words?))\s+${quoted}`,
  "gi",
);
const audiencePattern = /^\s*for\s+([^:,.;\n]{2,80})[:,.;]/i;

const toneWords: ReadonlyArray<[DirectionTone, RegExp]> = [
  ["playful", /\b(playful|fun|cheeky|lighthearted)\b/i],
  ["calm", /\b(calm|gentle|relaxed|soothing)\b/i],
  ["technical", /\b(technical|in[- ]depth|for engineers)\b/i],
  ["confident", /\b(confident|bold|punchy|energetic)\b/i],
  ["plain", /\b(plain|simple|no hype|straightforward|understated)\b/i],
];

function phrases(text: string, pattern: RegExp): string[] {
  const found = [...text.matchAll(pattern)]
    .flatMap((match) => match.slice(1).filter(Boolean))
    .map((phrase) => phrase.trim());
  return [...new Set(found)].slice(0, 5);
}

/**
 * The composer's free text → a Direction, deterministically: quoted phrases after "say" or
 * "mention" must be said, after "don't say" or "avoid" must not; a leading "for …" names the
 * audience; tone words set the tone. Anything else stays in `prompt` for the model to read.
 */
export function parseDirection(text: string | undefined): Direction {
  const prompt = text?.trim();
  if (!prompt) return {};
  const mustNotSay = phrases(prompt, mustNotSayPattern);
  const mustSay = phrases(prompt, mustSayPattern).filter((phrase) => !mustNotSay.includes(phrase));
  const audience = prompt.match(audiencePattern)?.[1]?.trim();
  const tone = toneWords.find(([, pattern]) => pattern.test(prompt))?.[0];
  return directionSchema.parse({
    prompt,
    ...(audience ? { audience } : {}),
    ...(tone ? { tone } : {}),
    ...(mustSay.length > 0 ? { mustSay } : {}),
    ...(mustNotSay.length > 0 ? { mustNotSay } : {}),
  });
}
