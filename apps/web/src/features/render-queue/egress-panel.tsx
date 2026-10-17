"use client";

import { ShieldCheck } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { apiClient, type RunView } from "@/lib/api-client";

/** Hybrid mode: every file and code excerpt in the upload, confirmed before anything leaves (FR-PRV-3). */
export function EgressPanel(props: {
  run: RunView;
  onRunChange: (run: RunView) => void;
}): React.ReactElement | null {
  const { egress } = props.run;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (!egress) return null;
  const totalBytes = egress.manifest.files.reduce((sum, file) => sum + file.bytes, 0);
  const confirm = async () => {
    setBusy(true);
    try {
      props.onRunChange(await apiClient.confirmEgress(props.run.id, egress.manifestSha256));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setBusy(false);
    }
  };
  return (
    <Card className="border-accent/50">
      <CardHeader
        title="Egress manifest"
        description={`Hybrid mode uploads only this bundle to the render API: ${egress.manifest.files.length} files, ${(totalBytes / 1024).toFixed(0)} KB. No source files are included.`}
      />
      <div className="space-y-4 p-5">
        <table className="w-full text-left text-xs">
          <thead className="text-ink-faint">
            <tr>
              <th className="pb-2 font-medium">File</th>
              <th className="pb-2 font-medium">Kind</th>
              <th className="pb-2 text-right font-medium">Size</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {egress.manifest.files.map((file) => (
              <tr key={file.path} className="border-t border-line">
                <td className="py-1.5">{file.path}</td>
                <td className="py-1.5 text-ink-muted">{file.kind}</td>
                <td className="py-1.5 text-right text-ink-muted">{(file.bytes / 1024).toFixed(1)} KB</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-xs">
          <div className="mb-1 text-ink-faint">Code excerpts shown on screen</div>
          {egress.manifest.codeExcerpts.length === 0 ? (
            <p className="text-ink-muted">None.</p>
          ) : (
            <ul className="space-y-0.5 font-mono text-ink-muted">
              {egress.manifest.codeExcerpts.map((excerpt) => (
                <li key={`${excerpt.sceneId}-${excerpt.filePath}`}>
                  {excerpt.filePath}:{excerpt.lineStart}-{excerpt.lineEnd}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-[11px] text-ink-faint">sha256 {egress.manifestSha256}</p>
          <Button variant="primary" onClick={() => void confirm()} disabled={busy}>
            <ShieldCheck className="size-4" aria-hidden="true" /> Upload this bundle
          </Button>
        </div>
        {error ? <p className="text-sm text-unsupported">{error}</p> : null}
      </div>
    </Card>
  );
}
