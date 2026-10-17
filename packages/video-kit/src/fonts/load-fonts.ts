import { loadFont } from "@remotion/fonts";
import { fontManifest } from "./font-manifest";

let fontsRequested = false;

/**
 * Loads every self-hosted font once. `resolveFontUrl` maps a file name to a URL:
 * `staticFile` inside Remotion renders, a public path inside the web app's player.
 */
export function loadCutroomFonts(resolveFontUrl: (fileName: string) => string): void {
  if (fontsRequested) return;
  fontsRequested = true;
  for (const font of fontManifest) {
    void loadFont({
      family: font.family,
      url: resolveFontUrl(font.fileName),
      weight: String(font.weight),
      display: "block",
    });
  }
}
