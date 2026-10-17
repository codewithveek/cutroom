"use client";

import type { ClaimOverride, ClaimResult } from "@cutroom/scene-spec";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, TextInput } from "@/components/ui/field";
import { SideSheet } from "@/components/ui/side-sheet";

export interface ApprovalFooterProps {
  unsupportedClaims: ReadonlyArray<ClaimResult>;
  dirty: boolean;
  busy: boolean;
  onSave: () => void;
  onApprove: (overrides: ClaimOverride[]) => void;
}

const MINIMUM_REASON_LENGTH = 8;

/**
 * Unsupported claims block approval until fixed, or overridden with a typed reason that the
 * delivery note will list (FR-CA-4).
 */
export function ApprovalFooter(props: ApprovalFooterProps): React.ReactElement {
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const allReasoned = props.unsupportedClaims.every(
    (claim) => (reasons[claim.claimId]?.trim().length ?? 0) >= MINIMUM_REASON_LENGTH,
  );
  const count = props.unsupportedClaims.length;
  const approveWithOverrides = () => {
    setOverrideOpen(false);
    props.onApprove(
      props.unsupportedClaims.map((claim) => ({
        claimId: claim.claimId,
        reason: (reasons[claim.claimId] ?? "").trim(),
      })),
    );
  };
  return (
    <div className="sticky bottom-0 z-20 flex items-center gap-3 border-t border-line bg-canvas/95 px-5 py-3 backdrop-blur">
      <p className={count > 0 ? "text-sm text-unsupported" : "text-sm text-ink-muted"}>
        {count > 0
          ? `${count} claim${count === 1 ? "" : "s"} need${count === 1 ? "s" : ""} evidence`
          : "Every claim is supported or weak."}
        {props.dirty ? <span className="ml-2 text-weak">Unsaved edits: save to re-audit.</span> : null}
      </p>
      <div className="ml-auto flex gap-2">
        <Button onClick={props.onSave} disabled={!props.dirty || props.busy}>
          Save and re-audit
        </Button>
        {count > 0 && !props.dirty ? (
          <Button variant="danger" onClick={() => setOverrideOpen(true)} disabled={props.busy}>
            Override {count}…
          </Button>
        ) : null}
        <Button
          variant="primary"
          onClick={() => props.onApprove([])}
          disabled={count > 0 || props.dirty || props.busy}
        >
          Approve and render
        </Button>
      </div>
      <SideSheet
        title="Override unsupported claims"
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
      >
        <p className="mb-4 text-sm text-ink-muted">
          Say why each claim may stay. Overrides are stored on the run and printed in the delivery note.
        </p>
        <div className="space-y-4">
          {props.unsupportedClaims.map((claim) => (
            <div key={claim.claimId}>
              <Label htmlFor={`override-${claim.claimId}`}>“{claim.claimText}”</Label>
              <TextInput
                id={`override-${claim.claimId}`}
                value={reasons[claim.claimId] ?? ""}
                placeholder="e.g. Shown as an illustrative mock-up"
                onChange={(event) =>
                  setReasons((previous) => ({ ...previous, [claim.claimId]: event.target.value }))
                }
              />
            </div>
          ))}
        </div>
        <Button className="mt-6" variant="danger" disabled={!allReasoned} onClick={approveWithOverrides}>
          Approve with overrides
        </Button>
      </SideSheet>
    </div>
  );
}
