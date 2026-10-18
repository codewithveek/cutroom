import path from "node:path";
import type { CutroomEnv } from "@cutroom/config";
import { createDatabase, PostgresRunStore } from "@cutroom/db";
import type { CutroomLogger } from "@cutroom/observability";
import {
  createPipelineServices,
  createShipnoteScriptedTransport,
  InProcessRunner,
  type PipelineRunner,
  type PipelineServices,
} from "@cutroom/pipeline";
import { TemporalRunner } from "@cutroom/temporal";
import { Client, Connection } from "@temporalio/client";

export interface RunnerSetup {
  runner: PipelineRunner;
  services: PipelineServices;
  close: () => Promise<void>;
}

const interruptedStatuses = new Set([
  "queued",
  "ingesting",
  "analyzing",
  "planning",
  "auditing",
  "voicing",
  "rendering",
  "finalizing",
]);

/**
 * RUNNER=in-process: steps run in the API (file or Postgres store); interrupted runs resume on boot.
 * RUNNER=temporal: the API records and signals; apps/worker executes; Temporal owns durability.
 */
export async function createRunner(options: {
  env: CutroomEnv;
  logger: CutroomLogger;
}): Promise<RunnerSetup> {
  const { env, logger } = options;
  const database =
    env.RUN_STORE === "postgres" && env.DATABASE_URL
      ? createDatabase({ connectionString: env.DATABASE_URL })
      : undefined;
  const store = database
    ? new PostgresRunStore({ database, filesRoot: path.join(path.resolve(env.CUTROOM_DATA_DIR), "runs") })
    : undefined;
  const services = createPipelineServices({
    env,
    logger,
    overrides: {
      ...(store ? { store } : {}),
      ...(env.MODEL_PROVIDER === "scripted-shipnote"
        ? { modelTransportOverride: createShipnoteScriptedTransport() }
        : {}),
    },
  });
  const closeStore = async () => {
    await store?.close();
    await database?.close();
  };

  if (env.RUNNER === "temporal" && store) {
    const connection = await Connection.connect({ address: env.TEMPORAL_ADDRESS });
    const client = new Client({ connection, namespace: env.TEMPORAL_NAMESPACE });
    const runner = new TemporalRunner({
      services: { ...services, store },
      client,
      taskQueue: env.TEMPORAL_TASK_QUEUE,
    });
    return {
      runner,
      services,
      close: async () => {
        await connection.close();
        await closeStore();
      },
    };
  }

  const runner = new InProcessRunner(services);
  for (const run of await services.store.list()) {
    if (interruptedStatuses.has(run.status)) {
      logger.info({ runId: run.id, status: run.status }, "resuming interrupted run");
      runner.resume(run.id);
    }
  }
  return { runner, services, close: closeStore };
}
