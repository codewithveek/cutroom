"use client";

import type { CaptionCue, Scene } from "@cutroom/scene-spec";
import type React from "react";
import { blockIcons } from "@/features/storyboard/block-icons";
import { sceneHeadline } from "@/features/storyboard/scene-summary";
import { StoryboardThumbnail } from "@/features/video-preview/storyboard-thumbnail";
import { apiClient } from "@/lib/api-client";
import { classNames } from "@/lib/class-names";
import { useEditor } from "../editor-context";
import type { LineClip, SceneClip } from "../model/timeline-layout";
import { useWaveformPeaks } from "../use-waveform-peaks";

export interface ClipGeometry {
  pixelsPerFrame: number;
}

function clipStyle(options: {
  startFrame: number;
  endFrame: number;
  pixelsPerFrame: number;
}): React.CSSProperties {
  return {
    left: options.startFrame * options.pixelsPerFrame,
    width: Math.max(4, (options.endFrame - options.startFrame) * options.pixelsPerFrame - 2),
  };
}

export function VideoClip(props: {
  clip: SceneClip;
  scene: Scene;
  geometry: ClipGeometry;
  draggable: boolean;
  onDropScene: (fromIndex: number, toIndex: number) => void;
}): React.ReactElement {
  const editor = useEditor();
  const selected = editor.selectedSceneId === props.scene.id;
  const Icon = blockIcons[props.scene.block];
  const fps = editor.timeline.fps;
  const seconds = (props.clip.endFrame - props.clip.startFrame) / fps;
  const middleFrame = Math.round((props.clip.startFrame + props.clip.endFrame) / 2);
  return (
    <button
      type="button"
      draggable={props.draggable}
      onDragStart={(event) => event.dataTransfer.setData("text/scene-index", String(props.clip.index))}
      onDragOver={(event) => {
        if (props.draggable) event.preventDefault();
      }}
      onDrop={(event) => {
        const fromIndex = Number(event.dataTransfer.getData("text/scene-index"));
        if (Number.isInteger(fromIndex)) props.onDropScene(fromIndex, props.clip.index);
      }}
      onClick={() => editor.selectScene(props.scene.id)}
      aria-label={`Scene ${props.clip.index + 1}: ${sceneHeadline(props.scene)}, ${seconds.toFixed(1)} seconds`}
      aria-pressed={selected}
      style={clipStyle({ ...props.clip, pixelsPerFrame: props.geometry.pixelsPerFrame })}
      className={classNames(
        "absolute top-0 flex h-full items-stretch overflow-hidden rounded-lg border-2 bg-panel-raised text-left transition-colors",
        selected ? "z-10 border-accent" : "border-line-strong hover:border-ink-faint",
        props.draggable && "cursor-grab active:cursor-grabbing",
      )}
    >
      <span className="pointer-events-none h-full w-[72px] shrink-0 overflow-hidden border-r border-line">
        <StoryboardThumbnail storyboard={editor.draft.storyboard} frame={middleFrame} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-between px-2 py-1">
        <span className="flex items-center gap-1 truncate text-[11px] font-medium text-ink">
          <Icon className="size-3 shrink-0 text-ink-muted" aria-hidden="true" />
          <span className="truncate">{sceneHeadline(props.scene)}</span>
        </span>
        <span className="self-end font-mono text-[10px] text-ink-faint">{seconds.toFixed(1)}s</span>
      </span>
    </button>
  );
}

function Bars(props: { peaks: ReadonlyArray<number>; estimated: boolean }): React.ReactElement {
  return (
    <span aria-hidden="true" className="flex h-full flex-1 items-center gap-px overflow-hidden px-1">
      {props.peaks.map((peak, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: one bar per bucket
          key={index}
          className={classNames(
            "w-[2px] shrink-0 rounded-full",
            props.estimated ? "bg-ink-faint/50" : "bg-ink-muted",
          )}
          style={{ height: `${Math.max(8, peak * 100)}%` }}
        />
      ))}
    </span>
  );
}

/** Word-length envelope for lines that have no audio yet; drawn faint and labelled as estimated. */
function estimatedPeaks(text: string, buckets: number): number[] {
  const words = text.split(/\s+/).filter(Boolean);
  return Array.from({ length: buckets }, (_, bucket) => {
    const word = words[Math.floor((bucket / buckets) * words.length)] ?? "";
    return 0.25 + Math.min(0.6, word.length * 0.07) * (bucket % 3 === 1 ? 0.6 : 1);
  });
}

export function VoiceClip(props: { clip: LineClip; geometry: ClipGeometry }): React.ReactElement {
  const editor = useEditor();
  const style = clipStyle({ ...props.clip, pixelsPerFrame: props.geometry.pixelsPerFrame });
  const buckets = Math.max(4, Math.floor(Number(style.width) / 3));
  const media = editor.run.media.find((item) => item.assetKey === props.clip.audioAssetKey);
  const realPeaks = useWaveformPeaks(
    editor.timeline.source === "voice" && media ? apiClient.assetUrl(media.url) : undefined,
    buckets,
  );
  const seconds = ((props.clip.endFrame - props.clip.startFrame) / editor.timeline.fps).toFixed(1);
  const selected =
    editor.selectedLine?.sceneId === props.clip.sceneId &&
    editor.selectedLine.lineIndex === props.clip.lineIndex;
  return (
    <button
      type="button"
      onClick={() => editor.playLine({ sceneId: props.clip.sceneId, lineIndex: props.clip.lineIndex })}
      title={props.clip.text}
      aria-label={`Play line: ${props.clip.text}`}
      style={style}
      className={classNames(
        "absolute top-0 flex h-full items-center overflow-hidden rounded-lg border bg-panel-hover",
        selected ? "border-accent" : "border-line-strong",
      )}
    >
      <Bars peaks={realPeaks ?? estimatedPeaks(props.clip.text, buckets)} estimated={!realPeaks} />
      <span className="absolute right-1 bottom-0.5 rounded bg-panel-hover/90 px-1 font-mono text-[9px] text-ink-faint">
        {realPeaks ? "" : "est. "}
        {seconds}s
      </span>
    </button>
  );
}

export function CaptionClip(props: { cue: CaptionCue; geometry: ClipGeometry }): React.ReactElement {
  const editor = useEditor();
  return (
    <button
      type="button"
      onClick={() => editor.seekToFrame(props.cue.startFrame)}
      title={props.cue.text}
      style={clipStyle({ ...props.cue, pixelsPerFrame: props.geometry.pixelsPerFrame })}
      className="absolute top-0 flex h-full items-center overflow-hidden rounded-lg bg-caption px-2 text-left text-[11px] text-white"
    >
      <span className="truncate">{props.cue.text}</span>
    </button>
  );
}
