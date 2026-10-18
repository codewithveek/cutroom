import type React from "react";
import { LibraryView } from "@/features/library/library-view";

export default function ActivityPage(): React.ReactElement {
  return (
    <LibraryView
      title="Activity"
      description="Runs in flight and runs waiting for you: storyboards to review, manifests to confirm."
      initialFilter="active"
    />
  );
}
