"use client";

import {
  type AspectRatio,
  type ClaimOverride,
  estimateTimeline,
  type Scene,
  type Storyboard,
  type VoiceTimeline,
} from "@cutroom/scene-spec";
import { lookTokensById } from "@cutroom/video-kit";
import type { PlayerRef } from "@remotion/player";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StoryboardPlayer } from "@/features/video-preview/storyboard-player";
import { apiClient, type RunView } from "@/lib/api-client";
import { ApprovalFooter } from "./approval-footer";
import { moveItem, setAtPath } from "./edit-paths";
import { SceneInspector } from "./scene-inspector";
import { SceneList } from "./scene-list";

const ratioOptions = (["16:9", "9:16", "1:1", "4:5"] as const).map((ratio) => ({
  value: ratio,
  label: ratio,
}));

export interface StoryboardEditorProps {
  run: RunView;
  onRunChange: (run: RunView) => void;
}

/** The hero screen: scene list, live preview with a ratio switcher, inspector and approval (PRD §9 screen 4). */
export function StoryboardEditor(props: StoryboardEditorProps): React.ReactElement | null {
  const saved = props.run.storyboard;
  const editable = props.run.status === "awaiting_review";
  const [draft, setDraft] = useState<Storyboard | undefined>(saved?.storyboard);
  const [selectedSceneId, setSelectedSceneId] = useState<string | undefined>(saved?.storyboard.scenes[0]?.id);
  const [ratio, setRatio] = useState<AspectRatio>(props.run.request.ratios[0] ?? "16:9");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const playerRef = useRef<PlayerRef>(null);

  useEffect(() => {
    setDraft(saved?.storyboard);
  }, [saved?.versionId, saved?.storyboard]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved?.storyboard),
    [draft, saved?.storyboard],
  );
  const previewTimeline: VoiceTimeline | undefined = useMemo(() => {
    if (!draft) return undefined;
    if (!dirty && props.run.voiceTimeline) return props.run.voiceTimeline;
    return estimateTimeline({
      scenes: draft.scenes,
      transitionFrames: lookTokensById[draft.look].crossfadeFrames,
    });
  }, [draft, dirty, props.run.voiceTimeline]);

  if (!saved || !draft || !previewTimeline) return null;

  const selectedScene = draft.scenes.find((scene) => scene.id === selectedSceneId) ?? draft.scenes[0];
  const claimResults = saved.claimResults;

  const selectScene = (sceneId: string) => {
    setSelectedSceneId(sceneId);
    const timing = previewTimeline.scenes.find((sceneTiming) => sceneTiming.sceneId === sceneId);
    if (timing) playerRef.current?.seekTo(timing.fromFrame + timing.transitionInFrames + 20);
  };

  const updateSelectedScene = (path: string, value: unknown) => {
    if (!selectedScene) return;
    const updatedScene = setAtPath<Scene>(selectedScene, path, value);
    setDraft({
      ...draft,
      scenes: draft.scenes.map((scene) => (scene.id === selectedScene.id ? updatedScene : scene)),
    });
  };

  const runAction = async (action: () => Promise<RunView>) => {
    setBusy(true);
    setError(undefined);
    try {
      props.onRunChange(await action());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const unsupportedClaims = claimResults.filter((claim) => claim.verdict === "unsupported");

  return (
    <div className="rounded-xl border border-line bg-panel">
      <div className="grid gap-0 lg:grid-cols-[300px_minmax(0,1fr)_360px]">
        <div className="max-h-[75vh] overflow-y-auto border-b border-line p-3 lg:border-r lg:border-b-0">
          <SceneList
            scenes={draft.scenes}
            timings={previewTimeline.scenes}
            claimResults={claimResults}
            selectedSceneId={selectedScene?.id}
            onSelect={selectScene}
            onMove={(fromIndex, toIndex) =>
              setDraft({ ...draft, scenes: moveItem(draft.scenes, fromIndex, toIndex) })
            }
            editable={editable}
          />
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-ink-muted">
              v{saved.version} · {lookTokensById[draft.look].label} ·{" "}
              {previewTimeline.source === "voice" ? "voice timing" : "estimated timing"}
            </div>
            <SegmentedControl label="Aspect ratio" options={ratioOptions} value={ratio} onChange={setRatio} />
          </div>
          <div className={ratio === "16:9" ? "" : "mx-auto max-w-sm"}>
            <StoryboardPlayer
              ref={playerRef}
              storyboard={draft}
              ratio={ratio}
              voiceTimeline={previewTimeline}
            />
          </div>
          {error ? <p className="text-sm text-unsupported">{error}</p> : null}
        </div>
        <div className="max-h-[75vh] overflow-y-auto border-t border-line p-4 lg:border-t-0 lg:border-l">
          {selectedScene ? (
            <SceneInspector
              scene={selectedScene}
              claims={claimResults.filter((claim) => claim.sceneId === selectedScene.id)}
              editable={editable}
              onChange={updateSelectedScene}
            />
          ) : null}
        </div>
      </div>
      {editable ? (
        <ApprovalFooter
          unsupportedClaims={unsupportedClaims}
          dirty={dirty}
          busy={busy}
          onSave={() => void runAction(() => apiClient.saveStoryboard(props.run.id, draft))}
          onApprove={(overrides: ClaimOverride[]) =>
            void runAction(() => apiClient.approve(props.run.id, { versionId: saved.versionId, overrides }))
          }
        />
      ) : null}
    </div>
  );
}
