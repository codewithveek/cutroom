import type React from "react";
import { LibraryView } from "@/features/library/library-view";

export default function LibraryPage(): React.ReactElement {
  return (
    <LibraryView
      title="Library"
      description="Every video Cutroom has made or is making, newest first."
      initialFilter="all"
    />
  );
}
