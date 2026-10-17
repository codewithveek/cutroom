export { audioAssetKeys } from "./audio/audio-asset-keys";
export { musicLevelsFor, musicVolumeAt } from "./audio/music-levels";
export {
  type CompositionMetadata,
  calculateThumbnailMetadata,
  calculateVideoMetadata,
  compositionIds,
} from "./compositions/calculate-metadata";
export { createPreviewVideoProps, fixtureStoryboard } from "./compositions/default-props";
export { ThumbnailComposition } from "./compositions/thumbnail-composition";
export {
  pickThumbnailScene,
  THUMBNAIL_CAPTURE_FRAME,
  THUMBNAIL_FRAMES,
} from "./compositions/thumbnail-frame";
export { VideoComposition } from "./compositions/video-composition";
export { fontManifest } from "./fonts/font-manifest";
export { loadCutroomFonts } from "./fonts/load-fonts";
export { computeFrameShape, type FrameShape } from "./frame-shape/frame-shape";
export {
  cinematicLook,
  editorialLook,
  graphicLook,
  type LookTokens,
  lookTokensById,
  resolveLook,
  studioLook,
} from "./looks";
export { formatNumber } from "./motion/odometer";
export { resolveSceneTransition } from "./transitions/resolve-transition";

/** File name of the Remotion entry, next to this index; the renderer resolves it on disk. */
export const REMOTION_ENTRY_FILE = "remotion-entry.ts";
