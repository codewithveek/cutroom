"use client";

import { type PresetId, presets } from "@cutroom/presets";
import type { AspectRatio, LookId, PrivacyMode } from "@cutroom/scene-spec";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Label, TextArea, TextInput } from "@/components/ui/field";
import { RadioCards } from "@/components/ui/radio-cards";
import { apiClient } from "@/lib/api-client";
import { classNames } from "@/lib/class-names";
import { LookPicker } from "./look-picker";
import { PrivacyPicker } from "./privacy-picker";
import { buildRunRequest } from "./run-request";

const ratioOptions: ReadonlyArray<AspectRatio> = ["16:9", "9:16", "1:1", "4:5"];

function PresetPicker(props: {
  value: PresetId;
  onChange: (presetId: PresetId) => void;
}): React.ReactElement {
  return (
    <RadioCards
      name="preset"
      legend="Preset"
      value={props.value}
      onChange={props.onChange}
      className="grid gap-3 md:grid-cols-3"
      options={Object.values(presets).map((preset) => ({
        value: preset.id,
        content: (
          <>
            <span className="block text-sm font-medium">{preset.label}</span>
            <span className="mt-1 block text-xs leading-relaxed text-ink-muted">{preset.description}</span>
            <span className="mt-2 block font-mono text-[11px] text-ink-faint">
              {preset.ratios.join(" · ")} · {preset.targetSeconds}s
            </span>
          </>
        ),
      }))}
    />
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
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">Aspect ratios</legend>
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
    </fieldset>
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
export function NewVideoWizard(props: { initialPresetId?: PresetId }): React.ReactElement {
  const router = useRouter();
  const initialPreset = presets[props.initialPresetId ?? "launch-editorial"];
  const [repo, setRepo] = useState("");
  const [direction, setDirection] = useState("");
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>("local");
  const [presetId, setPresetId] = useState<PresetId>(initialPreset.id);
  const [look, setLook] = useState<LookId | "auto">(initialPreset.look);
  const [ratios, setRatios] = useState<AspectRatio[]>(initialPreset.ratios);
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
    setSubmitting(true);
    setError(undefined);
    try {
      const run = await apiClient.createRun(
        buildRunRequest({ repo, presetId, privacyMode, ratios, look, accentColor, direction }),
      );
      router.push(`/runs/${run.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-5xl space-y-5 px-3 py-6 sm:px-5 sm:py-8">
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
        <div className="mt-4">
          <Label htmlFor="direction" hint="optional, up to 280 characters">
            Direction
          </Label>
          <TextArea
            id="direction"
            maxLength={280}
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
            placeholder="Who it is for, what to focus on, what to leave out"
          />
        </div>
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
