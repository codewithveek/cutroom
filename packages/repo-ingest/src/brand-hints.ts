import type { BrandHints } from "./snapshot-schema";

const hexColor = "#[0-9a-fA-F]{6}\\b";

const accentVariablePatterns: ReadonlyArray<RegExp> = [
  new RegExp(`--(?:color-)?(?:brand|primary|accent)(?:-500|-600)?\\s*:\\s*(${hexColor})`),
  new RegExp(`(?:brand|primary|accent)\\s*:\\s*["'](${hexColor})["']`),
  new RegExp(`(?:brand|primary|accent)\\s*:\\s*\\{[^}]*?(?:DEFAULT|500)\\s*:\\s*["'](${hexColor})["']`, "s"),
];

const backgroundVariablePattern = new RegExp(`--(?:color-)?background\\s*:\\s*(${hexColor})`);
const fontPattern = /font-family\s*:\s*["']?([A-Z][A-Za-z0-9 ]+?)["']?\s*[,;]/;
const nextFontPattern = /import\s*\{\s*([A-Z][A-Za-z_]+)\s*\}\s*from\s*["']next\/font\/google["']/;

const logoCandidates: ReadonlyArray<RegExp> = [
  /(^|\/)(public|static|assets|images?)\/(logo|brand|icon|mark)[^/]*\.(svg|png)$/i,
  /(^|\/)logo[^/]*\.(svg|png)$/i,
  /(^|\/)(public|static|app)\/(favicon|apple-touch-icon|icon)[^/]*\.(svg|png)$/i,
];

function firstMatch(content: string, patterns: ReadonlyArray<RegExp>): string | undefined {
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]) return match[1].toLowerCase();
  }
  return undefined;
}

export interface BrandHintSources {
  /** Contents of style and theme files (tailwind config, globals.css, theme files). */
  styleContents: ReadonlyArray<string>;
  /** Every path in the repo, including binary files we did not read. */
  allPaths: ReadonlyArray<string>;
  homepage?: string | undefined;
}

/** Accent colour, background, font and logo from the repo itself (FR-ING-5). */
export function extractBrandHints(sources: BrandHintSources): BrandHints {
  const combinedStyles = sources.styleContents.join("\n");
  const accentColor = firstMatch(combinedStyles, accentVariablePatterns);
  const backgroundColor = combinedStyles.match(backgroundVariablePattern)?.[1]?.toLowerCase();
  const fontFamily =
    combinedStyles.match(nextFontPattern)?.[1]?.replaceAll("_", " ") ??
    combinedStyles.match(fontPattern)?.[1]?.trim();
  const logoPath = logoCandidates
    .map((pattern) => sources.allPaths.find((candidate) => pattern.test(candidate)))
    .find(Boolean);
  return {
    ...(accentColor ? { accentColor } : {}),
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(fontFamily ? { fontFamily } : {}),
    ...(logoPath ? { logoPath } : {}),
    ...(sources.homepage ? { homepage: sources.homepage } : {}),
  };
}

/** Relative luminance below 0.2 counts as a dark surface. */
export function isDarkColor(hex: string): boolean {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue < 0.2;
}
