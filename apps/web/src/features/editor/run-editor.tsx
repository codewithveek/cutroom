"use client";

import {
  type AspectRatio,
  attachScreenViews,
  estimateTimeline,
  type RunEvent,
  type Storyboard,
  type VoiceTimeline,
} from "@cutroom/scene-spec";
import { lookTokensById } from "@cutroom/video-kit";
import type { PlayerRef } from "@remotion/player";
import { Download, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EgressPanel } from "@/features/render-queue/egress-panel";
import { RendersPanel } from "@/features/render-queue/renders-panel";
import { apiClient, type RunView } from "@/lib/api-client";
import { classNames } from "@/lib/class-names";
import { breakpoints, useMediaQuery } from "@/lib/use-media-query";
import { useRun } from "@/lib/use-run";
import {
  EditorContext,
  type EditorContextValue,
  type EditorSheet,
  type LineSelection,
} from "./editor-context";
import { EditorHeader, type PrimaryActionState } from "./editor-header";
import { EditorSheets } from "./editor-sheets";
import type { EditorTabId } from "./editor-tabs";
import { lineClips } from "./model/timeline-layout";
import { OverridesSheet } from "./overrides-sheet";
import { AudioPanel } from "./panels/audio-panel";
import { CaptionsPanel } from "./panels/captions-panel";
import { InspectorPanel } from "./panels/inspector-panel";
import { MediaPanel } from "./panels/media-panel";
import { ScriptPanel } from "./panels/script-panel";
import { TextPanel } from "./panels/text-panel";
import { TransitionsPanel } from "./panels/transitions-panel";
import { PipelineView } from "./pipeline-view";
import { PreviewStage } from "./preview-stage";
import { TimelinePanel } from "./timeline/timeline-panel";
import { usePlayerState } from "./use-player-state";
import { useStoryboardDraft } from "./use-storyboard-draft";

const leftPanels: Readonly<Record<EditorTabId, () => React.ReactElement>> = {
  script: ScriptPanel,
  media: MediaPanel,
  text: TextPanel,
  audio: AudioPanel,
  captions: CaptionsPanel,
  transitions: TransitionsPanel,
};

type MobilePaneId = "edit" | "style" | "timeline";

/** Below the desktop breakpoint the three regions share one column, one at a time under the stage. */
const mobilePanes: ReadonlyArray<{ id: MobilePaneId; label: string }> = [
  { id: "edit", label: "Edit" },
  { id: "style", label: "Voice & style" },
  { id: "timeline", label: "Timeline" },
];

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

function previewTimeline(options: { draft: Storyboard; dirty: boolean; run: RunView }): VoiceTimeline {
  const voiced = options.run.voiceTimeline;
  if (!options.dirty && voiced && voiced.scenes.length === options.draft.scenes.length) return voiced;
  return estimateTimeline({
    scenes: options.draft.scenes,
    transitionFrames: lookTokensById[options.draft.look].crossfadeFrames,
  });
}

interface WorkspaceProps {
  run: RunView & { storyboard: NonNullable<RunView["storyboard"]> };
  events: ReadonlyArray<RunEvent>;
  replaceRun: (run: RunView) => void;
}

