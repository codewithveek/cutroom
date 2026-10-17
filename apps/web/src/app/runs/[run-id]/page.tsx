import type React from "react";
import { RunWorkspace } from "@/features/render-queue/run-workspace";

export default async function RunPage(props: {
  params: Promise<{ "run-id": string }>;
}): Promise<React.ReactElement> {
  const params = await props.params;
  return <RunWorkspace runId={params["run-id"]} />;
}
