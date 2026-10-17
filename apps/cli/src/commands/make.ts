import type { CutroomEnv } from "@cutroom/config";
import { createLogger } from "@cutroom/observability";
import {
  createPipelineServices,
  createShipnoteScriptedTransport,
  InProcessRunner,
  latestStoryboardVersion,
  type RunRecord,
} from "@cutroom/pipeline";
import { createSilentProvider } from "@cutroom/voice";
import { buildRunRequest, type MakeFlags } from "../make-options";
import { printStoryboard, promptForApproval } from "../review-prompt";
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

/** `cutroom make`: the same pipeline and contracts as the web app, in a terminal (PRD §6.2). */
export async function runMake(flags: MakeFlags, env: CutroomEnv): Promise<number> {
  const services = createPipelineServices({
    env,
    logger: createLogger({ level: env.LOG_LEVEL === "info" ? "warn" : env.LOG_LEVEL }),
    overrides: {
      enforceLocalEgress: true,
      ...(flags.scripted ? { modelTransportOverride: createShipnoteScriptedTransport() } : {}),
      ...(flags.silent ? { voiceProviderOverride: createSilentProvider() } : {}),
    },
  });
  const runner = new InProcessRunner(services);
  const request = buildRunRequest(flags);
  const { runId } = await runner.start(request);
  console.log(
    `Run ${runId} · ${request.videoType} · ${request.ratios.join(", ")} · ${request.privacyMode} mode`,
  );
  let unsubscribe = runner.subscribe(runId, printEvent);
  try {
    let run = await runner.waitForStatus(runId, ["awaiting_review", "completed"]);
    const version = latestStoryboardVersion(run);
    if (version) printStoryboard(version);
    if (run.status === "awaiting_review" && version) {
      unsubscribe();
      const approval = await promptForApproval(version);
      if (!approval) return 2;
      unsubscribe = runner.subscribe(runId, printEvent);
      await runner.approveStoryboard(runId, approval);
      run = await runner.waitForStatus(runId, ["completed"]);
    }
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