/** Everything once a storyboard exists: script, preview, inspector, timeline (PRD §9 screen 4). */
function StoryboardWorkspace(props: WorkspaceProps): React.ReactElement {
  const { run } = props;
  const saved = run.storyboard;
  const draft = useStoryboardDraft({ saved: saved.storyboard, savedVersionId: saved.versionId });
  const editable = run.status === "awaiting_review";
  const [tab, setTab] = useState<EditorTabId>("script");
  const [selectedSceneId, setSelectedSceneId] = useState<string | undefined>(saved.storyboard.scenes[0]?.id);
  const [selectedLine, setSelectedLine] = useState<LineSelection>();
  const [ratio, setRatio] = useState<AspectRatio>(run.request.ratios[0] ?? "16:9");
  const [burnCaptions, setBurnCaptions] = useState<boolean | undefined>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [sheet, setSheet] = useState<EditorSheet>();
  const [stageMode, setStageMode] = useState<"preview" | "renders">("preview");
  const [player, setPlayer] = useState<PlayerRef | null>(null);
  const isDesktop = useMediaQuery(breakpoints.lg);
  const [mobilePane, setMobilePane] = useState<MobilePaneId>("edit");
  const playerState = usePlayerState(player);
  const stopAtFrame = useRef<number | undefined>(undefined);

  const timeline = useMemo(
    () => previewTimeline({ draft: draft.storyboard, dirty: draft.dirty, run }),
    [draft.storyboard, draft.dirty, run],
  );
  const lines = useMemo(() => lineClips(timeline), [timeline]);
  const hasRenders = run.assets.some((asset) => asset.kind === "video");

  useEffect(() => {
    if (hasRenders && run.status === "completed") setStageMode("renders");
  }, [hasRenders, run.status]);

  // Open on a resolved frame of the first scene rather than an empty frame 0.
  useEffect(() => {
    if (player && player.getCurrentFrame() === 0) player.seekTo(45);
  }, [player]);

  // A line played from the script stops at its end.
  useEffect(() => {
    if (stopAtFrame.current !== undefined && playerState.frame >= stopAtFrame.current) {
      stopAtFrame.current = undefined;
      player?.pause();
    }
  }, [playerState.frame, player]);

  const seekToFrame = useCallback(
    (frame: number) => {
      stopAtFrame.current = undefined;
      player?.seekTo(frame);
    },
    [player],
  );

  const selectScene = useCallback(
    (sceneId: string) => {
      setSelectedSceneId(sceneId);
      setSelectedLine(undefined);
      const sceneTiming = timeline.scenes.find((scene) => scene.sceneId === sceneId);
      if (sceneTiming) seekToFrame(sceneTiming.fromFrame + sceneTiming.transitionInFrames + 20);
    },
    [timeline, seekToFrame],
  );

  const selectLine = useCallback(
    (selection: LineSelection) => {
      setSelectedSceneId(selection.sceneId);
      setSelectedLine(selection);
      const clip = lines.find(
        (line) => line.sceneId === selection.sceneId && line.lineIndex === selection.lineIndex,
      );
      if (clip) seekToFrame(clip.startFrame);
    },
    [lines, seekToFrame],
  );

  const playLine = useCallback(
    (selection: LineSelection) => {
      selectLine(selection);
      const clip = lines.find(
        (line) => line.sceneId === selection.sceneId && line.lineIndex === selection.lineIndex,
      );
      if (!clip || !player) return;
      player.play();
      stopAtFrame.current = clip.endFrame;
    },
    [lines, player, selectLine],
  );

  const runAction = useCallback(
    async (action: () => Promise<RunView>) => {
      setBusy(true);
      setNotice(undefined);
      try {
        props.replaceRun(await action());
      } catch (caught) {
        setNotice(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setBusy(false);
      }
    },
    [props.replaceRun],
  );

  const screens = props.run.capture?.screens;
  const applyEdit = useCallback(
    (change: (storyboard: Storyboard) => Storyboard) => {
      // Screenshot scenes follow the capture: the preview shows the box the server will store.
      const failure = draft.edit((storyboard) =>
        attachScreenViews({ storyboard: change(storyboard), screens: screens ?? [] }),
      );
      setNotice(failure);
    },
    [draft.edit, screens],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      if (event.key === " ") {
        event.preventDefault();
        player?.toggle();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) draft.redo();
        else draft.undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [player, draft.undo, draft.redo]);

  const unsupportedClaims = saved.claimResults.filter((claim) => claim.verdict === "unsupported");
  const approve = (overrides: Parameters<typeof apiClient.approve>[1]["overrides"]) => {
    setSheet(undefined);
    void runAction(() => apiClient.approve(run.id, { versionId: saved.versionId, overrides }));
  };

  const primary: PrimaryActionState = (() => {
    if (editable && draft.dirty)
      return {
        label: "Save & re-audit",
        tone: "accent",
        busy,
        onClick: () => void runAction(() => apiClient.saveStoryboard(run.id, draft.storyboard)),
      };
    if (editable && unsupportedClaims.length > 0)
      return {
        label: `Resolve ${unsupportedClaims.length} claim${unsupportedClaims.length === 1 ? "" : "s"}`,
        tone: "danger",
        busy,
        onClick: () => setSheet("overrides"),
      };
    if (editable) return { label: "Approve & render", tone: "accent", busy, onClick: () => approve([]) };
    if (run.status === "completed")
      return { label: "Renders", tone: "accent", Icon: Download, onClick: () => setStageMode("renders") };
    if (run.status === "failed")
      return { label: "See what failed", tone: "danger", onClick: () => setSheet("pipeline") };
    if (run.status === "awaiting_egress")
      return { label: "Confirm the manifest", tone: "neutral", disabled: true };
    return { label: "Rendering…", tone: "neutral", busy: true };
  })();

  const context: EditorContextValue = {
    run,
    draft,
    timeline,
    editable,
    tab,
    setTab,
    selectedSceneId,
    selectedLine,
    selectScene,
    selectLine,
    playLine,
    seekToFrame,
    player,
    playerState,
    ratio,
    setRatio,
    burnCaptions,
    setBurnCaptions,
    busy,
    runAction,
    applyEdit,
    notice,
    setNotice,
    openSheet: setSheet,
  };
  const LeftPanel = leftPanels[tab];
  const stageRegion = (
    <>
      {run.egress && !run.egress.confirmedAt ? (
        <div className="max-h-[50%] shrink-0 overflow-y-auto">
          <EgressPanel run={run} onRunChange={props.replaceRun} />
        </div>
      ) : null}
      {hasRenders ? (
        <fieldset className="flex shrink-0 self-center rounded-xl bg-panel p-1 text-xs">
          <legend className="sr-only">Stage</legend>
          {(["preview", "renders"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={stageMode === mode}
              onClick={() => setStageMode(mode)}
              className={classNames(
                "rounded-lg px-3 py-1 capitalize",
                stageMode === mode ? "bg-panel-hover text-ink" : "text-ink-muted",
              )}
            >
              {mode === "preview" ? "Live preview" : "Final renders"}
            </button>
          ))}
        </fieldset>
      ) : null}
      {stageMode === "renders" && hasRenders ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <RendersPanel run={run} events={props.events} />
        </div>
      ) : (
        <PreviewStage playerRef={setPlayer} />
      )}
    </>
  );

  return (
    <EditorContext.Provider value={context}>
      <div
        className={classNames("flex flex-col gap-2 lg:gap-3", isDesktop ? "h-full min-h-0" : "min-h-full")}
      >
        <EditorHeader
          run={run}
          events={props.events}
          tab={tab}
          onTab={setTab}
          tabsEnabled
          dirty={draft.dirty}
          onOpenSheet={setSheet}
          primary={primary}
        />
        {isDesktop ? (
          <>
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(260px,340px)_minmax(0,1fr)_minmax(280px,360px)] gap-3">
              <LeftPanel />
              <div className="flex min-h-0 min-w-0 flex-col gap-3">{stageRegion}</div>
              <InspectorPanel />
            </div>
            <TimelinePanel />
          </>
        ) : (
          <>
            <div className="flex h-[42vh] min-h-[220px] shrink-0 flex-col gap-2">{stageRegion}</div>
            <fieldset className="flex shrink-0 rounded-xl bg-panel p-1 text-sm">
              <legend className="sr-only">Panel</legend>
              {mobilePanes.map((pane) => (
                <button
                  key={pane.id}
                  type="button"
                  aria-pressed={mobilePane === pane.id}
                  onClick={() => setMobilePane(pane.id)}
                  className={classNames(
                    "flex-1 rounded-lg py-1.5",
                    mobilePane === pane.id ? "bg-panel-hover font-medium text-ink" : "text-ink-muted",
                  )}
                >
                  {pane.label}
                </button>
              ))}
            </fieldset>
            <div className="flex min-h-[60vh] flex-1 flex-col">
              {mobilePane === "edit" ? <LeftPanel /> : null}
              {mobilePane === "style" ? <InspectorPanel /> : null}
              {mobilePane === "timeline" ? <TimelinePanel compact /> : null}
            </div>
          </>
        )}
      </div>
      {notice ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 flex max-w-lg -translate-x-1/2 items-center gap-3 rounded-xl border border-line-strong bg-panel-raised px-4 py-2.5 text-sm shadow-2xl"
        >
          {notice}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setNotice(undefined)}
            className="text-ink-faint hover:text-ink"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <EditorSheets
        run={run}
        events={props.events}
        sheet={sheet}
        onClose={() => setSheet(undefined)}
        busy={busy}
        onSaveBrief={(brief) => void runAction(() => apiClient.updateBrief(run.id, brief))}
      />
      <OverridesSheet
        open={sheet === "overrides"}
        onClose={() => setSheet(undefined)}
        unsupportedClaims={unsupportedClaims}
        onApprove={approve}
      />
    </EditorContext.Provider>
  );
}

/** The run page: the live pipeline until a storyboard exists, then the editor. */
export function RunEditor(props: { runId: string }): React.ReactElement {
  const { run, events, error, replaceRun } = useRun(props.runId);
  const [sheet, setSheet] = useState<EditorSheet>();
  if (error && !run) return <p className="p-8 text-sm text-unsupported">{error}</p>;
  if (!run) return <p className="p-8 text-sm text-ink-muted">Loading run…</p>;
  if (run.storyboard) {
    const withStoryboard = { ...run, storyboard: run.storyboard };
    return <StoryboardWorkspace run={withStoryboard} events={events} replaceRun={replaceRun} />;
  }
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <EditorHeader
        run={run}
        events={events}
        tab="script"
        onTab={() => undefined}
        tabsEnabled={false}
        dirty={false}
        onOpenSheet={setSheet}
        primary={
          run.status === "failed"
            ? { label: "See what failed", tone: "danger", onClick: () => setSheet("pipeline") }
            : { label: "Working…", tone: "neutral", busy: true }
        }
      />
      <PipelineView run={run} events={events} />
      <EditorSheets run={run} events={events} sheet={sheet} onClose={() => setSheet(undefined)} />
    </div>
  );
}
