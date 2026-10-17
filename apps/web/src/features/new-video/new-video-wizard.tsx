"use client";

import { type PresetId, presets } from "@cutroom/presets";
import type { AspectRatio, LookId, PrivacyMode, RunRequestInput } from "@cutroom/scene-spec";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Label, TextInput } from "@/components/ui/field";
import { apiClient } from "@/lib/api-client";
import { classNames } from "@/lib/class-names";
import { LookPicker } from "./look-picker";
import { PrivacyPicker } from "./privacy-picker";

const ratioOptions: ReadonlyArray<AspectRatio> = ["16:9", "9:16", "1:1", "4:5"];

function sourceFor(repo: string): RunRequestInput["source"] {
  return /^(https:\/\/|git@)/.test(repo.trim())
    ? { kind: "git", url: repo.trim() }
    : { kind: "path", path: repo.trim() };
}

function PresetPicker(props: {
  value: PresetId;
  onChange: (presetId: PresetId) => void;
}): React.ReactElement {
  return (
    <div role="radiogroup" aria-label="Preset" className="grid gap-3 md:grid-cols-3">
      {Object.values(presets).map((preset) => (
        <button
          key={preset.id}
          type="button"
          role="radio"
          aria-checked={preset.id === props.value}
          onClick={() => props.onChange(preset.id)}
          className={classNames(
            "rounded-lg border p-4 text-left transition-colors",
            preset.id === props.value
              ? "border-accent bg-accent/10"
              : "border-line bg-panel hover:border-line-strong",
          )}
        >
          <div className="text-sm font-medium">{preset.label}</div>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">{preset.description}</p>
          <p className="mt-2 font-mono text-[11px] text-ink-faint">
            {preset.ratios.join(" · ")} · {preset.targetSeconds}s
          </p>
        </button>
      ))}
    </div>
  );
}

function RatioChips(props: {
  value: AspectRatio[];
  onChange: (ratios: AspectRatio[]) => void;
}): React.ReactElement {
  const toggle = (ratio: AspectRatio) => {
    const next = props.value.includes(ratio)
      ? props.value.filter((item) => item !== ratio)
      : [...props.value, ratio];
    if (next.length > 0) props.onChange(next);
  };
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Aspect ratios">
      {ratioOptions.map((ratio) => (
        <button
          key={ratio}
          type="button"
          aria-pressed={props.value.includes(ratio)}
          onClick={() => toggle(ratio)}
          className={classNames(
            "rounded-md border px-3 py-1.5 font-mono text-xs",
            props.value.includes(ratio)
              ? "border-accent bg-accent/10 text-ink"
              : "border-line text-ink-muted hover:text-ink",
          )}
        >
          {ratio}
        </button>
      ))}
    </div>
  );
}

function Step(props: {
  number: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Card>
      <CardHeader
        title={`${props.number}. ${props.title}`}
        {...(props.description ? { description: props.description } : {})}
      />
      <div className="p-5">{props.children}</div>
    </Card>
  );
}

/** Source → Privacy → Preset or custom → Brand (PRD §9 screen 1). */
export function NewVideoWizard(): React.ReactElement {
  const router = useRouter();
  const [repo, setRepo] = useState("");
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>("local");
  const [presetId, setPresetId] = useState<PresetId>("launch-editorial");
  const [look, setLook] = useState<LookId | "auto">("editorial");
  const [ratios, setRatios] = useState<AspectRatio[]>(presets["launch-editorial"].ratios);
  const [accentColor, setAccentColor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const choosePreset = (nextPresetId: PresetId) => {
    setPresetId(nextPresetId);
    setLook(presets[nextPresetId].look);
    setRatios(presets[nextPresetId].ratios);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const preset = presets[presetId];
    setSubmitting(true);
    setError(undefined);
    try {
      const run = await apiClient.createRun({
        source: sourceFor(repo),
        presetId,
        videoType: preset.videoType,
        ...(look === "auto" ? {} : { look }),
        ratios,
        targetSeconds: preset.targetSeconds,
        voice: preset.voice,
        music: preset.music,
        privacyMode,
        ...(/^#[0-9a-fA-F]{6}$/.test(accentColor) ? { brandOverride: { accentColor } } : {}),
      });
      router.push(`/runs/${run.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-5xl space-y-5 px-5 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Make a product video from your code</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Cutroom reads the repository, writes a brief with evidence, plans a storyboard and checks every
          claim against the code before anything is rendered. A launch film without a freelancer or a week in
          After Effects.
        </p>
      </div>
      <Step number={1} title="Source" description="A folder on this machine, or a git URL (shallow-cloned).">
        <Label htmlFor="repo">Repository</Label>
        <TextInput
          id="repo"
          required
          value={repo}
          onChange={(event) => setRepo(event.target.value)}
          placeholder="~/code/my-app or https://github.com/you/app"
        />
      </Step>
      <Step number={2} title="Privacy">
        <PrivacyPicker value={privacyMode} onChange={setPrivacyMode} />
      </Step>
      <Step
        number={3}
        title="Preset"
        description="Presets fill video type, look, ratios, length, voice and music in one click."
      >
        <PresetPicker value={presetId} onChange={choosePreset} />
        <div className="mt-6 space-y-2">
          <div className="text-xs font-medium text-ink-muted">Look</div>
          <LookPicker value={look} onChange={setLook} />
        </div>
        <div className="mt-6 space-y-2">
          <div className="text-xs font-medium text-ink-muted">Aspect ratios</div>
          <RatioChips value={ratios} onChange={setRatios} />
        </div>
      </Step>
      <Step
        number={4}
        title="Brand"
        description="Detected from the repo (Tailwind config, CSS variables, logo). Override the accent here."
      >
        <Label htmlFor="accent" hint="optional, #rrggbb">
          Accent colour
        </Label>
        <TextInput
          id="accent"
          value={accentColor}
          onChange={(event) => setAccentColor(event.target.value)}
          placeholder="#7c5cff"
          className="max-w-40 font-mono"
        />
      </Step>
      <div className="flex items-center justify-end gap-4">
        {error ? <p className="text-sm text-unsupported">{error}</p> : null}
        <Button type="submit" variant="primary" disabled={submitting || !repo.trim()}>
          {submitting ? "Starting…" : "Analyse repository"}
        </Button>
      </div>
    </form>
  );
}
