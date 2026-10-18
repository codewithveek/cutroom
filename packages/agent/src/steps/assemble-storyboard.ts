import type { BrandHints, SnapshotReader } from "@cutroom/repo-ingest";
import { normalizeWhitespace } from "@cutroom/repo-ingest";
import {
  attachScreenView,
  type Brand,
  blockCatalog,
  type CapturedScreen,
  FRAMES_PER_SECOND,
  type LookId,
  type ProductBrief,
  type Scene,
  type SceneDraft,
  type Storyboard,
  type StoryboardDraft,
  sceneSchema,
  storyboardSchema,
  type VideoType,
} from "@cutroom/scene-spec";
import { ulid } from "ulid";

/** Minimum on-screen time before narration stretches it: the look's pace inside the block's range. */
export function baseFramesFor(options: {
  block: Scene["block"];
  paceSeconds: readonly [number, number];
}): number {
  const [blockMinimum, blockMaximum] = blockCatalog[options.block].durationRangeSeconds;
  const seconds = Math.min(blockMaximum, Math.max(blockMinimum, options.paceSeconds[0]));
  return Math.round(seconds * FRAMES_PER_SECOND);
}

export type BrandOverride = { [Key in keyof Brand]?: Brand[Key] | undefined };

function definedEntries(override: BrandOverride): Partial<Brand> {
  return Object.fromEntries(Object.entries(override).filter((entry) => entry[1] !== undefined));
}

export function brandFromBrief(options: {
  brief: ProductBrief;
  hints: BrandHints;
  override?: BrandOverride;
}): Brand {
  const url = options.hints.homepage?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return {
    name: options.brief.name,
    tagline: options.brief.tagline,
    ...(options.hints.accentColor ? { accentColor: options.hints.accentColor } : {}),
    ...(options.hints.fontFamily ? { fontFamily: options.hints.fontFamily } : {}),
    ...(url && url.length <= 80 ? { url } : {}),
    ...definedEntries(options.override ?? {}),
  };
}

/**
 * Code cards must match the file byte-for-byte. When the model's excerpt matches the cited
 * lines up to whitespace, snap it to the exact bytes; otherwise leave it for the claim audit.
 */
async function snapCodeToSource(scene: SceneDraft, reader: SnapshotReader): Promise<SceneDraft> {
  if (scene.block !== "code-card") return scene;
  const exactLines = await reader.readLines({
    filePath: scene.props.filePath,
    lineStart: scene.props.lineStart,
    lineEnd: scene.props.lineEnd,
  });
  if (exactLines === undefined || exactLines === scene.props.code) return scene;
  if (normalizeWhitespace(exactLines) !== normalizeWhitespace(scene.props.code)) return scene;
  return { ...scene, props: { ...scene.props, code: exactLines } };
}

export interface AssembleSceneOptions {
  draftScene: SceneDraft;
  paceSeconds: readonly [number, number];
  reader: SnapshotReader;
  /** Keep an existing id (scene regeneration); a new ULID otherwise. */
  sceneId?: string;
  /** Captured screens, for screenshot-window scenes' image size and focus box. */
  screens?: ReadonlyArray<CapturedScreen> | undefined;
}

/** One draft scene → a Scene with an id, base frames and exact code bytes. */
export async function assembleScene(options: AssembleSceneOptions): Promise<Scene> {
  const snapped = attachScreenView({
    scene: await snapCodeToSource(options.draftScene, options.reader),
    screens: options.screens ?? [],
  });
  return sceneSchema.parse({
    ...snapped,
    id: options.sceneId ?? ulid(),
    baseFrames: baseFramesFor({ block: snapped.block, paceSeconds: options.paceSeconds }),
  });
}

export interface AssembleStoryboardOptions {
  draft: StoryboardDraft;
  videoType: VideoType;
  look: LookId;
  paceSeconds: readonly [number, number];
  brand: Brand;
  reader: SnapshotReader;
  seed: number;
  storyboardId?: string;
  screens?: ReadonlyArray<CapturedScreen> | undefined;
}

/** Turns a validated draft into a Storyboard: ids, base frames, brand and exact code bytes. */
export async function assembleStoryboard(options: AssembleStoryboardOptions): Promise<Storyboard> {
  const scenes: Scene[] = [];
  for (const draftScene of options.draft.scenes) {
    scenes.push(
      await assembleScene({
        draftScene,
        paceSeconds: options.paceSeconds,
        reader: options.reader,
        screens: options.screens,
      }),
    );
  }
  return storyboardSchema.parse({
    id: options.storyboardId ?? ulid(),
    title: options.draft.title,
    videoType: options.videoType,
    look: options.look,
    brand: options.brand,
    seed: options.seed,
    scenes,
  });
}
