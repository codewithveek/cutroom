import type React from "react";
import { LibraryGrid } from "@/features/library/library-grid";

export default function LibraryPage(): React.ReactElement {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <h1 className="mb-6 text-xl font-semibold tracking-tight">Library</h1>
      <LibraryGrid />
    </div>
  );
}
