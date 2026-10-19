import { access } from "node:fs/promises";
import { assertNotDemoMode } from "@cutroom/config";
import { lookTokensById } from "@cutroom/video-kit";
import {
  createCachedVoice,
  createVoiceProvider,
  synthesizeNarration,
  type VoiceProvider,
} from "@cutroom/voice";
import { latestStoryboardVersion, type RunRecord } from "../run-schema";
import { dataPaths } from "../services";
import { MissingStepOutputError } from "./run-resources";
import type { StepContext, StepFunction } from "./step-context";

async function allExist(filePaths: ReadonlyArray<string>): Promise<boolean> {
  const checks = await Promise.all(
    filePaths.map((filePath) =>
      access(filePath).then(
        () => true,
        () => false,
      ),
    ),
  );
  return checks.every(Boolean);
}

export function createRunVoiceProvider(context: StepContext, run: RunRecord): VoiceProvider {
  assertNotDemoMode(context.services.env, "The voice provider");
  if (context.services.voiceProviderOverride) return context.services.voiceProviderOverride;
  return createVoiceProvider({
    mode: run.request.privacyMode,
    selection: run.request.voice,
    kokoro: {
      modelId: context.services.env.KOKORO_MODEL_ID,
      dtype: context.services.env.KOKORO_DTYPE,
      modelCacheDirectory: dataPaths(context.services.dataDirectory).models,
    },
    elevenLabsApiKey: context.services.env.ELEVENLABS_API_KEY,
  });
}

/** Step 5: one clip per narration line, then real durations drive scene lengths. */
export const voiceStep: StepFunction = async (context, run) => {
  if (run.voiceTimeline && (await allExist(run.voiceClips.map((clip) => clip.filePath))))
    return { skipped: true };
  const approvedVersion =
    run.storyboardVersions.find((version) => version.id === run.approval?.versionId) ??
    latestStoryboardVersion(run);
  if (!approvedVersion) throw new MissingStepOutputError("No approved storyboard.");
  const provider = createRunVoiceProvider(context, run);
  const voice = createCachedVoice({
    provider,
    cacheDirectory: dataPaths(context.services.dataDirectory).voiceCache,
  });
  const look = lookTokensById[approvedVersion.storyboard.look];
  const narration = await synthesizeNarration({
    storyboard: approvedVersion.storyboard,
    voice,
    selection: run.request.voice,
    transitionFrames: look.crossfadeFrames,
    onLine: ({ done, total }) => context.progress({ done, total }),
  });
  await context.updateRun((current) => ({
    ...current,
    voiceTimeline: narration.timeline,
    voiceClips: narration.clips,
    providers: {
      ...current.providers,
      voiceProvider: provider.providerId,
      isAiVoice: provider.isAiVoice,
      voiceLicence: provider.licence,
    },
  }));
  return {
    payload: {
      provider: provider.providerId,
      lines: narration.synthesizedLines + narration.cachedLines,
      cachedLines: narration.cachedLines,
      seconds: Math.round(narration.timeline.totalFrames / narration.timeline.fps),
    },
  };
};
