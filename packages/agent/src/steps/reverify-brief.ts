import { type SnapshotReader, verifyEvidence } from "@cutroom/repo-ingest";
import type { ProductBrief } from "@cutroom/scene-spec";

/**
 * A user-edited brief keeps only evidence that still verifies against the snapshot, and a
 * feature with none left is marked weak (FR-ANA-3). Editing text can change emphasis, never facts.
 */
export async function reverifyBrief(options: {
  brief: ProductBrief;
  reader: SnapshotReader;
}): Promise<ProductBrief> {
  const features = await Promise.all(
    options.brief.features.map(async (feature) => {
      const checks = await Promise.all(
        feature.evidence.map((evidence) => verifyEvidence(options.reader, evidence)),
      );
      const evidence = checks.flatMap((check) => (check.status === "rejected" ? [] : [check.evidence]));
      return {
        ...feature,
        evidence,
        strength: evidence.length > 0 ? ("verified" as const) : ("weak" as const),
      };
    }),
  );
  return { ...options.brief, features };
}
