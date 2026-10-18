"use client";

import { ImageOff, MonitorPlay, Sparkles } from "lucide-react";
import type React from "react";
import { Label, TextInput } from "@/components/ui/field";
import { apiClient } from "@/lib/api-client";
import { isEnabled } from "@/lib/capabilities";
import { useEditor } from "../editor-context";
import { EditorPanel } from "../editor-panel";
import { setBrandAccent } from "../model/storyboard-edits";

function Placeholder(props: { Icon: typeof Sparkles; title: string; text: string }): React.ReactElement {
  return (
    <div className="flex gap-3 rounded-xl border border-dashed border-line-strong p-3">
      <props.Icon className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
      <div>
        <div className="text-sm font-medium">{props.title}</div>
        <p className="mt-0.5 text-xs text-ink-faint">{props.text}</p>
      </div>
    </div>
  );
}

/** The brand the video wears: logo and name from the repository, and the accent colour. */
export function MediaPanel(): React.ReactElement {
  const editor = useEditor();
  const { brand } = editor.draft.storyboard;
  const logo = editor.run.media.find((item) => item.kind === "logo");
  const accent = brand.accentColor ?? "";
  return (
    <EditorPanel title="Media" bodyClassName="space-y-5 px-4 pb-4">
      <section className="space-y-3">
        <h3 className="text-xs font-medium text-ink-muted">Brand</h3>
        <div className="flex items-center gap-3 rounded-xl bg-panel-raised p-3">
          <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-panel">
            {logo ? (
              // biome-ignore lint/performance/noImgElement: served by the local API
              <img
                src={apiClient.assetUrl(logo.url)}
                alt={`${brand.name} logo`}
                className="size-full object-contain p-2"
              />
            ) : (
              <ImageOff className="size-5 text-ink-faint" aria-label="No logo found in the repository" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{brand.name}</div>
            {brand.tagline ? <div className="truncate text-xs text-ink-muted">{brand.tagline}</div> : null}
            <div className="mt-1 text-[11px] text-ink-faint">
              {logo ? "Logo found in the repository" : "No logo found; title cards use the initial"}
            </div>
          </div>
        </div>
        <fieldset disabled={!editor.editable} className="space-y-1.5 disabled:opacity-70">
          <Label htmlFor="brand-accent" hint="#rrggbb, replaces the look's accent">
            Accent colour
          </Label>
          <div className="flex gap-2">
            <input
              type="color"
              aria-label="Pick the accent colour"
              value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#ff7a1a"}
              onChange={(event) =>
                editor.applyEdit((storyboard) => setBrandAccent(storyboard, event.target.value))
              }
              className="h-10 w-12 cursor-pointer rounded-md border border-line bg-transparent"
            />
            <TextInput
              id="brand-accent"
              value={accent}
              placeholder="Look default"
              onChange={(event) => {
                const value = event.target.value.trim();
                if (value === "" || /^#[0-9a-fA-F]{6}$/.test(value))
                  editor.applyEdit((storyboard) => setBrandAccent(storyboard, value || undefined));
              }}
              className="font-mono"
            />
          </div>
        </fieldset>
      </section>
      {isEnabled("screenCapture") ? (
        <Placeholder
          Icon={MonitorPlay}
          title="Screen captures"
          text="Capture the running app for window scenes."
        />
      ) : null}
      {isEnabled("generatedMedia") ? (
        <Placeholder Icon={Sparkles} title="Generated media" text="Imagery generated for a scene." />
      ) : null}
      <p className="text-xs leading-relaxed text-ink-faint">
        Everything shown in a Cutroom video comes from the repository: names, code, commands and numbers.
        There is no stock footage to add.
      </p>
    </EditorPanel>
  );
}
