"use client";

import { useEffect, useState } from "react";
import { apiClient } from "./api-client";

const LOOKUP_DELAY_MS = 400;

/** Tags of the local repository typed in the composer, newest first; empty for git URLs. */
export function useRepositoryTags(repo: string): string[] {
  const [tags, setTags] = useState<string[]>([]);
  useEffect(() => {
    const path = repo.trim();
    if (!path || /^(https:\/\/|git@)/.test(path)) {
      setTags([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      apiClient
        .listTags(path)
        .then((response) => {
          if (!cancelled) setTags(response.tags);
        })
        .catch(() => {
          if (!cancelled) setTags([]);
        });
    }, LOOKUP_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [repo]);
  return tags;
}
