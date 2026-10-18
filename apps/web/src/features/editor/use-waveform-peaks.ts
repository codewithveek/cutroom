"use client";

import { useEffect, useState } from "react";

const peaksCache = new Map<string, Promise<number[]>>();

async function decodePeaks(url: string, buckets: number): Promise<number[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Audio ${response.status}`);
  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(await response.arrayBuffer());
    const samples = audio.getChannelData(0);
    const bucketSize = Math.max(1, Math.floor(samples.length / buckets));
    const peaks = Array.from({ length: buckets }, (_, bucket) => {
      let peak = 0;
      const end = Math.min(samples.length, (bucket + 1) * bucketSize);
      for (let index = bucket * bucketSize; index < end; index += 1)
        peak = Math.max(peak, Math.abs(samples[index] ?? 0));
      return peak;
    });
    const loudest = Math.max(...peaks, 1e-6);
    return peaks.map((peak) => peak / loudest);
  } finally {
    void context.close();
  }
}

/** Normalised peaks of a voice clip, decoded once per URL; undefined until ready or without a URL. */
export function useWaveformPeaks(url: string | undefined, buckets: number): number[] | undefined {
  const [peaks, setPeaks] = useState<number[]>();
  useEffect(() => {
    if (!url) {
      setPeaks(undefined);
      return undefined;
    }
    const key = `${url}#${buckets}`;
    let cancelled = false;
    const pending = peaksCache.get(key) ?? decodePeaks(url, buckets);
    peaksCache.set(key, pending);
    pending.then(
      (decoded) => {
        if (!cancelled) setPeaks(decoded);
      },
      () => peaksCache.delete(key),
    );
    return () => {
      cancelled = true;
    };
  }, [url, buckets]);
  return peaks;
}
