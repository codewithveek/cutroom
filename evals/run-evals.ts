/**
 * Eval harness (PRD §7.17): ingest → analyse → plan → audit (→ render) on pinned fixtures, per model.
 *   pnpm eval                                   # MODEL_ID from the environment, every fixture
 *   pnpm eval --models gemma4:e2b,gemma4:e4b --fixtures shipnote,vercel-serve
 *   pnpm eval --scripted --fixtures shipnote    # harness self-test without a model
 * Writes evals/results/<date>-<model>.json and .md. Run manually; not part of CI.
 * Render success is covered by the pipeline's end-to-end test and `cutroom make`.
 */
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { analyzeProduct, brandFromBrief, planStoryboard } from "@cutroom/agent";
import { auditClaims } from "@cutroom/claim-audit";
import { loadEnv } from "@cutroom/config";
import { createShipnoteScriptedTransport } from "@cutroom/pipeline";
import { createModelClient, type ModelClient } from "@cutroom/providers";
import { ingestRepository } from "@cutroom/repo-ingest";
import { repoSourceSchema } from "@cutroom/scene-spec";
import { lookTokensById } from "@cutroom/video-kit";
import { z } from "zod";
import { type FixtureEvalResult, formatResultsTable, verdictCounts } from "./eval-metrics";

const fixturesFileSchema = z.object({
  fixtures: z.array(z.object({ id: z.string(), kind: z.string(), source: repoSourceSchema })),
});

const { values } = parseArgs({
  options: {
    models: { type: "string" },
    fixtures: { type: "string" },
    scripted: { type: "boolean", default: false },
  },
});

const env = loadEnv();
const repoRoot = path.resolve(import.meta.dirname, "..");
const { fixtures } = fixturesFileSchema.parse(
  JSON.parse(await readFile(path.join(repoRoot, "evals/fixtures.json"), "utf8")),
);
const selectedFixtures = values.fixtures
  ? fixtures.filter((fixture) => values.fixtures?.split(",").includes(fixture.id))
  : fixtures;
const modelIds = values.scripted
  ? ["scripted-shipnote"]
  : (values.models ?? env.MODEL_ID).split(",").map((id) => id.trim());

function createEvalModel(modelId: string): ModelClient {
  return createModelClient({
    mode: "local",
    env: { ...env, MODEL_ID: modelId },
    ...(values.scripted ? { transportOverride: createShipnoteScriptedTransport() } : {}),
  });
}

async function timed<Result>(work: () => Promise<Result>): Promise<{ result: Result; seconds: number }> {
  const startedAt = performance.now();
  const result = await work();
  return { result, seconds: (performance.now() - startedAt) / 1000 };
}

async function evaluateFixture(
  fixture: (typeof fixtures)[number],
  modelId: string,
): Promise<FixtureEvalResult> {
  const startedAt = performance.now();
  const model = createEvalModel(modelId);
  const evaluation: FixtureEvalResult = { fixtureId: fixture.id, modelId, ok: false, totalSeconds: 0 };
  let step = "ingest";
  try {
    const source =
      fixture.source.kind === "path"
        ? { ...fixture.source, path: path.resolve(repoRoot, fixture.source.path) }
        : fixture.source;
    const { reader } = await ingestRepository({
      source,
      outputDirectory: await mkdtemp(path.join(tmpdir(), `cutroom-eval-${fixture.id}-`)),
    });
    evaluation.files = reader.snapshot.stats.keptFiles;
    step = "analyze-product";
    const analysis = await timed(() =>
      analyzeProduct({ reader, model, contextBudgetTokens: env.MODEL_CONTEXT_BUDGET_TOKENS }),
    );
    const report = analysis.result.evidenceReport;
    const evidenceTotal = report.verified + report.relocated + report.rejected.length;
    evaluation.brief = {
      features: analysis.result.brief.features.length,
      evidenceTotal,
      evidenceValid: report.verified + report.relocated,
      attempts: analysis.result.attempts,
      seconds: analysis.seconds,
      tokens: analysis.result.usage.inputTokens + analysis.result.usage.outputTokens,
    };
    step = "plan-storyboard";
    const brief = analysis.result.brief;
    const plan = await timed(() =>
      planStoryboard({
        brief,
        reader,
        model,
        videoType: "launch",
        look: "editorial",
        paceSeconds: lookTokensById.editorial.paceSeconds,
        targetSeconds: 45,
        brand: brandFromBrief({ brief, hints: reader.snapshot.brandHints }),
        seed: 1,
      }),
    );
    evaluation.storyboard = {
      scenes: plan.result.storyboard.scenes.length,
      attempts: plan.result.attempts,
      firstTryValid: plan.result.attempts === 1,
      seconds: plan.seconds,
      tokens: plan.result.usage.inputTokens + plan.result.usage.outputTokens,
    };
    step = "audit-claims";
    const audit = await timed(() =>
      auditClaims({ storyboard: plan.result.storyboard, reader, brief, model }),
    );
    evaluation.audit = {
      ...verdictCounts(audit.result.results),
      judged: audit.result.judgedClaims,
      seconds: audit.seconds,
      tokens: audit.result.usage.inputTokens + audit.result.usage.outputTokens,
    };
    evaluation.ok = true;
  } catch (error) {
    evaluation.failedStep = step;
    evaluation.error = error instanceof Error ? error.message : String(error);
  }
  evaluation.totalSeconds = (performance.now() - startedAt) / 1000;
  return evaluation;
}

const date = new Date().toISOString().slice(0, 10);
await mkdir(path.join(repoRoot, "evals/results"), { recursive: true });
for (const modelId of modelIds) {
  const results: FixtureEvalResult[] = [];
  for (const fixture of selectedFixtures) {
    console.log(`▸ ${modelId} · ${fixture.id}`);
    const result = await evaluateFixture(fixture, modelId);
    results.push(result);
    console.log(
      result.ok ? `  ✔ ${result.totalSeconds.toFixed(0)} s` : `  ✘ ${result.failedStep}: ${result.error}`,
    );
  }
  const fileStem = path.join(repoRoot, "evals/results", `${date}-${modelId.replaceAll(/[^\w.-]/g, "_")}`);
  await writeFile(`${fileStem}.json`, JSON.stringify({ date, modelId, results }, null, 2));
  const table = formatResultsTable(results);
  await writeFile(`${fileStem}.md`, `# Eval · ${modelId} · ${date}\n\n${table}\n`);
  console.log(`\n${table}\n\nWrote ${fileStem}.json and .md`);
}
