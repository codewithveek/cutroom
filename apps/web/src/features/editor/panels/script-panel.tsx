"use client";

import { blocksAllowedInLook, type Scene } from "@cutroom/scene-spec";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  Eye,
  MoreVertical,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { VerdictBadge } from "@/components/ui/badge";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { blockIcons } from "@/features/storyboard/block-icons";
import { blockLabels } from "@/features/storyboard/block-labels";
import { sceneHeadline, sceneVerdict } from "@/features/storyboard/scene-summary";
import { apiClient } from "@/lib/api-client";
import { classNames } from "@/lib/class-names";
import { useEditor } from "../editor-context";
import { EditorPanel, IconButton } from "../editor-panel";
import {
  duplicateScene,
  insertScene,
  moveScene,
  removeScene,
  templateBlocks,
} from "../model/storyboard-edits";
import { formatSeconds, type LineClip, lineClips } from "../model/timeline-layout";

function WordBars(props: { text: string }): React.ReactElement {
  const words = props.text.split(/\s+/).slice(0, 8);
  return (
    <span aria-hidden="true" className="flex h-2.5 items-end gap-px">
      {words.map((word, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: one bar per word position
          key={index}
          className="w-[2px] rounded-full bg-ink-faint"
          style={{ height: `${30 + Math.min(70, word.length * 10)}%` }}
        />
      ))}
    </span>
  );
}

function LineRow(props: {
  scene: Scene;
  lineIndex: number;
  clip: LineClip | undefined;
}): React.ReactElement | null {
  const editor = useEditor();
  const line = props.scene.narration[props.lineIndex];
  if (!line) return null;
  const selection = { sceneId: props.scene.id, lineIndex: props.lineIndex };
  const selected =
    editor.selectedLine?.sceneId === props.scene.id && editor.selectedLine.lineIndex === props.lineIndex;
  const fps = editor.timeline.fps;
  const playing =
    editor.playerState.playing &&
    props.clip !== undefined &&
    editor.playerState.frame >= props.clip.startFrame &&
    editor.playerState.frame < props.clip.endFrame;
  return (
    <li
      className={classNames(
        "group flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors",
        selected ? "bg-accent-soft" : "hover:bg-panel-hover",
      )}
    >
      <button
        type="button"
        aria-label={`Play line: ${line.text}`}
        onClick={() => editor.playLine(selection)}
        className={classNames(
          "grid size-6 shrink-0 place-items-center rounded-full transition-colors",
          playing ? "bg-accent text-on-accent" : "bg-ink-faint/40 text-ink group-hover:bg-ink-faint/60",
        )}
      >
        <Play className="size-3 translate-x-px fill-current" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => editor.selectLine(selection)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[13px] text-ink">{line.text}</span>
        <span className="mt-1 flex items-center gap-2 text-[11px] text-ink-faint">
          <WordBars text={line.text} />
          {props.clip ? (
            <>
              <span>Starts {formatSeconds(props.clip.startFrame, fps)}</span>
              <span aria-hidden="true">·</span>
              <span>{((props.clip.endFrame - props.clip.startFrame) / fps).toFixed(1)}s</span>
            </>
          ) : null}
        </span>
      </button>
      {selected ? <Eye className="size-4 shrink-0 text-ink-muted" aria-label="Selected" /> : null}
    </li>
  );
}

function RegenerateForm(props: { sceneId: string; onClose: () => void }): React.ReactElement {
  const editor = useEditor();
  const [instruction, setInstruction] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        props.onClose();
        void editor.runAction(() =>
          apiClient.regenerateScene({
            runId: editor.run.id,
            sceneId: props.sceneId,
            instruction: instruction.trim() || undefined,
          }),
        );
      }}
      className="absolute inset-x-2 top-12 z-20 flex gap-1.5 rounded-xl border border-line-strong bg-panel-raised p-2 shadow-xl"
    >
      <input
        // biome-ignore lint/a11y/noAutofocus: the form opens on purpose to take this one input
        autoFocus
        aria-label="Direction for the new version"
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
        placeholder="Optional direction, e.g. show the CLI"
        className="min-w-0 flex-1 rounded-lg bg-panel px-2.5 text-xs placeholder:text-ink-faint focus:outline-none"
      />
      <button type="submit" className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-medium text-on-accent">
        Regenerate
      </button>
      <button
        type="button"
        aria-label="Cancel"
        onClick={props.onClose}
        className="rounded-lg px-1.5 text-ink-faint hover:text-ink"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </form>
  );
}

function sceneMenuItems(options: {
  editor: ReturnType<typeof useEditor>;
  scene: Scene;
  index: number;
  count: number;
  onRegenerate: () => void;
}): MenuItem[] {
  const { editor, scene, index, count } = options;
  const locked = !editor.editable;
  return [
    {
      id: "up",
      label: "Move up",
      Icon: ArrowUp,
      disabled: locked || index === 0,
      onSelect: () =>
        editor.applyEdit((storyboard) => moveScene({ storyboard, fromIndex: index, toIndex: index - 1 })),
    },
    {
      id: "down",
      label: "Move down",
      Icon: ArrowDown,
      disabled: locked || index === count - 1,
      onSelect: () =>
        editor.applyEdit((storyboard) => moveScene({ storyboard, fromIndex: index, toIndex: index + 1 })),
    },
    {
      id: "duplicate",
      label: "Duplicate",
      Icon: Copy,
      disabled: locked,
      onSelect: () => editor.applyEdit((storyboard) => duplicateScene({ storyboard, sceneId: scene.id })),
    },
    {
      id: "regenerate",
      label: "Regenerate with Gemma…",
      Icon: RefreshCw,
      disabled: locked || editor.draft.dirty || editor.busy,
      ...(editor.draft.dirty ? { hint: "save first" } : {}),
      onSelect: options.onRegenerate,
    },
    {
      id: "delete",
      label: "Delete",
      Icon: Trash2,
      danger: true,
      disabled: locked,
      onSelect: () => editor.applyEdit((storyboard) => removeScene({ storyboard, sceneId: scene.id })),
    },
  ];
}

