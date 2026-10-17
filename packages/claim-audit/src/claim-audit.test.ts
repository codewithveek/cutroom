import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createModelClientFromTransport,
  createScriptedTransport,
  type JsonCompletionRequest,
} from "@cutroom/providers";
import { ingestRepository, type SnapshotReader } from "@cutroom/repo-ingest";
import {
  type ClaimResult,
  type ProductBrief,
  type StoryboardInput,
  storyboardSchema,
} from "@cutroom/scene-spec";
import { beforeAll, describe, expect, it } from "vitest";
import {
  ApprovalBlockedError,
  applyOverrides,
  assertApprovable,
  findApprovalBlockers,
} from "./approval-gate";
import { auditClaims } from "./audit-claims";
import { formatAuditTable } from "./format-audit-table";
import { findOverclaims } from "./overclaim-lexicon";

const shipnoteFixture = path.resolve(import.meta.dirname, "../../../evals/fixtures/shipnote");
let reader: SnapshotReader;

const brief: ProductBrief = {
  name: "Shipnote",
  tagline: "Release notes from your commits",
  audience: "Maintainers",
  problem: "Release notes take time",
  promise: "Draft a changelog from commits",
  features: [
    {
      title: "Group commits by type",
      description: "Groups commits into feat, fix and perf",
      evidence: [
        {
          filePath: "src/group-commits.ts",
          lineStart: 5,
          lineEnd: 5,
          excerpt: 'export const commitTypes = ["feat", "fix", "perf"];',
        },
      ],
      strength: "verified",
    },
  ],
};

const storyboardInput: StoryboardInput = {
  id: "sb",
  title: "Audit test",
  videoType: "launch",
  look: "editorial",
  brand: { name: "Shipnote" },
  scenes: [
    {
      id: "code-ok",
      block: "code-card",
      baseFrames: 90,
      props: {
        filePath: "src/group-commits.ts",
        language: "ts",
        lineStart: 5,
        lineEnd: 5,
        code: 'export const commitTypes = ["feat", "fix", "perf"];',
      },
      narration: [{ text: "Commits are grouped by type." }],
    },
    {
      id: "code-bad",
      block: "code-card",
      baseFrames: 90,
      props: {
        filePath: "src/group-commits.ts",
        language: "ts",
        lineStart: 5,
        lineEnd: 5,
        code: 'export const commitTypes = ["feat", "fix", "docs"];',
      },
    },
    {
      id: "headline",
      block: "kinetic-headline",
      baseFrames: 90,
      props: { lines: ['Click "Export PDF" to share', "Works *anywhere* you ship"], tone: "promise" },
    },
    {
      id: "number",
      block: "big-number",
      baseFrames: 90,
      props: { label: "Teams onboarded", value: 1200, format: "integer", line: "and counting" },
    },
    {
      id: "terminal",
      block: "terminal",
      baseFrames: 90,
      props: { commands: [{ command: "npx shipnote draft", output: ["Wrote CHANGELOG.md"] }] },
    },
    {
      id: "close",
      block: "end-card",
      baseFrames: 90,
      props: { name: "Shipnote", tagline: "Release notes from your commits", cta: "npx shipnote draft" },
    },
  ],
};

function judgeResponder(request: JsonCompletionRequest) {
  const prompt = request.messages[0]?.content ?? "";
  const claimIds = [...prompt.matchAll(/- id: (\S+)/g)].map((match) => match[1] ?? "");
  return {
    verdicts: claimIds.map((claimId) =>
      claimId === "code-ok:narration.0.text"
        ? {
            claimId,
            verdict: "supported",
            reason: "groupCommits groups by type",
            evidence: [
              {
                filePath: "src/group-commits.ts",
                lineStart: 2,
                lineEnd: 2,
                excerpt: "return Object.groupBy(commits, (commit) => commit.type);",
              },
            ],
          }
        : {
            claimId,
            verdict: "supported",
            reason: "looks fine",
            evidence: [{ filePath: "src/made-up.ts", lineStart: 1, lineEnd: 1, excerpt: "nope" }],
          },
    ),
  };
}

