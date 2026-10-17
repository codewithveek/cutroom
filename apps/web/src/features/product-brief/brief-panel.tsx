"use client";

import type { Evidence, ProductBrief } from "@cutroom/scene-spec";
import { FileCode2 } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { SideSheet } from "@/components/ui/side-sheet";

function EvidenceChip(props: {
  evidence: Evidence;
  onOpen: (evidence: Evidence) => void;
}): React.ReactElement {
  const { evidence } = props;
  return (
    <button
      type="button"
      onClick={() => props.onOpen(evidence)}
      className="inline-flex items-center gap-1 rounded border border-line bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-ink-muted hover:border-accent hover:text-ink"
    >
      <FileCode2 className="size-3" aria-hidden="true" />
      {evidence.filePath}:{evidence.lineStart}
    </button>
  );
}

export function EvidenceViewer(props: {
  evidence: Evidence | undefined;
  onClose: () => void;
}): React.ReactElement {
  const { evidence } = props;
  return (
    <SideSheet
      title={evidence ? `${evidence.filePath}:${evidence.lineStart}-${evidence.lineEnd}` : ""}
      open={evidence !== undefined}
      onClose={props.onClose}
    >
      {evidence ? (
        <pre className="overflow-x-auto rounded-lg border border-line bg-canvas p-4 font-mono text-xs leading-relaxed">
          {evidence.excerpt.split("\n").map((line, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: lines of a fixed excerpt
            <div key={`${index}-${line}`} className="flex gap-4">
              <span className="w-8 shrink-0 select-none text-right text-ink-faint">
                {evidence.lineStart + index}
              </span>
              <span className="bg-accent/10">{line || " "}</span>
            </div>
          ))}
        </pre>
      ) : null}
    </SideSheet>
  );
}

/** Name, pitch, audience and features, each with evidence chips (PRD §9 screen 3). */
export function BriefPanel(props: { brief: ProductBrief }): React.ReactElement {
  const { brief } = props;
  const [openEvidence, setOpenEvidence] = useState<Evidence>();
  return (
    <Card>
      <CardHeader title={`${brief.name} · product brief`} description={brief.tagline} />
      <div className="grid gap-4 p-5 md:grid-cols-3">
        {(
          [
            ["Audience", brief.audience],
            ["Problem", brief.problem],
            ["Promise", brief.promise],
          ] as const
        ).map(([label, text]) => (
          <div key={label}>
            <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</div>
            <p className="mt-1 text-sm">{text}</p>
          </div>
        ))}
      </div>
      <ul className="grid gap-3 border-t border-line p-5 md:grid-cols-2">
        {brief.features.map((feature) => (
          <li key={feature.title} className="rounded-lg border border-line bg-panel-raised p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              {feature.title}
              {feature.strength === "weak" ? (
                <Badge className="border-weak/40 text-weak">weak evidence</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-ink-muted">{feature.description}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {feature.evidence.map((evidence) => (
                <EvidenceChip
                  key={`${evidence.filePath}:${evidence.lineStart}`}
                  evidence={evidence}
                  onOpen={setOpenEvidence}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
      <EvidenceViewer evidence={openEvidence} onClose={() => setOpenEvidence(undefined)} />
    </Card>
  );
}
