"use client";

import type { AspectRatio, Storyboard, VoiceTimeline } from "@cutroom/scene-spec";
import type { PlayerRef } from "@remotion/player";
import { createContext, useContext } from "react";
import type { RunView } from "@/lib/api-client";
import type { EditorTabId } from "./editor-tabs";
import type { PlayerState } from "./use-player-state";
import type { StoryboardDraft } from "./use-storyboard-draft";

export interface LineSelection {
  sceneId: string;
  lineIndex: number;
}

export interface EditorContextValue {
  run: RunView;
  draft: StoryboardDraft;
  /** Voice timing when the draft matches what was voiced; estimated otherwise. */
  timeline: VoiceTimeline;
  /** Edits are accepted only while the run waits for review. */
  editable: boolean;
  tab: EditorTabId;
  setTab: (tab: EditorTabId) => void;
  selectedSceneId: string | undefined;
  selectedLine: LineSelection | undefined;
  selectScene: (sceneId: string) => void;
  selectLine: (selection: LineSelection) => void;
  playLine: (selection: LineSelection) => void;
  seekToFrame: (frame: number) => void;
  player: PlayerRef | null;
  playerState: PlayerState;
  ratio: AspectRatio;
  setRatio: (ratio: AspectRatio) => void;
  /** Preview override; undefined follows the renderer's rule per ratio. */
  burnCaptions: boolean | undefined;
  setBurnCaptions: (burn: boolean | undefined) => void;
  busy: boolean;
  /** Runs an API call that returns the updated run, with busy and error handling. */
  runAction: (action: () => Promise<RunView>) => Promise<void>;
  /** Applies a storyboard edit, surfacing a refused edit as a message. */
  applyEdit: (change: (storyboard: Storyboard) => Storyboard) => void;
  notice: string | undefined;
  setNotice: (notice: string | undefined) => void;
  openSheet: (sheet: EditorSheet) => void;
}

export type EditorSheet = "brief" | "pipeline" | "renders" | "overrides";

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const value = useContext(EditorContext);
  if (!value) throw new Error("useEditor must be used inside the run editor");
  return value;
}
