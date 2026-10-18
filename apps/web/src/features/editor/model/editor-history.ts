/** Undo/redo over immutable snapshots: the editor's storyboard drafts. */
export interface History<State> {
  past: ReadonlyArray<State>;
  present: State;
  future: ReadonlyArray<State>;
}

export const HISTORY_LIMIT = 100;

export function createHistory<State>(present: State): History<State> {
  return { past: [], present, future: [] };
}

export function pushHistory<State>(history: History<State>, next: State): History<State> {
  if (Object.is(next, history.present)) return history;
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
  };
}

export function undoHistory<State>(history: History<State>): History<State> {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redoHistory<State>(history: History<State>): History<State> {
  const [next, ...rest] = history.future;
  if (next === undefined) return history;
  return { past: [...history.past, history.present], present: next, future: rest };
}
