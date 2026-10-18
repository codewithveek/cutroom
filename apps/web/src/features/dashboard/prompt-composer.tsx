"use client";

import { type PresetId, presets } from "@cutroom/presets";
import type { AspectRatio, LookId, PrivacyMode, SystemStatus } from "@cutroom/scene-spec";
import {
  ArrowUp,
  Cloud,
  FileArchive,
  FlaskConical,
  Laptop,
  Loader2,
  Paperclip,
  Sparkles,
  Split,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { allRatios, RatioIcon } from "@/components/ui/ratio-icon";
import { buildRunRequest } from "@/features/new-video/run-request";
import { apiClient } from "@/lib/api-client";
import { classNames } from "@/lib/class-names";
import { availableSourceModes, type SourceModeId } from "./source-modes";
import { useArchiveUpload } from "./use-archive-upload";

const privacyOptions = [
  { value: "local", label: "Local", description: "Nothing leaves this machine.", Icon: Laptop },
  {
    value: "hybrid",
    label: "Hybrid",
    description: "Only the approved render bundle goes to your render host.",
    Icon: Split,
  },
  {
    value: "cloud",
    label: "Cloud",
    description: "Public repos: hosted model, optional ElevenLabs voice.",
    Icon: Cloud,
  },
] as const satisfies ReadonlyArray<{
  value: PrivacyMode;
  label: string;
  description: string;
  Icon: typeof Laptop;
}>;

const lookOptions = [
  { value: "auto", label: "Look: auto", description: "Picked from the repository's signals." },
  { value: "studio", label: "Studio" },
  { value: "editorial", label: "Editorial" },
  { value: "graphic", label: "Graphic" },
  { value: "cinematic", label: "Cinematic" },
] as const satisfies ReadonlyArray<{ value: LookId | "auto"; label: string; description?: string }>;

function ModelChip(props: { status: SystemStatus | undefined }): React.ReactElement | null {
  if (!props.status) return null;
  const check = props.status.checks.find((candidate) => candidate.id === "model");
  const scripted = props.status.model.provider === "scripted";
  return (
    <span
      title={check?.detail}
      className="hidden items-center gap-1.5 rounded-lg px-2 text-xs text-ink-faint sm:flex"
    >
      {scripted ? (
        <FlaskConical className="size-3.5" aria-hidden="true" />
      ) : (
        <Sparkles className="size-3.5" aria-hidden="true" />
      )}
      {scripted ? "Scripted demo model" : props.status.model.modelId}
      <span
        className={classNames(
          "size-1.5 rounded-full",
          check?.state === "ready" ? "bg-supported" : "bg-unsupported",
        )}
        aria-hidden="true"
      />
    </span>
  );
}

function RatioToggles(props: {
  value: ReadonlyArray<AspectRatio>;
  onChange: (ratios: AspectRatio[]) => void;
}): React.ReactElement {
  const toggle = (ratio: AspectRatio) => {
    const next = props.value.includes(ratio)
      ? props.value.filter((item) => item !== ratio)
      : allRatios.filter((item) => item === ratio || props.value.includes(item));
    if (next.length > 0) props.onChange(next);
  };
  return (
    <fieldset className="flex items-center rounded-lg">
      <legend className="sr-only">Aspect ratios</legend>
      {allRatios.map((ratio) => (
        <button
          key={ratio}
          type="button"
          aria-pressed={props.value.includes(ratio)}
          title={ratio}
          onClick={() => toggle(ratio)}
          className={classNames(
            "grid size-8 place-items-center rounded-lg transition-colors",
            props.value.includes(ratio) ? "bg-accent-soft text-accent" : "text-ink-faint hover:text-ink",
          )}
        >
          <RatioIcon ratio={ratio} className="size-[18px]" />
          <span className="sr-only">{ratio}</span>
        </button>
      ))}
    </fieldset>
  );
}

export interface PromptComposerProps {
  status: SystemStatus | undefined;
}

/** The dashboard's one input: where the video comes from, a direction, and the few choices that matter. */
export function PromptComposer(props: PromptComposerProps): React.ReactElement {
  const router = useRouter();
  const modes = availableSourceModes();
  const [sourceMode, setSourceMode] = useState<SourceModeId>("repository");
  const [repo, setRepo] = useState("");
  const [direction, setDirection] = useState("");
  const [presetId, setPresetId] = useState<PresetId>("launch-editorial");
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>("local");
  const [privacyChosen, setPrivacyChosen] = useState(false);
  const serverDefaultPrivacy = props.status?.defaultPrivacyMode;
  // Start from the deployment's default (Cloud on a host without Ollama) until the user picks one.
  useEffect(() => {
    if (serverDefaultPrivacy && !privacyChosen) setPrivacyMode(serverDefaultPrivacy);
  }, [serverDefaultPrivacy, privacyChosen]);
  const [look, setLook] = useState<LookId | "auto">("auto");
  const [ratios, setRatios] = useState<AspectRatio[]>(presets["launch-editorial"].ratios);
  const [submitting, setSubmitting] = useState(false);
  const archive = useArchiveUpload();
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasSource = Boolean(archive.upload) || repo.trim().length > 0;
  const [error, setError] = useState<string>();
  const mode = modes.find((candidate) => candidate.id === sourceMode) ?? modes[0];

  const choosePreset = (nextPresetId: PresetId) => {
    setPresetId(nextPresetId);
    setRatios(presets[nextPresetId].ratios);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasSource) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const run = await apiClient.createRun(
        buildRunRequest({ repo, upload: archive.upload, presetId, privacyMode, ratios, look, direction }),
      );
      router.push(`/runs/${run.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 sm:pb-0">
        <legend className="sr-only">Video type</legend>
        {Object.values(presets).map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={preset.id === presetId}
            onClick={() => choosePreset(preset.id)}
            className={classNames(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] whitespace-nowrap transition-colors",
              preset.id === presetId
                ? "border-accent/60 bg-accent-soft text-ink"
                : "border-line bg-panel text-ink-muted hover:border-line-strong hover:text-ink",
            )}
          >
            {preset.label}
          </button>
        ))}
      </fieldset>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: dropping a zip is a shortcut; the attach button does the same */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) void archive.attach(file);
        }}
        className={classNames(
          "relative rounded-2xl border bg-panel shadow-[var(--shadow-panel)] transition-colors focus-within:border-line-strong",
          dragging ? "border-accent" : "border-line",
        )}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-accent to-transparent"
        />
        {modes.length > 1 ? (
          <div className="flex gap-1 px-4 pt-3">
            {modes.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                aria-pressed={candidate.id === sourceMode}
                onClick={() => setSourceMode(candidate.id)}
                className="rounded-md px-2 py-1 text-xs text-ink-muted aria-pressed:bg-panel-hover aria-pressed:text-ink"
              >
                {candidate.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-3 px-4 pt-4">
          {mode ? <mode.Icon className="size-5 shrink-0 text-ink-faint" aria-hidden="true" /> : null}
          {archive.upload ? (
            <span className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-panel-raised px-2.5 py-1.5 text-sm">
              <FileArchive className="size-4 shrink-0 text-accent" aria-hidden="true" />
              <span className="truncate font-mono">{archive.upload.fileName}</span>
              <span className="shrink-0 text-xs text-ink-faint">{archive.upload.files} files</span>
              <button
                type="button"
                aria-label="Remove the archive"
                onClick={archive.clear}
                className="ml-auto text-ink-faint hover:text-ink"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </span>
          ) : (
            <label className="min-w-0 flex-1">
              <span className="sr-only">Repository</span>
              <input
                id="repo"
                value={repo}
                onChange={(event) => setRepo(event.target.value)}
                placeholder={archive.uploading ? "Uploading the archive…" : mode?.placeholder}
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-transparent font-mono text-[15px] text-ink placeholder:font-sans placeholder:text-ink-faint focus:outline-none"
              />
            </label>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void archive.attach(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            aria-label="Upload a .zip of the repository"
            title="Upload a .zip (or drop one here)"
            disabled={archive.uploading}
            onClick={() => fileInputRef.current?.click()}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-faint hover:bg-panel-hover hover:text-ink disabled:opacity-40"
          >
            {archive.uploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Paperclip className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
        <label className="block px-4 pt-2 pb-1 sm:pl-12">
          <span className="sr-only">Direction</span>
          <textarea
            id="direction"
            rows={2}
            maxLength={280}
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
            placeholder="Add direction (optional): who it is for, what to focus on, what to leave out…"
            className="w-full resize-none bg-transparent text-sm text-ink-muted placeholder:text-ink-faint focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap items-center gap-1 border-t border-line px-3 py-2">
          <DropdownSelect
            label="Privacy"
            options={privacyOptions}
            value={privacyMode}
            onChange={(mode) => {
              setPrivacyChosen(true);
              setPrivacyMode(mode);
            }}
          />
          <DropdownSelect label="Look" options={lookOptions} value={look} onChange={setLook} />
          <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
          <RatioToggles value={ratios} onChange={setRatios} />
          <div className="ml-auto flex items-center gap-2">
            <ModelChip status={props.status} />
            <button
              type="submit"
              aria-label="Make the video"
              disabled={submitting || !hasSource}
              className="grid size-9 place-items-center rounded-full bg-ink text-canvas transition-opacity disabled:opacity-30"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowUp className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs">
        {props.status?.demoRepositoryPath ? (
          <button
            type="button"
            onClick={() => setRepo(props.status?.demoRepositoryPath ?? "")}
            className="rounded-full border border-line px-3 py-1.5 text-ink-muted hover:border-line-strong hover:text-ink"
          >
            Try the sample repository (shipnote)
          </button>
        ) : (
          <span />
        )}
        {error || archive.error ? <p className="text-unsupported">{error ?? archive.error}</p> : null}
        <Link href="/new" className="text-ink-faint hover:text-ink">
          Advanced setup: brand colour, every option →
        </Link>
      </div>
    </form>
  );
}