let results: ClaimResult[] = [];
let judgeRequests: JsonCompletionRequest[] = [];

beforeAll(async () => {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-audit-"));
  ({ reader } = await ingestRepository({ source: { kind: "path", path: shipnoteFixture }, outputDirectory }));
  const transport = createScriptedTransport(judgeResponder);
  ({ results } = await auditClaims({
    storyboard: storyboardSchema.parse(storyboardInput),
    reader,
    brief,
    model: createModelClientFromTransport(transport),
  }));
  judgeRequests = transport.requests;
});

function resultFor(claimId: string): ClaimResult | undefined {
  return results.find((result) => result.claimId === claimId);
}

describe("auditClaims · deterministic checks", () => {
  it("accepts an exact code excerpt and rejects an edited one", () => {
    expect(resultFor("code-ok:props.code")?.verdict).toBe("supported");
    expect(resultFor("code-bad:props.code")).toMatchObject({ verdict: "unsupported" });
  });

  it("rejects quoted UI labels that do not exist and flags overclaims as weak", () => {
    expect(resultFor("headline:props.lines.0")?.verdict).toBe("unsupported");
    const overclaim = resultFor("headline:props.lines.1");
    expect(overclaim?.verdict).toBe("weak");
    expect(overclaim?.suggestion).toContain("anywhere");
  });

  it("rejects numbers that are not in the code", () => {
    expect(resultFor("number:props.value")?.verdict).toBe("unsupported");
  });

  it("accepts README commands, real output and the product name without a model call", () => {
    expect(resultFor("terminal:props.commands.0.command")?.verdict).toBe("supported");
    expect(resultFor("terminal:props.commands.0.output.0")?.verdict).toBe("supported");
    expect(resultFor("close:props.cta")?.verdict).toBe("supported");
    const judgedPrompt = judgeRequests.map((request) => request.messages[0]?.content ?? "").join("\n");
    expect(judgedPrompt).not.toContain("close:props.cta");
    expect(judgedPrompt).not.toContain("code-ok:props.code");
  });
});

describe("auditClaims · model judge", () => {
  it("keeps a supported verdict whose evidence verifies", () => {
    const narration = resultFor("code-ok:narration.0.text");
    expect(narration?.verdict).toBe("supported");
    expect(narration?.evidence[0]?.filePath).toBe("src/group-commits.ts");
  });

  it("downgrades a supported verdict whose evidence is invented", () => {
    expect(resultFor("close:props.tagline")?.verdict).toBe("weak");
  });

  it("sends retrieved snippets with line numbers", () => {
    expect(judgeRequests[0]?.messages[0]?.content).toMatch(/src\/group-commits\.ts\n\s+\d+\| /);
  });
});

describe("approval gate", () => {
  it("blocks on unsupported claims until each one is overridden with a reason", () => {
    const blockers = findApprovalBlockers(results, []);
    expect(blockers.map((blocker) => blocker.claimId).sort()).toEqual(
      ["code-bad:props.code", "headline:props.lines.0", "number:props.value"].sort(),
    );
    expect(() => assertApprovable(results, [])).toThrow(ApprovalBlockedError);
    const overrides = blockers.map((blocker) => ({
      claimId: blocker.claimId,
      reason: "Shown as an illustrative mock-up",
    }));
    expect(() => assertApprovable(results, overrides)).not.toThrow();
    expect(applyOverrides(results, overrides).filter((result) => result.overrideReason)).toHaveLength(3);
  });

  it("formats a table with counts", () => {
    const table = formatAuditTable(results, new Map([["code-ok", 1]]));
    expect(table).toContain("✘ unsupported");
    expect(table).toMatch(/\d+ supported · \d+ weak · 3 unsupported/);
  });
});

describe("findOverclaims", () => {
  it("ignores qualified absolutes", () => {
    expect(findOverclaims("Works with all three commit types")).toEqual([]);
    expect(findOverclaims("Secure by default")).toEqual([]);
    expect(findOverclaims("Instantly ships everything").map((hit) => hit.word)).toEqual(["instantly"]);
  });
});
