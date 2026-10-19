/**
 * Renders the Styles section's thumbnails (§2.6): one real still per look, from Cutroom's own
 * blocks and the video-kit fixture storyboard, at the end of its feature-cards scene.
 * Usage: BROWSER_EXECUTABLE=<headless shell> pnpm --filter @cutroom/landing render:looks
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { bundleVideoKit, renderStills, resolveBrowserExecutable } from "@cutroom/renderer";
import {
  type BlockId,
  blockCatalog,
  estimateTimeline,
  lookIdSchema,
  type Storyboard,
  type VideoProps,
} from "@cutroom/scene-spec";
import { fixtureStoryboard, lookTokensById } from "@cutroom/video-kit";

const outputDirectory = path.resolve(import.meta.dirname, "../public/media/looks");
const SAMPLE_BLOCK = "feature-cards";

await mkdir(outputDirectory, { recursive: true });
const { serveUrl } = await bundleVideoKit({
  outDir: path.resolve(import.meta.dirname, "../../../.cutroom/landing-bundle"),
});
const browserExecutable = resolveBrowserExecutable(process.env.BROWSER_EXECUTABLE);

for (const look of lookIdSchema.options) {
  const scenes = fixtureStoryboard.scenes.filter((scene) =>
    blockCatalog[scene.block as BlockId].allowedLooks.includes(look),
  );
  const storyboard: Storyboard = { ...fixtureStoryboard, look, scenes };
  const timeline = estimateTimeline({ scenes, transitionFrames: lookTokensById[look].crossfadeFrames });
  const sampleIndex = scenes.findIndex((scene) => scene.block === SAMPLE_BLOCK);
  const sampleScene = timeline.scenes[sampleIndex];
  if (!sampleScene) throw new Error(`The fixture storyboard has no ${SAMPLE_BLOCK} scene in ${look}`);
  const nextTransition = timeline.scenes[sampleIndex + 1]?.transitionInFrames ?? 0;
  const videoProps: VideoProps = {
    storyboard,
    voiceTimeline: timeline,
    ratio: "16:9",
    music: { kind: "none" },
    assetUrls: {},
    openOnThumbnail: false,
    burnCaptions: false,
    watermark: false,
  };
  const [still] = await renderStills({
    serveUrl,
    videoProps,
    frames: [sampleScene.fromFrame + sampleScene.durationFrames - nextTransition - 1],
    outputPathForFrame: () => path.join(outputDirectory, `${look}.jpg`),
    browserExecutable,
    scale: 0.5,
  });
  console.log(`✔ ${look}: ${still}`);
}
