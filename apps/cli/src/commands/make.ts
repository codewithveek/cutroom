import type { CutroomEnv } from "@cutroom/config";
import { createLogger } from "@cutroom/observability";
import {
  createPipelineServices,
  createShipnoteScriptedTransport,
  dataPaths,
  InProcessRunner,
  latestStoryboardVersion,
  type RunRecord,
} from "@cutroom/pipeline";
import { createSilentProvider } from "@cutroom/voice";
import { buildRunRequest, type MakeFlags } from "../make-options";
import { findPrebuiltBundle } from "../package-assets";
import { runPreflight } from "../preflight";
import { prepareRenderBrowser } from "../render-browser";
import { printEgressManifest, printStoryboard, promptForApproval, promptForEgress } from "../review-prompt";
import { isZipPath, stageArchive } from "../stage-archive";
import { printEvent } from "../terminal-ui";

function printDeliverables(run: RunRecord): void {
  console.log("\nDeliverables");
  for (const asset of run.assets.filter((candidate) => candidate.kind !== "still")) {
    const duration = asset.durationMs ? ` · ${(asset.durationMs / 1000).toFixed(1)} s` : "";
    console.log(
      `  ${asset.kind.padEnd(14)} ${asset.ratio?.padEnd(5) ?? "     "} ${asset.filePath}${duration}`,
    );
  }
  if (run.request.privacyMode === "local") console.log("\n✔ Ran fully local: no outbound network calls.\n");
}

export interface RunMakeOptions {
  flags: MakeFlags;
  env: CutroomEnv;
  /** Where the CLI's entry file lives; the published package keeps its Remotion bundle there. */
  entryDirectory: string;
}

/**
 * Hybrid mode: shows the egress manifest and, when the run waits on it, asks before anything leaves
 * the machine. Undefined when the user declines.
 */
async function confirmEgressIfAsked(options: {
  runner: InProcessRunner;
  run: RunRecord;
}): Promise<RunRecord | undefined> {
  const { runner, run } = options;
  if (!run.egress) return run;
  printEgressManifest(run.egress);
  if (run.status !== "awaiting_egress") return run;
  if (!(await promptForEgress())) return undefined;
  await runner.confirmEgress(run.id, run.egress.manifestSha256);
  return runner.waitForStatus(run.id, ["completed"]);
}

/** `cutroom make`: the same pipeline and contracts as the web app, in a terminal (PRD §6.2). */
export async function runMake(options: RunMakeOptions): Promise<number> {
  const { flags, env } = options;
  const problems = await runPreflight({ flags, env });
  if (problems.length > 0) {
    for (const problem of problems) console.error(`✘ ${problem}`);
    return 1;
  }
  const prebuiltBundleDirectory = findPrebuiltBundle(options.entryDirectory);
  const services = createPipelineServices({
    env,
    logger: createLogger({ level: env.LOG_LEVEL === "info" ? "warn" : env.LOG_LEVEL }),
    overrides: {
      enforceLocalEgress: true,
      ...(prebuiltBundleDirectory ? { prebuiltBundleDirectory } : {}),
      ...(flags.scripted ? { modelTransportOverride: createShipnoteScriptedTransport() } : {}),
      ...(flags.silent ? { voiceProviderOverride: createSilentProvider() } : {}),
    },
  });
  await prepareRenderBrowser(services.browserExecutable);
  const runner = new InProcessRunner(services);
  const request = buildRunRequest(
    flags,
    isZipPath(flags.repo)
      ? await stageArchive({
          archivePath: flags.repo,
          uploadsDirectory: dataPaths(services.dataDirectory).uploads,
        })
      : undefined,
  );
  const { runId } = await runner.start(request);
  console.log(
    `Run ${runId} · ${request.videoType} · ${request.ratios.join(", ")} · ${request.privacyMode} mode`,
  );
  let storyboardPrinted = false;
  const printStoryboardOnce = async () => {
    const current = await runner.getRun(runId);
    const latest = current ? latestStoryboardVersion(current) : undefined;
    if (latest && !storyboardPrinted) {
      storyboardPrinted = true;
      printStoryboard(latest);
    }
  };
  const onEvent = (event: Parameters<typeof printEvent>[0]) => {
    printEvent(event);
    // With --yes the run does not pause, so show what is about to be rendered as soon as it is audited.
    if (event.step === "review" && event.kind === "completed") void printStoryboardOnce();
  };
  let unsubscribe = runner.subscribe(runId, onEvent);
  try {
    let run = await runner.waitForStatus(runId, ["awaiting_review", "awaiting_egress", "completed"]);
    const version = latestStoryboardVersion(run);
    if (run.status === "awaiting_review") await printStoryboardOnce();
    if (run.status === "awaiting_review" && version) {
      unsubscribe();
      const approval = await promptForApproval(version);
      if (!approval) return 2;
      unsubscribe = runner.subscribe(runId, onEvent);
      await runner.approveStoryboard(runId, approval);
      run = await runner.waitForStatus(runId, ["completed", "awaiting_egress"]);
    }
    const afterEgress = await confirmEgressIfAsked({ runner, run });
    if (!afterEgress) return 2;
    run = afterEgress;
    await runner.settled(runId);
    run = (await runner.getRun(runId)) ?? run;
    if (run.status === "failed") {
      console.error(`\n✘ ${run.error?.code}: ${run.error?.message}`);
      return 1;
    }
    printDeliverables(run);
    return 0;
  } finally {
    unsubscribe();
  }
}
