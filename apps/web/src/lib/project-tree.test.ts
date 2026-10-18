import { describe, expect, it } from "vitest";
import type { RunView } from "./api-client";
import { buildProjectTree, runActivity, sourceLabel } from "./project-tree";

function run(options: { id: string; source: RunView["request"]["source"]; createdAt: string }): RunView {
  return {
    id: options.id,
    status: "completed",
    request: { source: options.source, videoType: "launch" },
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
  } as unknown as RunView;
}

describe("buildProjectTree", () => {
  it("groups videos by source, newest first", () => {
    const tree = buildProjectTree([
      run({ id: "a", source: { kind: "path", path: "/code/shipnote" }, createdAt: "2026-10-01" }),
      run({
        id: "b",
        source: { kind: "git", url: "https://github.com/x/serve.git" },
        createdAt: "2026-10-02",
      }),
      run({ id: "c", source: { kind: "path", path: "/code/shipnote/" }, createdAt: "2026-10-03" }),
    ]);
    expect(tree.map((project) => project.label)).toEqual(["shipnote", "serve"]);
    expect(tree[0]?.videos.map((video) => video.id)).toEqual(["c", "a"]);
  });

  it("labels sources by their last segment and maps statuses to activity", () => {
    expect(sourceLabel({ kind: "git", url: "git@github.com:vercel/serve.git" })).toBe("serve");
    expect(runActivity({ status: "awaiting_review" })).toBe("needs-you");
    expect(runActivity({ status: "rendering" })).toBe("working");
  });
});
