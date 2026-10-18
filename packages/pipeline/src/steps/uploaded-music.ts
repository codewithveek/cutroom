import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { runFfmpeg } from "@cutroom/renderer";
import { audioAssetKeys } from "@cutroom/video-kit";

export const UPLOADED_MUSIC_FILE = "music.wav";

/** Where a run keeps its uploaded music, as the WAV the renderer mixes. */
export function uploadedMusicPath(runDirectory: string): string {
  return path.join(runDirectory, "media", UPLOADED_MUSIC_FILE);
}

/**
 * Transcodes any ffmpeg-readable track to 48 kHz stereo WAV (the headless render browser cannot
 * decode every codec), video streams dropped. Fails with ffmpeg's reason when it is not audio.
 */
export async function transcodeMusic(options: { sourcePath: string; runDirectory: string }): Promise<string> {
  const target = uploadedMusicPath(options.runDirectory);
  await mkdir(path.dirname(target), { recursive: true });
  try {
    await runFfmpeg(["-y", "-i", options.sourcePath, "-vn", "-ac", "2", "-ar", "48000", "-t", "600", target]);
  } catch (error) {
    await rm(target, { force: true });
    throw error;
  }
  return target;
}

export const uploadedMusicAssetKey = audioAssetKeys.music;
