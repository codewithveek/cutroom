import { stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ulid } from "ulid";
import { buildDeliveryNote } from "../delivery-note";
import type { StepFunction } from "./step-context";

/** Step 7b: the delivery note, written next to the videos. */
export const finalizeStep: StepFunction = async (context, run) => {
  if (run.assets.some((asset) => asset.kind === "delivery-note")) return { skipped: true };
  const notePath = path.join(context.runDirectory, "deliverables", "delivery-note.md");
  await writeFile(notePath, buildDeliveryNote(run));
  const { size } = await stat(notePath);
  await context.updateRun((current) => ({
    ...current,
    assets: [
      ...current.assets,
      { id: ulid(), kind: "delivery-note", version: 1, filePath: notePath, bytes: size },
    ],
  }));
  return { payload: { deliveryNote: notePath } };
};
