"use client";

import { Minus, Plus } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Label, Select, TextArea, TextInput } from "@/components/ui/field";

/** The subset of JSON Schema that Zod emits for block props. */
export interface JsonSchemaNode {
  type?: string;
  enum?: ReadonlyArray<string>;
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  description?: string;
}

export interface SchemaFieldProps {
  schema: JsonSchemaNode;
  value: unknown;
  path: string;
  label: string;
  onChange: (path: string, value: unknown) => void;
}

function inputId(path: string): string {
  return `field-${path.replaceAll(".", "-")}`;
}

function StringField(props: SchemaFieldProps): React.ReactElement {
  const id = inputId(props.path);
  const text = typeof props.value === "string" ? props.value : "";
  const limit = props.schema.maxLength;
  const Control = limit && limit > 70 ? TextArea : TextInput;
  return (
    <div>
      <Label htmlFor={id} {...(limit ? { hint: `${text.length}/${limit}` } : {})}>
        {props.label}
      </Label>
      <Control
        id={id}
        value={text}
        maxLength={limit}
        onChange={(event) => props.onChange(props.path, event.target.value)}
      />
    </div>
  );
}

function ArrayField(props: SchemaFieldProps): React.ReactElement {
  const items = Array.isArray(props.value) ? props.value : [];
  const itemSchema = props.schema.items ?? { type: "string" };
  const canAdd = props.schema.maxItems === undefined || items.length < props.schema.maxItems;
  const canRemove = items.length > (props.schema.minItems ?? 0);
  const emptyItem = itemSchema.type === "object" ? {} : "";
  return (
    <fieldset className="space-y-2 rounded-md border border-line p-3">
      <legend className="px-1 text-xs font-medium text-ink-muted">{props.label}</legend>
      {items.map((item, index) => (
        <div key={`${props.path}.${index}`} className="flex items-start gap-2">
          <div className="flex-1">
            <SchemaField
              schema={itemSchema}
              value={item}
              path={`${props.path}.${index}`}
              label={`${props.label} ${index + 1}`}
              onChange={props.onChange}
            />
          </div>
          <button
            type="button"
            aria-label={`Remove ${props.label} ${index + 1}`}
            disabled={!canRemove}
            onClick={() =>
              props.onChange(
                props.path,
                items.filter((_, itemIndex) => itemIndex !== index),
              )
            }
            className="mt-6 rounded p-1 text-ink-faint hover:text-unsupported disabled:opacity-30"
          >
            <Minus className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ))}
      {canAdd ? (
        <Button size="sm" variant="ghost" onClick={() => props.onChange(props.path, [...items, emptyItem])}>
          <Plus className="size-3.5" aria-hidden="true" /> Add
        </Button>
      ) : null}
    </fieldset>
  );
}

/** Renders a form for one JSON Schema node; the props form is generated from the block's Zod schema (PRD §9). */
export function SchemaField(props: SchemaFieldProps): React.ReactElement | null {
  const { schema } = props;
  const id = inputId(props.path);
  if (schema.enum) {
    return (
      <div>
        <Label htmlFor={id}>{props.label}</Label>
        <Select
          id={id}
          value={String(props.value ?? "")}
          onChange={(event) => props.onChange(props.path, event.target.value)}
        >
          {schema.enum.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </div>
    );
  }
  if (schema.type === "string") return <StringField {...props} />;
  if (schema.type === "number" || schema.type === "integer") {
    return (
      <div>
        <Label htmlFor={id}>{props.label}</Label>
        <TextInput
          id={id}
          type="number"
          value={String(props.value ?? 0)}
          onChange={(event) => props.onChange(props.path, Number(event.target.value))}
        />
      </div>
    );
  }
  if (schema.type === "boolean") {
    return (
      <label htmlFor={id} className="flex items-center gap-2 text-sm">
        <input
          id={id}
          type="checkbox"
          checked={props.value === true}
          onChange={(event) => props.onChange(props.path, event.target.checked)}
        />
        {props.label}
      </label>
    );
  }
  if (schema.type === "array") return <ArrayField {...props} />;
  if (schema.type === "object" && schema.properties) {
    const record =
      props.value && typeof props.value === "object" ? (props.value as Record<string, unknown>) : {};
    return (
      <div className="space-y-3">
        {Object.entries(schema.properties).map(([key, childSchema]) => (
          <SchemaField
            key={key}
            schema={childSchema}
            value={record[key]}
            path={`${props.path}.${key}`}
            label={key}
            onChange={props.onChange}
          />
        ))}
      </div>
    );
  }
  return null;
}