function SceneGroup(props: {
  scene: Scene;
  index: number;
  count: number;
  clips: ReadonlyArray<LineClip>;
  query: string;
}): React.ReactElement | null {
  const editor = useEditor();
  const [collapsed, setCollapsed] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const Icon = blockIcons[props.scene.block];
  const verdict = sceneVerdict(props.scene.id, editor.run.storyboard?.claimResults ?? []);
  const selected = editor.selectedSceneId === props.scene.id;
  const headline = sceneHeadline(props.scene);
  const lineIndexes = props.scene.narration
    .map((line, lineIndex) => ({ line, lineIndex }))
    .filter(({ line }) => !props.query || line.text.toLowerCase().includes(props.query));
  if (props.query && lineIndexes.length === 0 && !headline.toLowerCase().includes(props.query)) return null;
  return (
    <li
      className={classNames(
        "relative rounded-2xl border p-1.5 transition-colors",
        selected ? "border-line-strong bg-panel-raised" : "border-transparent bg-panel-raised/60",
      )}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={collapsed ? "Expand scene" : "Collapse scene"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
          className="grid size-7 shrink-0 place-items-center rounded-lg text-ink-faint hover:text-ink"
        >
          <ChevronDown
            className={classNames("size-4 transition-transform", collapsed && "-rotate-90")}
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          onClick={() => editor.selectScene(props.scene.id)}
          aria-current={selected}
          className="flex min-w-0 flex-1 items-center gap-2.5 py-1 text-left"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{headline}</span>
            <span className="flex items-center gap-1.5 text-[11px] text-ink-faint">
              <span className="font-mono">{String(props.index + 1).padStart(2, "0")}</span>
              {blockLabels[props.scene.block]}
              {props.scene.beat ? <span>· {props.scene.beat}</span> : null}
            </span>
          </span>
        </button>
        {verdict && verdict !== "supported" ? <VerdictBadge verdict={verdict} /> : null}
        <Menu
          label={`Scene ${props.index + 1} actions`}
          align="end"
          triggerClassName="grid size-7 place-items-center rounded-lg text-ink-faint hover:bg-panel-hover hover:text-ink"
          trigger={<MoreVertical className="size-4" aria-hidden="true" />}
          items={sceneMenuItems({
            editor,
            scene: props.scene,
            index: props.index,
            count: props.count,
            onRegenerate: () => setRegenerating(true),
          })}
        />
      </div>
      {regenerating ? (
        <RegenerateForm sceneId={props.scene.id} onClose={() => setRegenerating(false)} />
      ) : null}
      {collapsed ? null : (
        <ul className="mt-1 space-y-0.5 pl-6">
          {lineIndexes.map(({ lineIndex }) => (
            <LineRow
              key={`${props.scene.id}-${lineIndex}`}
              scene={props.scene}
              lineIndex={lineIndex}
              clip={props.clips.find(
                (clip) => clip.sceneId === props.scene.id && clip.lineIndex === lineIndex,
              )}
            />
          ))}
          {props.scene.narration.length === 0 ? (
            <li className="px-2 py-1.5 text-xs text-ink-faint">No narration: music carries this scene.</li>
          ) : null}
        </ul>
      )}
    </li>
  );
}

/** Scenes and their narration lines as a tree; play a line, reorder, add, duplicate or regenerate a scene. */
export function ScriptPanel(): React.ReactElement {
  const editor = useEditor();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const clips = useMemo(() => lineClips(editor.timeline), [editor.timeline]);
  const { storyboard } = editor.draft;
  const templates = templateBlocks();
  const addable = blocksAllowedInLook(storyboard.look).filter((block) => templates.has(block));
  return (
    <EditorPanel
      title="Script"
      actions={
        <>
          <IconButton label="Search the script" active={searching} onClick={() => setSearching(!searching)}>
            <Search className="size-4" aria-hidden="true" />
          </IconButton>
          <Menu
            label="Add a scene"
            align="end"
            heading="Add after the selected scene"
            triggerClassName="grid size-8 place-items-center rounded-lg border border-line bg-panel-raised text-ink-muted hover:text-ink"
            trigger={<Plus className="size-4" aria-hidden="true" />}
            items={addable.map((block) => ({
              id: block,
              label: blockLabels[block],
              Icon: blockIcons[block],
              disabled: !editor.editable,
              onSelect: () =>
                editor.applyEdit((current) =>
                  insertScene({ storyboard: current, afterSceneId: editor.selectedSceneId, block }),
                ),
            }))}
          />
        </>
      }
    >
      {searching ? (
        <label className="mb-2 flex items-center gap-2 rounded-xl border border-line bg-panel-raised px-3 py-2">
          <Search className="size-3.5 text-ink-faint" aria-hidden="true" />
          <span className="sr-only">Search lines</span>
          <input
            // biome-ignore lint/a11y/noAutofocus: opened on purpose by the search button
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a line"
            className="w-full bg-transparent text-sm placeholder:text-ink-faint focus:outline-none"
          />
        </label>
      ) : null}
      <ol className="space-y-2" aria-label="Scenes">
        {storyboard.scenes.map((scene, index) => (
          <SceneGroup
            key={scene.id}
            scene={scene}
            index={index}
            count={storyboard.scenes.length}
            clips={clips}
            query={query.trim().toLowerCase()}
          />
        ))}
      </ol>
    </EditorPanel>
  );
}
