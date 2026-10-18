"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";

export type SampleState = "idle" | "loading" | "playing";

/**
 * Plays one voice sample at a time. The first request for a voice synthesises it locally with
 * Kokoro (a few seconds); later plays come from the API's cache.
 */
export function useVoiceSample(): {
  stateFor: (voiceId: string) => SampleState;
  toggle: (voiceId: string) => void;
  error: string | undefined;
} {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<{ voiceId: string; state: SampleState }>();
  const [error, setError] = useState<string>();

  useEffect(() => () => audioRef.current?.pause(), []);

  const toggle = useCallback(
    (voiceId: string) => {
      audioRef.current?.pause();
      if (current?.voiceId === voiceId && current.state !== "idle") {
        setCurrent(undefined);
        return;
      }
      setError(undefined);
      const audio = new Audio(apiClient.voiceSampleUrl(voiceId));
      audioRef.current = audio;
      setCurrent({ voiceId, state: "loading" });
      audio.addEventListener("playing", () => setCurrent({ voiceId, state: "playing" }));
      audio.addEventListener("ended", () => setCurrent(undefined));
      audio.addEventListener("error", () => {
        setCurrent(undefined);
        setError("This voice cannot play yet. Download the voice model with `pnpm cutroom setup`.");
      });
      void audio.play().catch(() => undefined);
    },
    [current],
  );

  const stateFor = useCallback(
    (voiceId: string): SampleState => (current?.voiceId === voiceId ? current.state : "idle"),
    [current],
  );
  return { stateFor, toggle, error };
}
