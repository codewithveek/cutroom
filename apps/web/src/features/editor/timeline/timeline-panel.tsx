"use client";

import {
  Captions,
  Eye,
  EyeOff,
  Film,
  Lock,
  Maximize2,
  Music2,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  Undo2,
  Unlock,
  Volume2,
  VolumeX,
  Waves,
} from "lucide-react";
import type React from "react";
import { useMemo, useRef, useState } from "react";
import { classNames } from "@/lib/class-names";
import { useEditor } from "../editor-context";
import { moveScene } from "../model/storyboard-edits";
import {
  captionClips,
  formatClock,
  lineClips,
  rulerTicks,
  sceneClips,
  totalFrames,
} from "../model/timeline-layout";
import { useElementSize } from "../use-fit-size";
import { CaptionClip, VideoClip, VoiceClip } from "./timeline-clips";

const TRACK_HEADER_WIDTH = 188;
const COMPACT_TRACK_HEADER_WIDTH = 44;
const RULER_HEIGHT = 30;

function TransportButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string },
): React.ReactElement {
  const { label, className, ...rest } = props;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={classNames(
        "grid size-8 place-items-center rounded-lg text-ink-muted transition-colors hover:text-ink disabled:opacity-35",
        className,
      )}
    />
  );
}

function TrackHeader(props: {
  Icon: typeof Film;
  label: string;
  compact: boolean;
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      title={props.label}
      className={classNames(
        "flex h-full items-center gap-2 rounded-xl bg-panel-raised text-sm text-ink-muted",
        props.compact ? "justify-center" : "px-3",
      )}
    >
      <props.Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className={classNames("flex-1 truncate", props.compact && "sr-only")}>{props.label}</span>
      {props.compact ? null : props.children}
    </div>
  );
}

