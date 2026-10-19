"use client";

import type { SystemStatus } from "@cutroom/scene-spec";
import { useEffect, useState } from "react";
import { apiClient } from "./api-client";

/** One request per page load: the banner, the dashboard and the editor all read the same report. */
let pendingStatus: Promise<SystemStatus> | undefined;

function loadSystemStatus(): Promise<SystemStatus> {
  pendingStatus ??= apiClient.systemStatus().catch((caught: unknown) => {
    pendingStatus = undefined;
    throw caught;
  });
  return pendingStatus;
}

/** The toolchain report from the API; undefined while loading or when the API is down. */
export function useSystemStatus(): { status: SystemStatus | undefined; error: string | undefined } {
  const [status, setStatus] = useState<SystemStatus>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    loadSystemStatus()
      .then(setStatus)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : String(caught)));
  }, []);
  return { status, error };
}
