"use client";

import type { AspectRatio, LookId } from "@cutroom/scene-spec";
import { lookTokensById } from "@cutroom/video-kit";
import type React from "react";
import { RatioIcon } from "@/components/ui/ratio-icon";
import { ClaimDetails } from "@/features/storyboard/scene-fields";
import { lookIds } from "@/features/video-preview/look-preview";
import { VoiceList } from "@/features/voice/voice-list";
import { apiClient } from "@/lib/api-client";
import { classNames } from "@/lib/class-names";
import { useVoices } from "@/lib/use-voices";
import { useEditor } from "../editor-context";
import { setLook } from "../model/storyboard-edits";
import { useSelectedScene } from "../use-selected-scene";

function Section(props: {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[15px] font-medium">{props.title}</h2>
        {props.aside}
      </div>
      {props.children}
    </section>
  );
}

function SubHeading(props: { children: React.ReactNode }): React.ReactElement {
  return <h3 className="mt-4 mb-2 text-xs text-ink-faint first:mt-0">{props.children}</h3>;
}

function Voiceover(): React.ReactElement {
  const editor = useEditor();
  const voices = useVoices();
  const { voice } = editor.run.request;
  const usesKokoro = voice.provider === "kokoro";
  return (
    <Section
      title="Voiceover"
      aside={<span className="text-[11px] text-ink-faint">Kokoro · on this machine</span>}
    >
      {voices ? (
        <div className="max-h-56 overflow-y-auto pr-1">
          <VoiceList
            voices={voices}
            selectedVoiceId={usesKokoro ? voice.voiceId : undefined}
            disabled={Boolean(editor.run.approval) || editor.busy}
            onSelect={(option) =>
              void editor.runAction(() =>
                apiClient.updateSettings(editor.run.id, {
                  voice: { provider: "kokoro", voiceId: option.id, speed: voice.speed },
                }),
              )
            }
          />
        </div>
      ) : (
        <p className="text-sm text-ink-faint">Loading voices…</p>
      )}
      {editor.run.approval ? (
        <p className="mt-2 text-[11px] text-ink-faint">The voice is fixed once the storyboard is approved.</p>
      ) : null}
    </Section>
  );
}

function LookSwatch(props: { look: LookId }): React.ReactElement {
  const tokens = lookTokensById[props.look];
  return (
    <span
      aria-hidden="true"
      className="relative size-6 shrink-0 overflow-hidden rounded-md border border-line"
      style={{ background: tokens.colors.ground }}
    >
      <span
        className="absolute right-0.5 bottom-0.5 size-2.5 rounded-full"
        style={{ background: tokens.colors.accent }}
      />
    </span>
  );
}

function VisualStyle(): React.ReactElement {
  const editor = useEditor();
  const { storyboard } = editor.draft;
  const ratios = editor.run.request.ratios;
  return (
    <Section title="Visual Style">
      <SubHeading>Look</SubHeading>
      <div className="flex flex-wrap gap-1.5">
        {lookIds.map((look) => (
          <button
            key={look}
            type="button"
            aria-pressed={storyboard.look === look}
            disabled={!editor.editable}
            onClick={() => editor.applyEdit((current) => setLook(current, look))}
            className={classNames(
              "flex items-center gap-2 rounded-lg border py-1 pr-3 pl-1 text-sm transition-colors disabled:opacity-60",
              storyboard.look === look
                ? "border-accent/70 bg-accent-soft text-ink"
                : "border-transparent bg-panel-raised text-ink-muted hover:text-ink",
            )}
          >
            <LookSwatch look={look} />
            {lookTokensById[look].label}
          </button>
        ))}
      </div>
      <SubHeading>Aspect ratio · preview</SubHeading>
      <fieldset className="flex rounded-xl bg-panel-raised p-1">
        <legend className="sr-only">Preview aspect ratio</legend>
        {(["16:9", "9:16", "1:1", "4:5"] as const satisfies ReadonlyArray<AspectRatio>).map((ratio) => (
          <button
            key={ratio}
            type="button"
            aria-pressed={editor.ratio === ratio}
            title={ratios.includes(ratio) ? `${ratio} · rendered` : `${ratio} · preview only`}
            onClick={() => editor.setRatio(ratio)}
            className={classNames(
              "flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 transition-colors",
              editor.ratio === ratio ? "bg-panel-hover text-ink" : "text-ink-faint hover:text-ink",
            )}
          >
            <RatioIcon ratio={ratio} className="size-5" />
            <span className="font-mono text-[10px]">{ratio}</span>
            <span
              className={classNames(
                "size-1 rounded-full",
                ratios.includes(ratio) ? "bg-accent" : "bg-transparent",
              )}
              aria-hidden="true"
            />
          </button>
        ))}
      </fieldset>
      <p className="mt-2 text-[11px] text-ink-faint">Dotted ratios are rendered: {ratios.join(", ")}.</p>
    </Section>
  );
}

function ClaimAudit(): React.ReactElement {
  const editor = useEditor();
  const { scene, update } = useSelectedScene();
  const claims = (editor.run.storyboard?.claimResults ?? []).filter((claim) => claim.sceneId === scene?.id);
  const unsupported = editor.run.storyboard?.unsupportedCount ?? 0;
  return (
    <Section
      title="Claim audit"
      aside={
        <span className={classNames("text-[11px]", unsupported > 0 ? "text-unsupported" : "text-ink-faint")}>
          {unsupported > 0 ? `${unsupported} unsupported in the video` : "Nothing unsupported"}
        </span>
      }
    >
      {editor.draft.dirty ? (
        <p className="mb-2 text-[11px] text-weak">Unsaved edits are audited when you save.</p>
      ) : null}
      <ClaimDetails claims={claims} onApply={(fieldPath, suggestion) => update(fieldPath, suggestion)} />
    </Section>
  );
}

/** The right column: who speaks, how it looks, and whether this scene's claims hold up. */
export function InspectorPanel(): React.ReactElement {
  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
      <Voiceover />
      <VisualStyle />
      <ClaimAudit />
    </div>
  );
}
