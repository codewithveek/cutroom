"use client";

import type { VoiceOption } from "@cutroom/scene-spec";
import { Loader2, Play, Square } from "lucide-react";
import type React from "react";
import { classNames } from "@/lib/class-names";
import { useVoiceSample } from "./use-voice-sample";

/** A deterministic two-colour orb per voice, so each one is recognisable at a glance. */
function orbGradient(voiceId: string): string {
  let hash = 0;
  for (const character of voiceId) hash = (hash * 31 + character.charCodeAt(0)) % 360;
  return `radial-gradient(circle at 30% 30%, hsl(${hash} 90% 80%), hsl(${(hash + 60) % 360} 80% 55%) 60%, hsl(${(hash + 140) % 360} 70% 40%))`;
}

function SampleBars(props: { playing: boolean }): React.ReactElement {
  return (
    <span aria-hidden="true" className="flex h-5 items-center gap-[3px]">
      {[0.5, 0.9, 0.6, 1, 0.7].map((height, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed decorative meter
          key={index}
          className={classNames("w-[3px] rounded-full bg-accent", props.playing && "animate-pulse")}
          style={{
            height: `${height * 100}%`,
            animationDelay: `${index * 120}ms`,
            opacity: props.playing ? 1 : 0.45,
          }}
        />
      ))}
    </span>
  );
}

export interface VoiceListProps {
  voices: ReadonlyArray<VoiceOption>;
  selectedVoiceId?: string | undefined;
  onSelect?: ((voice: VoiceOption) => void) | undefined;
  disabled?: boolean;
}

/** Voices as cards: pick one (when `onSelect` is given) and hear a sample of each. */
export function VoiceList(props: VoiceListProps): React.ReactElement {
  const sample = useVoiceSample();
  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {props.voices.map((voice) => {
          const selected = voice.id === props.selectedVoiceId;
          const state = sample.stateFor(voice.id);
          const SampleIcon = state === "loading" ? Loader2 : state === "playing" ? Square : Play;
          return (
            <li
              key={voice.id}
              className={classNames(
                "flex items-center gap-3 rounded-xl border p-2.5 transition-colors",
                selected ? "border-accent/60 bg-accent-soft" : "border-transparent bg-panel-raised",
              )}
            >
              <button
                type="button"
                disabled={!props.onSelect || props.disabled}
                aria-pressed={props.onSelect ? selected : undefined}
                onClick={() => props.onSelect?.(voice)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
              >
                <span
                  className="size-9 shrink-0 rounded-full"
                  style={{ background: orbGradient(voice.id) }}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{voice.name}</span>
                  <span className="block truncate text-xs text-ink-faint">
                    {voice.accent} · {voice.gender} · grade {voice.grade}
                  </span>
                </span>
              </button>
              <SampleBars playing={state === "playing"} />
              <button
                type="button"
                onClick={() => sample.toggle(voice.id)}
                aria-label={state === "idle" ? `Play a sample of ${voice.name}` : `Stop ${voice.name}`}
                className="grid size-8 shrink-0 place-items-center rounded-full bg-panel-hover text-ink-muted hover:text-ink"
              >
                <SampleIcon
                  className={classNames("size-3.5", state === "loading" && "animate-spin")}
                  aria-hidden="true"
                />
              </button>
            </li>
          );
        })}
      </ul>
      {sample.error ? <p className="text-xs text-unsupported">{sample.error}</p> : null}
    </div>
  );
}
