import { Captions, Clapperboard, type LucideIcon, Music2, ScrollText, Type, Wand2 } from "lucide-react";
import type { Capability } from "@/lib/capabilities";

export type EditorTabId = "script" | "media" | "text" | "audio" | "captions" | "transitions";

export interface EditorTab {
  id: EditorTabId;
  label: string;
  Icon: LucideIcon;
  requires?: Capability;
}

/** The left panel's modes, in the order of the design's top bar. */
export const editorTabs: ReadonlyArray<EditorTab> = [
  { id: "script", label: "Script", Icon: ScrollText },
  { id: "media", label: "Media", Icon: Clapperboard },
  { id: "text", label: "Text", Icon: Type },
  { id: "audio", label: "Audio", Icon: Music2 },
  { id: "captions", label: "Captions", Icon: Captions },
  { id: "transitions", label: "Transitions", Icon: Wand2 },
];
