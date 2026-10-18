"use client";

import type { ProductBrief } from "@cutroom/scene-spec";
import { Trash2 } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, TextArea, TextInput } from "@/components/ui/field";

type TextField = "name" | "tagline" | "audience" | "problem" | "promise";

const fields: ReadonlyArray<{ key: TextField; label: string; max: number; multiline: boolean }> = [
  { key: "name", label: "Product name", max: 40, multiline: false },
  { key: "tagline", label: "Tagline", max: 90, multiline: false },
  { key: "audience", label: "Audience", max: 160, multiline: true },
  { key: "problem", label: "Problem", max: 240, multiline: true },
  { key: "promise", label: "Promise", max: 240, multiline: true },
];

/**
 * Edit the brief's words and drop features; evidence is kept as found and re-verified on save, so
 * the new storyboard can only stand on what the code shows.
 */
export function BriefEditor(props: {
  brief: ProductBrief;
  busy: boolean;
  onSave: (brief: ProductBrief) => void;
}): React.ReactElement {
  const [draft, setDraft] = useState<ProductBrief>(props.brief);
  const dirty = JSON.stringify(draft) !== JSON.stringify(props.brief);
  const setField = (key: TextField, value: string) => setDraft({ ...draft, [key]: value });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        props.onSave(draft);
      }}
      className="space-y-4"
    >
      <p className="text-sm text-ink-muted">
        Saving re-plans the storyboard from this brief as a new version and audits it again. Evidence stays as
        found in the code.
      </p>
      {fields.map((field) => (
        <div key={field.key}>
          <Label htmlFor={`brief-${field.key}`} hint={`${draft[field.key].length}/${field.max}`}>
            {field.label}
          </Label>
          {field.multiline ? (
            <TextArea
              id={`brief-${field.key}`}
              maxLength={field.max}
              value={draft[field.key]}
              onChange={(event) => setField(field.key, event.target.value)}
            />
          ) : (
            <TextInput
              id={`brief-${field.key}`}
              maxLength={field.max}
              value={draft[field.key]}
              onChange={(event) => setField(field.key, event.target.value)}
            />
          )}
        </div>
      ))}
      <fieldset className="space-y-3">
        <legend className="mb-1.5 text-xs font-medium text-ink-muted">Features</legend>
        {draft.features.map((feature, index) => (
          <div
            key={`${feature.title}-${index.toString()}`}
            className="space-y-2 rounded-xl border border-line p-3"
          >
            <div className="flex items-center gap-2">
              <TextInput
                aria-label={`Feature ${index + 1} title`}
                maxLength={48}
                value={feature.title}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    features: draft.features.map((candidate, position) =>
                      position === index ? { ...candidate, title: event.target.value } : candidate,
                    ),
                  })
                }
              />
              <button
                type="button"
                aria-label={`Remove feature ${index + 1}`}
                disabled={draft.features.length <= 1}
                onClick={() =>
                  setDraft({ ...draft, features: draft.features.filter((_, position) => position !== index) })
                }
                className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-faint hover:text-unsupported disabled:opacity-30"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
            <TextArea
              aria-label={`Feature ${index + 1} description`}
              maxLength={240}
              value={feature.description}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  features: draft.features.map((candidate, position) =>
                    position === index ? { ...candidate, description: event.target.value } : candidate,
                  ),
                })
              }
            />
            <p className="font-mono text-[11px] text-ink-faint">
              {feature.evidence.map((evidence) => `${evidence.filePath}:${evidence.lineStart}`).join(" · ") ||
                "no verified evidence (weak)"}
            </p>
          </div>
        ))}
      </fieldset>
      <Button type="submit" variant="primary" disabled={!dirty || props.busy}>
        {props.busy ? "Re-planning…" : "Save and re-plan"}
      </Button>
    </form>
  );
}