function ToggleIcon(props: {
  label: string;
  pressed: boolean;
  onToggle: () => void;
  on: typeof Lock;
  off: typeof Lock;
}): React.ReactElement {
  const Icon = props.pressed ? props.on : props.off;
  return (
    <button
      type="button"
      aria-label={props.label}
      aria-pressed={props.pressed}
      title={props.label}
      onClick={props.onToggle}
      className={classNames(
        "rounded p-0.5 transition-colors",
        props.pressed ? "text-accent" : "text-ink-faint hover:text-ink",
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
    </button>
  );
}

/** Undo/redo, play, the clock, volume, zoom and fullscreen. */
function TimelineTransport(props: {
  compact: boolean;
  zoom: number;
  onZoom: (zoom: number) => void;
}): React.ReactElement {
  const { compact, zoom } = props;
  const setZoom = props.onZoom;
  const editor = useEditor();
  const { player, playerState, timeline, draft } = editor;
  const frames = totalFrames(timeline);
  return (
    <div className={classNames("flex h-14 shrink-0 items-center gap-3", compact ? "px-2" : "px-4")}>
      <h2 className={classNames("w-[172px] text-[15px] font-medium", compact && "sr-only")}>Timeline</h2>
      <div className="mx-auto flex items-center gap-2">
        <div className="flex items-center rounded-xl border border-line bg-panel-raised px-1">
          <TransportButton label="Undo (Ctrl+Z)" disabled={!draft.canUndo} onClick={draft.undo}>
            <Undo2 className="size-4" aria-hidden="true" />
          </TransportButton>
          <TransportButton label="Redo (Ctrl+Shift+Z)" disabled={!draft.canRedo} onClick={draft.redo}>
            <Redo2 className="size-4" aria-hidden="true" />
          </TransportButton>
          <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
          <TransportButton label="Back to the start" onClick={() => editor.seekToFrame(0)}>
            <RotateCcw className="size-4" aria-hidden="true" />
          </TransportButton>
        </div>
        <TransportButton
          label={playerState.playing ? "Pause (Space)" : "Play (Space)"}
          onClick={() => player?.toggle()}
          className="size-9 rounded-xl border border-line bg-panel-raised text-ink"
        >
          {playerState.playing ? (
            <Pause className="size-4 fill-current" aria-hidden="true" />
          ) : (
            <Play className="size-4 translate-x-px fill-current" aria-hidden="true" />
          )}
        </TransportButton>
        <span className="font-mono text-sm tabular-nums">
          {formatClock(playerState.frame, timeline.fps)}
          <span className="text-ink-faint"> / {formatClock(frames, timeline.fps)}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <TransportButton
          label={playerState.muted ? "Unmute" : "Mute"}
          onClick={() => (playerState.muted ? player?.unmute() : player?.mute())}
        >
          {playerState.muted ? (
            <VolumeX className="size-4" aria-hidden="true" />
          ) : (
            <Volume2 className="size-4" aria-hidden="true" />
          )}
        </TransportButton>
        <input
          type="range"
          aria-label="Volume"
          min={0}
          max={1}
          step={0.05}
          value={playerState.muted ? 0 : playerState.volume}
          onChange={(event) => {
            player?.setVolume(Number(event.target.value));
            if (playerState.muted) player?.unmute();
          }}
          className={classNames("w-24 accent-[var(--color-ink-muted)]", compact && "hidden")}
        />
        <label
          className={classNames(
            "ml-2 items-center gap-1.5 text-[11px] text-ink-faint",
            compact ? "hidden" : "flex",
          )}
        >
          Zoom
          <input
            type="range"
            min={1}
            max={4}
            step={0.25}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="w-16 accent-[var(--color-ink-muted)]"
          />
        </label>
        <TransportButton
          label="Full screen"
          onClick={() => player?.requestFullscreen()}
          className="border border-line bg-panel-raised"
        >
          <Maximize2 className="size-4" aria-hidden="true" />
        </TransportButton>
      </div>
    </div>
  );
}

/**
 * Video, voice, music and caption tracks on one clock, with the transport. Clip lengths come
 * from the voice (narration drives timing), so clips reorder but never stretch.
 */
export function TimelinePanel(props: { compact?: boolean }): React.ReactElement {
  const compact = props.compact ?? false;
  const editor = useEditor();
  const { player, playerState, timeline, draft } = editor;
  const [locked, setLocked] = useState(false);
  const [zoom, setZoom] = useState(1);
  const laneRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);
  const lane = useElementSize(laneRef);
  const frames = totalFrames(timeline);
  const pixelsPerFrame = Math.max(0.2, ((lane.width || 800) - 24) / frames) * zoom;
  const geometry = { pixelsPerFrame };
  const scenes = useMemo(() => sceneClips(timeline), [timeline]);
  const lines = useMemo(() => lineClips(timeline), [timeline]);
  const cues = useMemo(() => captionClips(timeline), [timeline]);
  const ticks = rulerTicks({ totalFrames: frames, fps: timeline.fps, pixelsPerFrame });
  const music = editor.run.request.music;
  const captionsVisible = editor.burnCaptions ?? (editor.ratio === "9:16" || editor.ratio === "1:1");

  const frameFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left + event.currentTarget.scrollLeft - 12;
    return Math.max(0, Math.min(frames - 1, Math.round(x / pixelsPerFrame)));
  };

  const contentWidth = frames * pixelsPerFrame + 24;
  return (
    <section className="panel flex h-[272px] shrink-0 flex-col" aria-label="Timeline">
      <TimelineTransport compact={compact} zoom={zoom} onZoom={setZoom} />
      <div className={classNames("flex min-h-0 flex-1 gap-2 pb-4", compact ? "px-2" : "px-4")}>
        <div
          className="grid shrink-0 gap-2"
          style={{
            width: compact ? COMPACT_TRACK_HEADER_WIDTH : TRACK_HEADER_WIDTH,
            gridTemplateRows: `${RULER_HEIGHT - 8}px 52px 34px 22px 30px`,
          }}
        >
          <span />
          <TrackHeader compact={compact} Icon={Film} label="Video">
            <ToggleIcon
              label={locked ? "Unlock scene order" : "Lock scene order"}
              pressed={locked}
              onToggle={() => setLocked(!locked)}
              on={Lock}
              off={Unlock}
            />
          </TrackHeader>
          <TrackHeader compact={compact} Icon={Waves} label="Voice">
            <ToggleIcon
              label={playerState.muted ? "Unmute" : "Mute"}
              pressed={playerState.muted}
              onToggle={() => (playerState.muted ? player?.unmute() : player?.mute())}
              on={VolumeX}
              off={Volume2}
            />
          </TrackHeader>
          <TrackHeader compact={compact} Icon={Music2} label="Music" />
          <TrackHeader compact={compact} Icon={Captions} label="Captions">
            <ToggleIcon
              label={captionsVisible ? "Hide captions in the preview" : "Show captions in the preview"}
              pressed={!captionsVisible}
              onToggle={() => editor.setBurnCaptions(!captionsVisible)}
              on={EyeOff}
              off={Eye}
            />
          </TrackHeader>
        </div>
        <div
          ref={laneRef}
          role="slider"
          tabIndex={0}
          aria-label="Playhead"
          aria-valuemin={0}
          aria-valuemax={frames}
          aria-valuenow={playerState.frame}
          aria-valuetext={formatClock(playerState.frame, timeline.fps)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight")
              editor.seekToFrame(Math.min(frames - 1, playerState.frame + timeline.fps));
            if (event.key === "ArrowLeft") editor.seekToFrame(Math.max(0, playerState.frame - timeline.fps));
          }}
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest("button")) return;
            scrubbing.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            editor.seekToFrame(frameFromPointer(event));
          }}
          onPointerMove={(event) => {
            if (scrubbing.current) editor.seekToFrame(frameFromPointer(event));
          }}
          onPointerUp={() => {
            scrubbing.current = false;
          }}
          className="relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden rounded-xl bg-canvas/60 focus-visible:outline-2"
        >
          <div className="relative h-full px-3" style={{ width: contentWidth }}>
            <div className="relative" style={{ height: RULER_HEIGHT }}>
              {ticks.map((tick) => (
                <span
                  key={tick.frame}
                  className="absolute top-2 flex -translate-x-1/2 flex-col items-center"
                  style={{ left: tick.frame * pixelsPerFrame }}
                >
                  <span
                    className={classNames(
                      "rounded-full",
                      tick.label ? "size-1.5 bg-ink-faint" : "size-1 bg-line-strong",
                    )}
                  />
                  {tick.label ? (
                    <span className="mt-0.5 text-[10px] text-ink-faint">{tick.label}</span>
                  ) : null}
                </span>
              ))}
            </div>
            <div className="space-y-2">
              <div className="relative h-[52px]">
                {scenes.map((clip) => {
                  const scene = draft.storyboard.scenes[clip.index];
                  return scene ? (
                    <VideoClip
                      key={scene.id}
                      clip={clip}
                      scene={scene}
                      geometry={geometry}
                      draggable={editor.editable && !locked}
                      onDropScene={(fromIndex, toIndex) =>
                        editor.applyEdit((storyboard) => moveScene({ storyboard, fromIndex, toIndex }))
                      }
                    />
                  ) : null;
                })}
              </div>
              <div className="relative h-[34px]">
                {lines.map((clip) => (
                  <VoiceClip key={`${clip.sceneId}-${clip.lineIndex}`} clip={clip} geometry={geometry} />
                ))}
              </div>
              <div className="relative h-[22px]">
                {music.kind === "none" ? (
                  <span className="absolute inset-y-0 left-0 flex items-center text-[11px] text-ink-faint">
                    No music
                  </span>
                ) : (
                  <span
                    className="absolute inset-y-0 left-0 flex items-center rounded-lg border border-dashed border-line-strong px-2 text-[11px] text-ink-faint"
                    style={{ width: frames * pixelsPerFrame }}
                  >
                    {music.kind === "generated" ? `${music.bed} bed` : (music.fileName ?? "Your track")} ·
                    ducked under the voice
                  </span>
                )}
              </div>
              <div className="relative h-[30px]">
                {cues.map((cue) => (
                  <CaptionClip key={`${cue.startFrame}-${cue.text}`} cue={cue} geometry={geometry} />
                ))}
              </div>
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-accent"
              style={{ left: 12 + playerState.frame * pixelsPerFrame }}
            >
              <span className="absolute top-1 left-1/2 -translate-x-1/2 rounded-md bg-accent px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap text-on-accent">
                {formatClock(playerState.frame, timeline.fps)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
