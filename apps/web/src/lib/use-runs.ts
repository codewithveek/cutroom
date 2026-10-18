"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, type RunView } from "./api-client";

export interface RunsState {
  runs: RunView[] | undefined;
  error: string | undefined;
  refresh: () => Promise<void>;
}

/** Every run, refreshed on an interval so the sidebar and dashboard follow live progress. */
export function useRuns(options: { intervalMs?: number } = {}): RunsState {
  const intervalMs = options.intervalMs ?? 8000;
  const [runs, setRuns] = useState<RunView[]>();
  const [error, setError] = useState<string>();
  const refresh = useCallback(async () => {
    try {
      setRuns((await apiClient.listRuns()).runs);
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [refresh, intervalMs]);
  return { runs, error, refresh };
}
