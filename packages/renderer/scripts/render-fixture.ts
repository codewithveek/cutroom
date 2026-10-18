/**
 * M1 acceptance: renders the hand-written fixture storyboard in every look, 16:9 and 9:16,
 * with captions, a generated music bed and a thumbnail. Usage:
 *   pnpm --filter @cutroom/renderer render:fixture [--looks editorial,graphic] [--ratios 16:9,9:16]
 */
import path from "node:path";
import { parseArgs } from "node:util";
import {
  type AspectRatio,
  aspectRatioSchema,
  blockCatalog,
  type LookId,
  lookIdSchema,
  screenshotAssetKey,
} from "@cutroom/scene-spec";
import { createPreviewVideoProps, fixtureStoryboard } from "@cutroom/video-kit";
import { bundleVideoKit, produceDeliverables, resolveBrowserExecutable } from "../src/index";

const { values } = parseArgs({
  options: {
    looks: { type: "string", default: "studio,editorial,graphic,cinematic" },
    ratios: { type: "string", default: "16:9,9:16" },
    out: { type: "string", default: path.resolve(import.meta.dirname, "../../../.cutroom/fixture-renders") },
  },
});

const looks: LookId[] = values.looks.split(",").map((look) => lookIdSchema.parse(look.trim()));
const ratios: AspectRatio[] = values.ratios.split(",").map((ratio) => aspectRatioSchema.parse(ratio.trim()));
const cacheDirectory = path.resolve(values.out, "..", "bundle");
const { serveUrl } = await bundleVideoKit({ outDir: cacheDirectory });
const browserExecutable = resolveBrowserExecutable(process.env.BROWSER_EXECUTABLE);

for (const look of looks) {
  const scenes = fixtureStoryboard.scenes.filter((scene) =>
    blockCatalog[scene.block].allowedLooks.includes(look),
  );
  const storyboard = { ...fixtureStoryboard, look, scenes };
  const { voiceTimeline } = createPreviewVideoProps(storyboard);
  const startedAt = Date.now();
  const deliverables = await produceDeliverables({
    serveUrl,
    jobId: `fixture-${look}`,
    storyboard,
    voiceTimeline,
    ratios,
    music: { kind: "generated", bed: look === "studio" || look === "cinematic" ? "calm" : "upbeat" },
    watermark: false,
    localAssets: [
      {
        assetKey: screenshotAssetKey("screen-1"),
        filePath: path.resolve(import.meta.dirname, "../../video-kit/public/fixtures/screen-1.png"),
      },
    ],
    outputDirectory: values.out,
    workDirectory: path.join(values.out, "work", look),
    baseName: `fixture-${look}`,
    browserExecutable,
    onProgress: ({ ratio, stage, progress }) => {
      if (stage !== "render" || Math.round(progress * 100) % 25 === 0) {
        process.stdout.write(`\r${look} ${ratio} ${stage} ${Math.round(progress * 100)}%   `);
      }
    },
  });
  console.log(`\n${look}: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  for (const ratio of deliverables.ratios) {
    console.log(
      `  ${ratio.videoPath} (${(ratio.bytes / 1e6).toFixed(1)} MB, ${ratio.durationMs} ms, ${ratio.loudness.input_i} LUFS in)`,
    );
  }
  console.log(`  ${deliverables.thumbnailJpgPath}`);
}
