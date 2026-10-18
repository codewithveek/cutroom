import { type PresetId, presetIdSchema } from "@cutroom/presets";
import type React from "react";
import { NewVideoWizard } from "@/features/new-video/new-video-wizard";

export default async function NewVideoPage(props: {
  searchParams: Promise<{ preset?: string | string[] }>;
}): Promise<React.ReactElement> {
  const { preset } = await props.searchParams;
  const parsed = presetIdSchema.safeParse(preset);
  const initialPresetId: PresetId | undefined = parsed.success ? parsed.data : undefined;
  return (
    <div className="min-h-full rounded-2xl bg-panel/40">
      <NewVideoWizard {...(initialPresetId ? { initialPresetId } : {})} />
    </div>
  );
}
