"use client";

import type { Storyboard } from "@cutroom/scene-spec";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createHistory, type History, pushHistory, redoHistory, undoHistory } from "./model/editor-history";

export interface StoryboardDraft {
  storyboard: Storyboard;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** Applies an edit; a thrown error (e.g. too few scenes) is returned instead of applied. */
  edit: (change: (storyboard: Storyboard) => Storyboard) => string | undefined;
  undo: () => void;
  redo: () => void;
}

/**
 * The editable copy of the saved storyboard, with undo/redo. A new saved version (after save,
 * regenerate or an agent edit) becomes the new baseline.
 */
export function useStoryboardDraft(options: { saved: Storyboard; savedVersionId: string }): StoryboardDraft {
  const [history, setHistoryState] = useState<History<Storyboard>>(() => createHistory(options.saved));
  const historyRef = useRef(history);
  const { saved, savedVersionId } = options;

  const setHistory = useCallback((next: History<Storyboard>) => {
    historyRef.current = next;
    setHistoryState(next);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the saved version changes
  useEffect(() => {
    setHistory(createHistory(saved));
  }, [savedVersionId]);

  const dirty = useMemo(
    () => JSON.stringify(history.present) !== JSON.stringify(saved),
    [history.present, saved],
  );

  const edit = useCallback(
    (change: (storyboard: Storyboard) => Storyboard): string | undefined => {
      try {
        setHistory(pushHistory(historyRef.current, change(historyRef.current.present)));
        return undefined;
      } catch (caught) {
        return caught instanceof Error ? caught.message : String(caught);
      }
    },
    [setHistory],
  );

  return {
    storyboard: history.present,
    dirty,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    edit,
    undo: useCallback(() => setHistory(undoHistory(historyRef.current)), [setHistory]),
    redo: useCallback(() => setHistory(redoHistory(historyRef.current)), [setHistory]),
  };
}
