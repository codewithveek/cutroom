"use client";

import type { VoiceOption } from "@cutroom/scene-spec";
import { useEffect, useState } from "react";
import { apiClient } from "./api-client";

export function useVoices(): VoiceOption[] | undefined {
  const [voices, setVoices] = useState<VoiceOption[]>();
  useEffect(() => {
    apiClient
      .listVoices()
      .then((response) => setVoices(response.voices))
      .catch(() => setVoices([]));
  }, []);
  return voices;
}
