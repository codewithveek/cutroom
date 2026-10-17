import type { PrivacyMode } from "@cutroom/scene-spec";
import { Cloud, Laptop, Split } from "lucide-react";
import type React from "react";
import { classNames } from "@/lib/class-names";

interface PrivacyOption {
  mode: PrivacyMode;
  label: string;
  sentence: string;
  providers: string;
  icon: React.ComponentType<{ className?: string }>;
}

const privacyOptions: ReadonlyArray<PrivacyOption> = [
  {
    mode: "local",
    label: "Local",
    sentence: "Everything runs on this machine; Cutroom blocks every outbound connection while it works.",
    providers: "Gemma via Ollama · Kokoro voice · local render",
    icon: Laptop,
  },
  {
    mode: "hybrid",
    label: "Hybrid",
    sentence:
      "Code is read and audited locally; only the approved storyboard bundle goes to a cloud renderer.",
    providers: "Gemma via Ollama · Kokoro voice · cloud render",
    icon: Split,
  },
  {
    mode: "cloud",
    label: "Cloud",
    sentence: "For public repos: analysis on a hosted Gemma GPU, optional ElevenLabs voice.",
    providers: "Hosted Gemma · Kokoro or ElevenLabs · cloud render",
    icon: Cloud,
  },
];

export function PrivacyPicker(props: {
  value: PrivacyMode;
  onChange: (mode: PrivacyMode) => void;
}): React.ReactElement {
  return (
    <div role="radiogroup" aria-label="Privacy mode" className="grid gap-3 md:grid-cols-3">
      {privacyOptions.map((option) => {
        const selected = option.mode === props.value;
        const Icon = option.icon;
        return (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => props.onChange(option.mode)}
            className={classNames(
              "rounded-lg border p-4 text-left transition-colors",
              selected ? "border-accent bg-accent/10" : "border-line bg-panel hover:border-line-strong",
            )}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <Icon className="size-4 text-accent" />
              {option.label}
              {option.mode === "local" ? (
                <span className="ml-auto text-[11px] text-ink-faint">default</span>
              ) : null}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">{option.sentence}</p>
            <p className="mt-2 font-mono text-[11px] text-ink-faint">{option.providers}</p>
          </button>
        );
      })}
    </div>
  );
}
