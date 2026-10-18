import { presets, videoTypeTemplates } from "@cutroom/presets";
import { lookTokensById } from "@cutroom/video-kit";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/** Presets, looks and video types: the wizard's catalogue. */
export const catalogueRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/presets", async () => ({ presets: Object.values(presets) }));
  app.get("/looks", async () => ({
    looks: Object.values(lookTokensById).map((look) => ({
      id: look.id,
      label: look.label,
      summary: look.summary,
      isDark: look.isDark,
      accent: look.colors.accent,
      ground: look.colors.ground,
    })),
  }));
  app.get("/video-types", async () => ({
    videoTypes: Object.values(videoTypeTemplates).map((template) => ({
      videoType: template.videoType,
      label: template.label,
      targetSeconds: template.targetSeconds,
      defaultLook: template.defaultLook,
      beats: template.beats.map((beat) => beat.beat),
    })),
  }));
};
