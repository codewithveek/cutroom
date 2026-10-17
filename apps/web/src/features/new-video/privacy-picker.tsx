import type { PrivacyMode } from "@cutroom/scene-spec";
import { Cloud, Laptop, Split } from "lucide-react";
import type React from "react";
import { RadioCards } from "@/components/ui/radio-cards";

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
    <RadioCards
      name="privacy-mode"
      legend="Privacy mode"
      value={props.value}
      onChange={props.onChange}
      className="grid gap-3 md:grid-cols-3"
      options={privacyOptions.map((option) => {
        const Icon = option.icon;
        return {
          value: option.mode,
          content: (
            <>
              <span className="flex items-center gap-2 text-sm font-medium">
                <Icon className="size-4 text-accent" />
                {option.label}
                {option.mode === "local" ? (
                  <span className="ml-auto text-[11px] text-ink-faint">default</span>
                ) : null}
              </span>
              <span className="mt-2 block text-xs leading-relaxed text-ink-muted">{option.sentence}</span>
              <span className="mt-2 block font-mono text-[11px] text-ink-faint">{option.providers}</span>
            </>
          ),
        };
      })}
    />
  );
}
