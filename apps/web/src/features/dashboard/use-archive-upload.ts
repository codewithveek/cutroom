"use client";

import type { UploadResult } from "@cutroom/scene-spec";
import { useCallback, useState } from "react";
import { apiClient } from "@/lib/api-client";

export interface ArchiveUpload {
  upload: UploadResult | undefined;
  uploading: boolean;
  error: string | undefined;
  attach: (file: File) => Promise<void>;
  clear: () => void;
}

/** Sends a .zip to the API, which extracts it; the result becomes the run's source. */
export function useArchiveUpload(): ArchiveUpload {
  const [upload, setUpload] = useState<UploadResult>();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const attach = useCallback(async (file: File) => {
    if (!/\.zip$/i.test(file.name)) {
      setError("Only .zip archives can be uploaded.");
      return;
    }
    setUploading(true);
    setError(undefined);
    try {
      setUpload(await apiClient.uploadArchive(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setUploading(false);
    }
  }, []);
  return { upload, uploading, error, attach, clear: useCallback(() => setUpload(undefined), []) };
}
