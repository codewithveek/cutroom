import type { BlockId } from "@cutroom/scene-spec";
import {
  AlignLeft,
  Code2,
  Flag,
  Hash,
  LayoutGrid,
  ListOrdered,
  Route,
  SquareTerminal,
  Type,
} from "lucide-react";
import type React from "react";

export const blockIcons: Readonly<Record<BlockId, React.ComponentType<{ className?: string }>>> = {
  "title-card": Type,
  "kinetic-headline": AlignLeft,
  "big-number": Hash,
  "feature-cards": LayoutGrid,
  "code-card": Code2,
  terminal: SquareTerminal,
  "word-slot": ListOrdered,
  "end-card": Flag,
  "diagram-flow": Route,
};
