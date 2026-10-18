import { createInterface } from "node:readline/promises";
import { findApprovalBlockers, formatAuditTable } from "@cutroom/claim-audit";
import type { ApproveStoryboardInput, RunRecord, StoryboardVersion } from "@cutroom/pipeline";
import type { ClaimOverride, Scene } from "@cutroom/scene-spec";

function describeScene(scene: Scene): string {
  switch (scene.block) {
    case "title-card":
      return `${scene.props.name}: ${scene.props.tagline}`;
    case "kinetic-headline":
      return scene.props.lines.join(" / ");
    case "big-number":
      return `${scene.props.value} ${scene.props.label}`;
    case "feature-cards":
      return scene.props.cards.map((card) => card.title).join(" · ");
    case "code-card":
      return `${scene.props.filePath}:${scene.props.lineStart}-${scene.props.lineEnd}`;
    case "terminal":
      return scene.props.commands.map((command) => `$ ${command.command}`).join(" ; ");
    case "word-slot":
      return `${scene.props.lead} ${scene.props.items.join(" | ")}`;
    case "screenshot-window":
      return `${scene.props.screenId}${scene.props.focusText ? ` → "${scene.props.focusText}"` : ""}`;
    case "diagram-flow":
      return scene.props.nodes.map((node) => node.label).join(" → ");
    case "end-card":
      return `${scene.props.name} · ${scene.props.cta}`;
  }
}

export function printStoryboard(version: StoryboardVersion): void {
  console.log(`\nStoryboard v${version.version}: ${version.storyboard.title} (${version.storyboard.look})`);
  version.storyboard.scenes.forEach((scene, index) => {
    console.log(`  ${String(index + 1).padStart(2)}. [${scene.block}] ${describeScene(scene)}`);
    for (const line of scene.narration) console.log(`        “${line.text}”`);
  });
  const sceneNumbers = new Map(version.storyboard.scenes.map((scene, index) => [scene.id, index + 1]));
  console.log(`\nClaim audit\n${formatAuditTable(version.claimResults, sceneNumbers)}\n`);
}

/** Terminal approval (FR-HR-1): approve, override each unsupported claim with a reason, or stop. */
export async function promptForApproval(
  version: StoryboardVersion,
): Promise<ApproveStoryboardInput | undefined> {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const blockers = findApprovalBlockers(version.claimResults, []);
    const overrides: ClaimOverride[] = [];
    if (blockers.length > 0) {
      console.log(
        `${blockers.length} claim(s) are unsupported. Override each with a reason, or press Enter to stop and edit.`,
      );
      for (const blocker of blockers) {
        const reason = (await terminal.question(`  Override “${blocker.claimText}” because: `)).trim();
        if (reason.length < 8) {
          console.log("Stopped. Edit the storyboard (web app) or re-run with a different preset.");
          return undefined;
        }
        overrides.push({ claimId: blocker.claimId, reason });
      }
    }
    const answer = (await terminal.question("Approve this storyboard and render? [y/N] "))
      .trim()
      .toLowerCase();
    return answer === "y" || answer === "yes" ? { versionId: version.id, overrides } : undefined;
  } finally {
    terminal.close();
  }
}

export function printEgressManifest(egress: NonNullable<RunRecord["egress"]>): void {
  console.log("\nHybrid mode: this bundle is all that will leave this machine.");
  for (const file of egress.manifest.files)
    console.log(`  ${file.path.padEnd(48)} ${file.kind.padEnd(11)} ${(file.bytes / 1024).toFixed(1)} KB`);
  if (egress.manifest.codeExcerpts.length > 0) {
    console.log("  Code shown on screen:");
    for (const excerpt of egress.manifest.codeExcerpts)
      console.log(`    ${excerpt.filePath}:${excerpt.lineStart}-${excerpt.lineEnd}`);
  }
  console.log(`  manifest sha256 ${egress.manifestSha256}\n`);
}

/** Hybrid: explicit consent before upload (FR-PRV-3). */
export async function promptForEgress(): Promise<boolean> {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await terminal.question("Upload exactly this bundle to the render API? [y/N] "))
      .trim()
      .toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    terminal.close();
  }
}
