"use client";

import { Cloud, Laptop, Split } from "lucide-react";
import type React from "react";
import { ThemeSwitch } from "@/components/app-shell/theme-switch";
import { PageFrame, PageHeader } from "@/components/page-header";
import { SystemCheckCard } from "@/components/system-check-card";
import { VoiceList } from "@/features/voice/voice-list";
import { useSystemStatus } from "@/lib/use-system-status";
import { useVoices } from "@/lib/use-voices";

function Section(props: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section
      aria-labelledby={props.id}
      className="grid gap-6 border-t border-line pt-8 lg:grid-cols-[260px_minmax(0,1fr)]"
    >
      <div>
        <h2 id={props.id} className="text-sm font-semibold">
          {props.title}
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{props.description}</p>
      </div>
      <div>{props.children}</div>
    </section>
  );
}

const privacyModes = [
  {
    label: "Local",
    Icon: Laptop,
    text: "Gemma via Ollama, Kokoro voice and the render all run here. An egress guard blocks every non-loopback connection while a run works.",
  },
  {
    label: "Hybrid",
    Icon: Split,
    text: "Analysis, audit, review and voice stay here. Only the approved render bundle goes to your render host, after you confirm its manifest.",
  },
  {
    label: "Cloud",
    Icon: Cloud,
    text: "For public repositories: a hosted OpenAI-compatible model and optional ElevenLabs voice.",
  },
];

/** What this installation runs on. Values come from the API's environment (`.env`), shown read-only. */
export function SettingsView(): React.ReactElement {
  const { status, error } = useSystemStatus();
  const voices = useVoices();
  return (
    <PageFrame>
      <PageHeader
        title="Settings"
        description="Cutroom reads its configuration from the API's environment (.env). This page shows what it found and how to fix what is missing."
      />
      {error ? <p className="text-sm text-unsupported">The API is not answering: {error}</p> : null}
      <Section id="toolchain" title="Toolchain" description="What a Local run needs, checked live.">
        <ul className="grid gap-3 sm:grid-cols-2">
          {status?.checks.map((check) => (
            <li key={check.id}>
              <SystemCheckCard check={check} />
            </li>
          ))}
        </ul>
      </Section>
      <Section
        id="model"
        title="Model"
        description="Set MODEL_ID and OLLAMA_HOST in .env; pull models with ollama pull."
      >
        <div className="rounded-xl border border-line bg-panel p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">In use</span>
            <span className="font-mono">{status?.model.modelId ?? "…"}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {status?.model.installedModels.length ? (
              status.model.installedModels.map((model) => (
                <span
                  key={model}
                  className="rounded-md bg-panel-raised px-2 py-0.5 font-mono text-xs text-ink-muted"
                >
                  {model}
                </span>
              ))
            ) : (
              <span className="text-xs text-ink-faint">
                {status?.model.provider === "scripted"
                  ? "Scripted model: no Ollama needed."
                  : "No models reported by Ollama."}
              </span>
            )}
          </div>
        </div>
      </Section>
      <Section
        id="voices"
        title="Voices"
        description="Kokoro voices graded C or better, best first. Samples are synthesised on this machine."
      >
        {voices ? <VoiceList voices={voices} /> : <p className="text-sm text-ink-faint">Loading…</p>}
      </Section>
      <Section
        id="privacy"
        title="Privacy modes"
        description="Enforced in code at the provider factory, not by configuration labels."
      >
        <ul className="space-y-2">
          {privacyModes.map(({ label, Icon, text }) => (
            <li key={label} className="flex gap-3 rounded-xl border border-line bg-panel p-3.5">
              <Icon className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
              <div>
                <div className="text-sm font-medium">{label}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>
      <Section id="appearance" title="Appearance" description="Stored in this browser.">
        <div className="max-w-xs">
          <ThemeSwitch collapsed={false} />
        </div>
      </Section>
    </PageFrame>
  );
}
