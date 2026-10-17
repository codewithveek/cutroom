/** Self-hosted fonts in public/fonts, loaded with @remotion/fonts. Never fetched at render time. */
export interface FontFile {
  family: string;
  /** fontsource package directory name. */
  packageName: string;
  weight: number;
  fileName: string;
}

function latinFont(options: { family: string; packageName: string; weights: number[] }): FontFile[] {
  return options.weights.map((weight) => ({
    family: options.family,
    packageName: options.packageName,
    weight,
    fileName: `${options.packageName}-latin-${weight}-normal.woff2`,
  }));
}

export const fontManifest: ReadonlyArray<FontFile> = [
  ...latinFont({ family: "Inter", packageName: "inter", weights: [400, 500, 600, 800] }),
  ...latinFont({
    family: "Plus Jakarta Sans",
    packageName: "plus-jakarta-sans",
    weights: [400, 500, 700, 800],
  }),
  ...latinFont({ family: "Inter Tight", packageName: "inter-tight", weights: [400, 500, 600] }),
  ...latinFont({ family: "Geist", packageName: "geist", weights: [400, 500, 600] }),
  ...latinFont({ family: "Geist Mono", packageName: "geist-mono", weights: [400, 500] }),
];

export const monospaceFontFamily = "Geist Mono";
