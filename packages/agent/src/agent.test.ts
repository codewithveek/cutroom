import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createModelClientFromTransport, createScriptedTransport } from "@cutroom/providers";
import { ingestRepository, type SnapshotReader, verifyEvidence } from "@cutroom/repo-ingest";
import { beforeAll, describe, expect, it } from "vitest";
import { shipnoteBriefDraft, shipnoteStoryboardDraft } from "./shipnote-fixture-drafts";
import { analyzeProduct } from "./steps/analyze-product";
import { brandFromBrief } from "./steps/assemble-storyboard";
import { planStoryboard } from "./steps/plan-storyboard";
import { storyboardDraftIssues } from "./validation/word-budget";

const shipnoteFixture = path.resolve(import.meta.dirname, "../../../evals/fixtures/shipnote");
let reader: SnapshotReader;

beforeAll(async () => {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-agent-"));
  ({ reader } = await ingestRepository({ source: { kind: "path", path: shipnoteFixture }, outputDirectory }));
});

describe("verifyEvidence", () => {
  it("verifies, relocates or rejects", async () => {
    const [grouped, changelog, missing] = shipnoteBriefDraft.features.map((feature) => feature.evidence[0]);
    if (!grouped || !changelog || !missing) throw new Error("fixture drift");
    expect((await verifyEvidence(reader, grouped)).status).toBe("verified");
    const relocated = await verifyEvidence(reader, changelog);
    expect(relocated).toMatchObject({ status: "relocated", evidence: { lineStart: 10, lineEnd: 10 } });
    expect(await verifyEvidence(reader, missing)).toMatchObject({ status: "rejected" });
    expect(await verifyEvidence(reader, { ...grouped, excerpt: "return everything;" })).toMatchObject({
      status: "rejected",
    });
  });
});

describe("analyzeProduct", () => {
  it("returns a brief with verified evidence and marks unsupported features weak", async () => {
    const transport = createScriptedTransport(() => shipnoteBriefDraft);
    const result = await analyzeProduct({
      reader,
      model: createModelClientFromTransport(transport),
      contextBudgetTokens: 24_000,
    });
    expect(result.brief.name).toBe("Shipnote");
    expect(result.brief.features.map((feature) => feature.strength)).toEqual([
      "verified",
      "verified",
      "weak",
    ]);
    expect(result.evidenceReport).toMatchObject({ verified: 1, relocated: 1 });
    expect(result.evidenceReport.rejected).toHaveLength(1);
    const prompt = transport.requests[0]?.messages[0]?.content ?? "";
    expect(prompt).toContain("=== README.md");
    expect(prompt).toContain("   1| export function groupCommits");
  });

  it("summarises directories when the repo does not fit the budget", async () => {
    const transport = createScriptedTransport((request) =>
      request.schemaName === "directory_summary"
        ? { summary: "Commit parsing and changelog writing.", candidateFeatures: [] }
        : shipnoteBriefDraft,
    );
    const result = await analyzeProduct({
      reader,
      model: createModelClientFromTransport(transport),
      contextBudgetTokens: 6_500,
    });
    expect(transport.requests.some((request) => request.schemaName === "directory_summary")).toBe(true);
    expect(result.summarizedDirectories.length).toBeGreaterThan(0);
    for (const request of transport.requests) {
      const promptCharacters =
        request.system.length + request.messages.reduce((sum, message) => sum + message.content.length, 0);
      expect(promptCharacters / 4).toBeLessThan(6_500);
    }
  });
});

describe("storyboardDraftIssues", () => {
  it("accepts the fixture draft", () => {
    expect(storyboardDraftIssues(shipnoteStoryboardDraft, "launch")).toEqual([]);
  });

  it("flags over-budget narration, filler openers, short headlines and a missing end card", () => {
    const [problem, ...rest] = shipnoteStoryboardDraft.scenes;
    if (problem?.block !== "kinetic-headline") throw new Error("fixture drift");
    const broken = {
      ...shipnoteStoryboardDraft,
      scenes: [
        {
          ...problem,
          props: { ...problem.props, lines: ["Too short"] },
          narration: [{ text: "So, release notes take far too long to write by hand every week." }],
        },
        ...rest.slice(0, -1),
      ],
    };
    const issues = storyboardDraftIssues(broken, "launch");
    expect(issues.some((issue) => issue.includes("at most 8"))).toBe(true);
    expect(issues.some((issue) => issue.includes("filler opener"))).toBe(true);
    expect(issues.some((issue) => issue.includes("headline has 2 words"))).toBe(true);
    expect(issues).toContain("The last scene must be an end-card.");
  });
});

describe("planStoryboard", () => {
  it("repairs an over-budget draft, assigns ids and snaps code to the file bytes", async () => {
    const overBudget = structuredClone(shipnoteStoryboardDraft);
    const firstScene = overBudget.scenes[0];
    if (firstScene)
      firstScene.narration = [
        { text: "Writing release notes by hand takes a whole afternoon every release." },
      ];
    const transport = createScriptedTransport((_request, callIndex) =>
      callIndex === 0 ? overBudget : shipnoteStoryboardDraft,
    );
    const { brief } = await analyzeProduct({
      reader,
      model: createModelClientFromTransport(createScriptedTransport(() => shipnoteBriefDraft)),
      contextBudgetTokens: 24_000,
    });
    const result = await planStoryboard({
      brief,
      reader,
      model: createModelClientFromTransport(transport),
      videoType: "launch",
      look: "editorial",
      paceSeconds: [3, 5],
      targetSeconds: 45,
      brand: brandFromBrief({ brief, hints: reader.snapshot.brandHints }),
      seed: 1,
    });
    expect(result.attempts).toBe(2);
    expect(transport.requests[1]?.messages.at(-1)?.content).toContain("at most 8");
    const { storyboard } = result;
    expect(new Set(storyboard.scenes.map((scene) => scene.id)).size).toBe(storyboard.scenes.length);
    const codeScene = storyboard.scenes.find((scene) => scene.block === "code-card");
    expect(codeScene?.block === "code-card" && codeScene.props.code).toBe(
      "export function groupCommits(commits: Commit[]) {\n  return Object.groupBy(commits, (commit) => commit.type);\n}",
    );
    expect(storyboard.scenes[0]?.baseFrames).toBe(90);
  });
});
