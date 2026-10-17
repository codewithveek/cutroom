import type { UiString } from "./snapshot-schema";

const MIN_UI_TEXT_LENGTH = 2;
const MAX_UI_TEXT_LENGTH = 120;

function lineOf(content: string, index: number): number {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) if (content.charCodeAt(cursor) === 10) line += 1;
  return line;
}

/** Visible words: has a letter, is not code-ish, not a redaction marker. */
function isUserFacing(text: string): boolean {
  if (text.length < MIN_UI_TEXT_LENGTH || text.length > MAX_UI_TEXT_LENGTH) return false;
  if (!/\p{L}/u.test(text)) return false;
  if (/[{}();=<>]|=>|&&|\|\|/.test(text)) return false;
  return !text.includes("‹redacted:");
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

interface PatternExtraction {
  pattern: RegExp;
  kind: UiString["kind"];
  group: number;
}

const markupExtractions: ReadonlyArray<PatternExtraction> = [
  { pattern: />([^<>{}`]+)</g, kind: "jsx-text", group: 1 },
  {
    pattern:
      /\b(?:aria-label|title|placeholder|label|alt|tooltip|description|heading|buttonText)=["']([^"'{}]+)["']/g,
    kind: "attribute",
    group: 1,
  },
];

const cliExtractions: ReadonlyArray<PatternExtraction> = [
  { pattern: /\.(?:command|description|summary|alias)\(\s*["'`]([^"'`]+)["'`]/g, kind: "cli", group: 1 },
  {
    pattern: /\.(?:option|requiredOption)\(\s*["'`]([^"'`]+)["'`]\s*,\s*["'`]([^"'`]+)["'`]/g,
    kind: "cli",
    group: 1,
  },
  {
    pattern: /\.(?:option|requiredOption)\(\s*["'`][^"'`]+["'`]\s*,\s*["'`]([^"'`]+)["'`]/g,
    kind: "cli",
    group: 1,
  },
  {
    pattern: /add_argument\(\s*["']([^"']+)["'](?:[^)]*help\s*=\s*["']([^"']+)["'])?/g,
    kind: "cli",
    group: 1,
  },
  { pattern: /help\s*=\s*["']([^"']+)["']/g, kind: "cli", group: 1 },
];

function extractWithPatterns(options: {
  content: string;
  filePath: string;
  extractions: ReadonlyArray<PatternExtraction>;
}): UiString[] {
  const found: UiString[] = [];
  for (const extraction of options.extractions) {
    for (const match of options.content.matchAll(extraction.pattern)) {
      const text = normalizeText(match[extraction.group] ?? "");
      if (!isUserFacing(text) && extraction.kind !== "cli") continue;
      if (!text) continue;
      found.push({
        text,
        filePath: options.filePath,
        line: lineOf(options.content, match.index),
        kind: extraction.kind,
      });
    }
  }
  return found;
}

function collectJsonStrings(value: unknown, sink: string[]): void {
  if (typeof value === "string") sink.push(value);
  else if (Array.isArray(value)) for (const item of value) collectJsonStrings(item, sink);
  else if (value && typeof value === "object")
    for (const item of Object.values(value)) collectJsonStrings(item, sink);
}

function extractI18nStrings(content: string, filePath: string): UiString[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }
  const values: string[] = [];
  collectJsonStrings(parsed, values);
  return values
    .map(normalizeText)
    .filter(isUserFacing)
    .map((text) => {
      const index = content.indexOf(JSON.stringify(text).slice(1, -1));
      return { text, filePath, line: index >= 0 ? lineOf(content, index) : 1, kind: "i18n" as const };
    });
}

const markupLanguages = new Set(["tsx", "jsx", "vue", "svelte", "astro", "html"]);
const cliLanguages = new Set(["ts", "js", "python", "go", "rust"]);

export interface ExtractUiStringsOptions {
  filePath: string;
  language: string;
  content: string;
  isI18nFile: boolean;
}

/** The UI string inventory: text a user can see, with where it lives (FR-ING-4). */
export function extractUiStrings(options: ExtractUiStringsOptions): UiString[] {
  if (options.isI18nFile && options.filePath.endsWith(".json"))
    return extractI18nStrings(options.content, options.filePath);
  if (markupLanguages.has(options.language)) {
    return extractWithPatterns({
      content: options.content,
      filePath: options.filePath,
      extractions: markupExtractions,
    });
  }
  if (cliLanguages.has(options.language)) {
    return extractWithPatterns({
      content: options.content,
      filePath: options.filePath,
      extractions: cliExtractions,
    });
  }
  return [];
}
