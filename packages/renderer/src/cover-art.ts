import { runFfmpeg } from "./ffmpeg";

export interface EmbedCoverArtOptions {
  videoPath: string;
  coverJpgPath: string;
  outputPath: string;
}

/** Embeds the thumbnail as MP4 cover art (attached picture). */
export async function embedCoverArt(options: EmbedCoverArtOptions): Promise<void> {
  await runFfmpeg([
    "-y",
    "-i",
    options.videoPath,
    "-i",
    options.coverJpgPath,
    "-map",
    "0",
    "-map",
    "1",
    "-c",
    "copy",
    "-c:v:1",
    "mjpeg",
    "-disposition:v:1",
    "attached_pic",
    "-movflags",
    "+faststart",
    options.outputPath,
  ]);
}
