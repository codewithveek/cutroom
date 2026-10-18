import { FileText, FolderGit2, type LucideIcon } from "lucide-react";
import { type Capability, isEnabled } from "@/lib/capabilities";

export type SourceModeId = "repository" | "script";

export interface SourceMode {
  id: SourceModeId;
  label: string;
  placeholder: string;
  Icon: LucideIcon;
  requires?: Capability;
}

/**
 * Where a video starts. Today: a repository. Script-to-motion (a written script, no code) has its
 * slot here and appears when the `scriptSource` capability and its run contract land.
 */
export const sourceModes: ReadonlyArray<SourceMode> = [
  {
    id: "repository",
    label: "Repository",
    placeholder: "Path to a repository, or a git URL",
    Icon: FolderGit2,
  },
  {
    id: "script",
    label: "Script",
    placeholder: "Paste a script and Cutroom will storyboard it",
    Icon: FileText,
    requires: "scriptSource",
  },
];

export function availableSourceModes(): SourceMode[] {
  return sourceModes.filter((mode) => !mode.requires || isEnabled(mode.requires));
}
