# 0010 · Hybrid mode: one bundle, one hash, explicit consent

- **Status:** accepted · 2026-10-17

## Context
PRD P4 and FR-PRV-3/5/6: in Hybrid mode the approved `RenderJob` bundle is the only thing that crosses to the cloud, the user sees an egress manifest first, and the remote render API authenticates with a per-user token and deletes bundles 24 h after the job completes. The PRD's status list has no state for "waiting for egress consent".

## Decision
- A `build-render-job` step (Hybrid only) writes `render-job.json` plus `assets/<assetKey>` (voice clips, logo) into one directory, builds the manifest from that bundle alone (`buildEgressManifest`: every file with size and kind, every code excerpt shown on screen) and stores `sha256(canonicalManifestJson(manifest))` on the job.
- The run pauses in a new status, **`awaiting_egress`**, until `confirmEgress(runId, manifestSha256)`; a stale hash is refused. `autoApprove` (`--yes`) counts as consent and the CLI prints the manifest either way.
- The upload client is the only provider with role `render-upload`, the only external role Hybrid allows. It sends exactly the manifest's files; a test asserts this (FR-PRV-5).
- The render host recomputes the manifest from what it received, refuses missing, extra or hash-mismatched files, and refuses a manifest hash that differs from the job's. Finished jobs are swept after 24 h.
- Kokoro never downloads at run time outside Cloud mode, so Hybrid voice stays local.

## Consequences
- What the user confirmed and what the server rendered are provably the same bytes.
- Uploaded music is not yet supported in Hybrid (generated beds are synthesised on the render host).
