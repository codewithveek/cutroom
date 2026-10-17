import { spawn } from "node:child_process";

export class FfmpegError extends Error {
  override readonly name = "FfmpegError";
  readonly stderrTail: string;

  constructor(message: string, stderrTail: string) {
    super(message);
    this.stderrTail = stderrTail;
  }
}

export interface FfmpegResult {
  stderr: string;
}

export function ffmpegBinary(): string {
  return process.env.FFMPEG_PATH ?? "ffmpeg";
}

/** Runs ffmpeg with an argument list (never a shell string) and returns stderr. */
export function runFfmpeg(args: ReadonlyArray<string>): Promise<FfmpegResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBinary(), ["-hide_banner", "-nostdin", ...args], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    const stderrChunks: Buffer[] = [];
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", (error) => reject(new FfmpegError(`Could not start ffmpeg: ${error.message}`, "")));
    child.on("close", (exitCode) => {
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      if (exitCode === 0) resolve({ stderr });
      else reject(new FfmpegError(`ffmpeg exited with code ${exitCode}`, stderr.slice(-2000)));
    });
  });
}
