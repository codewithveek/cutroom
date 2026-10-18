import { createRequire } from "node:module";
import { LocalRunEventBus, type PipelineServices, StepExecutor } from "@cutroom/pipeline";
import { NativeConnection, Worker } from "@temporalio/worker";
import { createPipelineActivities } from "./activities";
import { temporalConnectionOptions } from "./connection-options";

/** The workflow module Temporal bundles for its deterministic sandbox. */
export const workflowsPath = createRequire(import.meta.url).resolve("./workflows/index.ts");

export interface PipelineWorkerOptions {
  services: PipelineServices;
  address: string;
  /** Temporal Cloud: connects over TLS with this key. */
  apiKey?: string | undefined;
  namespace: string;
  taskQueue: string;
}

/** A worker that polls the pipeline task queue and runs steps with the shared StepExecutor. */
export async function createPipelineWorker(
  options: PipelineWorkerOptions,
): Promise<{ worker: Worker; connection: NativeConnection }> {
  const connection = await NativeConnection.connect(
    temporalConnectionOptions({ address: options.address, apiKey: options.apiKey }),
  );
  const executor = new StepExecutor({ services: options.services, bus: new LocalRunEventBus() });
  const worker = await Worker.create({
    connection,
    namespace: options.namespace,
    taskQueue: options.taskQueue,
    workflowsPath,
    activities: createPipelineActivities(executor),
  });
  return { worker, connection };
}
