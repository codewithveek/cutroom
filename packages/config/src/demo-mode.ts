import type { CutroomEnv } from "./env-schema";

/** Thrown where a capability the public demo must never have is about to be constructed (D-4). */
export class DemoModeDisabledError extends Error {
  override readonly name = "DemoModeDisabledError";
  readonly capability: string;

  constructor(capability: string) {
    super(`${capability} is disabled in the read-only demo. Run Cutroom locally to use your own code.`);
    this.capability = capability;
  }
}

/** Defence in depth behind the API's read-only hook: ingest, model, voice and render providers refuse to exist. */
export function assertNotDemoMode(env: Pick<CutroomEnv, "CUTROOM_DEMO_MODE">, capability: string): void {
  if (env.CUTROOM_DEMO_MODE) throw new DemoModeDisabledError(capability);
}
