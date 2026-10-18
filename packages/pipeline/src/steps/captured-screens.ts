import path from "node:path";
import type { StagedAsset } from "@cutroom/renderer";
import { type CapturedScreen, type Storyboard, screenshotAssetKey } from "@cutroom/scene-spec";
import type { RunRecord } from "../run-schema";

export function captureDirectory(runDirectory: string): string {
  return path.join(runDirectory, "capture");
}

/** The PNG behind a captured screen. The manifest's file name is reduced to a bare name first. */
export function screenshotFilePath(options: { runDirectory: string; screen: CapturedScreen }): string {
  return path.join(captureDirectory(options.runDirectory), path.basename(options.screen.fileName));
}

/** The captured screen a media key names (`screenshot-screen-2`), if the run has it. */
export function screenForAssetKey(run: RunRecord, assetKey: string): CapturedScreen | undefined {
  return run.capture?.screens.find((screen) => screenshotAssetKey(screen.id) === assetKey);
}

/** Screenshots a storyboard shows, staged under their asset keys for a render. */
export function screenshotAssetsFor(options: {
  runDirectory: string;
  run: RunRecord;
  storyboard: Storyboard;
}): StagedAsset[] {
  const shownScreenIds = new Set(
    options.storyboard.scenes.flatMap((scene) =>
      scene.block === "screenshot-window" ? [scene.props.screenId] : [],
    ),
  );
  return (options.run.capture?.screens ?? [])
    .filter((screen) => shownScreenIds.has(screen.id))
    .map((screen) => ({
      assetKey: screenshotAssetKey(screen.id),
      filePath: screenshotFilePath({ runDirectory: options.runDirectory, screen }),
    }));
}
