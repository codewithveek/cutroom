"use client";

import { type RunEvent, runEventSchema } from "@cutroom/scene-spec";
import { useCallback, useEffect, useState } from "react";
import { apiBaseUrl, apiClient, type RunView } from "./api-client";

export interface RunState {
  run: RunView | undefined;
  events: RunEvent[];
  error: string | undefined;
  refresh: () => Promise<void>;
  replaceRun: (run: RunView) => void;
}

/** Loads a run, streams its events over SSE and refetches when a step finishes. */
export function useRun(runId: string): RunState {
  const [run, setRun] = useState<RunView>();
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      setRun(await apiClient.getRun(runId));
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [runId]);

  useEffect(() => {
    void refresh();
    const source = new EventSource(`${apiBaseUrl}/runs/${runId}/events`);
    source.addEventListener("run-event", (message) => {
      const parsed = runEventSchema.safeParse(JSON.parse((message as MessageEvent<string>).data));
      if (!parsed.success) return;
      const event = parsed.data;
      setEvents((previous) =>
        previous.some((existing) => existing.id === event.id) ? previous : [...previous, event],
      );
      if (event.kind !== "progress" || event.payload.awaitingReview) void refresh();
    });
    return () => source.close();
  }, [runId, refresh]);

  return { run, events, error, refresh, replaceRun: setRun };
}
