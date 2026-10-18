import { captureScreens } from "@cutroom/capture";
import { captureDirectory } from "./captured-screens";
import { requireSnapshot } from "./run-resources";
import type { StepFunction } from "./step-context";

/**
 * Step 1b (FR-CAP-1..3): screenshots of the running app's routes, read-only, with secrets
 * redacted on the page. Elements whose text is in the repo's UI strings become camera targets.
 * Skipped when the run asked for no capture or already has one.
 */
export const captureStep: StepFunction = async (context, run) => {
  const request = run.request.capture;
  if (!request || run.capture) return { skipped: true };
  const { reader } = await requireSnapshot(context);
  const manifest = await captureScreens({
    request,
    outputDirectory: captureDirectory(context.runDirectory),
    uiStrings: reader.snapshot.uiStrings.map((uiString) => uiString.text),
    privacyMode: run.request.privacyMode,
    browserExecutable: context.services.browserExecutable,
  });
  await context.updateRun((current) => ({ ...current, capture: manifest }));
  return {
    payload: {
      screens: manifest.screens.length,
      targets: manifest.screens.reduce((sum, screen) => sum + screen.targets.length, 0),
      redactions: manifest.screens.reduce((sum, screen) => sum + screen.redactions, 0),
      blockedRequests: manifest.blockedRequests,
    },
  };
};
