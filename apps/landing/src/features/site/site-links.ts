/** Where the landing page sends people. The DEV post link appears once its URL is set at build time. */
export const siteLinks = {
  site: "https://cutroom.tech",
  demo: "https://demo.cutroom.tech",
  repository: "https://github.com/codewithveek/cutroom",
  productVideosSkill: "https://github.com/codewithveek/skills",
  devPost: process.env.NEXT_PUBLIC_DEV_POST_URL || undefined,
} as const;

export const siteCopy = {
  title: "Cutroom: point it at a release, get the launch video",
  heroSub:
    "Cutroom reads your codebase, writes the script, checks every claim against the code and renders the video, on open models, on your own machine.",
} as const;
