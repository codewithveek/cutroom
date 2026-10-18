"use client";

import type { ClaimOverride, ClaimResult } from "@cutroom/scene-spec";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, TextInput } from "@/components/ui/field";
import { SideSheet } from "@/components/ui/side-sheet";

const MINIMUM_REASON_LENGTH = 8;

/**
 * Unsupported claims block approval until fixed, or overridden with a typed reason that the
 * delivery note will list (FR-CA-4).
 */
export function OverridesSheet(props: {
  open: boolean;
  onClose: () => void;
  unsupportedClaims: ReadonlyArray<ClaimResult>;
  onApprove: (overrides: ClaimOverride[]) => void;
}): React.ReactElement {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const allReasoned = props.unsupportedClaims.every(
    (claim) => (reasons[claim.claimId]?.trim().length ?? 0) >= MINIMUM_REASON_LENGTH,
  );
  return (
    <SideSheet title="Override unsupported claims" open={props.open} onClose={props.onClose}>
      <p className="mb-4 text-sm text-ink-muted">
        Fix the scene, or say why each claim may stay. Overrides are stored on the run and printed in the
        delivery note.
      </p>
      <div className="space-y-4">
        {props.unsupportedClaims.map((claim) => (
          <div key={claim.claimId}>
            <Label htmlFor={`override-${claim.claimId}`}>“{claim.claimText}”</Label>
            <p className="mb-1.5 text-xs text-ink-faint">
              {claim.checks.find((check) => !check.passed)?.detail}
            </p>
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
      <Button
        className="mt-6"
        variant="danger"
        disabled={!allReasoned}
        onClick={() =>
          props.onApprove(
            props.unsupportedClaims.map((claim) => ({
              claimId: claim.claimId,
              reason: (reasons[claim.claimId] ?? "").trim(),
            })),
          )
        }
      >
        Approve with overrides
      </Button>
    </SideSheet>
  );
}
