"use client";

import type { SystemStatus } from "@cutroom/scene-spec";
import { useEffect, useState } from "react";
import { apiClient } from "./api-client";

/** The toolchain report from the API; undefined while loading or when the API is down. */
export function useSystemStatus(): { status: SystemStatus | undefined; error: string | undefined } {
  const [status, setStatus] = useState<SystemStatus>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    apiClient
      .systemStatus()
      .then(setStatus)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : String(caught)));
  }, []);
  return { status, error };
}
