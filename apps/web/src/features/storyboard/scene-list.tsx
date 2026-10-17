"use client";

import type { ClaimResult, Scene, SceneTiming } from "@cutroom/scene-spec";
import { ChevronDown, ChevronUp } from "lucide-react";
import type React from "react";
import { VerdictBadge } from "@/components/ui/badge";
import { classNames } from "@/lib/class-names";
import { blockIcons } from "./block-icons";
import { sceneHeadline, sceneVerdict } from "./scene-summary";

export interface SceneListProps {
  scenes: ReadonlyArray<Scene>;
  timings: ReadonlyArray<SceneTiming>;
  claimResults: ReadonlyArray<ClaimResult>;
  selectedSceneId: string | undefined;
  onSelect: (sceneId: string) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  editable: boolean;
}

export function SceneList(props: SceneListProps): React.ReactElement {
  const timingById = new Map(props.timings.map((timing) => [timing.sceneId, timing]));
  return (
    <ol className="space-y-1.5" aria-label="Scenes">
      {props.scenes.map((scene, index) => {
        const Icon = blockIcons[scene.block];
        const verdict = sceneVerdict(scene.id, props.claimResults);
        const timing = timingById.get(scene.id);
        const selected = scene.id === props.selectedSceneId;
        return (
          <li key={scene.id}>
            <div
              className={classNames(
                "group flex items-start gap-2 rounded-lg border p-2.5 transition-colors",
                selected ? "border-accent bg-accent/10" : "border-line bg-panel hover:border-line-strong",
              )}
            >
              <button
                type="button"
                onClick={() => props.onSelect(scene.id)}
                className="flex min-w-0 flex-1 items-start gap-2 text-left"
                aria-current={selected}
              >
                <span className="mt-0.5 font-mono text-[11px] text-ink-faint">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Icon className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{sceneHeadline(scene)}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-faint">
                    <span className="whitespace-nowrap font-mono">{scene.block}</span>
                    {timing ? (
                      <span className="font-mono">{(timing.durationFrames / 30).toFixed(1)}s</span>
                    ) : null}
                    {verdict ? <VerdictBadge verdict={verdict} /> : null}
                  </span>
                </span>
              </button>
              {props.editable ? (
                <span className="flex shrink-0 flex-col opacity-60 group-hover:opacity-100">
                  <button
                    type="button"
                    aria-label={`Move scene ${index + 1} up`}
                    onClick={() => props.onMove(index, index - 1)}
                    className="rounded p-0.5 hover:text-ink"
                  >
                    <ChevronUp className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move scene ${index + 1} down`}
                    onClick={() => props.onMove(index, index + 1)}
                    className="rounded p-0.5 hover:text-ink"
                  >
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                  </button>
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
