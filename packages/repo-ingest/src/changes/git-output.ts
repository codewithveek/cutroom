import { spawn } from "node:child_process";
import { SourceError } from "../source";

const MAX_OUTPUT_BYTES = 20 * 1024 * 1024;

/** Runs git in a repository and returns stdout; any failure becomes a SourceError. */
export function gitOutput(repoDirectory: string, args: ReadonlyArray<string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["-C", repoDirectory, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    const chunks: Buffer[] = [];
    let size = 0;
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size <= MAX_OUTPUT_BYTES) chunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => reject(new SourceError(`Could not run git: ${error.message}`)));
    child.on("close", (exitCode) =>
      exitCode === 0
        ? resolve(Buffer.concat(chunks).toString("utf8"))
        : reject(new SourceError(`git ${args[0]} failed: ${stderr.trim().slice(-400)}`)),
    );
  });
}

/** Writes the tracked files of one commit into a directory (`git archive | tar -x`). */
export function extractCommitTree(options: {
  repoDirectory: string;
  sha: string;
  outputDirectory: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const archive = spawn("git", ["-C", options.repoDirectory, "archive", "--format=tar", options.sha], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const extract = spawn("tar", ["-x", "-C", options.outputDirectory], {
      stdio: ["pipe", "ignore", "pipe"],
    });
    archive.stdout.pipe(extract.stdin);
    let stderr = "";
    archive.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    extract.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    archive.on("error", (error) => reject(new SourceError(`Could not run git archive: ${error.message}`)));
    extract.on("error", (error) => reject(new SourceError(`Could not run tar: ${error.message}`)));
    extract.on("close", (exitCode) =>
      exitCode === 0
        ? resolve()
        : reject(new SourceError(`Extracting ${options.sha} failed: ${stderr.trim().slice(-400)}`)),
    );
  });
}
