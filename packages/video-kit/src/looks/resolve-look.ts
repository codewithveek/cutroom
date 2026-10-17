import type { Brand, LookId } from "@cutroom/scene-spec";
import { cinematicLook } from "./cinematic";
import { editorialLook } from "./editorial";
import { graphicLook } from "./graphic";
import type { LookTokens } from "./look-tokens";
import { studioLook } from "./studio";

export const lookTokensById: Readonly<Record<LookId, LookTokens>> = {
  studio: studioLook,
  editorial: editorialLook,
  graphic: graphicLook,
  cinematic: cinematicLook,
};

/** The product's brand accent replaces the look's accent when one is set (PRD §7.5). */
export function resolveLook(lookId: LookId, brand?: Pick<Brand, "accentColor" | "fontFamily">): LookTokens {
  const baseLook = lookTokensById[lookId];
  if (!brand?.accentColor) return baseLook;
  return { ...baseLook, colors: { ...baseLook.colors, accent: brand.accentColor } };
}
