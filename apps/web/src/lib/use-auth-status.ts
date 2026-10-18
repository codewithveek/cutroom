"use client";

import type { AuthStatus } from "@cutroom/scene-spec";
import { useEffect, useState } from "react";
import { apiClient } from "./api-client";

/** `none` on a local install; the signed-in admin on a deployed one; undefined while loading. */
export function useAuthStatus(): AuthStatus | undefined {
  const [status, setStatus] = useState<AuthStatus>();
  useEffect(() => {
    apiClient
      .authStatus()
      .then(setStatus)
      .catch(() => setStatus(undefined));
  }, []);
  return status;
}
