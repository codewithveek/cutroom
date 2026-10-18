/**
 * Contract check (PRD §11): every block renders a still in every allowed look × every ratio.
 * Writes .cutroom/block-stills/<look>-<ratio>.jpg contact sheets and prints a hash per still,
 * so diffs between runs are easy to spot. Usage: pnpm --filter @cutroom/renderer render:block-stills
 * Add `--watermark` to check the "created with cutroom" badge over every block too.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  aspectRatioSchema,
  type BlockId,
  blockCatalog,
  estimateTimeline,
  lookIdSchema,
  type Storyboard,
  screenshotAssetKey,
  type VideoProps,
} from "@cutroom/scene-spec";
import { fixtureStoryboard, lookTokensById } from "@cutroom/video-kit";
import { bundleVideoKit, renderStills, resolveBrowserExecutable, runFfmpeg } from "../src/index";

const { values: flags } = parseArgs({ options: { watermark: { type: "boolean", default: false } } });
const outputDirectory = path.resolve(
  import.meta.dirname,
  flags.watermark ? "../../../.cutroom/block-stills-watermark" : "../../../.cutroom/block-stills",
);
await mkdir(outputDirectory, { recursive: true });
const { serveUrl } = await bundleVideoKit({ outDir: path.resolve(outputDirectory, "..", "bundle") });
const browserExecutable = resolveBrowserExecutable(process.env.BROWSER_EXECUTABLE);
const failures: string[] = [];

for (const look of lookIdSchema.options) {
  const scenes = fixtureStoryboard.scenes.filter((scene) =>
    blockCatalog[scene.block as BlockId].allowedLooks.includes(look),
  );
  const storyboard: Storyboard = { ...fixtureStoryboard, look, scenes };
  const timeline = estimateTimeline({ scenes, transitionFrames: lookTokensById[look].crossfadeFrames });
  for (const ratio of aspectRatioSchema.options) {
    const videoProps: VideoProps = {
      storyboard,
      voiceTimeline: timeline,
      ratio,
      music: { kind: "none" },
      assetUrls: { [screenshotAssetKey("screen-1")]: "public/fixtures/screen-1.png" },
      openOnThumbnail: false,
      burnCaptions: false,
      watermark: flags.watermark,
    };
    const frames = timeline.scenes.map((sceneTiming, index) => {
      const nextTransition = timeline.scenes[index + 1]?.transitionInFrames ?? 0;
      return sceneTiming.fromFrame + sceneTiming.durationFrames - nextTransition - 1;
    });
    const stillDirectory = path.join(outputDirectory, `${look}-${ratio.replace(":", "x")}`);
    await mkdir(stillDirectory, { recursive: true });
    try {
      const stills = await renderStills({
        serveUrl,
        videoProps,
        frames,
        outputPathForFrame: (frame) =>
          path.join(
            stillDirectory,
            `${String(frames.indexOf(frame)).padStart(2, "0")}-${scenes[frames.indexOf(frame)]?.block}.jpg`,
          ),
        browserExecutable,
        scale: 0.25,
      });
      for (const still of stills) {
        const hash = createHash("sha256")
          .update(await readFile(still))
          .digest("hex")
          .slice(0, 12);
        console.log(`${look.padEnd(10)} ${ratio.padEnd(5)} ${path.basename(still).padEnd(28)} ${hash}`);
      }
      await runFfmpeg([
        "-y",
        "-pattern_type",
        "glob",
        "-i",
        path.join(stillDirectory, "*.jpg"),
        "-filter_complex",
        `tile=${stills.length}x1:padding=8:color=0x333333`,
        "-frames:v",
        "1",
        path.join(outputDirectory, `${look}-${ratio.replace(":", "x")}.jpg`),
      ]);
    } catch (error) {
      failures.push(`${look} ${ratio}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} combinations failed:\n${failures.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`\n✔ Every block rendered in every allowed look × ratio. Contact sheets in ${outputDirectory}`);
}
