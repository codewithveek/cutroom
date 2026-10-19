"use client";

import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { launchVideoSource } from "./launch-video-source";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const controlClassName =
  "grid size-10 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80";

/**
 * Autoplays muted and looped, unless the visitor asked for reduced motion; then it waits for play.
 * Sound and play state are real buttons.
 */
export function LaunchVideo(): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || prefersReducedMotion()) return;
    // Autoplay can still be refused (data saver); the play button stays there for that.
    void video.play().catch(() => undefined);
  }, []);

  const togglePlaying = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  };

  const toggleMuted = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    if (!video.muted && video.paused) void video.play().catch(() => undefined);
  };

  return (
    <figure className="mx-auto w-full max-w-[22rem]">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-panel shadow-[var(--shadow-panel)]">
        <video
          ref={videoRef}
          src={launchVideoSource.src}
          poster={launchVideoSource.poster}
          width={launchVideoSource.width}
          height={launchVideoSource.height}
          muted
          loop
          playsInline
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className="block h-auto w-full"
          aria-label="Cutroom's launch video, with captions"
        />
        {/* Top corner: the bottom one carries the video's "created with cutroom" badge. */}
        <div className="absolute top-3 right-3 flex gap-2">
          <button
            type="button"
            onClick={togglePlaying}
            aria-label={playing ? "Pause the video" : "Play the video"}
            className={controlClassName}
          >
            {playing ? (
              <Pause className="size-4" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={toggleMuted}
            aria-label={muted ? "Unmute the video" : "Mute the video"}
            aria-pressed={!muted}
            className={controlClassName}
          >
            {muted ? (
              <VolumeX className="size-4" aria-hidden="true" />
            ) : (
              <Volume2 className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-sm text-ink-muted">{launchVideoSource.caption}</figcaption>
    </figure>
  );
}
