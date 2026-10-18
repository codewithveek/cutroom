import path from "node:path";
import type { CutroomEnv } from "@cutroom/config";
import { type CutroomLogger, createLogger } from "@cutroom/observability";
import { resolveBrowserExecutable } from "@cutroom/renderer";
import type { PipelineServices } from "./services";
import { FileRunStore } from "./store/file-run-store";

export interface CreatePipelineServicesOptions {
  env: CutroomEnv;
  logger?: CutroomLogger;
  overrides?: Partial<
    Pick<
      PipelineServices,
      | "modelTransportOverride"
      | "voiceProviderOverride"
      | "enforceLocalEgress"
      | "prebuiltBundleDirectory"
      | "store"
    >
  >;
}

export function createPipelineServices(options: CreatePipelineServicesOptions): PipelineServices {
  const dataDirectory = path.resolve(options.env.CUTROOM_DATA_DIR);
  return {
    env: options.env,
    logger: options.logger ?? createLogger({ level: options.env.LOG_LEVEL }),
    store: new FileRunStore(path.join(dataDirectory, "runs")),
    dataDirectory,
    browserExecutable: resolveBrowserExecutable(options.env.BROWSER_EXECUTABLE),
    ...options.overrides,
  };
}
