import { spawn } from "node:child_process";
import { mkdtemp, realpath, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { RepoSource } from "@cutroom/scene-spec";

export { type RepoSource, repoSourceSchema } from "@cutroom/scene-spec";

export class SourceError extends Error {
  override readonly name = "SourceError";
}

const allowedGitUrl = /^(https:\/\/[\w.-]+\/[\w./-]+?(\.git)?|git@[\w.-]+:[\w./-]+?(\.git)?)$/;
const allowedGitRef = /^[\w./-]{1,100}$/;

function runGit(args: ReadonlyArray<string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      stdio: ["ignore", "ignore", "pipe"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => reject(new SourceError(`Could not run git: ${error.message}`)));
    child.on("close", (exitCode) =>
      exitCode === 0
        ? resolve()
        : reject(new SourceError(`git ${args[0]} failed: ${stderr.trim().slice(-400)}`)),
    );
  });
}

const commitSha = /^[0-9a-f]{40}$/;

/** A shallow fetch of one commit: how eval fixtures stay pinned (FR-EV-1). */
async function cloneAtCommit(options: { url: string; sha: string; rootDirectory: string }): Promise<void> {
  await runGit(["init", "--quiet", options.rootDirectory]);
  await runGit(["-C", options.rootDirectory, "remote", "add", "origin", "--", options.url]);
  await runGit(["-C", options.rootDirectory, "fetch", "--depth", "1", "--quiet", "origin", options.sha]);
  await runGit(["-C", options.rootDirectory, "checkout", "--quiet", "FETCH_HEAD"]);
}

export interface ResolvedSource {
  rootDirectory: string;
  rootName: string;
  isTemporary: boolean;
}

/** A local path (must exist and be a directory) or a shallow clone into a temp workspace (FR-ING-1). */
export async function resolveSource(source: RepoSource): Promise<ResolvedSource> {
  if (source.kind === "path") {
    const rootDirectory = await realpath(path.resolve(source.path)).catch(() => {
      throw new SourceError(`Path not found: ${source.path}`);
    });
    if (!(await stat(rootDirectory)).isDirectory()) throw new SourceError(`Not a directory: ${source.path}`);
    return { rootDirectory, rootName: path.basename(rootDirectory), isTemporary: false };
  }
  if (!allowedGitUrl.test(source.url)) throw new SourceError(`Unsupported git URL: ${source.url}`);
  if (source.ref && !allowedGitRef.test(source.ref))
    throw new SourceError(`Unsupported git ref: ${source.ref}`);
  const workspace = await mkdtemp(path.join(tmpdir(), "cutroom-clone-"));
  const rootDirectory = path.join(workspace, "repo");
  if (source.ref && commitSha.test(source.ref)) {
    await cloneAtCommit({ url: source.url, sha: source.ref, rootDirectory });
  } else {
    const branchArgs = source.ref ? ["--branch", source.ref] : [];
    await runGit([
      "clone",
      "--depth",
      "1",
      "--single-branch",
      ...branchArgs,
      "--",
      source.url,
      rootDirectory,
    ]);
  }
  const rootName = path.basename(source.url).replace(/\.git$/, "");
  return { rootDirectory, rootName, isTemporary: true };
}
