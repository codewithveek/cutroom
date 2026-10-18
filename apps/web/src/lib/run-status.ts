import type { RunView } from "./api-client";

export const runStatusLabels: Readonly<Record<RunView["status"], string>> = {
  queued: "Queued",
  ingesting: "Reading the repository",
  analyzing: "Writing the brief",
  planning: "Planning the storyboard",
  auditing: "Auditing claims",
  awaiting_review: "Ready for your review",
  voicing: "Synthesising voice",
  awaiting_egress: "Confirm what leaves this machine",
  rendering: "Rendering",
  finalizing: "Finishing up",
  completed: "Done",
  failed: "Failed",
};
