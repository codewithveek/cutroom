import type React from "react";
import { RunEditor } from "@/features/editor/run-editor";

export default async function RunPage(props: {
  params: Promise<{ "run-id": string }>;
}): Promise<React.ReactElement> {
  const params = await props.params;
  return <RunEditor runId={params["run-id"]} />;
}
