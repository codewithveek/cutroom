"use client";

import { type ClaimResult, type Scene, sceneSchemaByBlock } from "@cutroom/scene-spec";
import { RefreshCw } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { VerdictBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, TextInput } from "@/components/ui/field";
import { type JsonSchemaNode, SchemaField } from "./schema-form";

function propsJsonSchema(block: Scene["block"]): JsonSchemaNode {
  const propsSchema = sceneSchemaByBlock[block].shape.props;
  return z.toJSONSchema(propsSchema, { io: "input", unrepresentable: "any" }) as JsonSchemaNode;
}

export function NarrationEditor(props: {
  scene: Scene;
  onChange: (path: string, value: unknown) => void;
}): React.ReactElement {
  return (
    <fieldset className="space-y-3">
      <legend className="text-xs font-medium text-ink-muted">Narration</legend>
      {props.scene.narration.map((line, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: narration lines are edited by position
          key={`${props.scene.id}-narration-${index}`}
          className="space-y-2 rounded-md border border-line p-3"
        >
          <div>
            <Label htmlFor={`narration-${index}-text`} hint="captions">
              Line {index + 1}
            </Label>
            <TextInput
              id={`narration-${index}-text`}
              value={line.text}
              onChange={(event) => props.onChange(`narration.${index}.text`, event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor={`narration-${index}-say`} hint="respelt for the voice">
              Say
            </Label>
            <TextInput
              id={`narration-${index}-say`}
              value={line.say ?? ""}
              placeholder={line.text}
              onChange={(event) => props.onChange(`narration.${index}.say`, event.target.value || undefined)}
            />
          </div>
        </div>
      ))}
    </fieldset>
  );
}

export function ClaimDetails(props: {
  claims: ReadonlyArray<ClaimResult>;
  onApply: (fieldPath: string, suggestion: string) => void;
}): React.ReactElement {
  if (props.claims.length === 0)
    return <p className="text-xs text-ink-faint">No claims in this scene yet. Save to audit.</p>;
  return (
    <ul className="space-y-2">
      {props.claims.map((claim) => (
        <li key={claim.claimId} className="rounded-md border border-line p-3 text-xs">
          <div className="flex items-start justify-between gap-2">
            <span className="text-ink">“{claim.claimText}”</span>
            <VerdictBadge verdict={claim.verdict} />
          </div>
          {claim.evidence[0] ? (
            <p className="mt-1.5 font-mono text-[11px] text-ink-faint">
              {claim.evidence[0].filePath}:{claim.evidence[0].lineStart}
            </p>
          ) : null}
          {claim.verdict !== "supported" ? (
            <p className="mt-1.5 text-ink-muted">{claim.checks.find((check) => !check.passed)?.detail}</p>
          ) : null}
          {claim.suggestion && claim.verdict !== "supported" ? (
            <div className="mt-2 flex items-center justify-between gap-2 rounded bg-panel-raised px-2 py-1.5">
              <span className="text-ink-muted">{claim.suggestion}</span>
              {claim.fieldPath.startsWith("props.") || claim.fieldPath.startsWith("narration.") ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => props.onApply(claim.fieldPath, claim.suggestion ?? "")}
                >
                  Apply suggestion
                </Button>
              ) : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function RegenerateControl(props: {
  busy: boolean;
  onRegenerate: (instruction: string) => void;
}): React.ReactElement {
  const [instruction, setInstruction] = useState("");
  return (
    <div className="flex gap-2">
      <TextInput
        aria-label="Direction for the new version"
        placeholder="Optional direction, e.g. show the CLI"
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
      />
      <Button size="md" onClick={() => props.onRegenerate(instruction.trim())} disabled={props.busy}>
        <RefreshCw className="size-3.5" aria-hidden="true" /> Regenerate
      </Button>
    </div>
  );
}

/** The block's props as a form generated from its Zod schema. */
export function SceneFields(props: {
  scene: Scene;
  onChange: (path: string, value: unknown) => void;
}): React.ReactElement {
  const schema = useMemo(() => propsJsonSchema(props.scene.block), [props.scene.block]);
  return (
    <SchemaField
      schema={schema}
      value={props.scene.props}
      path="props"
      label="props"
      onChange={props.onChange}
    />
  );
}
