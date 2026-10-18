"use client";

import { type CapturedScreen, screenshotAssetKey } from "@cutroom/scene-spec";
import { ImageOff, MonitorPlay, Plus, ShieldCheck, Sparkles } from "lucide-react";
import type React from "react";
import { Label, TextInput } from "@/components/ui/field";
import { apiClient } from "@/lib/api-client";
import { isEnabled } from "@/lib/capabilities";
import { useEditor } from "../editor-context";
import { EditorPanel } from "../editor-panel";
import { insertScreenScene, setBrandAccent } from "../model/storyboard-edits";

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

function CapturedScreenCard(props: { screen: CapturedScreen }): React.ReactElement {
  const editor = useEditor();
  const { screen } = props;
  const media = editor.run.media.find((item) => item.assetKey === screenshotAssetKey(screen.id));
  const shownIn = editor.draft.storyboard.scenes.filter(
    (scene) => scene.block === "screenshot-window" && scene.props.screenId === screen.id,
  ).length;
  return (
    <li className="overflow-hidden rounded-xl border border-line bg-panel-raised">
      {media ? (
        // biome-ignore lint/performance/noImgElement: served by the local API
        <img
          src={apiClient.assetUrl(media.url)}
          alt={`Screenshot of ${screen.route}`}
          className="aspect-[16/10] w-full border-b border-line object-cover object-top"
        />
      ) : null}
      <div className="flex items-start gap-2 p-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-xs">{screen.route}</div>
          <div className="truncate text-[11px] text-ink-faint">
            {screen.title || "Untitled"} · {screen.targets.length} focusable
            {shownIn > 0 ? ` · in ${shownIn} scene${shownIn === 1 ? "" : "s"}` : ""}
          </div>
        </div>
        <button
          type="button"
          disabled={!editor.editable}
          onClick={() =>
            editor.applyEdit((storyboard) =>
              insertScreenScene({ storyboard, afterSceneId: editor.selectedSceneId, screen }),
            )
          }
          className="flex shrink-0 items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] text-ink-muted hover:border-line-strong hover:text-ink disabled:opacity-40"
        >
          <Plus className="size-3" aria-hidden="true" /> Scene
        </button>
      </div>
    </li>
  );
}

/** Screens captured from the running app (FR-CAP-1), ready to drop in as window scenes. */
function CapturedScreens(): React.ReactElement {
  const editor = useEditor();
  const capture = editor.run.capture;
  if (!capture || capture.screens.length === 0) {
    return (
      <Placeholder
        Icon={MonitorPlay}
        title="Screen captures"
        text="Give the app's URL and routes when you start a video to show real screens in window scenes."
      />
    );
  }
  const redactions = capture.screens.reduce((sum, screen) => sum + screen.redactions, 0);
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium text-ink-muted">Screen captures</h3>
      <ul className="grid gap-2">
        {capture.screens.map((screen) => (
          <CapturedScreenCard key={screen.id} screen={screen} />
        ))}
      </ul>
      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-faint">
        <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        Captured read-only from {new URL(capture.appUrl).host}: {capture.blockedRequests} write request
        {capture.blockedRequests === 1 ? "" : "s"} blocked, {redactions} secret
        {redactions === 1 ? "" : "s"} redacted.
      </p>
    </section>
  );
}

/** The brand the video wears (logo, name, accent colour) and the app screens captured for it. */
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
      {isEnabled("screenCapture") ? <CapturedScreens /> : null}
      {isEnabled("generatedMedia") ? (
        <Placeholder Icon={Sparkles} title="Generated media" text="Imagery generated for a scene." />
      ) : null}
      <p className="text-xs leading-relaxed text-ink-faint">
        Everything shown in a Cutroom video comes from the repository and the running app: names, code,
        commands, numbers and real screens. There is no stock footage to add.
      </p>
    </EditorPanel>
  );
}
