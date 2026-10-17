"use client";

import { loadCutroomFonts } from "@cutroom/video-kit";

/** The player uses the fonts copied into /public/fonts by `pnpm copy-fonts`. */
export function ensurePreviewFonts(): void {
  if (typeof window === "undefined") return;
  loadCutroomFonts((fileName) => `/fonts/${fileName}`);
}
